import type { AiService } from '../ai/ai.service.js'
import { AGENTS, AGENT_NAMES, type AgentName } from './agents.js'

type StreamChunkCallback = (chunk: { type: string; delta?: string; error?: string; streamId: string }) => void

export class SquadService {
  constructor(private readonly _ai: AiService) {}

  async startAgentStream(
    agent: AgentName,
    message: string,
    history: Array<{ role: string; content: string }>,
    onChunk: StreamChunkCallback,
    opts?: { projectContext?: string; providerOverride?: string }
  ): Promise<{ streamId: string }> {
    const config = AGENTS[agent]

    let systemPrompt = config.systemPrompt
    if (opts?.projectContext) {
      systemPrompt += `\n\nCONTEXTO DO PROJETO:\n${opts.projectContext}`
    }

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content as unknown })),
      { role: 'user', content: message as unknown },
    ]

    const session = await this._ai.startStream(
      {
        messages,
        systemPrompt,
        provider: opts?.providerOverride ?? config.preferredProvider,
        maxTokens: 4096,
      } as Parameters<AiService['startStream']>[0],
      onChunk as Parameters<AiService['startStream']>[1]
    )

    return { streamId: session.streamId }
  }

  cancelStream(streamId: string): void {
    this._ai.cancelStream(streamId)
  }

  detectDelegations(agentName: AgentName, text: string): AgentName[] {
    const lower = text.toLowerCase()
    return AGENT_NAMES.filter(a => a !== agentName && lower.includes(`@${a}`))
  }

  extractDelegationTask(text: string, target: AgentName): string {
    const pattern = new RegExp(`@${target}[^.!?\\n]*[.!?\\n]?`, 'i')
    const match = text.match(pattern)
    if (match) {
      const task = match[0].replace(new RegExp(`@${target}[:\\s]*`, 'i'), '').trim()
      return task || text.slice(0, 400)
    }
    return text.slice(0, 400)
  }
}
