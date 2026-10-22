import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import webpush from 'web-push'
import { getPrismaClient } from '@cwm/db'
import type { RunnerEvent, RunnerState } from '@cwm/core'

/**
 * Notificações no celular (Passo 3b do Zeus Mobile) — Web Push padrão: o serviço envia pela
 * infraestrutura de push do navegador (no Android, a do Google), com o conteúdo criptografado de
 * ponta a ponta. Funciona com o app fechado e o PC desligado; só sai conexão daqui, nada entra.
 * O aviso diz só o essencial (projeto + o que aconteceu), nunca o texto de um comando.
 */

export interface PushPayload { title: string; body: string; url: string; tag: string }

interface Sub { endpoint: string; p256dh: string; auth: string }

export class PushNotifier {
  private ready = false
  private publicKey = ''
  /** Estado anterior por projeto — para avisar só do que é novo. */
  private prev = new Map<string, { approvals: Set<string>; decision: boolean; gate: string | null; mode: string; blocked: Set<string> | null; deliveryVersion: number; tasksVersion: number }>()
  private names = new Map<string, string>()

  constructor(private readonly dataDir: string, private readonly deps: {
    listTasks: (projectId: string) => Promise<{ id: string; title: string; status: string }[]>
    getDelivery: (projectId: string) => Promise<{ verdict: string } | null>
  }) {}

  private get db() { return getPrismaClient() }

  async init(): Promise<void> {
    await this.db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '', createdAt BIGINT NOT NULL)`)
    // Chaves VAPID: geradas na primeira vez e guardadas só no serviço (a pública vai para o celular).
    const file = path.join(this.dataDir, 'vapid.json')
    let keys: { publicKey: string; privateKey: string }
    if (fs.existsSync(file)) keys = JSON.parse(fs.readFileSync(file, 'utf8')) as typeof keys
    else {
      keys = webpush.generateVAPIDKeys()
      fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 })
    }
    webpush.setVapidDetails('mailto:zeus-hermes@localhost.invalid', keys.publicKey, keys.privateKey)
    this.publicKey = keys.publicKey
    this.ready = true
  }

  get key(): string { return this.publicKey }

  async subscribe(s: Sub & { label: string }): Promise<void> {
    await this.db.$executeRawUnsafe(
      `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, label, createdAt) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label`,
      crypto.randomUUID(), s.endpoint, s.p256dh, s.auth, s.label, Date.now(),
    )
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.db.$executeRawUnsafe(`DELETE FROM push_subscriptions WHERE endpoint = ?`, endpoint)
  }

  async count(): Promise<number> {
    const r = await this.db.$queryRawUnsafe(`SELECT count(*) AS n FROM push_subscriptions`) as { n: number | bigint }[]
    return Number(r[0]?.n ?? 0)
  }

  /** Envia a todos os aparelhos inscritos; inscrição que o push rejeita (expirou/desinstalou) é apagada. */
  async send(p: PushPayload): Promise<number> {
    if (!this.ready) return 0
    const subs = await this.db.$queryRawUnsafe(`SELECT endpoint, p256dh, auth FROM push_subscriptions`) as Sub[]
    let ok = 0
    await Promise.all(subs.map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 6 * 3600, urgency: 'high' })
        ok++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await this.unsubscribe(s.endpoint).catch(() => {})
        else console.error('[push] falha ao enviar:', code ?? (e instanceof Error ? e.message : e))
      }
    }))
    return ok
  }

  private async projectName(projectId: string): Promise<string> {
    const cached = this.names.get(projectId)
    if (cached) return cached
    const p = await this.db.project.findUnique({ where: { id: projectId } }) as { name: string } | null
    const name = p?.name ?? 'Projeto'
    this.names.set(projectId, name)
    return name
  }

  /** Chamado a cada evento do loop. Só os eventos de estado interessam. */
  /** Um projeto por vez: eventos chegam em rajada e duas checagens juntas avisariam em dobro. */
  private chains = new Map<string, Promise<void>>()

  onRunnerEvent(e: RunnerEvent): void {
    if (e.kind !== 'state') return
    const { projectId, state } = e
    const next = (this.chains.get(projectId) ?? Promise.resolve())
      .then(() => this.handleState(projectId, state))
      .catch(err => console.error('[push] evento:', err))
    this.chains.set(projectId, next)
  }

  private async handleState(projectId: string, s: RunnerState): Promise<void> {
    const before = this.prev.get(projectId)
    const now = {
      approvals: new Set(s.approvals.map(a => a.id)),
      decision: !!s.pendingDecision,
      gate: s.riskGateTaskId,
      mode: s.mode,
      blocked: before?.blocked ?? null,
      deliveryVersion: s.deliveryVersion,
      tasksVersion: s.tasksVersion,
    }
    this.prev.set(projectId, now)
    if (!before) {
      // Primeira vez que vemos o projeto (serviço acabou de subir): só registra a base de tarefas bloqueadas.
      now.blocked = new Set((await this.deps.listTasks(projectId).catch(() => [])).filter(t => t.status === 'BLOCKED').map(t => t.id))
      return
    }
    const name = await this.projectName(projectId)
    const url = `/#p=${encodeURIComponent(projectId)}`
    const out: PushPayload[] = []

    if ([...now.approvals].some(id => !before.approvals.has(id))) {
      out.push({ title: `${name}: comando aguardando aprovação`, body: 'O Hermes parou e espera você Autorizar ou Negar.', url, tag: `appr-${projectId}` })
    }
    if (now.decision && !before.decision) {
      out.push({ title: `${name}: decisão necessária`, body: 'O Hermes fez uma pergunta e o loop espera a sua resposta.', url, tag: `dec-${projectId}` })
    }
    if (now.gate && now.gate !== before.gate) {
      out.push({ title: `${name}: tarefa de risco alto`, body: 'O loop parou antes de uma tarefa de risco alto. Revise e libere.', url, tag: `gate-${projectId}` })
    }

    // Tarefas recém-bloqueadas (o loop as marca ao terminar a execução).
    const loopEnded = before.mode !== 'idle' && s.mode === 'idle'
    if (loopEnded || s.tasksVersion !== before.tasksVersion) {
      const tasks = await this.deps.listTasks(projectId).catch(() => null)
      if (tasks) {
        const blocked = tasks.filter(t => t.status === 'BLOCKED')
        const fresh = blocked.filter(t => !(before.blocked?.has(t.id)))
        now.blocked = new Set(blocked.map(t => t.id))
        if (fresh.length) {
          out.push({
            title: `${name}: ${fresh.length === 1 ? 'tarefa bloqueada' : `${fresh.length} tarefas bloqueadas`}`,
            body: fresh.slice(0, 2).map(t => t.title.slice(0, 80)).join(' · '),
            url, tag: `blk-${projectId}`,
          })
        }
        // Loop terminou sem pedir nada e ainda há pendentes, sem o usuário ter pedido Parar → parou por erro (ex.: 429, conexão).
        const todo = tasks.filter(t => t.status === 'TODO').length
        if (before.mode === 'loop' && s.mode === 'idle' && todo > 0 && !s.stopRequested
          && !s.approvals.length && !s.pendingDecision && !s.riskGateTaskId && !fresh.length) {
          out.push({ title: `${name}: o loop parou`, body: `Ainda há ${todo} tarefa(s) pendente(s). Abra para ver o motivo e continuar.`, url, tag: `stop-${projectId}` })
        }
      }
    }

    // Fechamento da entrega terminou.
    if (before.mode === 'review' && s.mode === 'idle' && s.deliveryVersion !== before.deliveryVersion) {
      const d = await this.deps.getDelivery(projectId).catch(() => null)
      if (d) {
        const label = d.verdict === 'approved' ? 'aprovada ✅' : d.verdict === 'approved_with_notes' ? 'aprovada com ressalvas' : 'bloqueada'
        out.push({ title: `${name}: entrega ${label}`, body: 'A revisão de fechamento terminou. Abra para ver o relatório.', url, tag: `deliv-${projectId}` })
      }
    }

    for (const p of out) await this.send(p)
  }
}
