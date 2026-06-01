import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Cpu, HardDrive, Clock, Wifi, WifiOff, Server, FolderSearch, X } from 'lucide-react'
import { ipc } from '../lib/ipc'

interface VpsItem { id: string; name: string; host: string; username: string }

interface VpsStats {
  vpsId: string; online: boolean
  cpu: { loadAvg1: number; loadAvg5: number; loadAvg15: number; cores: number; usagePercent: number }
  ram: { totalMb: number; usedMb: number; freeMb: number; usagePercent: number }
  disk: { total: string; used: string; available: string; usagePercent: number }
  uptime: string; fetchedAt: number
}

interface CardState { loading: boolean; stats: VpsStats | null; error: string | null }

interface DiskModal {
  vpsName: string
  loading: boolean
  top?: string; docker?: string; pm2logs?: string; varlog?: string
  error?: string
}

function usageColor(pct: number) {
  if (pct >= 85) return { bar: 'bg-red-500', text: 'text-red-400' }
  if (pct >= 60) return { bar: 'bg-yellow-500', text: 'text-yellow-400' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-400' }
}

function ProgressBar({ value, label, sub }: { value: number; label: string; sub: string }) {
  const { bar, text } = usageColor(value)
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono font-semibold ${text}`}>{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${Math.max(1, value)}%` }} />
      </div>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  )
}

function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

function DiskSection({ title, content }: { title: string; content?: string }) {
  if (!content || content === 'N/A' || !content.trim()) return null
  const lines = content.trim().split('\n').filter(Boolean)
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</p>
      <div className="bg-slate-950 rounded-lg overflow-hidden">
        {lines.map((line, i) => {
          const parts = line.match(/^(\S+)\s+(.+)$/)
          const size = parts?.[1] ?? ''
          const path = parts?.[2] ?? line
          const sizeNum = parseFloat(size)
          const isLarge = size.endsWith('G') && sizeNum > 5
          const isMedium = (size.endsWith('G') && sizeNum > 1) || (size.endsWith('M') && sizeNum > 500)
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-900 last:border-0 hover:bg-slate-900/50">
              <span className={`text-xs font-mono font-semibold w-16 shrink-0 text-right ${isLarge ? 'text-red-400' : isMedium ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {size}
              </span>
              <span className="text-xs text-slate-300 truncate font-mono">{path}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VpsCard({ vps, state, onRefresh, onDiskAnalysis }: {
  vps: VpsItem; state: CardState; onRefresh: () => void; onDiskAnalysis: () => void
}) {
  const { loading, stats, error } = state
  return (
    <div className={`bg-slate-900 border rounded-xl p-5 flex flex-col gap-4 ${stats?.disk && stats.disk.usagePercent >= 85 ? 'border-red-700/50' : 'border-slate-800'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Server size={14} className="text-slate-400 shrink-0" />
            <h3 className="font-semibold text-slate-100 truncate text-sm">{vps.name}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">{vps.username}@{vps.host}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stats && <span className="flex items-center gap-1 text-xs text-emerald-400"><Wifi size={11} /> Online</span>}
          {error && <span className="flex items-center gap-1 text-xs text-red-400"><WifiOff size={11} /> Offline</span>}
          <button onClick={onRefresh} disabled={loading} className="p-1 text-slate-500 hover:text-slate-300 rounded disabled:opacity-40">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !stats && (
        <div className="space-y-4 animate-pulse">
          {[0,1,2].map(i => <div key={i} className="space-y-2"><div className="h-3 bg-slate-800 rounded w-1/2"/><div className="h-1.5 bg-slate-800 rounded"/><div className="h-3 bg-slate-800 rounded w-2/3"/></div>)}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <WifiOff size={24} className="text-red-500/50" />
          <p className="text-xs text-red-400">Sem conexão</p>
          <p className="text-xs text-slate-600 max-w-[180px]">{error}</p>
        </div>
      )}

      {stats && (
        <>
          <ProgressBar label="CPU" value={stats.cpu.usagePercent}
            sub={`Load: ${stats.cpu.loadAvg1} / ${stats.cpu.loadAvg5} / ${stats.cpu.loadAvg15} · ${stats.cpu.cores} core${stats.cpu.cores !== 1 ? 's' : ''}`} />
          <ProgressBar label="RAM" value={stats.ram.usagePercent}
            sub={`${formatMb(stats.ram.usedMb)} / ${formatMb(stats.ram.totalMb)}`} />
          <ProgressBar label="Disco (/)" value={stats.disk.usagePercent}
            sub={`${stats.disk.used} / ${stats.disk.total} — ${stats.disk.available} livre`} />
          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={11} /><span className="truncate">{stats.uptime || '-'}</span>
            </div>
            <button onClick={onDiskAnalysis}
              className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded transition-colors ${stats.disk.usagePercent >= 85 ? 'bg-red-700/20 text-red-300 hover:bg-red-700/30' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}>
              <FolderSearch size={11} />
              {stats.disk.usagePercent >= 85 ? '⚠ Analisar disco' : 'Analisar disco'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DiskModal({ modal, onClose }: { modal: DiskModal; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800 shrink-0">
          <HardDrive size={16} className="text-brand-400" />
          <span className="font-semibold text-slate-100 flex-1">Uso de disco — {modal.vpsName}</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16}/></button>
        </div>

        {modal.loading ? (
          <div className="flex-1 flex items-center justify-center py-12 text-slate-500 text-sm">
            <RefreshCw size={18} className="animate-spin mr-2" /> Analisando disco...
          </div>
        ) : modal.error ? (
          <div className="flex-1 flex items-center justify-center py-12 text-red-400 text-sm">{modal.error}</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <DiskSection title="Maiores diretórios (/)" content={modal.top} />
            <DiskSection title="Docker (images + volumes + containers)" content={modal.docker} />
            <DiskSection title="PM2 — logs" content={modal.pm2logs} />
            <DiskSection title="Logs do sistema (/var/log)" content={modal.varlog} />
            <p className="text-[10px] text-slate-700 text-center">
              Cores: <span className="text-emerald-400">verde &lt; 1GB</span> ·{' '}
              <span className="text-yellow-400">amarelo 1-5GB</span> ·{' '}
              <span className="text-red-400">vermelho &gt; 5GB</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MonitorPage() {
  const [vpsList, setVpsList] = useState<VpsItem[]>([])
  const [cards, setCards] = useState<Record<string, CardState>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [globalLoading, setGlobalLoading] = useState(true)
  const [diskModal, setDiskModal] = useState<DiskModal | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStats = useCallback(async (vpsId: string) => {
    setCards(prev => ({ ...prev, [vpsId]: { ...prev[vpsId], loading: true, error: null } }))
    const res = await (window as any).electron.invoke('monitor:getStats', vpsId) as any
    if (res?.success) {
      setCards(prev => ({ ...prev, [vpsId]: { loading: false, stats: res.stats, error: null } }))
    } else {
      setCards(prev => ({ ...prev, [vpsId]: { loading: false, stats: prev[vpsId]?.stats ?? null, error: res?.error || 'Falha ao conectar' } }))
    }
  }, [])

  const refreshAll = useCallback(async (list: VpsItem[]) => {
    setLastUpdated(new Date())
    await Promise.allSettled(list.map(v => fetchStats(v.id)))
  }, [fetchStats])

  useEffect(() => {
    const load = async () => {
      const res = await (window as any).electron.invoke('vps:list') as VpsItem[]
      const list = Array.isArray(res) ? res : []
      setVpsList(list)
      const initial: Record<string, CardState> = {}
      list.forEach(v => { initial[v.id] = { loading: true, stats: null, error: null } })
      setCards(initial)
      setGlobalLoading(false)
      await refreshAll(list)
    }
    load()
  }, [refreshAll])

  useEffect(() => {
    if (vpsList.length === 0) return
    intervalRef.current = setInterval(() => refreshAll(vpsList), 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [vpsList, refreshAll])

  const openDiskAnalysis = useCallback(async (vps: VpsItem) => {
    setDiskModal({ vpsName: vps.name, loading: true })
    const r = await ipc.monitor.diskUsage(vps.id)
    if (r.success) {
      setDiskModal({ vpsName: vps.name, loading: false, top: r.top, docker: r.docker, pm2logs: r.pm2logs, varlog: r.varlog })
    } else {
      setDiskModal({ vpsName: vps.name, loading: false, error: r.error ?? 'Erro ao analisar disco' })
    }
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Cpu size={20} className="text-brand-400" /> Monitor de VPS
          </h1>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-0.5">
              Última atualização: {lastUpdated.toLocaleTimeString()} · auto-refresh 30s
            </p>
          )}
        </div>
        <button onClick={() => refreshAll(vpsList)} disabled={globalLoading || vpsList.length === 0}
          className="flex items-center gap-2 px-3 py-2 bg-brand-600/20 text-brand-300 border border-brand-600/30 rounded-lg text-sm hover:bg-brand-600/30 transition-colors disabled:opacity-40">
          <RefreshCw size={14} /> Atualizar tudo
        </button>
      </div>

      {!globalLoading && vpsList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Server size={40} className="text-slate-700" />
          <p className="text-slate-400 font-medium">Nenhuma VPS cadastrada</p>
        </div>
      )}

      {vpsList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {vpsList.map(vps => (
            <VpsCard key={vps.id} vps={vps}
              state={cards[vps.id] ?? { loading: true, stats: null, error: null }}
              onRefresh={() => fetchStats(vps.id)}
              onDiskAnalysis={() => openDiskAnalysis(vps)}
            />
          ))}
        </div>
      )}

      {diskModal && <DiskModal modal={diskModal} onClose={() => setDiskModal(null)} />}
    </div>
  )
}
