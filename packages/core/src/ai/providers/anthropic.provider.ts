import { BaseProvider, type SendInput, type SendResult, type StreamChunk, type ModelInfo } from './base.provider.js'

const BASE_URL = 'https://api.anthropic.com/v1'
const API_VERSION = '2023-06-01'

const MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-8',          name: 'Claude Opus 4.8',    contextWindow: 200000, supportsTools: true,  supportsVision: true },
  { id: 'claude-sonnet-4-6',        name: 'Claude Sonnet 4.6',  contextWindow: 200000, supportsTools: true,  supportsVision: true },
  { id: 'claude-haiku-4-5-20251001',name: 'Claude Haiku 4.5',   contextWindow: 200000, supportsTools: true,  supportsVision: true },
  { id: 'claude-opus-4-5',          name: 'Claude Opus 4.5',    contextWindow: 200000, supportsTools: true,  supportsVision: true },
]

export class AnthropicProvider extends BaseProvider {
  get providerName() { return 'Anthropic' }

  async sendMessage(input: SendInput): Promise<SendResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: input.maxTokens ?? 4096,
      messages: input.messages,
    }
    if (input.systemPrompt) body.system = input.systemPrompt
    if (input.tools?.length) body.tools = input.tools
    if (input.temperature !== undefined) body.temperature = input.temperature

    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as Record<string, unknown>
      throw new Error(`Anthropic ${res.status}: ${((e.error as Record<string, unknown>)?.message as string) ?? res.statusText}`)
    }

    type AnthropicContent = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }
    const data = (await res.json()) as { stop_reason: string; content: AnthropicContent[] }

    if (data.stop_reason === 'tool_use') {
      const calls = data.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ id: b.id!, name: b.name!, input: b.input ?? {} }))
      const text = data.content.find(b => b.type === 'text')?.text
      return {
        type: 'tool_use',
        calls,
        text,
        assistantMessage: { role: 'assistant', content: data.content },
        format: 'anthropic',
      }
    }

    return { type: 'text', content: data.content.find(b => b.type === 'text')?.text ?? '' }
  }

  async streamMessage(input: SendInput, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: input.maxTokens ?? 4096,
      messages: input.messages,
      stream: true,
    }
    if (input.systemPrompt) body.system = input.systemPrompt
    if (input.tools?.length) body.tools = input.tools

    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok || !res.body) {
      const e = (await res.json().catch(() => ({}))) as Record<string, unknown>
      onChunk({ type: 'error', error: `Anthropic ${res.status}: ${((e.error as Record<string, unknown>)?.message as string) ?? res.statusText}` })
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
        if (payload === '[DONE]') { onChunk({ type: 'done' }); return }
        try {
          const evt = JSON.parse(payload) as Record<string, unknown>
          if (evt.type === 'content_block_delta') {
            const delta = evt.delta as Record<string, unknown>
            if (delta.type === 'text_delta') {
              onChunk({ type: 'text_delta', delta: delta.text as string })
            }
          }
          if (evt.type === 'message_stop') {
            onChunk({ type: 'done' })
            return
          }
        } catch { /* linha inválida */ }
      }
    }
    onChunk({ type: 'done' })
  }

  async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': API_VERSION, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
      })
      return res.status !== 401 && res.status !== 403
    } catch { return false }
  }

  async listModels(): Promise<ModelInfo[]> {
    return MODELS
  }
}
