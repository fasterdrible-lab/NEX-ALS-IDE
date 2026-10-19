import { useEffect, useMemo, useState } from 'react'
import { Loader2, Wrench, AlertTriangle, Bot, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import { ipc, type AgentTask, type TaskStatus, type HermesRunSummary, type HermesRun, type HermesRunKind } from '../lib/ipc'

/**
 * Quadro de tarefas + painel de agentes (ETAPAS 12/13) e logs separados por execução (ETAPA 37).
 * Os dados vêm de hermes_task_runs, gravado pelo main a partir do stream-json — continuam corretos
 * mesmo se o painel foi fechado e reaberto no meio de uma execução.
 */

const COLUMNS: { status: TaskStatus; label: string; cls: string }[] = [
  { status: 'TODO', label: 'Pendente', cls: 'text-slate-400' },
  { status: 'IN_PROGRESS', label: 'Em andamento', cls: 'text-purple-300' },
  { status: 'BLOCKED', label: 'Bloqueada', cls: 'text-red-400' },
  { status: 'DONE', label: 'Concluída', cls: 'text-emerald-400' },
]

const RUN_KIND_LABEL: Record<HermesRunKind, string> = {
  task: 'Tarefa', parallel: 'Tarefa paralela', review: 'Revisão da entrega', project: 'Plano / mensagem',
  incident: 'Diagnóstico de incidente',
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

const runDuration = (r: HermesRunSummary, now: number) => formatDuration((r.endedAt ?? now) - r.startedAt)

/** Execuções do projeto, atualizadas a cada 4s enquanto a aba está aberta. */
export function useHermesRuns(projectId: string): HermesRunSummary[] {
  const [runs, setRuns] = useState<HermesRunSummary[]>([])
  useEffect(() => {
    setRuns([])
    if (!projectId) return
    let cancelled = false
    const load = () => ipc.hermes.runs.list(projectId).then(r => { if (!cancelled) setRuns(r) }).catch(() => {})
    void load()
    const t = setInterval(load, 4000)
    return () => { cancelled = true; clearInterval(t) }
  }, [projectId])
  return runs
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

function runLabel(r: HermesRunSummary, tasks: AgentTask[]): string {
  const title = r.taskId ? tasks.find(t => t.id === r.taskId)?.title : undefined
  return title ? `${RUN_KIND_LABEL[r.kind]}: ${title}` : RUN_KIND_LABEL[r.kind]
}

function StatusIcon({ status }: { status: HermesRunSummary['status'] }) {
  if (status === 'running') return <Loader2 size={11} className="animate-spin text-purple-400 shrink-0" />
  if (status === 'done') return <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
  return <XCircle size={11} className="text-red-400 shrink-0" />
}

export function HermesBoard({ tasks, runs, onOpenLogs }: {
  tasks: AgentTask[]
  runs: HermesRunSummary[]
  onOpenLogs: (taskId: string) => void
}) {
  const running = runs.filter(r => r.status === 'running')
  const now = useNow(running.length > 0)
  const runsByTask = useMemo(() => {
    const m = new Map<string, HermesRunSummary[]>()
    for (const r of runs) if (r.taskId) m.set(r.taskId, [...(m.get(r.taskId) ?? []), r])
    return m
  }, [runs])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Painel de agentes — o que está executando agora (ETAPA 13) */}
      <div className="shrink-0 border-b border-slate-800 px-3 py-2">
        <p className="text-[9px] text-slate-500 uppercase tracking-widest pb-1.5 flex items-center gap-1.5">
          <Bot size={11} /> Agentes em execução ({running.length})
        </p>
        {running.length === 0 ? (
          <p className="text-[10px] text-slate-600">Nenhuma execução do Hermes neste projeto agora.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {running.map(r => (
              <button
                key={r.id}
                onClick={() => r.taskId && onOpenLogs(r.taskId)}
                className="flex items-center gap-2 bg-purple-950/30 border border-purple-800/40 rounded px-2 py-1 text-left hover:border-purple-600/60"
              >
                <Loader2 size={11} className="animate-spin text-purple-400 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[11px] text-slate-200 truncate max-w-[220px]">{runLabel(r, tasks)}</span>
                  <span className="block text-[9px] text-slate-500">
                    {runDuration(r, now)} · {r.toolCount} ferramenta(s){r.errorCount ? ` · ${r.errorCount} erro(s)` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quadro (ETAPA 12) */}
      {tasks.length === 0 ? (
        <p className="p-4 text-xs text-slate-500">Sem tarefas ainda — inicie um objetivo para o Hermes gerar o plano.</p>
      ) : (
        <div className="flex-1 overflow-auto p-3">
          <div className="grid grid-cols-4 gap-2 min-w-[640px]">
            {COLUMNS.map(col => {
              const items = tasks.filter(t => t.status === col.status)
              return (
                <div key={col.status} className="bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col min-h-[120px]">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5 border-b border-slate-800 ${col.cls}`}>
                    {col.label} <span className="text-slate-600">({items.length})</span>
                  </p>
                  <div className="p-1.5 space-y-1.5">
                    {items.map(t => {
                      const tr = runsByTask.get(t.id) ?? []
                      const last = tr[0]
                      const isRunning = tr.some(r => r.status === 'running')
                      return (
                        <button
                          key={t.id}
                          onClick={() => onOpenLogs(t.id)}
                          title="Ver os logs desta tarefa"
                          className="w-full text-left bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded px-2 py-1.5 space-y-1"
                        >
                          <p className="text-[11px] text-slate-200 leading-snug flex items-start gap-1">
                            {isRunning && <Loader2 size={10} className="animate-spin text-purple-400 shrink-0 mt-0.5" />}
                            <span className="line-clamp-2">{t.title}</span>
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {t.risk === 'high' && <span className="px-1 rounded text-[8px] font-semibold text-red-400 bg-red-950/40">risco alto</span>}
                            {t.risk === 'medium' && <span className="px-1 rounded text-[8px] font-semibold text-amber-400 bg-amber-950/40">risco médio</span>}
                            {t.parallelizable && <span className="px-1 rounded text-[8px] font-semibold text-sky-400 bg-sky-950/40">paralelo</span>}
                          </div>
                          {last && (
                            <p className="text-[9px] text-slate-500 flex items-center gap-1">
                              <StatusIcon status={last.status} />
                              {tr.length} execução(ões) · {runDuration(last, now)} · {last.toolCount} ferr.
                              {last.errorCount > 0 && <span className="text-amber-400"> · {last.errorCount} erro(s)</span>}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** '' = todas as execuções do projeto; '__project__' = só as que não são de tarefa (plano, mensagens, revisão). */
export function HermesRunLogs({ tasks, runs, taskFilter, onTaskFilter }: {
  tasks: AgentTask[]
  runs: HermesRunSummary[]
  taskFilter: string
  onTaskFilter: (v: string) => void
}) {
  const filtered = useMemo(() => runs.filter(r =>
    taskFilter === '' ? true : taskFilter === '__project__' ? !r.taskId : r.taskId === taskFilter,
  ), [runs, taskFilter])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<HermesRun | null>(null)
  const now = useNow(filtered.some(r => r.status === 'running'))

  // Seleciona a execução mais recente do filtro quando a atual sai dele.
  useEffect(() => {
    if (!filtered.some(r => r.id === selectedId)) setSelectedId(filtered[0]?.id ?? null)
  }, [filtered, selectedId])

  const selected = filtered.find(r => r.id === selectedId)
  useEffect(() => {
    setDetail(null)
    if (!selectedId) return
    let cancelled = false
    const load = () => ipc.hermes.runs.get(selectedId).then(d => { if (!cancelled) setDetail(d) }).catch(() => {})
    void load()
    if (selected?.status !== 'running') return () => { cancelled = true }
    const t = setInterval(load, 3000)
    return () => { cancelled = true; clearInterval(t) }
  }, [selectedId, selected?.status])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      <div className="shrink-0 border-b border-slate-800 px-3 py-2 flex items-center gap-2">
        <label className="text-[10px] text-slate-500" htmlFor="hermes-log-filter">Logs de</label>
        <select
          id="hermes-log-filter"
          value={taskFilter}
          onChange={e => onTaskFilter(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-purple-500"
        >
          <option value="">Todas as execuções do projeto</option>
          <option value="__project__">Plano, mensagens e revisões</option>
          {tasks.map(t => <option key={t.id} value={t.id}>Tarefa: {t.title}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="p-4 text-xs text-slate-500">Nenhuma execução registrada aqui ainda. Os logs começam a ser gravados a partir da versão 3.67.0.</p>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-60 shrink-0 border-r border-slate-800 overflow-y-auto">
            {filtered.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left px-2.5 py-2 border-b border-slate-800/70 space-y-0.5 ${r.id === selectedId ? 'bg-slate-800/80' : 'hover:bg-slate-900'}`}
              >
                <p className="text-[11px] text-slate-200 flex items-center gap-1.5">
                  <StatusIcon status={r.status} />
                  <span className="truncate">{runLabel(r, tasks)}</span>
                </p>
                <p className="text-[9px] text-slate-500">
                  {new Date(r.startedAt).toLocaleString('pt-BR')} · {runDuration(r, now)} · {r.toolCount} ferr.
                  {r.errorCount > 0 && <span className="text-amber-400"> · {r.errorCount} erro(s)</span>}
                </p>
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {!detail ? (
              <div className="p-4"><Loader2 size={14} className="animate-spin text-slate-500" /></div>
            ) : (
              <>
                {detail.error && (
                  <p className="shrink-0 px-3 py-1.5 text-[10px] text-red-300 bg-red-950/30 border-b border-red-900/40 break-words">{detail.error}</p>
                )}
                {detail.activity.length > 0 && (
                  <div className="shrink-0 max-h-48 overflow-y-auto border-b border-slate-800 bg-slate-900/60 px-3 py-2 space-y-0.5">
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest pb-1">Atividade ({detail.activity.length})</p>
                    {detail.activity.map((a, i) => (
                      <div key={`${a.at}-${i}`} className="flex items-start gap-2 text-[10px] font-mono">
                        <span className="text-slate-600 shrink-0">{new Date(a.at).toLocaleTimeString('pt-BR')}</span>
                        {a.kind === 'tool_error' ? <AlertTriangle size={10} className="text-amber-400 shrink-0 mt-0.5" />
                          : a.kind === 'blocked' ? <ShieldAlert size={10} className="text-red-400 shrink-0 mt-0.5" />
                            : a.kind === 'init' ? <Bot size={10} className="text-purple-400 shrink-0 mt-0.5" />
                              : <Wrench size={10} className="text-sky-400 shrink-0 mt-0.5" />}
                        <span className={`break-all ${a.kind === 'tool_error' ? 'text-amber-300' : a.kind === 'blocked' ? 'text-red-300' : 'text-slate-400'}`}>
                          {a.kind === 'init' ? `sessão iniciada · ${a.summary}` : `${a.tool}${a.summary ? ` — ${a.summary}` : ''}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <pre className="flex-1 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap text-slate-300">
                  {detail.text || '(sem saída de texto)'}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
