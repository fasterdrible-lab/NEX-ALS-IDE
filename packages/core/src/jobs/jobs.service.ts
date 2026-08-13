import { getPrismaClient } from '@cwm/db'

// ── Schedule types ────────────────────────────────────────────────────────────
export type JobSchedule =
  | { type: 'interval'; minutes: number }
  | { type: 'hourly';   minute: number }
  | { type: 'daily';    hour: number; minute: number }
  | { type: 'weekly';   weekday: number; hour: number; minute: number }

export interface ScheduledJob {
  id: string
  title: string
  instruction: string
  agentName: string
  schedule: string      // JSON-encoded JobSchedule
  isActive: number      // SQLite 0/1
  lastRunAt: string | null
  lastResult: string | null
  nextRunAt: string
  vpsId: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduledJobInput {
  instruction: string
  title?: string
  agentName?: string
  vpsId?: string
  /** Obrigatório quando agentName === 'hermes' — define qual projeto/workspace recebe o objetivo. */
  projectId?: string
}

// ── Natural-language parser ───────────────────────────────────────────────────
const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0, dom: 0, sunday: 0, sun: 0,
  segunda: 1, seg: 1, 'segunda-feira': 1, monday: 1, mon: 1,
  'terça': 2, 'ter': 2, 'terça-feira': 2, tuesday: 2, tue: 2,
  quarta: 3, qua: 3, 'quarta-feira': 3, wednesday: 3, wed: 3,
  quinta: 4, qui: 4, 'quinta-feira': 4, thursday: 4, thu: 4,
  sexta: 5, sex: 5, 'sexta-feira': 5, friday: 5, fri: 5,
  'sábado': 6, sabado: 6, sab: 6, saturday: 6, sat: 6,
}

function extractHourMinute(t: string): { hour: number; minute: number } | null {
  // "às 8h", "às 8:30", "at 9", "9h30", "09:00"
  const m = t.match(/(?:às?|at)\s*(\d{1,2})(?::(\d{2}))?h?|(?<!\d)(\d{1,2}):(\d{2})|(?<!\d)(\d{1,2})h(\d{0,2})/i)
  if (!m) return null
  const hour = parseInt(m[1] ?? m[3] ?? m[5] ?? '0')
  const minute = parseInt(m[2] ?? m[4] ?? m[6] ?? '0') || 0
  if (hour < 0 || hour > 23) return null
  return { hour, minute }
}

export function parseSchedule(text: string): JobSchedule {
  const t = text.toLowerCase()

  // interval: "a cada X minutos", "todo X min", "every X min"
  const intervalM = t.match(/(?:a cada|every|todo|toda)\s+(\d+)\s*min/i)
  if (intervalM) return { type: 'interval', minutes: Math.max(5, parseInt(intervalM[1])) }

  // hourly
  if (/toda\s*hora|a cada\s*hora|every\s*hour|hourly/.test(t)) return { type: 'hourly', minute: 0 }

  // weekly — check day names before daily (so "toda segunda-feira" doesn't match "todo dia")
  for (const [key, weekday] of Object.entries(WEEKDAY_MAP)) {
    if (t.includes(key)) {
      const hm = extractHourMinute(t)
      return { type: 'weekly', weekday, hour: hm?.hour ?? 9, minute: hm?.minute ?? 0 }
    }
  }

  // daily
  if (/todo\s*dia|todos\s*os\s*dias|diariamente|every\s*day|daily/.test(t)) {
    const hm = extractHourMinute(t)
    return { type: 'daily', hour: hm?.hour ?? 9, minute: hm?.minute ?? 0 }
  }

  // time-of-day hints → daily at that time
  if (/de\s*manh[ãa]|in the morning/.test(t)) return { type: 'daily', hour: 9, minute: 0 }
  if (/ao?\s*meio.?dia|at\s*noon/.test(t))     return { type: 'daily', hour: 12, minute: 0 }
  if (/[aà]\s*tarde|afternoon/.test(t))         return { type: 'daily', hour: 15, minute: 0 }
  if (/[aà]\s*noite|at\s*night/.test(t))        return { type: 'daily', hour: 20, minute: 0 }

  // fallback: if there's a time, assume daily
  const hm = extractHourMinute(t)
  if (hm) return { type: 'daily', hour: hm.hour, minute: hm.minute }

  return { type: 'daily', hour: 9, minute: 0 }
}

export function describeSchedule(schedule: JobSchedule): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  switch (schedule.type) {
    case 'interval': return `A cada ${schedule.minutes} minuto${schedule.minutes !== 1 ? 's' : ''}`
    case 'hourly':   return `A cada hora`
    case 'daily':    return `Diariamente às ${pad(schedule.hour)}:${pad(schedule.minute)}`
    case 'weekly': {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      return `Toda ${days[schedule.weekday] ?? '?'} às ${pad(schedule.hour)}:${pad(schedule.minute)}`
    }
  }
}

export function computeNextRunAt(schedule: JobSchedule, from = new Date()): Date {
  switch (schedule.type) {
    case 'interval': {
      return new Date(from.getTime() + schedule.minutes * 60_000)
    }
    case 'hourly': {
      const next = new Date(from)
      next.setMinutes(schedule.minute, 0, 0)
      if (next <= from) next.setHours(next.getHours() + 1, schedule.minute, 0, 0)
      return next
    }
    case 'daily': {
      const next = new Date(from)
      next.setHours(schedule.hour, schedule.minute, 0, 0)
      if (next <= from) next.setDate(next.getDate() + 1)
      return next
    }
    case 'weekly': {
      const next = new Date(from)
      next.setHours(schedule.hour, schedule.minute, 0, 0)
      const daysDiff = (schedule.weekday - next.getDay() + 7) % 7
      next.setDate(next.getDate() + (daysDiff === 0 && next <= from ? 7 : daysDiff))
      return next
    }
  }
}

// ── ScheduledJobsService ──────────────────────────────────────────────────────
export class ScheduledJobsService {
  private get db() { return getPrismaClient() }

  async list(): Promise<ScheduledJob[]> {
    return this.db.$queryRawUnsafe(
      `SELECT * FROM scheduled_jobs ORDER BY createdAt DESC`,
    ) as Promise<ScheduledJob[]>
  }

  async get(id: string): Promise<ScheduledJob | null> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT * FROM scheduled_jobs WHERE id = ?`, id,
    ) as ScheduledJob[]
    return rows[0] ?? null
  }

  async getDue(): Promise<ScheduledJob[]> {
    const now = new Date().toISOString()
    return this.db.$queryRawUnsafe(
      `SELECT * FROM scheduled_jobs WHERE isActive = 1 AND nextRunAt <= ? ORDER BY nextRunAt ASC`,
      now,
    ) as Promise<ScheduledJob[]>
  }

  async create(input: ScheduledJobInput): Promise<ScheduledJob> {
    const id = crypto.randomUUID()
    const schedule = parseSchedule(input.instruction)
    const scheduleJson = JSON.stringify(schedule)
    const nextRunAt = computeNextRunAt(schedule).toISOString()
    const title = (input.title ?? input.instruction).slice(0, 80)
    const now = new Date().toISOString()
    await this.db.$executeRawUnsafe(
      `INSERT INTO scheduled_jobs
         (id, title, instruction, agentName, schedule, isActive, nextRunAt, vpsId, projectId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      id, title, input.instruction, input.agentName ?? 'jarvis',
      scheduleJson, nextRunAt, input.vpsId ?? null, input.projectId ?? null, now, now,
    )
    return (await this.get(id))!
  }

  async update(id: string, data: Partial<ScheduledJobInput & { isActive: number }>): Promise<ScheduledJob> {
    const job = await this.get(id)
    if (!job) throw new Error('Job não encontrado')
    const now = new Date().toISOString()

    let scheduleJson = job.schedule
    let nextRunAt = job.nextRunAt
    if (data.instruction && data.instruction !== job.instruction) {
      const sched = parseSchedule(data.instruction)
      scheduleJson = JSON.stringify(sched)
      nextRunAt = computeNextRunAt(sched).toISOString()
    }

    await this.db.$executeRawUnsafe(
      `UPDATE scheduled_jobs
         SET title=?, instruction=?, agentName=?, schedule=?, isActive=?, nextRunAt=?, vpsId=?, projectId=?, updatedAt=?
       WHERE id=?`,
      (data.title ?? job.title).slice(0, 80),
      data.instruction ?? job.instruction,
      data.agentName ?? job.agentName,
      scheduleJson,
      data.isActive !== undefined ? data.isActive : job.isActive,
      nextRunAt,
      data.vpsId !== undefined ? data.vpsId : job.vpsId,
      data.projectId !== undefined ? data.projectId : job.projectId,
      now, id,
    )
    return (await this.get(id))!
  }

  async delete(id: string): Promise<void> {
    await this.db.$executeRawUnsafe(`DELETE FROM scheduled_jobs WHERE id = ?`, id)
  }

  async markRan(id: string, result?: string): Promise<void> {
    const job = await this.get(id)
    if (!job) return
    const schedule: JobSchedule = JSON.parse(job.schedule)
    const nextRunAt = computeNextRunAt(schedule).toISOString()
    const now = new Date().toISOString()
    await this.db.$executeRawUnsafe(
      `UPDATE scheduled_jobs SET lastRunAt=?, nextRunAt=?, lastResult=?, updatedAt=? WHERE id=?`,
      now, nextRunAt, result !== undefined ? result.slice(0, 500) : null, now, id,
    )
  }
}
