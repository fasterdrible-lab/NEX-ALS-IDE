import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Saldo dos provedores de IA ATIVOS no Zeus (Configurações → Provedores com "ativo" ligado). Cada um
 * do jeito que o provedor permite:
 * - claude-code: limite de 5 h e semanal de cada conta cadastrada (API de uso da conta, só leitura do
 *   login — não renova token, para não rotacioná-lo debaixo do Claude Code);
 * - deepseek: saldo em dinheiro (GET /user/balance);
 * - openrouter: créditos comprados − usados (GET /api/v1/credits);
 * - os demais (OpenAI, Anthropic por chave, Gemini, Groq…) não têm consulta de saldo por chave de API:
 *   aparecem como ativos, com o link da página de cobrança.
 * A chave de API é lida e usada só aqui, no main — nunca vai para a tela.
 * Troca de conta Claude é sempre do usuário (botão ou clique na notificação): trocar sozinho para
 * escapar do limite pode ir contra os termos da Anthropic.
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
}
export interface ProviderUsage {
  provider: string
  label: string
  isDefault: boolean
  kind: 'accounts' | 'balance' | 'none'
  /** claude-code */
  accounts?: AccountUsage[]
  /** deepseek / openrouter: saldo restante. */
  balance?: { amount: number; currency: string; low: boolean }
  problem: string
  billingUrl: string
  checkedAt: number
}

export const NEAR_LIMIT = 90
const POLL_MS = 5 * 60_000
/** Saldo abaixo disto (na moeda do provedor) = acabando. */
const LOW_BALANCE = 2

const META: Record<string, { label: string; billingUrl: string }> = {
  'claude-code': { label: 'Claude Code', billingUrl: 'https://claude.ai/settings/usage' },
  anthropic: { label: 'Anthropic (API)', billingUrl: 'https://console.anthropic.com/settings/billing' },
  openai: { label: 'OpenAI', billingUrl: 'https://platform.openai.com/settings/organization/billing' },
  deepseek: { label: 'DeepSeek', billingUrl: 'https://platform.deepseek.com/usage' },
  openrouter: { label: 'OpenRouter', billingUrl: 'https://openrouter.ai/settings/credits' },
  gemini: { label: 'Gemini', billingUrl: 'https://aistudio.google.com/' },
  groq: { label: 'Groq', billingUrl: 'https://console.groq.com/settings/billing' },
  mistral: { label: 'Mistral', billingUrl: 'https://console.mistral.ai/billing/' },
  xai: { label: 'xAI', billingUrl: 'https://console.x.ai/' },
  ollama: { label: 'Ollama (local)', billingUrl: '' },
}

interface AccountRow { id: string; name: string; configDir: string; isActive: number }
interface ProviderRow { provider: string; isDefault: boolean }

export interface UsageDeps {
  listActiveProviders: () => Promise<ProviderRow[]>
  listClaudeAccounts: () => Promise<AccountRow[]>
  getKey: (provider: string) => Promise<string | null>
  onUpdate: (u: ProviderUsage[]) => void
  onClaudeNearLimit: (active: AccountUsage, best: AccountUsage | null, which: '5 h' | 'semanal', w: UsageWindow) => void
  onLowBalance: (p: ProviderUsage) => void
}

async function getJson(url: string, key: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  return { status: res.status, data: await res.json().catch(() => null) }
}

export class AiUsageMonitor {
  private last: ProviderUsage[] = []
  /** Avisos já dados (não repetem no mesmo ciclo do limite / no mesmo dia para saldo). */
  private warned = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly d: UsageDeps) {}

  start(): void {
    if (this.timer) return
    void this.refresh()
    this.timer = setInterval(() => { void this.refresh() }, POLL_MS)
    this.timer.unref?.()
  }

  get current(): ProviderUsage[] { return this.last }

  async refresh(): Promise<ProviderUsage[]> {
    const providers = await this.d.listActiveProviders().catch(() => [] as ProviderRow[])
    this.last = await Promise.all(providers.map(p => this.readProvider(p)))
    // Padrão primeiro: é o que o Squad / AI Hub usam.
    this.last.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    this.d.onUpdate(this.last)
    this.checkAlerts()
    return this.last
  }

  private async readProvider(p: ProviderRow): Promise<ProviderUsage> {
    const meta = META[p.provider] ?? { label: p.provider, billingUrl: '' }
    const base: ProviderUsage = { provider: p.provider, label: meta.label, isDefault: p.isDefault, kind: 'none', problem: '', billingUrl: meta.billingUrl, checkedAt: Date.now() }
    try {
      if (p.provider === 'claude-code') {
        const rows = await this.d.listClaudeAccounts().catch(() => [] as AccountRow[])
        return { ...base, kind: 'accounts', accounts: await Promise.all(rows.map(r => this.readClaudeAccount(r))) }
      }
      if (p.provider === 'deepseek' || p.provider === 'openrouter') {
        const key = await this.d.getKey(p.provider)
        if (!key) return { ...base, kind: 'balance', problem: 'Sem chave de API' }
        return p.provider === 'deepseek' ? await this.readDeepSeek(base, key) : await this.readOpenRouter(base, key)
      }
    } catch {
      return { ...base, problem: 'Sem conexão com o provedor' }
    }
    return base
  }

  private async readDeepSeek(base: ProviderUsage, key: string): Promise<ProviderUsage> {
    const r = await getJson('https://api.deepseek.com/user/balance', key)
    if (r.status === 401) return { ...base, kind: 'balance', problem: 'Chave de API recusada pelo DeepSeek — troque em Configurações' }
    const infos = (r.data as { balance_infos?: { currency?: string; total_balance?: string }[] } | null)?.balance_infos
    if (r.status !== 200 || !infos?.length) return { ...base, kind: 'balance', problem: `DeepSeek respondeu ${r.status}` }
    const b = infos.find(i => i.currency === 'USD') ?? infos[0]
    const amount = Number(b.total_balance ?? 0)
    return { ...base, kind: 'balance', balance: { amount, currency: b.currency ?? '', low: amount < LOW_BALANCE } }
  }

  private async readOpenRouter(base: ProviderUsage, key: string): Promise<ProviderUsage> {
    const r = await getJson('https://openrouter.ai/api/v1/credits', key)
    if (r.status === 401) return { ...base, kind: 'balance', problem: 'Chave de API recusada pelo OpenRouter — troque em Configurações' }
    const d = (r.data as { data?: { total_credits?: number; total_usage?: number } } | null)?.data
    if (r.status !== 200 || !d) return { ...base, kind: 'balance', problem: `OpenRouter respondeu ${r.status}` }
    const amount = Math.round(((d.total_credits ?? 0) - (d.total_usage ?? 0)) * 100) / 100
    return { ...base, kind: 'balance', balance: { amount, currency: 'USD', low: amount < LOW_BALANCE } }
  }

  private async readClaudeAccount(r: AccountRow): Promise<AccountUsage> {
    const base: AccountUsage = { id: r.id, name: r.name, active: r.isActive === 1, email: '', plan: '', fiveHour: null, sevenDay: null, problem: '' }
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
    } catch { return { ...base, problem: 'Sem conexão' } }
    if (res.status === 401) {
      const expired = oauth.expiresAt && oauth.expiresAt < Date.now()
      return { ...base, problem: expired ? 'Login expirado — use a conta uma vez ou faça login de novo' : 'Login recusado' }
    }
    if (!res.ok) return { ...base, problem: `Resposta ${res.status}` }
    const j = await res.json().catch(() => null) as Record<string, { utilization?: number; resets_at?: string } | null> | null
    const win = (k: string): UsageWindow | null => {
      const w = j?.[k]
      return w && typeof w.utilization === 'number' ? { pct: Math.round(w.utilization), resetsAt: w.resets_at ?? null } : null
    }
    return { ...base, fiveHour: win('five_hour'), sevenDay: win('seven_day') }
  }

  private checkAlerts(): void {
    for (const p of this.last) {
      if (p.kind === 'balance' && p.balance?.low) {
        const key = `${p.provider}|low|${new Date().toDateString()}`
        if (!this.warned.has(key)) { this.warned.add(key); this.d.onLowBalance(p) }
      }
      if (p.kind !== 'accounts' || !p.accounts) continue
      const active = p.accounts.find(a => a.active)
      if (!active) continue
      const used = (a: AccountUsage) => Math.max(a.fiveHour?.pct ?? 100, a.sevenDay?.pct ?? 100)
      const best = p.accounts.filter(a => !a.active && !a.problem && used(a) < NEAR_LIMIT).sort((a, b) => used(a) - used(b))[0] ?? null
      for (const [which, w] of [['5 h', active.fiveHour], ['semanal', active.sevenDay]] as const) {
        if (!w || w.pct < NEAR_LIMIT) continue
        const key = `${active.id}|${which}|${w.resetsAt ?? ''}`
        if (this.warned.has(key)) continue
        this.warned.add(key)
        this.d.onClaudeNearLimit(active, best, which, w)
      }
    }
  }
}
