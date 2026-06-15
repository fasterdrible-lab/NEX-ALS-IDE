import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Network, Loader2, RefreshCw, AlertCircle, CheckCircle2,
  Layers, Package, GitMerge, ShieldAlert, ChevronDown, ChevronRight, Globe,
} from 'lucide-react'
import { ipc, type WorkspaceReport, type WsRisk } from '../lib/ipc'

type Tab = 'summary' | 'architecture' | 'modules' | 'flows' | 'risks'

const SEVERITY_ORDER: WsRisk['severity'][] = ['critical', 'high', 'medium', 'low']

const RISK_STYLE: Record<WsRisk['severity'], { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: 'rgba(239,68,68,0.09)',   border: 'rgba(239,68,68,0.28)',   text: '#f87171', label: 'Crítico'  },
  high:     { bg: 'rgba(249,115,22,0.09)',   border: 'rgba(249,115,22,0.28)',  text: '#fb923c', label: 'Alto'     },
  medium:   { bg: 'rgba(234,179,8,0.09)',    border: 'rgba(234,179,8,0.28)',   text: '#facc15', label: 'Médio'    },
  low:      { bg: 'rgba(100,116,139,0.09)',  border: 'rgba(100,116,139,0.28)', text: '#94a3b8', label: 'Baixo'    },
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  controller: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
  service:    { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  model:      { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  utility:    { bg: 'rgba(234,179,8,0.12)',   color: '#facc15' },
  config:     { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
}

function getRoleStyle(role: string) {
  const key = Object.keys(ROLE_STYLE).find(k => role.toLowerCase().includes(k))
  return ROLE_STYLE[key ?? ''] ?? { bg: 'rgba(255,255,255,0.05)', color: '#94a3b8' }
}

// ── sub-components ───────────────────────────────────────────────────────────

function SummaryTab({ report }: { report: WorkspaceReport }) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="p-5 rounded-xl text-sm text-slate-300 leading-relaxed"
        style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)' }}>
        {report.summary || <span className="text-slate-600 italic">Sem resumo disponível.</span>}
      </div>

      {report.stack.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-3">Stack tecnológica</p>
          <div className="flex flex-wrap gap-2">
            {report.stack.map((s, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#93c5fd' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {report.architecture.patterns.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-3">Padrões de arquitetura</p>
          <div className="space-y-1.5">
            {report.architecture.patterns.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ArchitectureTab({ report }: { report: WorkspaceReport }) {
  return (
    <div className="max-w-2xl space-y-3">
      {report.architecture.layers.length === 0 ? (
        <p className="text-sm text-slate-600 italic">Nenhuma camada arquitetural identificada.</p>
      ) : (
        report.architecture.layers.map((layer, i) => (
          <div key={i} className="p-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Layers size={13} style={{ color: '#60a5fa' }} />
              <span className="text-sm font-medium text-slate-200">{layer.name}</span>
            </div>
            {layer.description && <p className="text-xs text-slate-500 mb-3">{layer.description}</p>}
            {layer.files.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {layer.files.map((f, j) => (
                  <span key={j} className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function ModulesTab({ report }: { report: WorkspaceReport }) {
  return (
    <div className="max-w-2xl space-y-2">
      {report.modules.length === 0 ? (
        <p className="text-sm text-slate-600 italic">Nenhum módulo identificado.</p>
      ) : (
        report.modules.map((m, i) => {
          const rs = getRoleStyle(m.role)
          return (
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Package size={13} className="text-slate-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-medium text-slate-200">{m.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={rs}>{m.role}</span>
                </div>
                {m.path && <p className="text-[10px] font-mono text-slate-600 mb-1">{m.path}</p>}
                <div className="flex items-center gap-3 text-[10px]">
                  {m.imports.length > 0 && <span className="text-slate-600">{m.imports.length} import{m.imports.length !== 1 ? 's' : ''}</span>}
                  {m.risks.length > 0 && <span className="text-amber-500">⚠ {m.risks.length} risco{m.risks.length !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function FlowsTab({ report }: { report: WorkspaceReport }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const toggle = (i: number) => {
    const next = new Set(expanded)
    next.has(i) ? next.delete(i) : next.add(i)
    setExpanded(next)
  }
  return (
    <div className="max-w-2xl space-y-3">
      {report.flows.length === 0 ? (
        <p className="text-sm text-slate-600 italic">Nenhum fluxo identificado.</p>
      ) : (
        report.flows.map((flow, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => toggle(i)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              style={{ background: expanded.has(i) ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.03)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = expanded.has(i) ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.03)' }}>
              <GitMerge size={13} style={{ color: '#60a5fa' }} />
              <span className="flex-1 text-sm font-medium text-slate-200">{flow.name}</span>
              <span className="text-[10px] text-slate-600 mr-2">{flow.steps.length} etapa{flow.steps.length !== 1 ? 's' : ''}</span>
              {expanded.has(i) ? <ChevronDown size={13} className="text-slate-600" /> : <ChevronRight size={13} className="text-slate-600" />}
            </button>
            {expanded.has(i) && (
              <div className="px-4 pb-4 pt-3 space-y-2.5">
                {flow.steps.map((step, j) => (
                  <div key={j} className="flex items-start gap-3 text-xs text-slate-400">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                      {j + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function RisksTab({ report }: { report: WorkspaceReport }) {
  const sorted = [...report.risks].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  )
  return (
    <div className="max-w-2xl space-y-3">
      {sorted.length === 0 ? (
        <div className="flex items-center gap-3 p-5 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">Nenhum risco identificado — projeto em boas condições.</p>
        </div>
      ) : (
        sorted.map((risk, i) => {
          const c = RISK_STYLE[risk.severity]
          return (
            <div key={i} className="p-4 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <div className="flex items-start gap-3">
                <ShieldAlert size={14} style={{ color: c.text }} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c.text }}>{c.label}</span>
                    {risk.type && <span className="text-xs text-slate-500">{risk.type}</span>}
                  </div>
                  <p className="text-sm text-slate-300">{risk.description}</p>
                  {risk.file && <p className="text-[10px] font-mono text-slate-600 mt-1">{risk.file}</p>}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── selector ─────────────────────────────────────────────────────────────────

interface VpsEntry { id: string; name: string; host: string }

function SelectorPanel({
  vpsList, selectedVpsId, setSelectedVpsId,
  projectPath, setProjectPath, onAnalyze,
}: {
  vpsList: VpsEntry[]; selectedVpsId: string; setSelectedVpsId: (v: string) => void
  projectPath: string; setProjectPath: (v: string) => void; onAnalyze: () => void
}) {
  return (
    <div className="max-w-md mx-auto py-16">
      <div className="flex items-center gap-3 mb-8">
        <Network size={22} style={{ color: '#60a5fa' }} />
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#93c5fd' }}>Workspace Intelligence</h1>
          <p className="text-xs text-slate-600">Análise de arquitetura, dependências e riscos do projeto</p>
        </div>
      </div>

      <div className="space-y-4 p-5 rounded-xl"
        style={{ background: 'rgba(13,10,36,0.8)', border: '1px solid rgba(96,165,250,0.14)' }}>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">VPS</label>
          <select
            value={selectedVpsId}
            onChange={e => setSelectedVpsId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-200"
            style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.1)' }}>
            <option value="">Selecionar VPS…</option>
            {vpsList.map(v => (
              <option key={v.id} value={v.id}>{v.name} — {v.host}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">Caminho do projeto na VPS</label>
          <input
            value={projectPath}
            onChange={e => setProjectPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAnalyze()}
            placeholder="/root/meu-projeto"
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-700 outline-none"
            style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        <button
          onClick={onAnalyze}
          disabled={!selectedVpsId || !projectPath.trim()}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.28)', color: '#93c5fd' }}>
          Analisar Projeto
        </button>
      </div>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; Icon: typeof Globe }[] = [
  { id: 'summary',      label: 'Resumo',       Icon: Globe      },
  { id: 'architecture', label: 'Arquitetura',  Icon: Layers     },
  { id: 'modules',      label: 'Módulos',      Icon: Package    },
  { id: 'flows',        label: 'Fluxos',       Icon: GitMerge   },
  { id: 'risks',        label: 'Riscos',       Icon: ShieldAlert },
]

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const initVpsId   = params.get('vpsId')   ?? ''
  const initPath    = params.get('path')    ?? ''

  const [vpsList,       setVpsList]       = useState<VpsEntry[]>([])
  const [selectedVpsId, setSelectedVpsId] = useState(initVpsId)
  const [projectPath,   setProjectPath]   = useState(initPath)
  const [loading,       setLoading]       = useState(false)
  const [report,        setReport]        = useState<WorkspaceReport | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [activeTab,     setActiveTab]     = useState<Tab>('summary')

  useEffect(() => {
    ipc.vps.list().then(list => setVpsList(list as unknown as VpsEntry[])).catch(() => {})
  }, [])

  useEffect(() => {
    if (initVpsId && initPath) void analyze()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async () => {
    if (!selectedVpsId || !projectPath.trim()) return
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const result = await ipc.workspace.analyze({ vpsId: selectedVpsId, projectPath: projectPath.trim() })
      if ((result as unknown as { error: string }).error) throw new Error((result as unknown as { error: string }).error)
      setReport(result)
      setActiveTab('summary')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const currentVps = vpsList.find(v => v.id === selectedVpsId)
  const projectLabel = projectPath.split('/').filter(Boolean).pop() ?? 'Projeto'

  const riskCounts = report
    ? SEVERITY_ORDER.reduce<Record<string, number>>((acc, s) => {
        acc[s] = report.risks.filter(r => r.severity === s).length
        return acc
      }, {})
    : {}

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#080612', color: '#F8F8FC' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0D0A24' }}>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={13} /> Voltar
        </button>
        <div className="w-px h-4 bg-slate-800" />
        <Network size={14} style={{ color: '#60a5fa' }} />
        <span className="text-sm font-semibold" style={{ color: '#93c5fd' }}>Workspace Intelligence</span>

        {currentVps && (
          <>
            <div className="w-px h-4 bg-slate-800" />
            <span className="text-xs text-slate-500">{currentVps.name}</span>
            <ChevronRight size={10} className="text-slate-700" />
            <span className="text-xs font-medium" style={{ color: '#93c5fd' }}>{projectLabel}</span>
          </>
        )}

        <div className="flex-1" />

        {/* Risk badges in top bar */}
        {report && !loading && (
          <div className="flex items-center gap-1.5">
            {(['critical', 'high'] as const).map(s =>
              (riskCounts[s] ?? 0) > 0 ? (
                <span key={s} className="px-2 py-0.5 rounded-full text-[10px]"
                  style={{ background: RISK_STYLE[s].bg, color: RISK_STYLE[s].text, border: `1px solid ${RISK_STYLE[s].border}` }}>
                  {riskCounts[s]} {RISK_STYLE[s].label.toLowerCase()}
                </span>
              ) : null
            )}
          </div>
        )}

        {selectedVpsId && projectPath && (
          <button
            onClick={() => void analyze()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#93c5fd' }}>
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {loading ? 'Analisando…' : 'Reanalisar'}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left nav (only when report is ready) */}
        {report && (
          <aside className="w-44 shrink-0 flex flex-col overflow-y-auto"
            style={{ borderRight: '1px solid rgba(255,255,255,0.05)', background: '#0A0817' }}>
            <nav className="p-3 space-y-0.5">
              {TABS.map(({ id, label, Icon }) => {
                const isActive = activeTab === id
                const count = id === 'modules' ? report.modules.length
                  : id === 'flows' ? report.flows.length
                  : id === 'risks' ? report.risks.length
                  : undefined
                return (
                  <button key={id} onClick={() => setActiveTab(id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
                    style={isActive
                      ? { background: 'rgba(96,165,250,0.1)', color: '#93c5fd', borderLeft: '2px solid #60a5fa', paddingLeft: '10px' }
                      : { color: 'rgba(248,248,252,0.4)', borderLeft: '2px solid transparent', paddingLeft: '10px' }}>
                    <Icon size={12} className="shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {count !== undefined && <span className="text-[10px]" style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.2)' }}>{count}</span>}
                  </button>
                )
              })}
            </nav>

            {/* Risk summary */}
            <div className="mt-auto p-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px] uppercase tracking-widest text-slate-700 mb-2">Riscos</p>
              {SEVERITY_ORDER.map(s => (
                <div key={s} className="flex items-center justify-between py-0.5 text-[10px]">
                  <span style={{ color: (riskCounts[s] ?? 0) > 0 ? RISK_STYLE[s].text : 'rgba(255,255,255,0.2)' }}>
                    {RISK_STYLE[s].label}
                  </span>
                  <span style={{ color: (riskCounts[s] ?? 0) > 0 ? RISK_STYLE[s].text : 'rgba(255,255,255,0.15)' }}>
                    {riskCounts[s] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Selector (no report yet, not loading) */}
          {!report && !loading && !error && (
            <SelectorPanel
              vpsList={vpsList}
              selectedVpsId={selectedVpsId}
              setSelectedVpsId={setSelectedVpsId}
              projectPath={projectPath}
              setProjectPath={setProjectPath}
              onAnalyze={() => void analyze()}
            />
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-72 gap-5">
              <div className="relative">
                <Network size={32} style={{ color: 'rgba(96,165,250,0.25)' }} />
                <Loader2 size={16} className="animate-spin absolute -top-1 -right-1" style={{ color: '#60a5fa' }} />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-300">Analisando projeto…</p>
                <p className="text-xs text-slate-600 mt-1">Lendo código-fonte e construindo mapa de arquitetura</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="max-w-md mx-auto py-16 flex flex-col items-center gap-4">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-sm text-slate-400 text-center">{error}</p>
              <button onClick={() => void analyze()}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#93c5fd' }}>
                Tentar novamente
              </button>
              <button onClick={() => { setError(null); setReport(null) }}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                ← Alterar projeto
              </button>
            </div>
          )}

          {/* Report tabs */}
          {report && !loading && (
            <>
              {activeTab === 'summary'      && <SummaryTab      report={report} />}
              {activeTab === 'architecture' && <ArchitectureTab report={report} />}
              {activeTab === 'modules'      && <ModulesTab      report={report} />}
              {activeTab === 'flows'        && <FlowsTab        report={report} />}
              {activeTab === 'risks'        && <RisksTab        report={report} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
