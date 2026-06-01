import { useEffect, useState, useCallback } from 'react'
import { History, CheckCircle, XCircle, RefreshCw, Filter } from 'lucide-react'
import { ipc } from '../lib/ipc'

interface HistoryEntry {
  id: string
  projectId: string
  launchedAt: string
  success: boolean
  errorMsg?: string
  project: { id: string; name: string; vpsServer: { id: string; name: string; host: string } }
}

interface VpsOption { id: string; name: string }
interface ProjectOption { id: string; name: string }

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [vpsList, setVpsList] = useState<VpsOption[]>([])
  const [projectsList, setProjectsList] = useState<ProjectOption[]>([])

  const [filterVps, setFilterVps] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const filters: { vpsId?: string; projectId?: string; success?: boolean } = {}
    if (filterVps) filters.vpsId = filterVps
    if (filterProject) filters.projectId = filterProject
    if (filterStatus === 'success') filters.success = true
    if (filterStatus === 'error') filters.success = false

    const r = await ipc.history.list(filters)
    setLoading(false)
    if (r.success) setHistory(r.history)
  }, [filterVps, filterProject, filterStatus])

  useEffect(() => {
    Promise.all([ipc.vps.list(), ipc.projects.list()]).then(([vs, ps]) => {
      setVpsList(Array.isArray(vs) ? vs.map(v => ({ id: v.id!, name: v.name })) : [])
      setProjectsList(Array.isArray(ps) ? ps.map(p => ({ id: p.id!, name: p.name })) : [])
    })
    load()
  }, [load])

  const total = history.length
  const successes = history.filter(h => h.success).length
  const rate = total > 0 ? Math.round((successes / total) * 100) : 0

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History size={20} className="text-brand-400" />
            Histórico de Lançamentos
          </h1>
          {!loading && total > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {total} registros · {successes} sucessos · taxa {rate}%
            </p>
          )}
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center p-3 bg-slate-900 border border-slate-800 rounded-xl">
        <Filter size={13} className="text-slate-500 shrink-0" />
        <select value={filterVps} onChange={e => setFilterVps(e.target.value)}
          className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500">
          <option value="">Todas as VPS</option>
          {vpsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500">
          <option value="">Todos os projetos</option>
          {projectsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {(['all', 'success', 'error'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 transition-colors ${filterStatus === s ? 'bg-brand-600/30 text-brand-300' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
              {s === 'all' ? 'Todos' : s === 'success' ? '✓ Sucesso' : '✗ Erro'}
            </button>
          ))}
        </div>
        {(filterVps || filterProject || filterStatus !== 'all') && (
          <button onClick={() => { setFilterVps(''); setFilterProject(''); setFilterStatus('all') }}
            className="text-xs text-slate-600 hover:text-slate-400">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-12 text-slate-600 text-sm">Carregando...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <History size={36} className="text-slate-800 mx-auto" />
          <p className="text-slate-500 text-sm">Nenhum lançamento encontrado</p>
          <p className="text-slate-700 text-xs">Abra projetos pelo Lançador para registrar o histórico</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Quando</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Projeto</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">VPS</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/50'}`}>
                  <td className="px-4 py-2.5">
                    <p className="text-slate-300 text-xs">{formatDate(h.launchedAt)}</p>
                    <p className="text-slate-600 text-[10px]">{timeAgo(h.launchedAt)}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-slate-200 text-xs font-medium">{h.project?.name ?? h.projectId}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-slate-400 text-xs">{h.project?.vpsServer?.name}</p>
                    <p className="text-slate-600 text-[10px] font-mono">{h.project?.vpsServer?.host}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    {h.success
                      ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} /> Sucesso</span>
                      : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> Erro</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    {h.errorMsg && <p className="text-red-400/70 text-[10px] max-w-xs truncate" title={h.errorMsg}>{h.errorMsg}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
