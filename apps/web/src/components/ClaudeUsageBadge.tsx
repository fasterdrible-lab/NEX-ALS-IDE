import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'
import { ipc, type ClaudeAccountUsage, type ClaudeUsageWindow } from '../lib/ipc'

/**
 * Saldo das contas Claude Code do Zeus (Squad / AI Hub) na barra lateral. Fechado: conta em uso e o
 * limite mais apertado. Aberto: todas as contas com 5 h e semanal, quando volta, e "Usar esta".
 * A troca é sempre um clique do usuário — o Zeus só avisa (notificação perto de 90%).
 */

const color = (pct: number) => (pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#34d399')

function when(iso: string | null): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'já voltou'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  if (h >= 24) return `volta ${new Date(iso).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
  return `volta em ${h ? `${h} h ` : ''}${m} min`
}

function Bar({ label, w }: { label: string; w: ClaudeUsageWindow | null }) {
  if (!w) return null
  return (
    <div>
      <div className="flex justify-between text-[10px]" style={{ color: 'rgba(247,249,252,0.55)' }}>
        <span>{label} · {w.pct}%</span><span>{when(w.resetsAt)}</span>
      </div>
      <div className="h-1 rounded-full mt-0.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-1 rounded-full" style={{ width: `${Math.min(100, w.pct)}%`, background: color(w.pct) }} />
      </div>
    </div>
  )
}

export default function ClaudeUsageBadge() {
  const [usage, setUsage] = useState<ClaudeAccountUsage[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    ipc.claude.allUsage().then(setUsage).catch(() => {})
    const unsub = ipc.claude.onUsage(setUsage)
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [])

  if (usage.length === 0) return null
  const active = usage.find(a => a.active) ?? usage[0]
  const worst = Math.max(active.fiveHour?.pct ?? 0, active.sevenDay?.pct ?? 0)

  const use = async (id: string) => {
    setBusy(id)
    try { await ipc.claude.accounts.setActive(id); setUsage(await ipc.claude.allUsage(true)) } catch { /* segue */ }
    setBusy(null)
  }
  const refresh = async () => {
    setBusy('refresh')
    try { setUsage(await ipc.claude.allUsage(true)) } catch { /* segue */ }
    setBusy(null)
  }

  return (
    <div className="mb-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
        title="Saldo das contas Claude (Squad e AI Hub)">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active.problem ? '#94a3b8' : color(worst) }} />
        <span className="text-[11px] truncate flex-1" style={{ color: 'rgba(247,249,252,0.8)' }}>
          Claude: {active.name}{!active.problem && ` · ${worst}%`}
        </span>
        {open ? <ChevronUp size={11} style={{ color: 'rgba(247,249,252,0.4)' }} /> : <ChevronDown size={11} style={{ color: 'rgba(247,249,252,0.4)' }} />}
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-2">
          {usage.map(a => (
            <div key={a.id} className="space-y-1 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'rgba(247,249,252,0.85)' }}>
                  {a.name}{a.plan ? ` · ${a.plan}` : ''}
                </span>
                {a.active ? (
                  <span className="text-[9px] px-1.5 rounded" style={{ background: 'rgba(26,140,255,0.15)', color: '#7cc0ff' }}>em uso</span>
                ) : (
                  <button onClick={() => void use(a.id)} disabled={busy !== null || !!a.problem}
                    className="text-[9px] px-1.5 py-0.5 rounded disabled:opacity-40"
                    style={{ background: 'rgba(26,140,255,0.2)', color: '#bfe0ff' }}
                    title={a.problem || `Passar a usar ${a.name} no Squad e no AI Hub`}>
                    {busy === a.id ? <Loader2 size={9} className="animate-spin" /> : 'Usar esta'}
                  </button>
                )}
              </div>
              {a.problem
                ? <p className="text-[10px]" style={{ color: '#fbbf24' }}>{a.problem}</p>
                : <><Bar label="5 h" w={a.fiveHour} /><Bar label="Semana" w={a.sevenDay} /></>}
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
