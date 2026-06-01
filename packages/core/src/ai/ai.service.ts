import { getPrismaClient } from '@cwm/db'
import { encryptPassword, decryptPassword, type AiProviderConfig, type AiChatInput } from '@cwm/config'
import { KeyStore } from './key-store.js'
import { ProviderManager } from './hub/provider-manager.js'
import { ModelRegistry } from './hub/model-registry.js'
import { ConversationManager } from './hub/conversation-manager.js'
import { ResponseStreamer } from './hub/response-streamer.js'
import { PromptBuilder, type PromptMode } from './hub/prompt-builder.js'
import { ContextManager, type ContextSelection } from './hub/context-manager.js'
import type { StreamChunk } from './providers/base.provider.js'

type Row = { provider: string; apiKey: string; model: string; enabled: number | bigint; isDefault: number | bigint }

function toBool(v: number | bigint | boolean): boolean {
  return v === 1 || v === 1n || v === true
}

export class AiService {
  private get db() { return getPrismaClient() }
  private readonly _pm = new ProviderManager()
  private readonly _cm = new ConversationManager()
  private readonly _streamer = new ResponseStreamer()
  private readonly _promptBuilder = new PromptBuilder()
  private readonly _contextManager = new ContextManager()

  // ── Provider CRUD (compatível com UI existente) ──────────────────────────

  async listProviders(): Promise<AiProviderConfig[]> {
    const rows = (await this.db.$queryRawUnsafe(
      `SELECT provider, apiKey, model, enabled, isDefault FROM ai_providers ORDER BY provider ASC`
    )) as Row[]
    return rows.map((r: Row) => {
      const plain = r.apiKey && r.apiKey !== 'MIGRATED' ? decryptPassword(r.apiKey) : ''
      return {
        provider: r.provider,
        model: r.model,
        enabled: toBool(r.enabled),
        isDefault: toBool(r.isDefault),
        hasKey: plain.length > 0,
        keyPreview: plain.length > 4 ? '••••••••' + plain.slice(-4) : plain.length > 0 ? '••••' : '',
      }
    })
  }

  async saveProvider(data: {
    provider: string
    apiKey: string
    model: string
    enabled: boolean
    isDefault: boolean
  }): Promise<{ provider: string }> {
    const db = this.db

    if (data.isDefault) {
      await db.$executeRawUnsafe(`UPDATE ai_providers SET isDefault = 0`)
    }

    const existing = (await db.$queryRawUnsafe(
      `SELECT provider, apiKey FROM ai_providers WHERE provider = ?`, data.provider
    )) as Row[]

    let encKey: string
    if (data.apiKey && !data.apiKey.startsWith('••')) {
      encKey = encryptPassword(data.apiKey)
      // Invalida cache de modelos ao trocar a key
      ModelRegistry.invalidate(data.provider)
    } else if (existing.length > 0) {
      encKey = existing[0].apiKey
    } else {
      encKey = ''
    }

    if (existing.length > 0) {
      await db.$executeRawUnsafe(
        `UPDATE ai_providers SET apiKey=?, model=?, enabled=?, isDefault=?, updatedAt=CURRENT_TIMESTAMP WHERE provider=?`,
        encKey, data.model, data.enabled ? 1 : 0, data.isDefault ? 1 : 0, data.provider
      )
    } else {
      await db.$executeRawUnsafe(
        `INSERT INTO ai_providers (provider, apiKey, model, enabled, isDefault) VALUES (?, ?, ?, ?, ?)`,
        data.provider, encKey, data.model, data.enabled ? 1 : 0, data.isDefault ? 1 : 0
      )
    }

    return { provider: data.provider }
  }

  async deleteProvider(provider: string): Promise<void> {
    await this.db.$executeRawUnsafe(`DELETE FROM ai_providers WHERE provider = ?`, provider)
    await KeyStore.delete(provider)
    ModelRegistry.invalidate(provider)
  }

  // ── Chat (compatível com código existente) ───────────────────────────────

  async chat(input: AiChatInput): Promise<string> {
    const provider = await this._pm.build(input.provider)
    const result = await provider.sendMessage({
      messages: input.messages as Array<{ role: string; content: unknown }>,
      systemPrompt: input.systemPrompt,
      maxTokens: input.maxTokens ?? 4096,
    })
    if (result.type === 'text') return result.content
    return ''
  }

  // ── Streaming (novo) ─────────────────────────────────────────────────────

  async startStream(
    input: AiChatInput & { provider?: string },
    onChunk: (chunk: StreamChunk & { streamId: string }) => void
  ): Promise<{ streamId: string; abort: () => void }> {
    return this._streamer.start(input, onChunk)
  }

  cancelStream(streamId: string): void {
    this._streamer.cancel(streamId)
  }

  // ── Chat com contexto inteligente (novo) ─────────────────────────────────

  async chatWithContext(input: {
    message: string
    mode?: PromptMode
    provider?: string
    context?: ContextSelection
    projectRoot?: string
    vpsName?: string
    isProduction?: boolean
    conversationId?: string
    maxTokens?: number
    history?: Array<{ role: string; content: string }>
  }): Promise<string> {
    const contextBlock = input.context ? this._contextManager.build(input.context) : undefined
    const systemPrompt = this._promptBuilder.build({
      mode: input.mode ?? 'chat',
      projectRoot: input.projectRoot,
      vpsName: input.vpsName,
      isProduction: input.isProduction,
      projectMemory: input.context?.projectMemory,
      contextBlock,
    })

    const messages: Array<{ role: string; content: unknown }> = [
      ...(input.history ?? []),
      { role: 'user', content: input.message },
    ]

    const provider = await this._pm.build(input.provider)
    const result = await provider.sendMessage({ messages, systemPrompt, maxTokens: input.maxTokens ?? 4096 })

    if (result.type === 'text') {
      // Persiste na conversa se conversationId fornecido
      if (input.conversationId) {
        await this._cm.addMessage({ conversationId: input.conversationId, role: 'user', content: input.message })
        await this._cm.addMessage({ conversationId: input.conversationId, role: 'assistant', content: result.content })
      }
      return result.content
    }
    return ''
  }

  // ── Agentic loop (compatível com código existente) ───────────────────────

  async chatAgent(input: {
    provider?: string
    messages: Array<{ role: string; content: unknown }>
    systemPrompt?: string
    tools: Array<{
      name: string
      description: string
      input_schema: { type: string; properties: Record<string, {type: string; description?: string}>; required: string[] }
    }>
    maxTokens?: number
  }): Promise<
    | { type: 'text'; content: string }
    | { type: 'tool_use'; calls: Array<{id: string; name: string; input: Record<string, unknown>}>; text?: string; assistantMessage: unknown; format: 'anthropic' | 'openai' }
  > {
    const provider = await this._pm.build(input.provider)
    return provider.sendMessage({
      messages: input.messages,
      systemPrompt: input.systemPrompt,
      tools: input.tools,
      maxTokens: input.maxTokens ?? 4096,
    }) as Promise<
      | { type: 'text'; content: string }
      | { type: 'tool_use'; calls: Array<{id: string; name: string; input: Record<string, unknown>}>; text?: string; assistantMessage: unknown; format: 'anthropic' | 'openai' }
    >
  }

  // ── Test provider ────────────────────────────────────────────────────────

  async testProvider(providerName: string): Promise<{ success: boolean; message: string }> {
    try {
      const provider = await this._pm.build(providerName)
      const valid = await provider.validateKey()
      if (!valid) return { success: false, message: 'API Key inválida ou sem acesso.' }
      // Faz uma chamada mínima
      const result = await provider.sendMessage({
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
        maxTokens: 16,
      })
      const reply = result.type === 'text' ? result.content.slice(0, 80) : '(tool_use)'
      return { success: true, message: `Conectado. Resposta: "${reply}"` }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  // ── Models (novo) ────────────────────────────────────────────────────────

  async getModels(provider: string) {
    return ModelRegistry.getModels(provider)
  }

  // ── Conversations (novo) ─────────────────────────────────────────────────

  get conversations() { return this._cm }
}
