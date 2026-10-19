import { getPrismaClient } from '@cwm/db'

/**
 * Log separado por execução do Hermes (ETAPA 37) — base do quadro de tarefas e do painel de
 * agentes (ETAPAS 12/13). Quem grava é o main (wireHermesStream), que sobrevive ao painel ser
 * fechado no meio de uma execução. Tabela raw-SQL (sem model Prisma), datas em ms declaradas como
 * BIGINT: no $queryRawUnsafe o Prisma lê coluna INTEGER como i32 e falha (P2010) com Date.now().
 */

export type HermesRunKind = 'task' | 'parallel' | 'review' | 'project'
export type HermesRunStatus = 'running' | 'done' | 'error'

export interface HermesRunActivity { at: number; kind: 'init' | 'tool' | 'tool_error' | 'blocked'; tool: string; summary: string }

export interface HermesRunSummary {
  id: string
  projectId: string
  taskId: string | null
  kind: HermesRunKind
  status: HermesRunStatus
  startedAt: number
  endedAt: number | null
  toolCount: number
  errorCount: number
  error: string
}

export interface HermesRun extends HermesRunSummary {
  text: string
  activity: HermesRunActivity[]
}

const TEXT_CAP = 200_000
const ACTIVITY_CAP = 400
const FLUSH_EVERY_MS = 15_000

/** Sessão do loop → tarefa: `nex-task-<id>` (tarefa), `nex-review-…` (fechamento), sem nome (plano/mensagem). */
export function runKindFromSession(sessionName?: string): { kind: HermesRunKind; taskId: string | null } {
  if (sessionName?.startsWith('nex-task-')) return { kind: 'task', taskId: sessionName.slice('nex-task-'.length) || null }
  if (sessionName?.startsWith('nex-review-')) return { kind: 'review', taskId: null }
  return { kind: 'project', taskId: null }
}

interface Buffer { text: string; truncated: boolean; activity: HermesRunActivity[]; toolCount: number; errorCount: number; lastFlush: number }

export class HermesRunLog {
  private get db() { return getPrismaClient() }
  private readonly buffers = new Map<string, Buffer>()
  // Escritas do mesmo run em série (flush periódico + final não podem se cruzar).
  private readonly chains = new Map<string, Promise<unknown>>()

  async ensureTable(): Promise<void> {
    await this.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS hermes_task_runs (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        taskId TEXT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        startedAt BIGINT NOT NULL,
        endedAt BIGINT,
        toolCount INTEGER NOT NULL DEFAULT 0,
        errorCount INTEGER NOT NULL DEFAULT 0,
        error TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL DEFAULT '',
        activity TEXT NOT NULL DEFAULT '[]'
      )`)
    await this.db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS hermes_task_runs_project ON hermes_task_runs (projectId, startedAt)`)
    // Execução "running" que sobreviveu a um restart é órfã — o processo que gravava acabou.
    await this.db.$executeRawUnsafe(
      `UPDATE hermes_task_runs SET status = 'error', endedAt = COALESCE(endedAt, startedAt), error = 'Interrompida — o app foi fechado durante a execução.' WHERE status = 'running'`,
    )
  }

  private enqueue(runId: string, fn: () => Promise<unknown>): Promise<unknown> {
    const next = (this.chains.get(runId) ?? Promise.resolve()).then(fn).catch((e: unknown) => console.error('[HermesRunLog]', e))
    this.chains.set(runId, next)
    return next
  }

  start(input: { projectId: string; taskId: string | null; kind: HermesRunKind }): string {
    const id = crypto.randomUUID()
    this.buffers.set(id, { text: '', truncated: false, activity: [], toolCount: 0, errorCount: 0, lastFlush: Date.now() })
    void this.enqueue(id, () => this.db.$executeRawUnsafe(
      `INSERT INTO hermes_task_runs (id, projectId, taskId, kind, status, startedAt) VALUES (?, ?, ?, ?, 'running', ?)`,
      id, input.projectId, input.taskId, input.kind, Date.now(),
    ))
    return id
  }

  appendText(runId: string, chunk: string): void {
    const b = this.buffers.get(runId)
    if (!b) return
    b.text += chunk
    // Mantém o fim (onde ficam a tag de conclusão e os erros); marca que cortou o começo.
    if (b.text.length > TEXT_CAP) { b.text = b.text.slice(-TEXT_CAP); b.truncated = true }
    this.maybeFlush(runId, b)
  }

  appendActivity(runId: string, a: Omit<HermesRunActivity, 'at'>): void {
    const b = this.buffers.get(runId)
    if (!b) return
    if (a.kind === 'tool') b.toolCount++
    if (a.kind === 'tool_error' || a.kind === 'blocked') b.errorCount++
    b.activity.push({ ...a, at: Date.now(), summary: a.summary.slice(0, 300) })
    if (b.activity.length > ACTIVITY_CAP) b.activity.splice(0, b.activity.length - ACTIVITY_CAP)
    this.maybeFlush(runId, b)
  }

  private maybeFlush(runId: string, b: Buffer): void {
    if (Date.now() - b.lastFlush < FLUSH_EVERY_MS) return
    b.lastFlush = Date.now()
    void this.enqueue(runId, () => this.write(runId, b))
  }

  private write(runId: string, b: Buffer, final?: { ok: boolean; error?: string }): Promise<unknown> {
    const text = b.truncated ? `[… início cortado — log maior que ${TEXT_CAP / 1000}k caracteres]\n${b.text}` : b.text
    if (!final) {
      return this.db.$executeRawUnsafe(
        `UPDATE hermes_task_runs SET text = ?, activity = ?, toolCount = ?, errorCount = ? WHERE id = ?`,
        text, JSON.stringify(b.activity), b.toolCount, b.errorCount, runId,
      )
    }
    return this.db.$executeRawUnsafe(
      `UPDATE hermes_task_runs SET text = ?, activity = ?, toolCount = ?, errorCount = ?, status = ?, endedAt = ?, error = ? WHERE id = ?`,
      text, JSON.stringify(b.activity), b.toolCount, b.errorCount, final.ok ? 'done' : 'error', Date.now(), (final.error ?? '').slice(0, 2000), runId,
    )
  }

  finish(runId: string, ok: boolean, error?: string): void {
    const b = this.buffers.get(runId)
    if (!b) return
    this.buffers.delete(runId)
    void this.enqueue(runId, () => this.write(runId, b, { ok, error })).then(() => this.chains.delete(runId))
  }

  async list(projectId: string, taskId?: string): Promise<HermesRunSummary[]> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT id, projectId, taskId, kind, status, startedAt, endedAt, toolCount, errorCount, error
       FROM hermes_task_runs WHERE projectId = ?${taskId ? ' AND taskId = ?' : ''} ORDER BY startedAt DESC LIMIT 200`,
      ...(taskId ? [projectId, taskId] : [projectId]),
    ) as Record<string, unknown>[]
    return rows.map(r => this.toSummary(r))
  }

  async get(runId: string): Promise<HermesRun | null> {
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM hermes_task_runs WHERE id = ? LIMIT 1`, runId) as Record<string, unknown>[]
    const r = rows[0]
    if (!r) return null
    // Execução em andamento: devolve o buffer em memória (mais novo que o último flush).
    const live = this.buffers.get(runId)
    let activity: HermesRunActivity[] = []
    try { activity = JSON.parse(String(r['activity'] ?? '[]')) } catch { activity = [] }
    return {
      ...this.toSummary(r),
      ...(live ? { toolCount: live.toolCount, errorCount: live.errorCount } : {}),
      text: live ? live.text : String(r['text'] ?? ''),
      activity: live ? [...live.activity] : activity,
    }
  }

  private toSummary(r: Record<string, unknown>): HermesRunSummary {
    const live = this.buffers.get(String(r['id']))
    return {
      id: String(r['id']),
      projectId: String(r['projectId']),
      taskId: r['taskId'] == null ? null : String(r['taskId']),
      kind: String(r['kind']) as HermesRunKind,
      status: String(r['status']) as HermesRunStatus,
      // SQLite devolve INTEGER grande como BigInt pelo Prisma raw.
      startedAt: Number(r['startedAt']),
      endedAt: r['endedAt'] == null ? null : Number(r['endedAt']),
      toolCount: live ? live.toolCount : Number(r['toolCount'] ?? 0),
      errorCount: live ? live.errorCount : Number(r['errorCount'] ?? 0),
      error: String(r['error'] ?? ''),
    }
  }
}
