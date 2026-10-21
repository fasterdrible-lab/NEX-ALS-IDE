#!/usr/bin/env node
// Migra os projetos de uma VPS do banco do Zeus (PC) para o serviço zeus-hermes dessa VPS (Passo 2 do
// Zeus Mobile). Depois disso o painel Agent desses projetos usa o loop do serviço (apps/desktop/src/hermes-remote.ts).
// Uso (Zeus FECHADO): node scripts/migrate-to-zeus-hermes.mjs [root@204.168.180.25] [https://vps-1.tailfd24ac.ts.net:8443]
//
// Leva: a VPS (sem senha nem fingerprint), os projetos dela, instância/agente do Hermes, tarefas, logs de
// execução, KB global (contexto do .hermes.md) e memória dos projetos. Não apaga nada do PC.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const target = process.argv[2] ?? 'root@204.168.180.25'
const serviceUrl = process.argv[3] ?? 'https://vps-1.tailfd24ac.ts.net:8443'
const host = target.split('@').pop()
const appData = process.env.APPDATA ?? path.join(os.homedir(), '.config')
const userData = path.join(appData, '@cwm', 'desktop')
const dbFile = path.join(userData, 'cwm.db')

const running = (() => {
  try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq Zeus IDE.exe', '/NH'], { encoding: 'utf8' }).includes('Zeus IDE.exe') } catch { return false }
})()
if (running) { console.error('[migrar] Feche o Zeus antes (o loop local não pode estar rodando nesses projetos).'); process.exit(1) }

const db = new DatabaseSync(dbFile, { readOnly: true })
const all = (sql, ...p) => db.prepare(sql).all(...p).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])))

const vps = all('SELECT * FROM vps_servers WHERE host = ?', host)
if (vps.length !== 1) throw new Error(`VPS ${host} não encontrada (ou repetida) no banco do Zeus`)
const vpsId = vps[0].id
delete vps[0].sshPassword
delete vps[0].sshHostFingerprint

const projects = all('SELECT * FROM projects WHERE vpsServerId = ?', vpsId)
if (projects.length === 0) throw new Error('Nenhum projeto dessa VPS no Zeus.')
const ids = projects.map(p => p.id)
const inIds = `(${ids.map(() => '?').join(',')})`
const data = {
  vps_servers: vps,
  projects,
  hermes_instances: all('SELECT * FROM hermes_instances WHERE vpsServerId = ?', vpsId),
  hermes_project_agents: all(`SELECT * FROM hermes_project_agents WHERE projectId IN ${inIds}`, ...ids),
  agent_tasks: all(`SELECT * FROM agent_tasks WHERE projectId IN ${inIds}`, ...ids),
  hermes_task_runs: all(`SELECT * FROM hermes_task_runs WHERE projectId IN ${inIds}`, ...ids),
  knowledge_entries: all('SELECT * FROM knowledge_entries'),
  project_memory: all(`SELECT * FROM project_memory WHERE projectId IN ${inIds} OR vpsId = ?`, ...ids, vpsId),
}
for (const [t, rows] of Object.entries(data)) console.log(`[migrar] ${t}: ${rows.length}`)
console.log('[migrar] projetos:', projects.map(p => `${p.name} (${p.remotePath})`).join(', '))

// Arquivo temporário com nome relativo (o scp do Git/Windows confunde "C:" com host remoto).
const tmpName = 'zeus-hermes-import.json'
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-migrar-'))
fs.writeFileSync(path.join(tmpDir, tmpName), JSON.stringify(data), { mode: 0o600 })
try {
  execFileSync('scp', ['-q', '-o', 'BatchMode=yes', tmpName, `${target}:/opt/zeus-hermes/data/import.json`], { cwd: tmpDir, stdio: 'inherit' })
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
execFileSync('ssh', ['-o', 'BatchMode=yes', target, [
  'set -e; chmod 600 /opt/zeus-hermes/data/import.json',
  'cd /opt/zeus-hermes/app && ZEUS_DATA_DIR=/opt/zeus-hermes/data node server.cjs import /opt/zeus-hermes/data/import.json 2>&1 | grep "^\\[import\\]"',
  'rm -f /opt/zeus-hermes/data/import.json',
  'systemctl restart zeus-hermes && sleep 3 && systemctl is-active zeus-hermes',
].join('; ')], { stdio: 'inherit' })

const cfgDir = path.join(userData, 'zeus-hermes')
fs.mkdirSync(cfgDir, { recursive: true })
fs.writeFileSync(path.join(cfgDir, 'config.json'), JSON.stringify({ url: serviceUrl, projectIds: ids }, null, 2))
console.log(`[migrar] ok — ${ids.length} projeto(s) agora usam o serviço. Config: ${path.join(cfgDir, 'config.json')}`)
