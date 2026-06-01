export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  supportsTools: boolean
  supportsVision: boolean
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, { type: string; description?: string }>
    required: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface SendInput {
  messages: Array<{ role: string; content: unknown }>
  systemPrompt?: string
  tools?: ToolDefinition[]
  maxTokens?: number
  temperature?: number
}

export type SendResult =
  | { type: 'text'; content: string }
  | {
      type: 'tool_use'
      calls: ToolCall[]
      text?: string
      assistantMessage: unknown
      format: 'anthropic' | 'openai'
    }

export interface StreamChunk {
  type: 'text_delta' | 'tool_use' | 'done' | 'error'
  delta?: string
  toolCall?: ToolCall
  error?: string
}

export abstract class BaseProvider {
  constructor(
    protected readonly apiKey: string,
    protected readonly model: string
  ) {}

  abstract sendMessage(input: SendInput): Promise<SendResult>

  /** Streaming — implementado no Sprint 3. */
  abstract streamMessage(input: SendInput, onChunk: (chunk: StreamChunk) => void): Promise<void>

  abstract validateKey(): Promise<boolean>

  abstract listModels(): Promise<ModelInfo[]>

  /** Nome legível do provider para logs e UI. */
  abstract get providerName(): string
}
