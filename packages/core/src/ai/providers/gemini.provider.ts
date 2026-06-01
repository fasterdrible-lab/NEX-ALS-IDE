import { BaseProvider, type SendInput, type SendResult, type StreamChunk, type ModelInfo } from './base.provider.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-pro',           name: 'Gemini 2.5 Pro',     contextWindow: 1048576, supportsTools: true, supportsVision: true },
  { id: 'gemini-2.0-flash',         name: 'Gemini 2.0 Flash',   contextWindow: 1048576, supportsTools: true, supportsVision: true },
  { id: 'gemini-2.0-flash-lite',    name: 'Gemini 2.0 Flash Lite', contextWindow: 1048576, supportsTools: true, supportsVision: false },
  { id: 'gemini-1.5-pro',           name: 'Gemini 1.5 Pro',     contextWindow: 2097152, supportsTools: true, supportsVision: true },
]

export class GeminiProvider extends BaseProvider {
  get providerName() { return 'Gemini' }

  private toGeminiMessages(messages: Array<{ role: string; content: unknown }>) {
    return messages
      .filter(m => m.role === 'user' || m.role === 'model' || m.role === 'assistant')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      }))
  }

  async sendMessage(input: SendInput): Promise<SendResult> {
    const url = `${BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`

    const body: Record<string, unknown> = {
      contents: this.toGeminiMessages(input.messages),
    }
    if (input.systemPrompt) {
      body.systemInstruction = { parts: [{ text: input.systemPrompt }] }
    }
    if (input.maxTokens || input.temperature !== undefined) {
      body.generationConfig = {
        ...(input.maxTokens ? { maxOutputTokens: input.maxTokens } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as Record<string, unknown>
      throw new Error(`Gemini ${res.status}: ${((e.error as Record<string, unknown>)?.message as string) ?? res.statusText}`)
    }

    type GeminiResponse = {
      candidates: Array<{
        content: { parts: Array<{ text?: string }> }
        finishReason: string
      }>
    }
    const data = (await res.json()) as GeminiResponse
    const text = data.candidates[0]?.content?.parts.map(p => p.text ?? '').join('') ?? ''
    return { type: 'text', content: text }
  }

  async streamMessage(input: SendInput, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const url = `${BASE_URL}/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`

    const body: Record<string, unknown> = {
      contents: this.toGeminiMessages(input.messages),
    }
    if (input.systemPrompt) {
      body.systemInstruction = { parts: [{ text: input.systemPrompt }] }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok || !res.body) {
      onChunk({ type: 'error', error: `Gemini ${res.status}: ${res.statusText}` })
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
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        try {
          const evt = JSON.parse(payload) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
          const text = evt.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) onChunk({ type: 'text_delta', delta: text })
        } catch { /* linha inválida */ }
      }
    }
    onChunk({ type: 'done' })
  }

  async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(
        `${BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 1 } }),
        }
      )
      return res.status !== 400 && res.status !== 403
    } catch { return false }
  }

  async listModels(): Promise<ModelInfo[]> {
    return MODELS
  }
}
