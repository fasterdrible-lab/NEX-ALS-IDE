import { OpenAICompatProvider } from './openai.provider.js'
import type { ModelInfo } from './base.provider.js'

const BASE_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterProvider extends OpenAICompatProvider {
  constructor(apiKey: string, model: string) {
    super(apiKey, model, 'openrouter', BASE_URL)
  }

  override get providerName() { return 'OpenRouter' }

  override async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      if (!res.ok) return []

      type ORModel = {
        id: string
        name: string
        context_length: number
        architecture?: { modality?: string }
      }
      const data = (await res.json()) as { data: ORModel[] }

      return data.data.map(m => ({
        id: m.id,
        name: m.name ?? m.id,
        contextWindow: m.context_length ?? 32768,
        supportsTools: true,
        supportsVision: m.architecture?.modality?.includes('image') ?? false,
      }))
    } catch { return [] }
  }

  override async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/auth/key`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      return res.ok
    } catch { return false }
  }
}
