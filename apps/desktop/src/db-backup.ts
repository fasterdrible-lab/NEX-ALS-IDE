import fs from 'node:fs'
import path from 'node:path'
import { getPrismaClient } from '@cwm/db'

/**
 * Cópia de segurança do banco (cwm.db) ao abrir o Zeus e a cada hora, em <userData>/backups.
 * Motivo: em 2026-10-20 os projetos e depois todas as tarefas do Hermes sumiram do banco (DELETE
 * linha a linha, causa não encontrada). Cada cópia anota em backups.log quantas linhas havia nas
 * tabelas principais — se algo sumir de novo, o log mostra entre quais horários foi.
 * `VACUUM INTO` tira uma foto consistente mesmo com o app gravando (cópia do arquivo não garante).
 */

const KEEP = 20
const HOURLY_MS = 60 * 60_000
const COUNTED = ['vps_servers', 'projects', 'agent_tasks', 'hermes_project_agents', 'hermes_task_runs', 'hermes_local_links'] as const

async function counts(): Promise<string> {
  const db = getPrismaClient()
  const parts: string[] = []
  for (const t of COUNTED) {
    const rows = await db.$queryRawUnsafe(`SELECT count(*) AS n FROM ${t}`).catch(() => null) as { n: number | bigint }[] | null
    parts.push(`${t}=${rows ? Number(rows[0]?.n ?? 0) : '?'}`)
  }
  return parts.join(' ')
}

export async function backupDatabase(userData: string, reason: 'abertura' | 'hora'): Promise<void> {
  const dir = path.join(userData, 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(dir, `cwm-${stamp}-${reason}.db`)
  await getPrismaClient().$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  fs.appendFileSync(path.join(dir, 'backups.log'), `${new Date().toISOString()} ${reason} ${path.basename(file)} ${await counts()}\n`)
  // Nome começa com a data ISO: ordem alfabética = ordem cronológica. Só as automáticas — cópias
  // guardadas à mão (ex.: cwm-forense-…) ficam.
  const old = fs.readdirSync(dir).filter(f => /^cwm-\d{4}-\d{2}-\d{2}T.*\.db$/.test(f)).sort().slice(0, -KEEP)
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true })
}

/** Cópia agora e a cada hora enquanto o app estiver aberto. Falha só vai para o log do main. */
export async function startDatabaseBackups(userData: string): Promise<void> {
  await backupDatabase(userData, 'abertura').catch((e: unknown) => console.error('[backup] falha na cópia do banco:', e))
  setInterval(() => {
    void backupDatabase(userData, 'hora').catch((e: unknown) => console.error('[backup] falha na cópia do banco:', e))
  }, HOURLY_MS).unref()
}
