import { BaseProvider, type SendInput, type SendResult, type StreamChunk, type ModelInfo } from './base.provider.js'

const STATIC_MODELS: Record<string, ModelInfo[]> = {
  openai: [
    { id: 'gpt-4.1',        name: 'GPT-4.1',        contextWindow: 1047576, supportsTools: true, supportsVision: true },
    { id: 'gpt-4o',         name: 'GPT-4o',          contextWindow: 128000,  supportsTools: true, supportsVision: true },
    { id: 'gpt-4o-mini',    name: 'GPT-4o Mini',     contextWindow: 128000,  supportsTools: true, supportsVision: true },
    { id: 'o3',             name: 'o3',               contextWindow: 200000,  supportsTools: true, supportsVision: false },
    { id: 'o4-mini',        name: 'o4-mini',          contextWindow: 200000,  supportsTools: true, supportsVision: false },
  ],
  deepseek: [
    { id: 'deepseek-chat',     name: 'DeepSeek Chat',     contextWindow: 64000,  supportsTools: true, supportsVision: false },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000,  supportsTools: false, supportsVision: false },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, supportsTools: true, supportsVision: false },
    { id: 'llama-3.1-8b-instant',    name: 'Llama 3.1 8B',  contextWindow: 128000, supportsTools: true, supportsVision: false },
  ],
  mistral: [
    { id: 'codestral-latest',  name: 'Codestral',       contextWindow: 256000, supportsTools: true, supportsVision: false },
    { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000, supportsTools: true, supportsVision: false },
  ],
  xai: [
    { id: 'grok-3',       name: 'Grok 3',       contextWindow: 131072, supportsTools: true, supportsVision: false },
    { id: 'grok-3-mini',  name: 'Grok 3 Mini',  contextWindow: 131072, supportsTools: true, supportsVision: false },
  ],
}

const BASE_URLS: Record<string, string> = {
  openai:   'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  groq:     'https://api.groq.com/openai/v1',
  mistral:  'https://api.mistral.ai/v1',
  xai:      'https://api.x.ai/v1',
}

export class OpenAICompatProvider extends BaseProvider {
  private readonly baseUrl: string
  private readonly providerKey: string

  constructor(
    apiKey: string,
    model: string,
    provider: string,
    customBaseUrl?: string
  ) {
    super(apiKey, model)
    this.providerKey = provider
    this.baseUrl = customBaseUrl ?? BASE_URLS[provider] ?? 'https://api.openai.com/v1'
  }

  get providerName() { return this.providerKey }

  async sendMessage(input: SendInput): Promise<SendResult> {
    const msgs = input.systemPrompt
      ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
      : input.messages

    const body: Record<string, unknown> = {
      model: this.model,
      messages: msgs,
      max_tokens: input.maxTokens ?? 4096,
    }
    if (input.temperature !== undefined) body.temperature = input.temperature
    if (input.tools?.length) {
      body.tools = input.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }))
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as Record<string, unknown>
      throw new Error(`${this.providerKey} ${res.status}: ${((e.error as Record<string, unknown>)?.message as string) ?? res.statusText}`)
    }

    type OAIResponse = {
      choices: Array<{
        finish_reason: string
        message: {
          content?: string
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
      }>
    }
    const data = (await res.json()) as OAIResponse
    const msg = data.choices[0].message

    if (data.choices[0].finish_reason === 'tool_calls' && msg.tool_calls) {
      const calls = msg.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }))
      return {
        type: 'tool_use',
        calls,
        text: msg.content ?? undefined,
        assistantMessage: { role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls },
        format: 'openai',
      }
    }

    return { type: 'text', content: msg.content ?? '' }
  }

  async streamMessage(input: SendInput, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const msgs = input.systemPrompt
      ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
      : input.messages

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: msgs,
        max_tokens: input.maxTokens ?? 4096,
        stream: true,
      }),
    })

    if (!res.ok || !res.body) {
      const e = (await res.json().catch(() => ({}))) as Record<string, unknown>
      onChunk({ type: 'error', error: `${this.providerKey} ${res.status}: ${((e.error as Record<string, unknown>)?.message as string) ?? res.statusText}` })
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
          const evt = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
          const delta = evt.choices?.[0]?.delta?.content
          if (delta) onChunk({ type: 'text_delta', delta })
        } catch { /* linha inválida */ }
      }
    }
    onChunk({ type: 'done' })
  }

  async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
      })
      return res.status !== 401 && res.status !== 403
    } catch { return false }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Tenta buscar modelos dinamicamente (OpenAI suporta /models)
    if (this.providerKey === 'openai') {
      try {
        const res = await fetch(`${this.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        })
        if (res.ok) {
          const data = (await res.json()) as { data: Array<{ id: string }> }
          return data.data
            .filter(m => m.id.startsWith('gpt') || m.id.startsWith('o'))
            .map(m => ({ id: m.id, name: m.id, contextWindow: 128000, supportsTools: true, supportsVision: m.id.includes('vision') || m.id.includes('4o') }))
        }
      } catch { /* usa estático como fallback */ }
    }
    return STATIC_MODELS[this.providerKey] ?? []
  }
}
