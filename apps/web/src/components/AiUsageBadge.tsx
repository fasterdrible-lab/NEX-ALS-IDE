import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { ipc, type AiProviderUsage, type ClaudeAccountUsage, type ClaudeUsageWindow } from '../lib/ipc'

/**
 * Saldo dos provedores de IA ATIVOS no Zeus (Configurações → Provedores), na barra lateral. Fechado: o
 * provedor padrão (o que o Squad / AI Hub usam). Aberto: cada provedor ativo do jeito que ele permite —
 * Claude Code por conta (5 h e semana, "Usar esta"), DeepSeek/OpenRouter em dinheiro, e os que não
 * informam saldo com o link da página de cobrança. A troca de conta é sempre um clique do usuário.
 */

const GREEN = '#34d399', AMBER = '#fbbf24', RED = '#f87171', GRAY = '#94a3b8'
const pctColor = (pct: number) => (pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN)

function when(iso: string | null): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'já voltou'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  if (h >= 24) return `volta ${new Date(iso).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
  return `volta em ${h ? `${h} h ` : ''}${m} min`
}

/** Nome da conta de VERDADE (e-mail que a Anthropic confirma); o apelido do cadastro pode estar desatualizado. */
const realName = (a: ClaudeAccountUsage) => (a.email ? a.email.split('@')[0] : a.name)

const money = (b: NonNullable<AiProviderUsage['balance']>) =>
  `${b.currency === 'USD' ? 'US$' : b.currency === 'CNY' ? '¥' : `${b.currency} `}${b.amount.toFixed(2)}`

/** Resumo de uma linha + cor do provedor (para o indicador fechado). */
function summary(p: AiProviderUsage): { text: string; color: string } {
  if (p.problem) return { text: p.problem.split(' — ')[0], color: AMBER }
  if (p.kind === 'balance' && p.balance) return { text: money(p.balance), color: p.balance.low ? RED : GREEN }
  if (p.kind === 'accounts') {
    const a = p.accounts?.find(x => x.active) ?? p.accounts?.[0]
    if (!a) return { text: 'nenhuma conta', color: GRAY }
    if (a.problem) return { text: `${realName(a)} · sem login`, color: AMBER }
    const worst = Math.max(a.fiveHour?.pct ?? 0, a.sevenDay?.pct ?? 0)
    return { text: `${realName(a)} · ${worst}%`, color: pctColor(worst) }
  }
  return { text: 'ativo', color: GRAY }
}

function Bar({ label, w }: { label: string; w: ClaudeUsageWindow | null }) {
  if (!w) return null
  return (
    <div>
      <div className="flex justify-between text-[10px]" style={{ color: 'rgba(247,249,252,0.55)' }}>
        <span>{label} · {w.pct}%</span><span>{when(w.resetsAt)}</span>
      </div>
      <div className="h-1 rounded-full mt-0.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-1 rounded-full" style={{ width: `${Math.min(100, w.pct)}%`, background: pctColor(w.pct) }} />
      </div>
    </div>
  )
}

function Account({ a, busy, onUse, onRenew }: { a: ClaudeAccountUsage; busy: string | null; onUse: (id: string) => void; onRenew: (id: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] truncate flex-1" style={{ color: 'rgba(247,249,252,0.8)' }}
          title={a.email ? `Conta logada: ${a.email} · cadastro no Zeus: "${a.name}"` : `Cadastro no Zeus: "${a.name}"`}>
          {realName(a)}{a.plan ? ` · ${a.plan}` : ''}
          {a.email && realName(a) !== a.name && <span style={{ color: 'rgba(247,249,252,0.4)' }}> (cadastro "{a.name}")</span>}
        </span>
        {a.active ? (
          <span className="text-[9px] px-1.5 rounded" style={{ background: 'rgba(26,140,255,0.15)', color: '#7cc0ff' }}>em uso</span>
        ) : (
          <button onClick={() => onUse(a.id)} disabled={busy !== null || !!a.problem}
            className="text-[9px] px-1.5 py-0.5 rounded disabled:opacity-40" style={{ background: 'rgba(26,140,255,0.2)', color: '#bfe0ff' }}
            title={a.problem || `Passar a usar ${a.name} no Squad e no AI Hub`}>
            {busy === a.id ? <Loader2 size={9} className="animate-spin" /> : 'Usar esta'}
          </button>
        )}
      </div>
      {a.problem
        ? <div className="flex items-start gap-1.5">
            <p className="text-[10px] flex-1" style={{ color: AMBER }}>{a.problem}</p>
            <button onClick={() => onRenew(a.id)} disabled={busy !== null}
              className="shrink-0 text-[9px] px-1.5 py-0.5 rounded disabled:opacity-40" style={{ background: 'rgba(251,191,36,0.15)', color: AMBER }}
              title="Roda o Claude Code nesta conta para renovar o login (não gasta mensagem)">
              {busy === `renew:${a.id}` ? <Loader2 size={9} className="animate-spin" /> : 'Renovar login'}
            </button>
          </div>
        : <><Bar label="5 h" w={a.fiveHour} /><Bar label="Semana" w={a.sevenDay} /></>}
      {a.notes?.map(n => <p key={n} className="text-[9px] leading-snug" style={{ color: 'rgba(251,191,36,0.75)' }}>{n}</p>)}
    </div>
  )
}

export default function AiUsageBadge() {
  const [usage, setUsage] = useState<AiProviderUsage[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    ipc.aiUsage.all().then(setUsage).catch(() => {})
    const unsub = ipc.aiUsage.onUpdate(setUsage)
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [])

  if (usage.length === 0) return null
  const main = usage.find(p => p.isDefault) ?? usage[0]
  const s = summary(main)

  const use = async (id: string) => {
    setBusy(id)
    try { await ipc.claude.accounts.setActive(id); setUsage(await ipc.aiUsage.all(true)) } catch { /* segue */ }
    setBusy(null)
  }
  const renew = async (id: string) => {
    setBusy(`renew:${id}`)
    try { setUsage(await ipc.aiUsage.renew(id)) } catch { /* segue */ }
    setBusy(null)
  }
  const refresh = async () => {
    setBusy('refresh')
    try { setUsage(await ipc.aiUsage.all(true)) } catch { /* segue */ }
    setBusy(null)
  }

  return (
    <div className="mb-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left" title="Saldo dos provedores de IA ativos">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
        <span className="text-[11px] truncate flex-1" style={{ color: 'rgba(247,249,252,0.8)' }}>{main.label}: {s.text}</span>
        {usage.length > 1 && <span className="text-[9px]" style={{ color: 'rgba(247,249,252,0.35)' }}>+{usage.length - 1}</span>}
        {open ? <ChevronUp size={11} style={{ color: 'rgba(247,249,252,0.4)' }} /> : <ChevronDown size={11} style={{ color: 'rgba(247,249,252,0.4)' }} />}
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-2">
          {usage.map(p => (
            <div key={p.provider} className="space-y-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold flex-1 truncate" style={{ color: 'rgba(247,249,252,0.9)' }}>
                  {p.label}{p.isDefault ? ' · padrão' : ''}
                </span>
                {p.billingUrl && (
                  <button onClick={() => void ipc.shell.openExternal(p.billingUrl).catch(() => {})}
                    className="flex items-center gap-0.5 text-[9px]" style={{ color: 'rgba(247,249,252,0.45)' }} title="Abrir a página de uso/cobrança do provedor">
                    Ver cobrança <ExternalLink size={8} />
                  </button>
                )}
              </div>
              {p.problem && <p className="text-[10px]" style={{ color: AMBER }}>{p.problem}</p>}
              {!p.problem && p.kind === 'balance' && p.balance && (
                <p className="text-[11px]" style={{ color: p.balance.low ? RED : 'rgba(247,249,252,0.75)' }}>
                  Saldo: {money(p.balance)}{p.balance.low ? ' — acabando' : ''}
                </p>
              )}
              {!p.problem && p.kind === 'none' && (
                <p className="text-[10px]" style={{ color: 'rgba(247,249,252,0.45)' }}>Ativo — este provedor não informa saldo pela API.</p>
              )}
              {p.kind === 'accounts' && (p.accounts?.length
                ? p.accounts.map(a => <Account key={a.id} a={a} busy={busy} onUse={id => void use(id)} onRenew={id => void renew(id)} />)
                : <p className="text-[10px]" style={{ color: 'rgba(247,249,252,0.45)' }}>Nenhuma conta cadastrada (Configurações → Claude Code).</p>)}
            </div>
          ))}
          <button onClick={() => void refresh()} disabled={busy !== null}
            className="flex items-center gap-1 text-[10px] disabled:opacity-40" style={{ color: 'rgba(247,249,252,0.45)' }}>
            {busy === 'refresh' ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Atualizar agora
          </button>
        </div>
      )}
    </div>
  )
}
