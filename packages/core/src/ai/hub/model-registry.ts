import type { ModelInfo } from '../providers/base.provider.js'
import { AnthropicProvider } from '../providers/anthropic.provider.js'
import { OpenAICompatProvider } from '../providers/openai.provider.js'
import { GeminiProvider } from '../providers/gemini.provider.js'
import { OpenRouterProvider } from '../providers/openrouter.provider.js'
import { OllamaProvider } from '../providers/ollama.provider.js'
import { KeyStore } from '../key-store.js'

type CacheEntry = { models: ModelInfo[]; fetchedAt: number }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

const cache = new Map<string, CacheEntry>()

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  anthropic:   'claude-sonnet-4-6',
  openai:      'gpt-4o',
  gemini:      'gemini-2.0-flash',
  deepseek:    'deepseek-chat',
  groq:        'llama-3.3-70b-versatile',
  mistral:     'codestral-latest',
  xai:         'grok-3-mini',
  openrouter:  'openai/gpt-4o-mini',
  ollama:      'llama3.2:latest',
}

export const ModelRegistry = {
  defaultModel(provider: string): string {
    return PROVIDER_DEFAULT_MODELS[provider] ?? ''
  },

  async getModels(provider: string): Promise<ModelInfo[]> {
    const cached = cache.get(provider)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.models
    }

    const apiKey = await KeyStore.get(provider) ?? ''
    const defaultModel = this.defaultModel(provider)
    let models: ModelInfo[] = []

    try {
      let p: AnthropicProvider | OpenAICompatProvider | GeminiProvider | OpenRouterProvider | OllamaProvider
      switch (provider) {
        case 'anthropic':   p = new AnthropicProvider(apiKey, defaultModel); break
        case 'gemini':      p = new GeminiProvider(apiKey, defaultModel); break
        case 'openrouter':  p = new OpenRouterProvider(apiKey, defaultModel); break
        case 'ollama':      p = new OllamaProvider(defaultModel); break
        default:            p = new OpenAICompatProvider(apiKey, defaultModel, provider); break
      }
      models = await p.listModels()
    } catch { models = [] }

    cache.set(provider, { models, fetchedAt: Date.now() })
    return models
  },

  invalidate(provider: string): void {
    cache.delete(provider)
  },
}
