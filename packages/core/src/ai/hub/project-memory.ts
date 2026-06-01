import { getPrismaClient } from '@cwm/db'
import { randomUUID } from 'node:crypto'

export interface MemoryBlock {
  id: string
  vpsId: string | null
  projectId: string | null
  key: string
  value: string
  updatedAt: string
}

type Row = { id: string; vpsId: string | null; projectId: string | null; key: string; value: string; updatedAt: string }

export class ProjectMemoryService {
  private get db() { return getPrismaClient() }

  async list(vpsId?: string | null, projectId?: string | null): Promise<MemoryBlock[]> {
    const conditions: string[] = []
    const params: (string | null)[] = []

    if (vpsId !== undefined) { conditions.push('"vpsId" = ?'); params.push(vpsId) }
    else conditions.push('("vpsId" IS NULL)')

    if (projectId !== undefined) { conditions.push('"projectId" = ?'); params.push(projectId) }
    else conditions.push('("projectId" IS NULL)')

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = (await this.db.$queryRawUnsafe(
      `SELECT * FROM project_memory ${where} ORDER BY key ASC`,
      ...params
    )) as Row[]
    return rows
  }

  async save(data: { vpsId?: string | null; projectId?: string | null; key: string; value: string }): Promise<MemoryBlock> {
    const existing = (await this.db.$queryRawUnsafe(
      `SELECT id FROM project_memory WHERE vpsId IS ? AND projectId IS ? AND key = ?`,
      data.vpsId ?? null, data.projectId ?? null, data.key
    )) as Array<{ id: string }>

    if (existing.length) {
      await this.db.$executeRawUnsafe(
        `UPDATE project_memory SET value = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        data.value, existing[0].id
      )
      const rows = (await this.db.$queryRawUnsafe(`SELECT * FROM project_memory WHERE id = ?`, existing[0].id)) as Row[]
      return rows[0]
    }

    const id = randomUUID()
    await this.db.$executeRawUnsafe(
      `INSERT INTO project_memory (id, vpsId, projectId, key, value) VALUES (?, ?, ?, ?, ?)`,
      id, data.vpsId ?? null, data.projectId ?? null, data.key, data.value
    )
    const rows = (await this.db.$queryRawUnsafe(`SELECT * FROM project_memory WHERE id = ?`, id)) as Row[]
    return rows[0]
  }

  async delete(id: string): Promise<void> {
    await this.db.$executeRawUnsafe(`DELETE FROM project_memory WHERE id = ?`, id)
  }

  /** Retorna o conteúdo formatado para injetar no system prompt. */
  async buildBlock(vpsId?: string | null, projectId?: string | null): Promise<string> {
    const blocks = await this.list(vpsId, projectId)
    if (!blocks.length) return ''
    return blocks.map(b => `### ${b.key}\n${b.value}`).join('\n\n')
  }
}
