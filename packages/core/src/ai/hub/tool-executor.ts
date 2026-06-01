import { getPrismaClient } from '@cwm/db'
import { randomUUID } from 'node:crypto'

export type ToolTier = 'read' | 'write' | 'exec_safe' | 'exec_dangerous'

export const TOOL_TIERS: Record<string, ToolTier> = {
  read_file:           'read',
  list_directory:      'read',
  search_files:        'read',
  read_logs:           'read',
  read_docker:         'read',
  read_pm2:            'read',
  read_vps_stats:      'read',
  write_file:          'write',
  create_file:         'write',
  run_git_add:         'write',
  run_git_commit:      'write',
  run_git_pull:        'exec_safe',
  run_git_push:        'exec_safe',
  pm2_restart:         'exec_safe',      // sobrescrito para exec_dangerous em PROD
  docker_restart:      'exec_dangerous',
  docker_rm:           'exec_dangerous',
  docker_stop:         'exec_dangerous',
  git_reset_hard:      'exec_dangerous',
  run_command:         'exec_dangerous',
}

export interface ExecutionContext {
  vpsId: string | null
  isProduction: boolean
  conversationId?: string
}

export type ConfirmationHandler = (toolName: string, inputSummary: string) => Promise<boolean>

export class ToolExecutor {
  private db = getPrismaClient()
  private confirmationHandler: ConfirmationHandler | null = null

  /** Injeta o handler de confirmação (chamado pelo IPC handler no main process). */
  setConfirmationHandler(handler: ConfirmationHandler): void {
    this.confirmationHandler = handler
  }

  getTier(toolName: string, ctx: ExecutionContext): ToolTier {
    const base = TOOL_TIERS[toolName] ?? 'exec_dangerous'
    // pm2_restart em produção vira exec_dangerous
    if (toolName === 'pm2_restart' && ctx.isProduction) return 'exec_dangerous'
    return base
  }

  async requiresConfirmation(toolName: string, ctx: ExecutionContext): Promise<boolean> {
    const tier = this.getTier(toolName, ctx)
    return tier === 'exec_dangerous' || (tier === 'exec_safe' && ctx.isProduction)
  }

  async requestConfirmation(toolName: string, input: Record<string, unknown>): Promise<boolean> {
    if (!this.confirmationHandler) return false
    const summary = Object.entries(input)
      .map(([k, v]) => `${k}: ${String(v).slice(0, 100)}`)
      .join(', ')
    return this.confirmationHandler(toolName, summary)
  }

  async logExecution(data: {
    toolName: string
    input: Record<string, unknown>
    output: string
    tier: ToolTier
    confirmed: boolean
    conversationId?: string
  }): Promise<void> {
    try {
      await this.db.$executeRawUnsafe(
        `INSERT INTO tool_execution_log (id, conversationId, toolName, input, output, tier, confirmed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        data.conversationId ?? null,
        data.toolName,
        JSON.stringify(data.input).slice(0, 2000),
        data.output.slice(0, 500),
        data.tier,
        data.confirmed ? 1 : 0
      )
    } catch { /* log não deve quebrar a execução */ }
  }
}

export const toolExecutor = new ToolExecutor()
