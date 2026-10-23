import { randomUUID } from 'node:crypto'
import { getPrismaClient } from '@cwm/db'
import {
  ProjectEnvironmentSchema, isUnderRemotePath,
  type EnvironmentKind, type ProjectEnvironmentInput,
} from '@cwm/config'

/**
 * Ambientes do projeto (Project First, Fase 4b). O "agente" é a VPS do próprio projeto (ZEUS, onde o
 * Hermes trabalha); aqui ficam os ambientes que recebem deploy: no máximo um staging e uma produção por
 * projeto, cada um numa VPS + pasta, com branch, URL de smoke test e comandos do deploy.
 *
 * Produção é protegida — as consultas abaixo são o que o main usa para:
 *  - IDE só leitura em pasta de produção (`productionAt`)
 *  - terminal com aviso e agentes (Hermes/Squad) fora da VPS que hospeda produção (`productionOnVps`)
 */

export interface ProjectEnvironment {
  id: string
  projectId: string
  kind: EnvironmentKind
  vpsServerId: string | null
  vpsName: string
  remotePath: string
  branch: string
  url: string
  deployCommands: string
  createdAt: string
  updatedAt: string
  /** Último deploy (qualquer status) — para a tela e para o gate da produção. */
  lastDeploy: DeployRecord | null
}

export type DeployStatus = 'running' | 'ok' | 'failed' | 'rolled_back'

export interface DeployRecord {
  id: string
  envId: string
  projectId: string
  kind: EnvironmentKind
  commitSha: string
  previousCommit: string
  status: DeployStatus
  /** '' = sem URL; 'ok' / 'falhou: …' */
  smoke: string
  log: string
  startedAt: string
  finishedAt: string | null
}

export interface ProductionTarget { envId: string; projectId: string; projectName: string; vpsServerId: string; remotePath: string }

type EnvRow = Omit<ProjectEnvironment, 'lastDeploy' | 'vpsName'> & { vpsName: string | null }

export class EnvironmentsService {
  private get db() { return getPrismaClient() }

  async list(projectId: string): Promise<ProjectEnvironment[]> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT e.*, v.name AS vpsName FROM project_environments e LEFT JOIN vps_servers v ON v.id = e.vpsServerId
       WHERE e.projectId = ? ORDER BY CASE e.kind WHEN 'staging' THEN 0 ELSE 1 END`, projectId,
    ) as EnvRow[]
    return Promise.all(rows.map(r => this.withLastDeploy(r)))
  }

  async get(id: string): Promise<ProjectEnvironment | null> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT e.*, v.name AS vpsName FROM project_environments e LEFT JOIN vps_servers v ON v.id = e.vpsServerId WHERE e.id = ?`, id,
    ) as EnvRow[]
    return rows[0] ? this.withLastDeploy(rows[0]) : null
  }

  async byKind(projectId: string, kind: EnvironmentKind): Promise<ProjectEnvironment | null> {
    return (await this.list(projectId)).find(e => e.kind === kind) ?? null
  }

  /** Cria ou atualiza o ambiente daquele tipo no projeto (um por tipo). */
  async save(input: ProjectEnvironmentInput): Promise<ProjectEnvironment> {
    const d = ProjectEnvironmentSchema.parse(input)
    const project = await this.db.project.findUnique({ where: { id: d.projectId } })
    if (!project) throw new Error('Projeto não encontrado')
    const vps = await this.db.vpsServer.findUnique({ where: { id: d.vpsServerId } })
    if (!vps) throw new Error('VPS não encontrada')
    // A pasta do agente (onde o Hermes trabalha) não pode ser um ambiente: o deploy faria checkout por cima do trabalho dele
    if (project.vpsServerId === d.vpsServerId && project.remotePath && (isUnderRemotePath(d.remotePath, project.remotePath) || isUnderRemotePath(project.remotePath, d.remotePath))) {
      throw new Error('Essa pasta é a do agente (onde o Hermes trabalha) — use outra pasta para o ambiente')
    }
    const other = await this.byKind(d.projectId, d.kind === 'staging' ? 'production' : 'staging')
    if (other && other.vpsServerId === d.vpsServerId && (isUnderRemotePath(d.remotePath, other.remotePath) || isUnderRemotePath(other.remotePath, d.remotePath))) {
      throw new Error('Staging e produção precisam de pastas separadas')
    }
    const existing = await this.byKind(d.projectId, d.kind)
    if (existing) {
      await this.db.$executeRawUnsafe(
        `UPDATE project_environments SET vpsServerId = ?, remotePath = ?, branch = ?, url = ?, deployCommands = ?, updatedAt = datetime('now') WHERE id = ?`,
        d.vpsServerId, d.remotePath, d.branch, d.url, d.deployCommands, existing.id,
      )
      return (await this.get(existing.id))!
    }
    const id = randomUUID()
    await this.db.$executeRawUnsafe(
      `INSERT INTO project_environments (id, projectId, kind, vpsServerId, remotePath, branch, url, deployCommands) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, d.projectId, d.kind, d.vpsServerId, d.remotePath, d.branch, d.url, d.deployCommands,
    )
    return (await this.get(id))!
  }

  /** Tira o ambiente do Zeus (não mexe em nada na VPS). */
  async remove(id: string): Promise<void> {
    await this.db.$executeRawUnsafe(`DELETE FROM project_deploys WHERE envId = ?`, id)
    await this.db.$executeRawUnsafe(`DELETE FROM project_environments WHERE id = ?`, id)
  }

  async history(envId: string, limit = 20): Promise<DeployRecord[]> {
    return await this.db.$queryRawUnsafe(
      `SELECT * FROM project_deploys WHERE envId = ? ORDER BY startedAt DESC LIMIT ?`, envId, limit,
    ) as DeployRecord[]
  }

  // ── Proteção da produção ──────────────────────────────────────────────────

  async productionTargets(): Promise<ProductionTarget[]> {
    return await this.db.$queryRawUnsafe(
      `SELECT e.id AS envId, e.projectId, p.name AS projectName, e.vpsServerId, e.remotePath
       FROM project_environments e JOIN projects p ON p.id = e.projectId
       WHERE e.kind = 'production' AND e.vpsServerId IS NOT NULL`,
    ) as ProductionTarget[]
  }

  /** Ambientes de produção nesta VPS (terminal pede confirmação; Hermes/Squad não entram). */
  async productionOnVps(vpsId: string): Promise<ProductionTarget[]> {
    return (await this.productionTargets()).filter(t => t.vpsServerId === vpsId)
  }

  /** Produção que contém este caminho da VPS (IDE só leitura). Caminho relativo conta como produção se a VPS tem alguma. */
  async productionAt(vpsId: string, remotePath: string): Promise<ProductionTarget | null> {
    const onVps = await this.productionOnVps(vpsId)
    if (!onVps.length) return null
    if (!remotePath.startsWith('/')) return onVps[0]
    return onVps.find(t => isUnderRemotePath(remotePath, t.remotePath)) ?? null
  }

  private async withLastDeploy(r: EnvRow): Promise<ProjectEnvironment> {
    const last = await this.db.$queryRawUnsafe(
      `SELECT * FROM project_deploys WHERE envId = ? ORDER BY startedAt DESC LIMIT 1`, r.id,
    ) as DeployRecord[]
    return { ...r, vpsName: r.vpsName ?? '', lastDeploy: last[0] ?? null }
  }
}
