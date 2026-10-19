import { getPrismaClient } from '@cwm/db'
import type { IncidentDiagnosis, IncidentStatus, IncidentType } from './incident.js'

/** Incidente de VPS (FASE 7). Tabela raw-SQL; datas em ms como BIGINT (INTEGER quebra o $queryRawUnsafe — ver run-log.ts). */
export interface HermesIncident {
  id: string
  vpsId: string
  vpsName: string
  type: IncidentType
  value: number
  threshold: number
  title: string
  status: IncidentStatus
  createdAt: number
  updatedAt: number
  runId: string | null
  error: string
  diagnosis: IncidentDiagnosis | null
}

/** Um alerta repetido do mesmo tipo na mesma VPS, com incidente ainda aberto, atualiza em vez de duplicar. */
const OPEN_STATUSES: IncidentStatus[] = ['open', 'diagnosing', 'diagnosed', 'diagnosis_failed']

export class HermesIncidentStore {
  private get db() { return getPrismaClient() }

  async ensureTable(): Promise<void> {
    await this.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS hermes_incidents (
        id TEXT PRIMARY KEY,
        vpsId TEXT NOT NULL,
        vpsName TEXT NOT NULL,
        type TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 0,
        threshold INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        createdAt BIGINT NOT NULL,
        updatedAt BIGINT NOT NULL,
        runId TEXT,
        error TEXT NOT NULL DEFAULT '',
        diagnosis TEXT NOT NULL DEFAULT ''
      )`)
    await this.db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS hermes_incidents_vps ON hermes_incidents (vpsId, createdAt)`)
    // Diagnóstico que estava rodando quando o app fechou não vai terminar.
    await this.db.$executeRawUnsafe(
      `UPDATE hermes_incidents SET status = 'diagnosis_failed', error = 'Diagnóstico interrompido — o app foi fechado.' WHERE status = 'diagnosing'`,
    )
  }

  /** Registra um alerta: reaproveita o incidente aberto do mesmo tipo na VPS ou cria um novo. Devolve { incident, created }. */
  async recordAlert(a: { vpsId: string; vpsName: string; type: IncidentType; value: number; threshold: number; title: string }): Promise<{ incident: HermesIncident; created: boolean }> {
    const now = Date.now()
    if (a.type !== 'manual') {
      const rows = await this.db.$queryRawUnsafe(
        `SELECT id FROM hermes_incidents WHERE vpsId = ? AND type = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')}) ORDER BY createdAt DESC LIMIT 1`,
        a.vpsId, a.type, ...OPEN_STATUSES,
      ) as { id: string }[]
      if (rows[0]) {
        await this.db.$executeRawUnsafe(`UPDATE hermes_incidents SET value = ?, title = ?, updatedAt = ? WHERE id = ?`, a.value, a.title, now, rows[0].id)
        return { incident: (await this.get(rows[0].id))!, created: false }
      }
    }
    const id = crypto.randomUUID()
    await this.db.$executeRawUnsafe(
      `INSERT INTO hermes_incidents (id, vpsId, vpsName, type, value, threshold, title, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      id, a.vpsId, a.vpsName, a.type, a.value, a.threshold, a.title, now, now,
    )
    return { incident: (await this.get(id))!, created: true }
  }

  async get(id: string): Promise<HermesIncident | null> {
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM hermes_incidents WHERE id = ? LIMIT 1`, id) as Record<string, unknown>[]
    return rows[0] ? this.map(rows[0]) : null
  }

  async listForVps(vpsId: string, limit = 30): Promise<HermesIncident[]> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT * FROM hermes_incidents WHERE vpsId = ? ORDER BY createdAt DESC LIMIT ?`, vpsId, limit,
    ) as Record<string, unknown>[]
    return rows.map(r => this.map(r))
  }

  async update(id: string, patch: { status?: IncidentStatus; runId?: string | null; error?: string; diagnosis?: IncidentDiagnosis | null }): Promise<void> {
    const sets: string[] = ['updatedAt = ?']
    const params: unknown[] = [Date.now()]
    if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
    if (patch.runId !== undefined) { sets.push('runId = ?'); params.push(patch.runId) }
    if (patch.error !== undefined) { sets.push('error = ?'); params.push(patch.error.slice(0, 2000)) }
    if (patch.diagnosis !== undefined) { sets.push('diagnosis = ?'); params.push(patch.diagnosis ? JSON.stringify(patch.diagnosis) : '') }
    params.push(id)
    await this.db.$executeRawUnsafe(`UPDATE hermes_incidents SET ${sets.join(', ')} WHERE id = ?`, ...params)
  }

  private map(r: Record<string, unknown>): HermesIncident {
    let diagnosis: IncidentDiagnosis | null = null
    if (r['diagnosis']) { try { diagnosis = JSON.parse(String(r['diagnosis'])) as IncidentDiagnosis } catch { diagnosis = null } }
    return {
      id: String(r['id']),
      vpsId: String(r['vpsId']),
      vpsName: String(r['vpsName']),
      type: String(r['type']) as IncidentType,
      value: Number(r['value'] ?? 0),
      threshold: Number(r['threshold'] ?? 0),
      title: String(r['title'] ?? ''),
      status: String(r['status']) as IncidentStatus,
      createdAt: Number(r['createdAt']),
      updatedAt: Number(r['updatedAt']),
      runId: r['runId'] == null ? null : String(r['runId']),
      error: String(r['error'] ?? ''),
      diagnosis,
    }
  }
}
