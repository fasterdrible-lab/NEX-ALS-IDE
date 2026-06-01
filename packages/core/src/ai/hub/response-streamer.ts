import { ProviderManager } from './provider-manager.js'
import type { SendInput, StreamChunk } from '../providers/base.provider.js'

export interface StreamSession {
  streamId: string
  abort: () => void
}

export class ResponseStreamer {
  private readonly manager = new ProviderManager()
  private readonly sessions = new Map<string, AbortController>()

  /**
   * Inicia streaming. Chama onChunk para cada fragmento.
   * Retorna streamId para uso em cancel().
   */
  async start(
    input: SendInput & { provider?: string },
    onChunk: (chunk: StreamChunk & { streamId: string }) => void
  ): Promise<StreamSession> {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const controller = new AbortController()
    this.sessions.set(streamId, controller)

    const provider = await this.manager.build(input.provider)

    // Executa o streaming de forma assíncrona
    void provider
      .streamMessage(input, chunk => {
        if (controller.signal.aborted) return
        onChunk({ ...chunk, streamId })
        if (chunk.type === 'done' || chunk.type === 'error') {
          this.sessions.delete(streamId)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          onChunk({ type: 'error', error: err instanceof Error ? err.message : String(err), streamId })
        }
        this.sessions.delete(streamId)
      })

    return {
      streamId,
      abort: () => {
        controller.abort()
        this.sessions.delete(streamId)
        onChunk({ type: 'done', streamId })
      },
    }
  }

  cancel(streamId: string): void {
    const ctrl = this.sessions.get(streamId)
    if (ctrl) {
      ctrl.abort()
      this.sessions.delete(streamId)
    }
  }
}
