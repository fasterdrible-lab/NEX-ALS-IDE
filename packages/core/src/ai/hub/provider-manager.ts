import { BaseProvider } from '../providers/base.provider.js'
import { AnthropicProvider } from '../providers/anthropic.provider.js'
import { OpenAICompatProvider } from '../providers/openai.provider.js'
import { GeminiProvider } from '../providers/gemini.provider.js'
import { OpenRouterProvider } from '../providers/openrouter.provider.js'
import { OllamaProvider } from '../providers/ollama.provider.js'
import { KeyStore } from '../key-store.js'
import { getPrismaClient } from '@cwm/db'

type ProviderRow = { provider: string; model: string; enabled: number | bigint; isDefault: number | bigint }

function toBool(v: number | bigint | boolean): boolean {
  return v === 1 || v === 1n || v === true
}

export interface ProviderConfig {
  provider: string
  model: string
  apiKey: string
}

export class ProviderManager {
  private get db() { return getPrismaClient() }

  /** Retorna configuração do provider padrão (ou por nome). */
  async resolve(providerName?: string): Promise<ProviderConfig> {
    let row: ProviderRow | null = null

    if (providerName) {
      const rows = (await this.db.$queryRawUnsafe(
        `SELECT provider, model, enabled, isDefault FROM ai_providers WHERE provider = ? LIMIT 1`,
        providerName
      )) as ProviderRow[]
      row = rows[0] ?? null
    }

    if (!row) {
      // Busca padrão
      const rows = (await this.db.$queryRawUnsafe(
        `SELECT provider, model, enabled, isDefault FROM ai_providers WHERE isDefault = 1 AND enabled = 1 LIMIT 1`
      )) as ProviderRow[]
      row = rows[0] ?? null
    }

    if (!row) {
      // Fallback: qualquer provider habilitado
      const rows = (await this.db.$queryRawUnsafe(
        `SELECT provider, model, enabled, isDefault FROM ai_providers WHERE enabled = 1 LIMIT 1`
      )) as ProviderRow[]
      row = rows[0] ?? null
    }

    if (!row) {
      throw new Error('Nenhum provedor de IA configurado. Vá em Configurações → Provedores de IA.')
    }

    const apiKey = await KeyStore.get(row.provider) ?? ''
    return { provider: row.provider, model: row.model, apiKey }
  }

  /** Instancia o provider correto com base no nome. */
  async build(providerName?: string): Promise<BaseProvider> {
    const cfg = await this.resolve(providerName)
    return this.buildFromConfig(cfg)
  }

  buildFromConfig(cfg: ProviderConfig): BaseProvider {
    const { provider, model, apiKey } = cfg

    switch (provider) {
      case 'anthropic':  return new AnthropicProvider(apiKey, model)
      case 'gemini':     return new GeminiProvider(apiKey, model)
      case 'openrouter': return new OpenRouterProvider(apiKey, model)
      case 'ollama':     return new OllamaProvider(model)
      default:           return new OpenAICompatProvider(apiKey, model, provider)
    }
  }

  /** Lista todos os providers cadastrados com status. */
  async listAll(): Promise<Array<{ provider: string; model: string; enabled: boolean; isDefault: boolean; hasKey: boolean }>> {
    const rows = (await this.db.$queryRawUnsafe(
      `SELECT provider, model, enabled, isDefault FROM ai_providers ORDER BY provider ASC`
    )) as ProviderRow[]

    const result = []
    for (const r of rows) {
      const key = await KeyStore.get(r.provider)
      result.push({
        provider: r.provider,
        model: r.model,
        enabled: toBool(r.enabled),
        isDefault: toBool(r.isDefault),
        hasKey: !!key,
      })
    }
    return result
  }
}
