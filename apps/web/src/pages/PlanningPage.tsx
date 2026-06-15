import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ClipboardList, Timer, Brain, Plus, Trash2,
  Play, ChevronRight, Loader2, RefreshCw, Check, Clock,
} from 'lucide-react'
import { ipc, type AgentTask, type TaskStatus, type TaskPriority, type ScheduledJob } from '../lib/ipc'

// ── constants ─────────────────────────────────────────────────────────────────

const AGENT_NAMES = ['jarvis','friday','fury','shuri','pepper','vision','requis','tester','reviewer','devops'] as const
type AgentName = typeof AGENT_NAMES[number]

const AGENT_EMOJI: Record<AgentName, string> = {
  jarvis:'🎯', friday:'👩‍💻', fury:'🔍', shuri:'🎨', pepper:'📣',
  vision:'📊', requis:'📋', tester:'🧪', reviewer:'🔎', devops:'🚀',
}

const STATUS_STYLE: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  TODO:        { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', label: 'A fazer'      },
  IN_PROGRESS: { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', label: 'Em andamento' },
  BLOCKED:     { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', label: 'Bloqueada'    },
  DONE:        { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', label: 'Concluída'    },
}

const PRIORITY_STYLE: Record<TaskPriority, { color: string; label: string }> = {
  high:   { color: '#f87171', label: '▲ Alta'  },
  medium: { color: '#facc15', label: '● Média' },
  low:    { color: '#94a3b8', label: '▽ Baixa' },
}

const LS_KEY = 'planning_agent_contexts'

function loadContexts(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}
function saveContexts(c: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(c))
}

// Parse a job schedule JSON for display
function nextRunLabel(job: ScheduledJob): string {
  try {
    const d = new Date(job.nextRunAt)
    const diff = d.getTime() - Date.now()
    if (diff < 0) return 'vencida'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 24) return `em ${Math.floor(h / 24)}d`
    if (h > 0) return `em ${h}h ${m}m`
    return `em ${m}m`
  } catch { return '—' }
}

function scheduleLabel(job: ScheduledJob): string {
  try {
    const s = JSON.parse(job.schedule) as { type: string; hour?: number; minute?: number; weekday?: number }
    if (s.type === 'interval') return 'intervalo'
    if (s.type === 'hourly')   return 'por hora'
    if (s.type === 'daily')    return `diário ${s.hour ?? 0}h`
    if (s.type === 'weekly')   return `semanal ${['dom','seg','ter','qua','qui','sex','sáb'][s.weekday ?? 0]} ${s.hour ?? 0}h`
  } catch {}
  return '—'
}

// ── task form modal ───────────────────────────────────────────────────────────

function TaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title,  setTitle]  = useState('')
  const [desc,   setDesc]   = useState('')
  const [agent,  setAgent]  = useState<AgentName>('friday')
  const [prio,   setPrio]   = useState<TaskPriority>('medium')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await ipc.tasks.create({ title: title.trim(), description: desc.trim(), ownerAgent: agent, priority: prio, status: 'TODO' })
      onCreated()
      onClose()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl p-5 shadow-2xl" style={{ background: '#0F0C22', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Nova Tarefa</h3>
        <div className="space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título"
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-600 outline-none"
            style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.1)' }} />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição (opcional)" rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-600 outline-none resize-none"
            style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.1)' }} />
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">Agente</p>
              <select value={agent} onChange={e => setAgent(e.target.value as AgentName)}
                className="w-full px-2 py-1.5 rounded-lg text-xs text-slate-200"
                style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.1)' }}>
                {AGENT_NAMES.map(a => <option key={a} value={a}>{AGENT_EMOJI[a]} {a}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">Prioridade</p>
              <select value={prio} onChange={e => setPrio(e.target.value as TaskPriority)}
                className="w-full px-2 py-1.5 rounded-lg text-xs text-slate-200"
                style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="high">▲ Alta</option>
                <option value="medium">● Média</option>
                <option value="low">▽ Baixa</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancelar</button>
          <button onClick={submit} disabled={!title.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
            style={{ background: 'rgba(217,164,65,0.14)', border: '1px solid rgba(217,164,65,0.28)', color: '#F2C879' }}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Criar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const navigate = useNavigate()

  const [tasks,       setTasks]       = useState<AgentTask[]>([])
  const [jobs,        setJobs]        = useState<ScheduledJob[]>([])
  const [contexts,    setContexts]    = useState<Record<string, string>>(loadContexts)
  const [agentCtxTab, setAgentCtxTab] = useState<AgentName>('jarvis')
  const [editCtx,     setEditCtx]     = useState('')
  const [ctxDirty,    setCtxDirty]    = useState(false)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [agentFilter,  setAgentFilter]  = useState<string>('ALL')
  const [loading,     setLoading]     = useState(true)
  const [taskModal,   setTaskModal]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, j] = await Promise.all([ipc.tasks.list(), ipc.jobs.list()])
      setTasks(t as AgentTask[])
      setJobs(j as ScheduledJob[])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // Sync context tab edit area when tab changes
  useEffect(() => {
    setEditCtx(contexts[agentCtxTab] ?? '')
    setCtxDirty(false)
  }, [agentCtxTab, contexts])

  const saveCtx = () => {
    const next = { ...contexts, [agentCtxTab]: editCtx.trim() }
    setContexts(next)
    saveContexts(next)
    setCtxDirty(false)
  }

  const deleteTask = async (id: string) => {
    await ipc.tasks.delete(id).catch(() => {})
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const cycleStatus = async (task: AgentTask) => {
    const order: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']
    const next = order[(order.indexOf(task.status) + 1) % order.length]
    await ipc.tasks.update(task.id, { status: next }).catch(() => {})
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
  }

  const runTask = (task: AgentTask) => {
    const msg = task.description ? `${task.title}: ${task.description}` : task.title
    navigate('/squad', { state: { autoMessage: msg, agent: task.ownerAgent } })
  }

  const toggleJob = async (job: ScheduledJob) => {
    const isActive = job.isActive === 0
    await ipc.jobs.toggle(job.id, isActive).catch(() => {})
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, isActive: isActive ? 1 : 0 } : j))
  }

  const filteredTasks = tasks.filter(t =>
    (statusFilter === 'ALL' || t.status === statusFilter) &&
    (agentFilter === 'ALL' || t.ownerAgent === agentFilter)
  ).sort((a, b) => {
    const po: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
    const so: Record<TaskStatus, number> = { IN_PROGRESS: 0, BLOCKED: 1, TODO: 2, DONE: 3 }
    return (so[a.status] - so[b.status]) || (po[a.priority] - po[b.priority])
  })

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
        <ClipboardList size={14} style={{ color: '#D9A441' }} />
        <span className="text-sm font-semibold" style={{ color: '#F2C879' }}>Planejamento</span>
        <div className="flex-1" />
        {!loading && (
          <span className="text-xs text-slate-600">
            {tasks.filter(t => t.status !== 'DONE').length} ativas · {jobs.filter(j => j.isActive).length} jobs
          </span>
        )}
        <button onClick={() => void load()} disabled={loading}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
        <button onClick={() => setTaskModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.25)', color: '#F2C879' }}>
          <Plus size={11} /> Nova Tarefa
        </button>
      </div>

      {/* Body: 2 columns top + context strip bottom */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">

          {/* ── Tasks panel ─── */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Filters */}
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
              <ClipboardList size={12} className="text-slate-600" />
              <span className="text-xs text-slate-500 mr-1">Tarefas</span>
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                className="px-2 py-1 rounded text-[10px] text-slate-300 ml-auto"
                style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.08)' }}>
                <option value="ALL">Todos os agentes</option>
                {AGENT_NAMES.map(a => <option key={a} value={a}>{AGENT_EMOJI[a]} {a}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaskStatus | 'ALL')}
                className="px-2 py-1 rounded text-[10px] text-slate-300"
                style={{ background: '#0A0817', border: '1px solid rgba(255,255,255,0.08)' }}>
                <option value="ALL">Todos os status</option>
                <option value="TODO">A fazer</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="BLOCKED">Bloqueadas</option>
                <option value="DONE">Concluídas</option>
              </select>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 size={20} className="animate-spin text-slate-700" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-700">
                  <ClipboardList size={20} />
                  <p className="text-xs">Nenhuma tarefa. Clique em "Nova Tarefa".</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const ss = STATUS_STYLE[task.status]
                  const ps = PRIORITY_STYLE[task.priority]
                  return (
                    <div key={task.id} className="p-3 rounded-xl flex items-start gap-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium text-slate-200 truncate">{task.title}</span>
                          <span className="text-[10px]" style={{ color: ps.color }}>{ps.label}</span>
                          <button onClick={() => cycleStatus(task)}
                            className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-opacity hover:opacity-70"
                            style={{ background: ss.bg, color: ss.text }}>
                            {ss.label}
                          </button>
                        </div>
                        {task.description && (
                          <p className="text-xs text-slate-500 truncate mb-1">{task.description}</p>
                        )}
                        <span className="text-[10px] text-slate-600">
                          {AGENT_EMOJI[task.ownerAgent as AgentName] ?? '🤖'} @{task.ownerAgent}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {task.status !== 'DONE' && (
                          <button onClick={() => runTask(task)}
                            title="Executar com agente no Squad"
                            className="p-1.5 rounded-lg transition-colors hover:bg-emerald-900/30 text-slate-600 hover:text-emerald-400">
                            <Play size={12} />
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-900/20 text-slate-700 hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Automations panel ─── */}
          <div className="w-72 shrink-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
              <Timer size={12} className="text-slate-600" />
              <span className="text-xs text-slate-500">Automações</span>
              <span className="ml-auto text-[10px] text-slate-700">{jobs.filter(j => j.isActive).length} ativas</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-700">
                  <Timer size={18} />
                  <p className="text-[10px]">Nenhuma automação</p>
                </div>
              ) : (
                jobs.map(job => (
                  <div key={job.id} className="p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => toggleJob(job)}
                        className={`mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 border transition-colors ${job.isActive ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">{job.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
                          <Clock size={9} />
                          <span>{scheduleLabel(job)}</span>
                          {job.isActive && (
                            <span className="text-emerald-600">{nextRunLabel(job)}</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => ipc.jobs.runNow(job.id).catch(() => {})}
                        title="Executar agora"
                        className="shrink-0 p-1 text-slate-700 hover:text-emerald-400 transition-colors">
                        <Play size={10} />
                      </button>
                    </div>
                    {job.lastResult && (
                      <p className="text-[10px] text-slate-600 mt-1.5 truncate pl-5">{job.lastResult.slice(0, 80)}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Agent context strip ─── */}
        <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0A0817' }}>
          {/* Agent tabs */}
          <div className="flex items-center gap-0 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-1.5 px-3 py-2 shrink-0">
              <Brain size={12} style={{ color: '#D9A441' }} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Contexto por Agente</span>
            </div>
            {AGENT_NAMES.map(a => (
              <button key={a} onClick={() => setAgentCtxTab(a)}
                className="flex items-center gap-1 px-3 py-2 text-[10px] shrink-0 transition-colors whitespace-nowrap"
                style={agentCtxTab === a
                  ? { color: '#F2C879', borderBottom: '2px solid #D9A441' }
                  : { color: 'rgba(248,248,252,0.35)', borderBottom: '2px solid transparent' }}>
                {AGENT_EMOJI[a]} {a}
              </button>
            ))}
            {ctxDirty && (
              <button onClick={saveCtx}
                className="ml-auto mr-3 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium shrink-0"
                style={{ background: 'rgba(217,164,65,0.12)', border: '1px solid rgba(217,164,65,0.25)', color: '#F2C879' }}>
                <Check size={10} /> Salvar
              </button>
            )}
          </div>
          {/* Context textarea */}
          <div className="px-4 py-2">
            <textarea
              value={editCtx}
              onChange={e => { setEditCtx(e.target.value); setCtxDirty(true) }}
              placeholder={`Instruções específicas para @${agentCtxTab} — injetadas automaticamente no sistema do agente em toda conversa no Squad…`}
              rows={3}
              className="w-full text-xs text-slate-300 placeholder-slate-700 outline-none resize-none"
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
      </div>

      {taskModal && (
        <TaskModal onClose={() => setTaskModal(false)} onCreated={() => void load()} />
      )}
    </div>
  )
}
