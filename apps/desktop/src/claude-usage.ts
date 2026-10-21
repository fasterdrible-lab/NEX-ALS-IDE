import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Uso das contas Claude Code cadastradas no Zeus (Squad / AI Hub no PC): limite de 5 h e semanal de
 * cada conta, lidos da mesma API do painel "Conta & Uso". Só LÊ o login de cada conta — não renova
 * token (a renovação é do próprio Claude Code; renovar aqui rotacionaria o token debaixo dele).
 *
 * A troca de conta é sempre do usuário (botão "Usar esta" ou clique na notificação): trocar sozinho
 * para escapar do limite pode ir contra os termos da Anthropic.
 */

export interface UsageWindow { pct: number; resetsAt: string | null }
export interface AccountUsage {
  id: string
  name: string
  active: boolean
  email: string
  plan: string
  fiveHour: UsageWindow | null
  sevenDay: UsageWindow | null
  /** '' = leu; senão o motivo (login expirado, sem login, sem rede). */
  problem: string
  checkedAt: number
}

export const NEAR_LIMIT = 90
const POLL_MS = 5 * 60_000

interface AccountRow { id: string; name: string; configDir: string; isActive: number }

export class ClaudeUsageMonitor {
  private last: AccountUsage[] = []
  /** Aviso já dado por conta+janela+horário de volta (não repete no mesmo ciclo do limite). */
  private warned = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly listAccounts: () => Promise<AccountRow[]>,
    private readonly onUpdate: (u: AccountUsage[]) => void,
    private readonly onNearLimit: (active: AccountUsage, best: AccountUsage | null, which: '5 h' | 'semanal', w: UsageWindow) => void,
  ) {}

  start(): void {
    if (this.timer) return
    void this.refresh()
    this.timer = setInterval(() => { void this.refresh() }, POLL_MS)
    this.timer.unref?.()
  }

  get current(): AccountUsage[] { return this.last }

  async refresh(): Promise<AccountUsage[]> {
    const rows = await this.listAccounts().catch(() => [] as AccountRow[])
    this.last = await Promise.all(rows.map(r => this.read(r)))
    this.onUpdate(this.last)
    this.checkLimits()
    return this.last
  }

  private async read(r: AccountRow): Promise<AccountUsage> {
    const base: AccountUsage = {
      id: r.id, name: r.name, active: r.isActive === 1, email: '', plan: '',
      fiveHour: null, sevenDay: null, problem: '', checkedAt: Date.now(),
    }
    let oauth: { accessToken?: string; expiresAt?: number; subscriptionType?: string } | undefined
    try {
      oauth = (JSON.parse(await fs.readFile(path.join(r.configDir, '.credentials.json'), 'utf8')) as { claudeAiOauth?: typeof oauth }).claudeAiOauth
    } catch { return { ...base, problem: 'Sem login nesta conta' } }
    try {
      const acc = (JSON.parse(await fs.readFile(path.join(r.configDir, '.claude.json'), 'utf8')) as { oauthAccount?: { emailAddress?: string } }).oauthAccount
      base.email = acc?.emailAddress ?? ''
    } catch { /* sem .claude.json */ }
    base.plan = oauth?.subscriptionType ?? ''
    if (!oauth?.accessToken) return { ...base, problem: 'Sem login nesta conta' }

    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/api/oauth/usage', {
        headers: { Authorization: `Bearer ${oauth.accessToken}`, Accept: 'application/json', 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'Zeus-IDE/1.0' },
        signal: AbortSignal.timeout(8000),
      })
    } catch { return { ...base, problem: 'Sem conexão com a Anthropic' } }
    if (res.status === 401) {
      // Token vencido: o Claude Code renova ao ser usado; se o login todo expirou, precisa logar de novo.
      const expired = oauth.expiresAt && oauth.expiresAt < Date.now()
      return { ...base, problem: expired ? 'Login expirado — use a conta uma vez ou faça login de novo' : 'Login recusado pela Anthropic' }
    }
    if (!res.ok) return { ...base, problem: `A Anthropic respondeu ${res.status}` }
    const j = await res.json().catch(() => null) as Record<string, { utilization?: number; resets_at?: string } | null> | null
    const win = (k: string): UsageWindow | null => {
      const w = j?.[k]
      return w && typeof w.utilization === 'number' ? { pct: Math.round(w.utilization), resetsAt: w.resets_at ?? null } : null
    }
    return { ...base, fiveHour: win('five_hour'), sevenDay: win('seven_day') }
  }

  private checkLimits(): void {
    const active = this.last.find(a => a.active)
    if (!active) return
    const free = (a: AccountUsage) => Math.max(a.fiveHour?.pct ?? 100, a.sevenDay?.pct ?? 100)
    const best = this.last.filter(a => !a.active && !a.problem && free(a) < NEAR_LIMIT).sort((a, b) => free(a) - free(b))[0] ?? null
    for (const [which, w] of [['5 h', active.fiveHour], ['semanal', active.sevenDay]] as const) {
      if (!w || w.pct < NEAR_LIMIT) continue
      const key = `${active.id}|${which}|${w.resetsAt ?? ''}`
      if (this.warned.has(key)) continue
      this.warned.add(key)
      this.onNearLimit(active, best, which, w)
    }
  }
}
