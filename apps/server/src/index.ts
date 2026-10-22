import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { z } from 'zod'
import { initializeDatabase, getPrismaClient } from '@cwm/db'
import { HermesAutonomyLevelSchema, HermesDevRulesSchema, HermesProjectIdSchema, HermesRunnerTextSchema } from '@cwm/config'
import {
  TerminalService, SftpService, GitService, KnowledgeService, ProjectMemoryService, TasksService,
  HermesService, HermesRunLog, HermesAgentRunner, ensureHermesSchema, type RunnerEvent,
} from '@cwm/core'
import { GithubPush, GITHUB_BRANCH, isRepoFullName } from './github.js'
import { PushNotifier } from './push.js'

/**
 * zeus-hermes — o loop do Hermes como serviço na VPS (Passo 1 do Zeus Mobile, docs/ZEUS_MOBILE_PLAN.md).
 * Mesmo HermesAgentRunner do Zeus, com banco próprio. Fala com o Hermes desta máquina pelo mesmo
 * código de SSH do Zeus, apontando para 127.0.0.1 (VPS cadastrada no banco do serviço).
 *
 * Só escuta em 127.0.0.1; quem expõe é o `tailscale serve` (HTTPS, só na rede privada do usuário).
 * Toda rota /api exige `Authorization: Bearer <token>`; o serviço guarda só o sha256 do token.
 */

const DATA_DIR = process.env['ZEUS_DATA_DIR'] ?? '/opt/zeus-hermes/data'
const PORT = Number(process.env['ZEUS_PORT'] ?? 8790)
const HOST = '127.0.0.1'
const MAX_BODY = 64 * 1024
const VERSION = '3.85.0'

fs.mkdirSync(DATA_DIR, { recursive: true })
process.env['DATABASE_URL'] = `file:${path.join(DATA_DIR, 'zeus.db')}`

// ── Autenticação ────────────────────────────────────────────────────────────
const TOKEN_HASH_FILE = path.join(DATA_DIR, 'token.sha256')
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest()
function tokenOk(header: string | undefined): boolean {
  if (!header?.startsWith('Bearer ')) return false
  let expected: Buffer
  try { expected = Buffer.from(fs.readFileSync(TOKEN_HASH_FILE, 'utf8').trim(), 'hex') } catch { return false }
  const got = sha256(header.slice(7).trim())
  return expected.length === got.length && crypto.timingSafeEqual(expected, got)
}
// Tentativas erradas por IP (só a rede do Tailscale chega aqui, mas não custa).
const failures = new Map<string, { n: number; until: number }>()
function blocked(ip: string): boolean { const f = failures.get(ip); return !!f && f.n >= 10 && Date.now() < f.until }
function fail(ip: string): void {
  const f = failures.get(ip) ?? { n: 0, until: 0 }
  f.n++; f.until = Date.now() + 15 * 60_000
  failures.set(ip, f)
}

// ── Serviços ────────────────────────────────────────────────────────────────
const terminal = new TerminalService()
const sftp = new SftpService()
const git = new GitService()
const tasks = new TasksService()
const hermes = new HermesService(terminal, sftp, git, new KnowledgeService(), new ProjectMemoryService())
const runLog = new HermesRunLog()

const github = new GithubPush(path.resolve(DATA_DIR, '..', 'ssh'))

/** Repositório ligado ao projeto (dono/nome) e a pasta dele na VPS; null se não houver. */
async function projectRepo(projectId: string): Promise<{ fullName: string; workspace: string } | null> {
  const p = await getPrismaClient().project.findUnique({ where: { id: projectId } }) as { gitRepo?: string; remotePath: string } | null
  const m = p?.gitRepo ? /^git@github\.com:(.+)\.git$/.exec(p.gitRepo) : null
  return p && m ? { fullName: m[1], workspace: p.remotePath } : null
}

// Notificações no celular (Web Push): avisa quando o loop precisa de você ou para.
const push = new PushNotifier(DATA_DIR, {
  listTasks: (projectId) => tasks.list({ projectId, ownerAgent: 'hermes' }),
  getDelivery: (projectId) => hermes.getDelivery(projectId),
})

const sseClients = new Set<{ res: http.ServerResponse; projectId: string | null }>()
const runner = new HermesAgentRunner({
  hermes, runLog, tasks, git,
  // Cada tarefa concluída e conferida vai para o branch `hermes` do GitHub (se o projeto estiver ligado).
  afterTaskDone: async (projectId: string) => {
    const repo = await projectRepo(projectId)
    if (!repo) return null
    const r = await github.push(projectId, repo.workspace)
    return r.pushed
      ? `[NEX] Enviado ao GitHub: ${repo.fullName} (branch ${GITHUB_BRANCH}).`
      : `[NEX] O envio ao GitHub falhou (a tarefa continua concluída; tenta de novo na próxima): ${r.output}`
  },
  emit: (e: RunnerEvent) => {
    push.onRunnerEvent(e)
    const projectId = 'projectId' in e ? e.projectId : null
    const data = `data: ${JSON.stringify(e)}\n\n`
    for (const c of sseClients) {
      if (c.projectId && projectId && c.projectId !== projectId) continue
      try { c.res.write(data) } catch { sseClients.delete(c) }
    }
  },
})

// ── HTTP ────────────────────────────────────────────────────────────────────
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message) } }

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) { reject(new HttpError(413, 'Corpo grande demais')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new HttpError(400, 'JSON inválido')) }
    })
    req.on('error', reject)
  })
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(body ?? null))
}

const parse = <T>(schema: z.ZodType<T>, v: unknown): T => {
  const r = schema.safeParse(v)
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? 'Dados inválidos')
  return r.data
}

type Handler = (p: { id: string; body: unknown; url: URL }) => Promise<unknown> | unknown
const routes: { method: string; re: RegExp; fn: Handler }[] = []
const route = (method: string, pattern: string, fn: Handler) =>
  routes.push({ method, re: new RegExp(`^${pattern.replace(':id', '([A-Za-z0-9_-]{1,64})')}$`), fn })

route('GET', '/api/projects', async () => {
  const ps = await getPrismaClient().project.findMany({ orderBy: { createdAt: 'asc' }, include: { vpsServer: true } })
  return (ps as { id: string; name: string; remotePath: string; vpsServer: { name: string } }[])
    .map(p => ({ id: p.id, name: p.name, remotePath: p.remotePath, vpsName: p.vpsServer.name }))
})
route('GET', '/api/projects/:id/state', async ({ id }) => ({
  ...runner.snapshot(id),
  orphanRunning: await runner.orphanRunning(id),
  agent: await hermes.getAgentStatus(id),
  tasks: await tasks.list({ projectId: id, ownerAgent: 'hermes' }),
  delivery: await hermes.getDelivery(id).catch(() => null),
}))
route('GET', '/api/projects/:id/tasks', ({ id }) => tasks.list({ projectId: id, ownerAgent: 'hermes' }))
route('POST', '/api/projects/:id/message', ({ id, body }) => runner.sendMessage(id, parse(z.object({ text: HermesRunnerTextSchema }), body).text))
route('POST', '/api/projects/:id/resume', ({ id }) => runner.resume(id))
route('POST', '/api/projects/:id/cancel', ({ id }) => runner.cancel(id))
route('POST', '/api/projects/:id/stop', ({ id }) => runner.stop(id))
route('POST', '/api/projects/:id/stop-remote', async ({ id }) => ({ stopped: await runner.stopRemote(id) }))
route('POST', '/api/projects/:id/objective', ({ id, body }) => runner.startObjective(id, parse(z.object({ objective: HermesRunnerTextSchema }), body).objective))
route('POST', '/api/projects/:id/loop', ({ id, body }) =>
  runner.runLoop(id, parse(z.object({ approvedTaskId: HermesProjectIdSchema.optional() }), body).approvedTaskId))
route('POST', '/api/projects/:id/next', ({ id }) => runner.runNext(id))
route('POST', '/api/projects/:id/decision', ({ id, body }) => runner.resolveDecision(id, parse(z.object({ answer: HermesRunnerTextSchema }), body).answer))
route('POST', '/api/projects/:id/review', ({ id }) => runner.review(id))
route('POST', '/api/projects/:id/corrections', ({ id }) => runner.createCorrections(id))
route('POST', '/api/projects/:id/autonomy', ({ id, body }) => hermes.setAutonomyLevel(id, parse(z.object({ level: HermesAutonomyLevelSchema }), body).level))
// O que o painel Agent do Zeus lê/grava além do loop (o Zeus repassa para cá nos projetos migrados).
route('GET', '/api/projects/:id/agent', ({ id }) => hermes.getAgentStatus(id))
route('POST', '/api/projects/:id/dev-rules', ({ id, body }) => hermes.setDevRules(id, parse(z.object({ devRules: HermesDevRulesSchema }), body).devRules))
route('POST', '/api/projects/:id/sync-context', ({ id }) => hermes.syncProjectContext(id))
route('GET', '/api/projects/:id/dod', ({ id }) => hermes.getDodChecklist(id))
route('POST', '/api/projects/:id/dod/toggle', ({ id, body }) => {
  const b = parse(z.object({ itemId: z.string().min(1).max(64), done: z.boolean() }), body)
  return hermes.toggleDodItem(id, b.itemId, b.done)
})
route('POST', '/api/projects/:id/dod/run', ({ id }) => hermes.runDodAutoChecks(id))
route('GET', '/api/projects/:id/delivery', ({ id }) => hermes.getDelivery(id))
route('POST', '/api/projects/:id/delivery/reevaluate', ({ id }) => hermes.reevaluateDelivery(id))
route('GET', '/api/projects/:id/runs', ({ id, url }) => {
  const taskId = url.searchParams.get('taskId')
  return runLog.list(id, taskId === null ? undefined : parse(HermesProjectIdSchema, taskId))
})
route('GET', '/api/runs/:id', ({ id }) => runLog.get(id))
// GitHub: o Zeus do PC pede a chave pública, cadastra no repositório e então liga (primeiro envio).
route('POST', '/api/projects/:id/github/key', async ({ id }) => ({ publicKey: await github.publicKey(id) }))
route('POST', '/api/projects/:id/github/link', async ({ id, body }) => {
  const { repo } = parse(z.object({ repo: z.string().refine(isRepoFullName, 'Repositório inválido (use dono/nome)') }), body)
  const db = getPrismaClient()
  const p = await db.project.findUnique({ where: { id } }) as { remotePath: string } | null
  if (!p) throw new HttpError(404, 'Projeto não encontrado')
  const r = await github.link(id, p.remotePath, repo)
  await db.project.update({ where: { id }, data: { gitRepo: `git@github.com:${repo}.git` } })
  return { ...r, repo, branch: GITHUB_BRANCH }
})
// Notificações no celular: chave pública, inscrição do aparelho, teste.
const PushSubSchema = z.object({
  endpoint: z.string().url().max(2000).refine(u => u.startsWith('https://'), 'Endereço de push inválido'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  label: z.string().max(100).default(''),
})
route('GET', '/api/push/key', async () => ({ publicKey: push.key, devices: await push.count() }))
route('POST', '/api/push/subscribe', async ({ body }) => {
  const s = parse(PushSubSchema, body)
  await push.subscribe({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, label: s.label ?? '' })
  return { devices: await push.count() }
})
route('POST', '/api/push/unsubscribe', async ({ body }) => {
  await push.unsubscribe(parse(z.object({ endpoint: z.string().max(2000) }), body).endpoint)
  return { devices: await push.count() }
})
route('POST', '/api/push/test', async () => ({
  sent: await push.send({ title: 'Zeus: notificações ligadas', body: 'É assim que o Hermes vai te avisar quando precisar de você.', url: '/', tag: 'test' }),
}))
// Governança — Autorizar = o serviço executa o comando (tool_execution_log); Negar só descarta.
route('POST', '/api/approvals/:id', ({ id, body }) => runner.resolveApproval(id, parse(z.object({ approve: z.boolean() }), body).approve))

// App do celular (Passo 3): arquivos estáticos em public/, ao lado do server.cjs. São só a interface —
// sem dados; tudo o que ela mostra vem de /api com o token.
const PUBLIC_DIR = path.join(__dirname, 'public')
const STATIC: Record<string, string> = {
  '/': 'index.html', '/app.js': 'app.js', '/app.css': 'app.css', '/sw.js': 'sw.js',
  '/manifest.webmanifest': 'manifest.webmanifest', '/icon.svg': 'icon.svg', '/icon-256.png': 'icon-256.png',
  '/icon-192.png': 'icon-192.png', '/icon-512.png': 'icon-512.png',
}
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
}
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}
function serveStatic(pathname: string, res: http.ServerResponse): boolean {
  const file = STATIC[pathname]
  if (!file) return false
  let body: Buffer
  try { body = fs.readFileSync(path.join(PUBLIC_DIR, file)) } catch { return false }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', ...SECURITY_HEADERS })
  res.end(body)
  return true
}

const server = http.createServer((req, res) => {
  void (async () => {
    const ip = req.socket.remoteAddress ?? '?'
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/health') return send(res, 200, { ok: true, version: VERSION })
    if (req.method === 'GET' && serveStatic(url.pathname, res)) return
    if (blocked(ip)) return send(res, 429, { error: 'Muitas tentativas — aguarde 15 minutos' })
    if (!tokenOk(req.headers['authorization'])) { fail(ip); return send(res, 401, { error: 'Não autorizado' }) }
    failures.delete(ip)

    if (req.method === 'GET' && url.pathname === '/api/events') {
      const projectId = url.searchParams.get('projectId')
      if (projectId !== null) parse(HermesProjectIdSchema, projectId)
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
      res.write(': ok\n\n')
      const client = { res, projectId }
      sseClients.add(client)
      const ping = setInterval(() => { try { res.write(': ping\n\n') } catch { /* fechado */ } }, 25_000)
      req.on('close', () => { clearInterval(ping); sseClients.delete(client) })
      return
    }

    const r = routes.find(x => x.method === req.method && x.re.test(url.pathname))
    if (!r) return send(res, 404, { error: 'Rota não encontrada' })
    const id = url.pathname.match(r.re)?.[1] ?? ''
    const body = req.method === 'POST' ? await readBody(req) : {}
    send(res, 200, (await r.fn({ id, body, url })) ?? { ok: true })
  })().catch((e: unknown) => {
    const status = e instanceof HttpError ? e.status : 400
    // Mensagem sim, stack trace não (só no log do serviço).
    if (!(e instanceof HttpError)) console.error('[zeus-hermes]', e)
    if (!res.headersSent) send(res, status, { error: e instanceof Error ? e.message : String(e) })
  })
})

/**
 * `node server.cjs import <arquivo.json>` — recebe os dados de projetos migrados do Zeus do PC
 * (scripts/migrate-to-zeus-hermes.mjs). A VPS vira "esta máquina": host 127.0.0.1, usuário root,
 * sem senha, com a chave própria do serviço. INSERT OR REPLACE: rodar de novo atualiza.
 */
const IMPORT_TABLES = ['vps_servers', 'projects', 'hermes_instances', 'hermes_project_agents', 'agent_tasks',
  'hermes_task_runs', 'knowledge_entries', 'project_memory'] as const
async function importData(file: string): Promise<void> {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>[]>
  const db = getPrismaClient()
  for (const t of IMPORT_TABLES) {
    for (const row of data[t] ?? []) {
      const r = { ...row }
      if (t === 'vps_servers') Object.assign(r, { host: '127.0.0.1', port: 22, username: 'root', sshPassword: null, sshHostFingerprint: null })
      const cols = Object.keys(r).filter(c => /^[A-Za-z_][A-Za-z0-9_]*$/.test(c))
      await db.$executeRawUnsafe(
        `INSERT OR REPLACE INTO ${t} (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        ...cols.map(c => r[c]),
      )
    }
    console.log(`[import] ${t}: ${(data[t] ?? []).length}`)
  }
  await db.$executeRawUnsafe(`INSERT OR IGNORE INTO settings (id) VALUES ('default')`)
  await db.$executeRawUnsafe(`UPDATE settings SET sshKeyPath = ? WHERE id = 'default'`, path.resolve(DATA_DIR, '..', 'ssh', 'id_ed25519'))
}

async function main(): Promise<void> {
  await initializeDatabase()
  await ensureHermesSchema()
  await runLog.ensureTable()
  await push.init()
  if (process.argv[2] === 'import') {
    await importData(process.argv[3] ?? '')
    process.exit(0)
  }
  const n = await hermes.recoverInterruptedSessions().catch(() => 0)
  if (n > 0) console.log(`[zeus-hermes] ${n} sessão(ões) interrompida(s) marcada(s) para retomada`)
  if (!fs.existsSync(TOKEN_HASH_FILE)) console.warn(`[zeus-hermes] sem ${TOKEN_HASH_FILE} — toda rota /api vai recusar`)
  server.listen(PORT, HOST, () => console.log(`[zeus-hermes] v${VERSION} ouvindo em http://${HOST}:${PORT}`))
}

process.on('SIGTERM', () => { server.close(); process.exit(0) })
void main().catch((e: unknown) => { console.error('[zeus-hermes] falha ao iniciar:', e); process.exit(1) })
