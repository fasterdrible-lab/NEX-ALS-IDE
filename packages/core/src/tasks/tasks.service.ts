import { getPrismaClient } from '@cwm/db'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface AgentTask {
  id: string
  title: string
  description: string
  status: TaskStatus
  ownerAgent: string
  priority: TaskPriority
  projectId: string | null
  sessionId: string | null
  parallelizable: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  ownerAgent?: string
  priority?: TaskPriority
  projectId?: string
  sessionId?: string
  parallelizable?: boolean
}

const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' }
const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'pendente', IN_PROGRESS: 'em andamento', BLOCKED: 'bloqueada', DONE: 'concluída',
}

const ORDER_BY = `ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, createdAt ASC`

export class TasksService {
  private get db() { return getPrismaClient() }

  private mapRow(row: AgentTask & { parallelizable: unknown }): AgentTask {
    return { ...row, parallelizable: Boolean(row.parallelizable) }
  }

  async list(filters?: { status?: TaskStatus; ownerAgent?: string; projectId?: string }): Promise<AgentTask[]> {
    const where: string[] = []
    const params: unknown[] = []
    if (filters?.status) { where.push('status = ?'); params.push(filters.status) }
    if (filters?.ownerAgent) { where.push('ownerAgent = ?'); params.push(filters.ownerAgent) }
    if (filters?.projectId) { where.push('projectId = ?'); params.push(filters.projectId) }
    const sql = `SELECT * FROM agent_tasks${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ${ORDER_BY}`
    const rows = await this.db.$queryRawUnsafe(sql, ...params) as AgentTask[]
    return rows.map(r => this.mapRow(r))
  }

  async listActive(): Promise<AgentTask[]> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT * FROM agent_tasks WHERE status != 'DONE' ${ORDER_BY} LIMIT 20`,
    ) as AgentTask[]
    return rows.map(r => this.mapRow(r))
  }

  async get(id: string): Promise<AgentTask | null> {
    const rows = await this.db.$queryRawUnsafe(
      'SELECT * FROM agent_tasks WHERE id = ? LIMIT 1', id,
    ) as AgentTask[]
    return rows[0] ? this.mapRow(rows[0]) : null
  }

  async create(input: AgentTaskInput): Promise<AgentTask> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await this.db.$executeRawUnsafe(
      `INSERT INTO agent_tasks (id, title, description, status, ownerAgent, priority, projectId, sessionId, parallelizable, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.title,
      input.description ?? '',
      input.status ?? 'TODO',
      input.ownerAgent ?? 'jarvis',
      input.priority ?? 'medium',
      input.projectId ?? null,
      input.sessionId ?? null,
      input.parallelizable ? 1 : 0,
      now, now,
    )
    return (await this.get(id))!
  }

  async update(id: string, input: Partial<AgentTaskInput>): Promise<AgentTask> {
    const sets: string[] = []
    const params: unknown[] = []
    if (input.title !== undefined)       { sets.push('title = ?');       params.push(input.title) }
    if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description) }
    if (input.status !== undefined)      { sets.push('status = ?');      params.push(input.status) }
    if (input.ownerAgent !== undefined)  { sets.push('ownerAgent = ?');  params.push(input.ownerAgent) }
    if (input.priority !== undefined)    { sets.push('priority = ?');    params.push(input.priority) }
    if (input.projectId !== undefined)   { sets.push('projectId = ?');   params.push(input.projectId) }
    if (input.sessionId !== undefined)   { sets.push('sessionId = ?');   params.push(input.sessionId) }
    if (input.parallelizable !== undefined) { sets.push('parallelizable = ?'); params.push(input.parallelizable ? 1 : 0) }
    if (sets.length === 0) return (await this.get(id))!
    sets.push('updatedAt = ?')
    params.push(new Date().toISOString(), id)
    await this.db.$executeRawUnsafe(
      `UPDATE agent_tasks SET ${sets.join(', ')} WHERE id = ?`, ...params,
    )
    return (await this.get(id))!
  }

  async delete(id: string): Promise<void> {
    await this.db.$executeRawUnsafe('DELETE FROM agent_tasks WHERE id = ?', id)
  }

  buildContext(tasks: AgentTask[]): string {
    if (tasks.length === 0) return ''
    const lines: string[] = ['## TAREFAS PENDENTES DO SQUAD\n']
    for (const t of tasks) {
      const prio = PRIORITY_LABEL[t.priority] ?? t.priority.toUpperCase()
      const st = STATUS_LABEL[t.status] ?? t.status
      lines.push(`**[${prio}] ${t.title}** (@${t.ownerAgent} · ${st})`)
      if (t.description.trim()) lines.push(t.description.trim())
      lines.push('')
    }
    return lines.join('\n')
  }
}
