import { BaseProvider, type SendInput, type SendResult, type StreamChunk, type ModelInfo } from './base.provider.js'

export class OllamaProvider extends BaseProvider {
  private readonly baseUrl: string

  constructor(model: string, baseUrl = 'http://localhost:11434') {
    super('', model) // Ollama não usa API key
    this.baseUrl = baseUrl
  }

  get providerName() { return 'Ollama' }

  async sendMessage(input: SendInput): Promise<SendResult> {
    const msgs = input.systemPrompt
      ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
      : input.messages

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: msgs,
        stream: false,
        options: input.maxTokens ? { num_predict: input.maxTokens } : undefined,
      }),
    })

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${res.statusText} — Verifique se o Ollama está rodando em ${this.baseUrl}`)
    }

    const data = (await res.json()) as { message: { content: string } }
    return { type: 'text', content: data.message?.content ?? '' }
  }

  async streamMessage(input: SendInput, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const msgs = input.systemPrompt
      ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
      : input.messages

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages: msgs, stream: true }),
    })

    if (!res.ok || !res.body) {
      onChunk({ type: 'error', error: `Ollama ${res.status}: ${res.statusText}` })
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const evt = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
          if (evt.message?.content) onChunk({ type: 'text_delta', delta: evt.message.content })
          if (evt.done) { onChunk({ type: 'done' }); return }
        } catch { /* linha inválida */ }
      }
    }
    onChunk({ type: 'done' })
  }

  async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      return res.ok
    } catch { return false }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      if (!res.ok) return []
      const data = (await res.json()) as { models: Array<{ name: string; details?: { parameter_size?: string } }> }
      return data.models.map(m => ({
        id: m.name,
        name: m.name,
        contextWindow: 32768,
        supportsTools: false,
        supportsVision: m.name.toLowerCase().includes('vision') || m.name.toLowerCase().includes('llava'),
      }))
    } catch { return [] }
  }
}
