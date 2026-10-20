import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getPrismaClient } from '@cwm/db'
import type { TerminalService } from '../terminal/terminal.service.js'
import type { SftpService, SftpSession } from '../sftp/sftp.service.js'
import { ProjectsService } from '../projects/projects.service.js'
import { ProjectSchema } from '@cwm/config'

const execFileP = promisify(execFile)

/**
 * Projeto que começa numa pasta local (OneDrive) e é enviado à VPS para o Hermes trabalhar.
 * O Hermes só roda na VPS; a pasta local continua sendo a do usuário. A ponte guarda, por arquivo,
 * o hash da última versão igual nos dois lados (manifest) — é isso que separa "mudou na VPS",
 * "mudou no PC" e "mudou nos dois" (conflito) quando o usuário traz ou envia alterações.
 */

/** Pastas que não vão para a VPS nem entram na comparação (geradas/instaláveis). `build/` fica: às vezes é fonte. */
export const SYNC_EXCLUDE_DIRS = ['node_modules', '.next', '.nuxt', 'dist', '.turbo', '.cache', 'coverage', '.venv', '__pycache__'] as const
/** Vai para a VPS no envio inicial (histórico do projeto), mas nunca é sincronizado arquivo a arquivo. */
const GIT_DIR = '.git'
/** Escritos pelo próprio NEX na pasta da VPS (contexto do Hermes) — não voltam para o PC. */
const SYNC_IGNORE_FILES = new Set(['.hermes.md'])

/** Pastas de sistema que nunca recebem um projeto (o envio extrai um tar dentro da pasta). */
const FORBIDDEN_ROOTS = new Set(['/', '/root', '/home', '/etc', '/usr', '/bin', '/sbin', '/lib', '/lib64', '/var', '/opt', '/tmp', '/boot', '/dev', '/proc', '/sys', '/srv', '/mnt', '/media', '/run'])

export type SyncChangeKind = 'added' | 'modified' | 'deleted'
/** `kind` descreve o que acontece no lado que RECEBE (pull: no PC; push: na VPS). */
export interface SyncChange { path: string; kind: SyncChangeKind; conflict: boolean }
export interface LocalSyncDiff {
  /** VPS → PC. Inclui conflitos (marcados), que só são aplicados se o usuário escolher. */
  pull: SyncChange[]
  /** PC → VPS. Idem. */
  push: SyncChange[]
  /** Mudou igual nos dois lados: só atualiza o manifest. */
  settled: Record<string, string | null>
}
export interface LocalLink {
  localPath: string
  projectId: string
  projectName: string
  vpsId: string
  vpsName: string
  remotePath: string
  lastSyncAt: number
}
export interface LocalSyncStatus { link: LocalLink; pull: SyncChange[]; push: SyncChange[] }
export interface LocalSyncApplyResult { applied: number; skipped: { path: string; reason: string }[] }

type Hashes = Record<string, string>

// ── Funções puras (testadas em local-sync.test.ts) ─────────────────────────────

/** Caminho remoto aceitável para receber um projeto: absoluto, ≥ 2 níveis, sem `..`, só caracteres seguros, fora das pastas de sistema. */
export function validatePublishPath(p: string): string | null {
  const s = p.trim().replace(/\/+$/, '')
  if (!s.startsWith('/')) return 'O caminho na VPS precisa ser absoluto (começar com /).'
  if (!/^\/[A-Za-z0-9._@+\-/]+$/.test(s)) return 'Use só letras, números e . _ - @ + no caminho (sem espaços nem acentos).'
  const parts = s.split('/').filter(Boolean)
  if (parts.some(x => x === '..' || x === '.')) return 'O caminho não pode ter . ou .. como pasta.'
  if (parts.length < 2 || FORBIDDEN_ROOTS.has(s)) return `"${s}" é uma pasta do sistema — escolha uma subpasta (ex.: /root/meu-projeto).`
  return null
}

/** Caminho relativo vindo da VPS que dá para gravar no Windows sem escapar da pasta do projeto. */
export function isSafeRelPath(rel: string): boolean {
  if (!rel || rel.startsWith('/') || rel.includes('\\') || /[<>:"|?*\u0000-\u001f]/.test(rel)) return false
  return rel.split('/').every(seg => seg !== '' && seg !== '.' && seg !== '..' && !/[. ]$/.test(seg))
}

export function isSyncExcluded(rel: string): boolean {
  const segs = rel.split('/')
  if (segs.some(s => s === GIT_DIR || (SYNC_EXCLUDE_DIRS as readonly string[]).includes(s))) return true
  return SYNC_IGNORE_FILES.has(rel)
}

/** Saída de `sha1sum` (`<hash>  ./<caminho>`). Linhas escapadas (nome com \ ou quebra de linha) são ignoradas. */
export function parseSha1sumOutput(out: string): Hashes {
  const res: Hashes = {}
  for (const line of out.split('\n')) {
    const m = /^([0-9a-f]{40}) [ *]\.\/(.+)$/.exec(line.replace(/\r$/, ''))
    if (m && !isSyncExcluded(m[2])) res[m[2]] = m[1]
  }
  return res
}

/** Compara a última versão sincronizada (base) com o PC e a VPS. */
export function diffSides(base: Hashes, local: Hashes, remote: Hashes): LocalSyncDiff {
  const pull: SyncChange[] = []
  const push: SyncChange[] = []
  const settled: Record<string, string | null> = {}
  const all = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])
  for (const p of [...all].sort()) {
    const b = base[p], l = local[p], r = remote[p]
    const lc = l !== b, rc = r !== b
    if (!lc && !rc) continue
    if (lc && rc && l === r) { settled[p] = l ?? null; continue }
    const conflict = lc && rc
    if (rc) pull.push({ path: p, kind: r === undefined ? 'deleted' : l === undefined ? 'added' : 'modified', conflict })
    if (lc) push.push({ path: p, kind: l === undefined ? 'deleted' : r === undefined ? 'added' : 'modified', conflict })
  }
  return { pull, push, settled }
}

/** Aspas simples para shell remoto. */
function shq(s: string): string { return `'${s.replace(/'/g, `'\\''`)}'` }

function localKey(localPath: string): string {
  const r = path.resolve(localPath).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? r.toLowerCase() : r
}

// ── Serviço ────────────────────────────────────────────────────────────────────

export class HermesLocalSync {
  private get db() { return getPrismaClient() }
  private readonly projects = new ProjectsService()

  constructor(private readonly terminal: TerminalService, private readonly sftp: SftpService) {}

  async ensureTable(): Promise<void> {
    await this.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS hermes_local_links (
        id TEXT PRIMARY KEY,
        localKey TEXT NOT NULL UNIQUE,
        localPath TEXT NOT NULL,
        projectId TEXT NOT NULL,
        manifest TEXT NOT NULL DEFAULT '{}',
        lastSyncAt BIGINT NOT NULL,
        createdAt BIGINT NOT NULL
      )`)
  }

  async getLink(localPath: string): Promise<LocalLink | null> {
    const row = await this.getRow(localPath)
    if (!row) return null
    const project = await this.db.project.findUnique({ where: { id: row.projectId }, include: { vpsServer: true } })
    // Projeto apagado em Projetos: sem ligação ativa, mas a linha fica — apagar aqui perdia o vínculo
    // sem aviso (2026-10-20). Enviar/Ligar de novo substituem a linha antiga.
    if (!project) return null
    return {
      localPath: row.localPath, projectId: project.id, projectName: project.name,
      vpsId: project.vpsServerId, vpsName: project.vpsServer.name, remotePath: project.remotePath,
      lastSyncAt: row.lastSyncAt,
    }
  }

  /**
   * Primeiro envio: empacota a pasta (sem as geradas), extrai numa pasta vazia/nova da VPS,
   * garante um repositório git lá (o fechamento da entrega e as tarefas paralelas do Hermes usam git),
   * cadastra o projeto e liga a pasta local a ele.
   */
  async publish(input: { localPath: string; vpsId: string; remotePath: string; name: string }): Promise<LocalLink> {
    const localPath = path.resolve(input.localPath)
    const remotePath = input.remotePath.trim().replace(/\/+$/, '')
    const pathErr = validatePublishPath(remotePath)
    if (pathErr) throw new Error(pathErr)
    const st = await fs.stat(localPath).catch(() => null)
    if (!st?.isDirectory()) throw new Error(`Pasta local não encontrada: ${localPath}`)
    const existing = await this.getLink(localPath)
    if (existing) throw new Error(`Esta pasta já está ligada ao projeto "${existing.projectName}" (${existing.vpsName}:${existing.remotePath}).`)
    const vps = await this.db.vpsServer.findUnique({ where: { id: input.vpsId } })
    if (!vps) throw new Error('VPS não encontrada.')

    const check = await this.terminal.exec(input.vpsId,
      `D=${shq(remotePath)}; if [ -e "$D" ]; then if [ -d "$D" ] && [ -z "$(ls -A "$D")" ]; then echo NEX_EMPTY; else echo NEX_EXISTS; fi; else echo NEX_FREE; fi`)
    if (check.includes('NEX_EXISTS')) throw new Error(`${remotePath} já existe na VPS e não está vazia — escolha outra pasta.`)
    if (!check.includes('NEX_EMPTY') && !check.includes('NEX_FREE')) throw new Error(`Não consegui verificar a pasta na VPS: ${check.trim().slice(0, 300)}`)

    const manifest = await this.hashLocal(localPath)
    const tmpLocal = path.join(os.tmpdir(), `zeus-publish-${crypto.randomUUID()}.tgz`)
    const tmpRemote = `/tmp/nex-upload-${crypto.randomUUID()}.tgz`
    try {
      const tarBin = process.platform === 'win32' ? path.join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
      await execFileP(tarBin, ['-czf', tmpLocal, ...SYNC_EXCLUDE_DIRS.map(d => `--exclude=${d}`), '-C', localPath, '.'],
        { timeout: 300_000, maxBuffer: 10 * 1024 * 1024, windowsHide: true })
      const session = await this.sftp.openSession(input.vpsId)
      try { await session.uploadFile(tmpLocal, tmpRemote) } finally { session.destroy() }
    } finally {
      await fs.rm(tmpLocal, { force: true }).catch(() => {})
    }

    const extract = await this.terminal.exec(input.vpsId,
      `D=${shq(remotePath)}; T=${shq(tmpRemote)}; mkdir -p "$D" && tar -xzf "$T" -C "$D" --no-same-owner 2>&1; rc=$?; rm -f "$T"; echo NEX_RC=$rc`, 300_000)
    if (!/NEX_RC=0\b/.test(extract)) throw new Error(`Falha ao extrair o projeto na VPS: ${extract.replace(/NEX_RC=\d+/, '').trim().slice(0, 500)}`)

    // Repositório que veio do Windows com core.autocrlf=true: os arquivos chegam com CRLF e o blob tem LF —
    // sem `input`, o git da VPS mostraria todo arquivo como modificado (e o diff da entrega viraria lixo).
    const autocrlf = await execFileP('git', ['-C', localPath, 'config', '--get', 'core.autocrlf'], { windowsHide: true, timeout: 10_000 })
      .then(r => r.stdout.trim().toLowerCase()).catch(() => '')
    await this.terminal.exec(input.vpsId, [
      `cd ${shq(remotePath)} || exit 0`,
      `if [ -d .git ]; then ${autocrlf === 'true' ? 'git config core.autocrlf input; ' : ''}echo NEX_GIT=existing`,
      `elif command -v git >/dev/null 2>&1; then git init -q && git add -A && git -c user.name='Zeus IDE' -c user.email='zeus-ide@localhost' commit -qm 'Importado do OneDrive pelo Zeus IDE' && echo NEX_GIT=init || echo NEX_GIT=fail`,
      `else echo NEX_GIT=nogit; fi`,
    ].join('\n'), 120_000)

    const project = await this.projects.create({
      name: input.name.trim() || path.basename(localPath),
      description: `Enviado da pasta local ${localPath}`,
      remotePath, vpsServerId: input.vpsId, gitRepo: '',
    })
    return this.saveLink(localPath, project.id, manifest)
  }

  /**
   * Liga a pasta local a uma pasta que JÁ existe na VPS (projeto enviado antes e cujo cadastro ou
   * ligação se perdeu), sem copiar nada. Reaproveita o projeto da mesma VPS+pasta; se ele foi
   * apagado mas o Hermes ainda tem histórico nessa pasta, recria o projeto com o mesmo id (tarefas e
   * estado do agente voltam). Base da sincronização = arquivos idênticos nos dois lados; o que
   * difere aparece em Trazer/Enviar (como conflito quando existe nos dois).
   */
  async relink(input: { localPath: string; vpsId: string; remotePath: string; name: string }): Promise<LocalLink> {
    const localPath = path.resolve(input.localPath)
    const remotePath = input.remotePath.trim().replace(/\/+$/, '')
    const pathErr = validatePublishPath(remotePath)
    if (pathErr) throw new Error(pathErr)
    const st = await fs.stat(localPath).catch(() => null)
    if (!st?.isDirectory()) throw new Error(`Pasta local não encontrada: ${localPath}`)
    const existing = await this.getLink(localPath)
    if (existing) throw new Error(`Esta pasta já está ligada ao projeto "${existing.projectName}" (${existing.vpsName}:${existing.remotePath}).`)
    const vps = await this.db.vpsServer.findUnique({ where: { id: input.vpsId } })
    if (!vps) throw new Error('VPS não encontrada.')

    const [local, remote] = await Promise.all([this.hashLocal(localPath), this.hashRemote(input.vpsId, remotePath)])
    const base: Hashes = {}
    for (const [p, h] of Object.entries(local)) if (remote[p] === h) base[p] = h

    let project = await this.db.project.findFirst({ where: { vpsServerId: input.vpsId, remotePath } })
    if (!project) {
      const orphans = await this.db.$queryRawUnsafe(
        `SELECT a.projectId FROM hermes_project_agents a JOIN hermes_instances i ON i.id = a.hermesInstanceId
         WHERE a.workspace = ? AND i.vpsServerId = ? ORDER BY a.updatedAt DESC`, remotePath, input.vpsId,
      ) as { projectId: string }[]
      let reuseId: string | undefined
      for (const o of orphans) {
        if (!(await this.db.project.findUnique({ where: { id: o.projectId } }))) { reuseId = o.projectId; break }
      }
      const data = ProjectSchema.parse({
        name: input.name.trim() || path.basename(localPath),
        description: `Ligado à pasta local ${localPath}`,
        remotePath, vpsServerId: input.vpsId, gitRepo: '',
      })
      project = await this.db.project.create({ data: reuseId ? { ...data, id: reuseId } : data })
    }
    return this.saveLink(localPath, project.id, base)
  }

  /** O que mudou desde a última sincronização, nos dois sentidos. */
  async status(localPath: string): Promise<LocalSyncStatus> {
    const { link, diff } = await this.computeDiff(localPath)
    return { link, pull: diff.pull, push: diff.push }
  }

  /** VPS → PC, só os caminhos escolhidos. A comparação é refeita aqui: o renderer só escolhe, não descreve a mudança. */
  async pull(localPath: string, paths: string[]): Promise<LocalSyncApplyResult> {
    const { link, row, diff } = await this.computeDiff(localPath)
    const byPath = new Map(diff.pull.map(c => [c.path, c]))
    const manifest: Hashes = { ...row.manifest }
    this.applySettled(manifest, diff.settled)
    const root = path.resolve(row.localPath)
    const skipped: LocalSyncApplyResult['skipped'] = []
    let applied = 0
    const session = await this.sftp.openSession(link.vpsId)
    try {
      for (const p of paths) {
        const c = byPath.get(p)
        if (!c) { skipped.push({ path: p, reason: 'não mudou mais' }); continue }
        if (!isSafeRelPath(p)) { skipped.push({ path: p, reason: 'nome inválido no Windows' }); continue }
        const target = path.resolve(root, ...p.split('/'))
        if (!target.startsWith(root + path.sep)) { skipped.push({ path: p, reason: 'fora da pasta do projeto' }); continue }
        try {
          if (c.kind === 'deleted') {
            await fs.rm(target, { force: true })
            delete manifest[p]
          } else {
            const data = await session.readFileBuffer(`${link.remotePath}/${p}`)
            await fs.mkdir(path.dirname(target), { recursive: true })
            await fs.writeFile(target, data)
            manifest[p] = sha1(data)
          }
          applied++
        } catch (e) {
          skipped.push({ path: p, reason: e instanceof Error ? e.message : String(e) })
        }
      }
    } finally { session.destroy() }
    await this.saveManifest(row.id, manifest)
    return { applied, skipped }
  }

  /** PC → VPS, só os caminhos escolhidos. Recusado enquanto o Hermes estiver rodando no projeto. */
  async push(localPath: string, paths: string[]): Promise<LocalSyncApplyResult> {
    const { link, row, diff } = await this.computeDiff(localPath)
    const agent = await this.db.hermesProjectAgent.findUnique({ where: { projectId: link.projectId } })
    if (agent?.status === 'running') throw new Error('O Hermes está rodando neste projeto — espere terminar para enviar alterações.')
    const byPath = new Map(diff.push.map(c => [c.path, c]))
    const manifest: Hashes = { ...row.manifest }
    this.applySettled(manifest, diff.settled)
    const root = path.resolve(row.localPath)
    const skipped: LocalSyncApplyResult['skipped'] = []
    let applied = 0
    const session = await this.sftp.openSession(link.vpsId)
    try {
      for (const p of paths) {
        const c = byPath.get(p)
        if (!c) { skipped.push({ path: p, reason: 'não mudou mais' }); continue }
        if (!isSafeRelPath(p)) { skipped.push({ path: p, reason: 'nome inválido' }); continue }
        const remote = `${link.remotePath}/${p}`
        try {
          if (c.kind === 'deleted') {
            await session.delete(remote, false).catch(() => { /* já não existe */ })
            delete manifest[p]
          } else {
            const data = await fs.readFile(path.resolve(root, ...p.split('/')))
            await session.mkdirp(path.posix.dirname(remote))
            await session.writeFileBuffer(remote, data)
            manifest[p] = sha1(data)
          }
          applied++
        } catch (e) {
          skipped.push({ path: p, reason: e instanceof Error ? e.message : String(e) })
        }
      }
    } finally { session.destroy() }
    await this.saveManifest(row.id, manifest)
    return { applied, skipped }
  }

  // ── internos ──

  /** Grava a ligação, substituindo uma linha antiga da mesma pasta (projeto apagado). */
  private async saveLink(localPath: string, projectId: string, manifest: Hashes): Promise<LocalLink> {
    const now = Date.now()
    await this.db.$executeRawUnsafe(`DELETE FROM hermes_local_links WHERE localKey = ?`, localKey(localPath))
    await this.db.$executeRawUnsafe(
      `INSERT INTO hermes_local_links (id, localKey, localPath, projectId, manifest, lastSyncAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(), localKey(localPath), localPath, projectId, JSON.stringify(manifest), now, now,
    )
    return (await this.getLink(localPath))!
  }

  private async getRow(localPath: string): Promise<{ id: string; localPath: string; projectId: string; manifest: Hashes; lastSyncAt: number } | null> {
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM hermes_local_links WHERE localKey = ? LIMIT 1`, localKey(localPath)) as Record<string, unknown>[]
    const r = rows[0]
    if (!r) return null
    let manifest: Hashes = {}
    try { manifest = JSON.parse(String(r['manifest'] ?? '{}')) as Hashes } catch { manifest = {} }
    return { id: String(r['id']), localPath: String(r['localPath']), projectId: String(r['projectId']), manifest, lastSyncAt: Number(r['lastSyncAt']) }
  }

  private async computeDiff(localPath: string) {
    const link = await this.getLink(localPath)
    const row = link && await this.getRow(localPath)
    if (!link || !row) throw new Error('Esta pasta não está ligada a um projeto na VPS.')
    const [local, remote] = await Promise.all([this.hashLocal(row.localPath), this.hashRemote(link.vpsId, link.remotePath)])
    return { link, row, diff: diffSides(row.manifest, local, remote) }
  }

  private applySettled(manifest: Hashes, settled: Record<string, string | null>): void {
    for (const [p, h] of Object.entries(settled)) { if (h === null) delete manifest[p]; else manifest[p] = h }
  }

  private async saveManifest(id: string, manifest: Hashes): Promise<void> {
    await this.db.$executeRawUnsafe(`UPDATE hermes_local_links SET manifest = ?, lastSyncAt = ? WHERE id = ?`, JSON.stringify(manifest), Date.now(), id)
  }

  private async hashLocal(root: string): Promise<Hashes> {
    const out: Hashes = {}
    const walk = async (dir: string, rel: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name
        if (isSyncExcluded(r)) continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) await walk(full, r)
        else if (e.isFile()) out[r] = sha1(await fs.readFile(full))
      }
    }
    await walk(root, '')
    return out
  }

  private async hashRemote(vpsId: string, remotePath: string): Promise<Hashes> {
    const prune = [GIT_DIR, ...SYNC_EXCLUDE_DIRS].map(d => `-name ${shq(d)}`).join(' -o ')
    const out = await this.terminal.exec(vpsId,
      `cd ${shq(remotePath)} 2>/dev/null || { echo NEX_NODIR; exit 0; }; find . -type d \\( ${prune} \\) -prune -o -type f -print0 | xargs -0 -r sha1sum; echo NEX_DONE`, 120_000)
    if (out.includes('NEX_NODIR')) throw new Error(`A pasta ${remotePath} não existe mais na VPS.`)
    if (!out.includes('NEX_DONE')) throw new Error('Não consegui listar os arquivos do projeto na VPS.')
    return parseSha1sumOutput(out)
  }
}

function sha1(data: Buffer): string { return crypto.createHash('sha1').update(data).digest('hex') }
