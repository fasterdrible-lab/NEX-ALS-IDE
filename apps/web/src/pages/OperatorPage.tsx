import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, RefreshCw, Cpu, MemoryStick, HardDrive, Clock, Wifi, WifiOff,
  AlertTriangle, CheckCircle, XCircle, Loader2, Bot, ArrowLeft, Bell,
} from 'lucide-react'
import { ipc } from '../lib/ipc'

// ── Types ─────────────────────────────────────────────────────────────────────
interface VpsItem { id: string; name: string; host: string; username: string }

interface VpsStats {
  vpsId: string; online: boolean
  cpu: { loadAvg1: number; cores: number; usagePercent: number }
  ram: { totalMb: number; usedMb: number; usagePercent: number }
  disk: { total: string; used: string; usagePercent: number }
  uptime: string; fetchedAt: number
}

type HealthStatus = 'ok' | 'warn' | 'critical' | 'offline' | 'checking'

interface Alert { id: string; vpsName: string; vpsId: string; message: string; level: 'warn' | 'critical'; time: string }

interface VpsHealth {
  vps: VpsItem
  status: HealthStatus
  stats: VpsStats | null
  alerts: string[]
  error?: string
}

// ── Thresholds ────────────────────────────────────────────────────────────────
const T = { cpu: { warn: 80, crit: 95 }, ram: { warn: 85, crit: 95 }, disk: { warn: 80, crit: 90 } }

function evaluateStatus(stats: VpsStats | null): { status: HealthStatus; alerts: string[] } {
  if (!stats) return { status: 'offline', alerts: ['Sem conexão'] }
  const alerts: string[] = []
  let status: HealthStatus = 'ok'

  const check = (label: string, val: number, warn: number, crit: number) => {
    if (val >= crit) { alerts.push(`${label} crítico: ${val}%`); status = 'critical' }
    else if (val >= warn) { alerts.push(`${label} alto: ${val}%`); if (status !== 'critical') status = 'warn' }
  }
  check('CPU', stats.cpu.usagePercent, T.cpu.warn, T.cpu.crit)
  check('RAM', stats.ram.usagePercent, T.ram.warn, T.ram.crit)
  check('Disco', stats.disk.usagePercent, T.disk.warn, T.disk.crit)
  return { status, alerts }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<HealthStatus, { dot: string; border: string; bg: string; text: string }> = {
  ok:       { dot: '#60D9B0', border: 'rgba(96,217,176,0.2)',   bg: 'rgba(96,217,176,0.05)',   text: '#60D9B0' },
  warn:     { dot: '#F2C879', border: 'rgba(242,200,121,0.25)', bg: 'rgba(242,200,121,0.06)',  text: '#F2C879' },
  critical: { dot: '#f87171', border: 'rgba(248,113,113,0.3)',  bg: 'rgba(248,113,113,0.07)', text: '#f87171' },
  offline:  { dot: '#6b7280', border: 'rgba(107,114,128,0.2)',  bg: 'rgba(255,255,255,0.02)',  text: '#6b7280' },
  checking: { dot: '#D9A441', border: 'rgba(217,164,65,0.2)',   bg: 'rgba(217,164,65,0.04)',   text: '#D9A441' },
}

function StatusDot({ status }: { status: HealthStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.dot, boxShadow: `0 0 6px ${c.dot}80` }} />
      <span className="text-[11px] font-medium" style={{ color: c.text }}>
        {status === 'ok' ? 'Online' : status === 'warn' ? 'Atenção' : status === 'critical' ? 'Crítico' : status === 'offline' ? 'Offline' : 'Verificando…'}
      </span>
    </span>
  )
}

function MiniBar({ label, value, unit }: { label: string; value: number; unit?: string }) {
  const color = value >= T.cpu.crit ? '#f87171' : value >= T.cpu.warn ? '#F2C879' : '#60D9B0'
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px]" style={{ color: 'rgba(248,248,252,0.4)' }}>{label}</span>
        <span className="text-[11px] font-mono font-semibold" style={{ color }}>{value}{unit ?? '%'}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(1, value)}%`, background: color }} />
      </div>
    </div>
  )
}

function formatMb(mb: number) { return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB` }
function formatTime(iso: string) {
  try { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso)) }
  catch { return iso }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OperatorPage() {
  const navigate = useNavigate()
  const [vpsList, setVpsList] = useState<VpsItem[]>([])
  const [health, setHealth] = useState<Map<string, VpsHealth>>(new Map())
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [lastCheck, setLastCheck] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const alertCounterRef = useRef(0)

  useEffect(() => {
    ipc.vps.list().then(list => {
      const items = (list as VpsItem[]).filter(v => v.host)
      setVpsList(items)
      const init = new Map<string, VpsHealth>()
      items.forEach(v => init.set(v.id, { vps: v, status: 'checking', stats: null, alerts: [] }))
      setHealth(init)
    }).catch(() => {})
  }, [])

  const checkAll = useCallback(async (list?: VpsItem[]) => {
    const targets = list ?? vpsList
    if (!targets.length) return
    setChecking(true)
    setAnalysis(null)

    // Reset all to 'checking'
    setHealth(prev => {
      const next = new Map(prev)
      targets.forEach(v => next.set(v.id, { vps: v, status: 'checking', stats: next.get(v.id)?.stats ?? null, alerts: [] }))
      return next
    })

    await Promise.all(targets.map(async vps => {
      try {
        const res = await ipc.monitor.getStats(vps.id) as { success: boolean; stats?: VpsStats; error?: string }
        const stats = res.success ? (res.stats ?? null) : null
        const { status, alerts: vpsAlerts } = evaluateStatus(stats)

        setHealth(prev => {
          const next = new Map(prev)
          next.set(vps.id, { vps, status, stats, alerts: vpsAlerts, error: res.success ? undefined : res.error })
          return next
        })

        // Add to alert feed if degraded
        if (vpsAlerts.length > 0) {
          const newAlerts: Alert[] = vpsAlerts.map(msg => ({
            id: `${++alertCounterRef.current}`,
            vpsName: vps.name,
            vpsId: vps.id,
            message: msg,
            level: status === 'critical' ? 'critical' : 'warn',
            time: new Date().toISOString(),
          }))
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 50))
        }
      } catch {
        setHealth(prev => {
          const next = new Map(prev)
          next.set(vps.id, { vps, status: 'offline', stats: null, alerts: ['Erro de conexão'] })
          return next
        })
      }
    }))

    setLastCheck(new Date().toISOString())
    setChecking(false)
  }, [vpsList])

  // Auto-check when VPS list loads
  useEffect(() => {
    if (vpsList.length > 0) void checkAll(vpsList)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vpsList.length])

  // Auto-refresh every 5 min
  useEffect(() => {
    if (!vpsList.length) return
    const t = setInterval(() => void checkAll(), 5 * 60_000)
    return () => clearInterval(t)
  }, [checkAll, vpsList.length])

  async function handleAnalyze() {
    if (analysing) return
    setAnalysing(true)
    setAnalysis(null)

    const lines: string[] = ['# RELATÓRIO DE INFRAESTRUTURA\n']
    health.forEach(({ vps, status, stats, alerts }) => {
      lines.push(`## ${vps.name} (${vps.host}) — ${status.toUpperCase()}`)
      if (stats) {
        lines.push(`CPU: ${stats.cpu.usagePercent}% (load ${stats.cpu.loadAvg1}, ${stats.cpu.cores} cores)`)
        lines.push(`RAM: ${stats.ram.usagePercent}% (${formatMb(stats.ram.usedMb)} / ${formatMb(stats.ram.totalMb)})`)
        lines.push(`Disco: ${stats.disk.usagePercent}% (${stats.disk.used} / ${stats.disk.total})`)
        lines.push(`Uptime: ${stats.uptime}`)
      } else { lines.push('(offline)') }
      if (alerts.length) lines.push(`Alertas: ${alerts.join(', ')}`)
      lines.push('')
    })

    try {
      const result = await ipc.infra.analyze(lines.join('\n'))
      setAnalysis(result)
    } catch (e) {
      setAnalysis(`Erro: ${(e as Error).message}`)
    } finally {
      setAnalysing(false)
    }
  }

  const healthArr = vpsList.map(v => health.get(v.id) ?? { vps: v, status: 'checking' as HealthStatus, stats: null, alerts: [] })
  const critCount = healthArr.filter(h => h.status === 'critical').length
  const warnCount = healthArr.filter(h => h.status === 'warn').length
  const okCount   = healthArr.filter(h => h.status === 'ok').length

  return (
    <div className="h-screen flex flex-col" style={{ background: '#080612', color: 'rgba(248,248,252,0.85)' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-1.5 rounded transition-colors"
            style={{ color: 'rgba(248,248,252,0.4)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F2C879' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(248,248,252,0.4)' }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={16} style={{ color: '#D9A441' }} />
            <span className="text-sm font-semibold" style={{ color: '#F2C879' }}>Operador de Infraestrutura</span>
          </div>
          {/* Summary badges */}
          <div className="flex items-center gap-2 ml-4">
            {critCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                {critCount} crítico{critCount !== 1 ? 's' : ''}
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(242,200,121,0.15)', color: '#F2C879' }}>
                {warnCount} atenção
              </span>
            )}
            {okCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(96,217,176,0.1)', color: '#60D9B0' }}>
                {okCount} ok
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastCheck && (
            <span className="text-[10px]" style={{ color: 'rgba(248,248,252,0.3)' }}>
              último check: {formatTime(lastCheck)}
            </span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={analysing || checking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-all"
            style={{ background: 'rgba(183,141,255,0.1)', border: '1px solid rgba(183,141,255,0.2)', color: '#B78DFF' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(183,141,255,0.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(183,141,255,0.1)' }}
          >
            {analysing ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
            Analisar com DevOps
          </button>
          <button
            onClick={() => void checkAll()}
            disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-all"
            style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.2)', color: '#F2C879' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,164,65,0.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,164,65,0.1)' }}
          >
            {checking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Verificar Tudo
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── VPS Grid ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {vpsList.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Shield size={40} style={{ color: 'rgba(217,164,65,0.15)' }} />
              <p className="text-sm" style={{ color: 'rgba(248,248,252,0.3)' }}>Nenhuma VPS cadastrada.</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {healthArr.map(({ vps, status, stats, alerts: vpsAlerts, error }) => {
              const c = STATUS_COLORS[status]
              return (
                <div key={vps.id} className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'rgba(248,248,252,0.9)' }}>{vps.name}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'rgba(248,248,252,0.35)' }}>{vps.host}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {status === 'checking' && <Loader2 size={12} className="animate-spin" style={{ color: '#D9A441' }} />}
                      {status === 'ok'       && <Wifi size={12} style={{ color: '#60D9B0' }} />}
                      {status === 'warn'     && <AlertTriangle size={12} style={{ color: '#F2C879' }} />}
                      {status === 'critical' && <XCircle size={12} style={{ color: '#f87171' }} />}
                      {status === 'offline'  && <WifiOff size={12} style={{ color: '#6b7280' }} />}
                      <StatusDot status={status} />
                    </div>
                  </div>

                  {/* Metrics */}
                  {stats ? (
                    <div className="space-y-2.5">
                      <MiniBar label="CPU" value={stats.cpu.usagePercent} />
                      <MiniBar label="RAM" value={stats.ram.usagePercent} />
                      <MiniBar label="Disco" value={stats.disk.usagePercent} />
                      <div className="flex items-center gap-1 pt-1">
                        <Clock size={9} style={{ color: 'rgba(248,248,252,0.25)' }} />
                        <span className="text-[10px]" style={{ color: 'rgba(248,248,252,0.25)' }}>
                          up {stats.uptime}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs py-4 text-center" style={{ color: 'rgba(248,248,252,0.3)' }}>
                      {error ?? (status === 'checking' ? 'Conectando…' : 'Sem dados')}
                    </p>
                  )}

                  {/* Alerts on card */}
                  {vpsAlerts.length > 0 && (
                    <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {vpsAlerts.map((a, i) => (
                        <p key={i} className="text-[10px] leading-relaxed" style={{ color: status === 'critical' ? '#f87171' : '#F2C879' }}>
                          ⚠ {a}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right panel: alerts + AI ── */}
        <div className="w-72 shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>

          {/* AI Analysis */}
          {(analysis || analysing) && (
            <div className="p-4 overflow-y-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', maxHeight: '45%' }}>
              <div className="flex items-center gap-2 mb-2">
                <Bot size={12} style={{ color: '#B78DFF' }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#B78DFF' }}>
                  Análise DevOps
                </span>
              </div>
              {analysing ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 size={14} className="animate-spin" style={{ color: '#B78DFF' }} />
                  <span className="text-xs" style={{ color: 'rgba(248,248,252,0.4)' }}>Analisando…</span>
                </div>
              ) : (
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(248,248,252,0.7)' }}>
                  {analysis}
                </p>
              )}
            </div>
          )}

          {/* Alert feed */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <Bell size={11} style={{ color: 'rgba(248,248,252,0.35)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(248,248,252,0.3)' }}>
                Alertas ({alerts.length})
              </span>
            </div>
            {alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle size={20} style={{ color: 'rgba(96,217,176,0.3)' }} />
                <p className="text-xs" style={{ color: 'rgba(248,248,252,0.25)' }}>Sem alertas</p>
              </div>
            )}
            <div className="px-3 pb-4 space-y-2">
              {alerts.map(a => (
                <div key={a.id} className="rounded-lg px-3 py-2"
                  style={{
                    background: a.level === 'critical' ? 'rgba(248,113,113,0.07)' : 'rgba(242,200,121,0.07)',
                    border: `1px solid ${a.level === 'critical' ? 'rgba(248,113,113,0.15)' : 'rgba(242,200,121,0.12)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold" style={{ color: a.level === 'critical' ? '#f87171' : '#F2C879' }}>
                      {a.vpsName}
                    </span>
                    <span className="text-[9px]" style={{ color: 'rgba(248,248,252,0.25)' }}>
                      {formatTime(a.time)}
                    </span>
                  </div>
                  <p className="text-[10px]" style={{ color: 'rgba(248,248,252,0.55)' }}>{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
