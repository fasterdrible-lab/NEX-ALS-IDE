import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronRight, Loader2, X, ClipboardList } from 'lucide-react'
import { ipc, type AgentTask, type AgentTaskInput, type TaskStatus, type TaskPriority } from '../lib/ipc'

const AGENT_NAMES = ['jarvis', 'friday', 'fury', 'shuri', 'pepper', 'vision', 'requis', 'tester', 'reviewer', 'devops'] as const
const AGENT_EMOJI: Record<string, string> = {
  jarvis: '🎯', friday: '👩‍💻', fury: '🔍', shuri: '🎨', pepper: '📣',
  vision: '📊', requis: '📋', tester: '🧪', reviewer: '🔎', devops: '🚀',
}

type Column = { status: TaskStatus; label: string; color: string; bg: string; border: string }
const COLUMNS: Column[] = [
  { status: 'TODO',        label: 'A fazer',       color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
  { status: 'IN_PROGRESS', label: 'Em andamento',  color: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.15)'  },
  { status: 'BLOCKED',     label: 'Bloqueada',     color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.15)' },
  { status: 'DONE',        label: 'Concluída',     color: '#4ade80', bg: 'rgba(74,222,128,0.06)',  border: 'rgba(74,222,128,0.15)'  },
]
const STATUS_NEXT: Partial<Record<TaskStatus, TaskStatus>> = {
  TODO: 'IN_PROGRESS', IN_PROGRESS: 'DONE', BLOCKED: 'TODO',
}
const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  high:   { label: 'Alta',  color: '#f87171' },
  medium: { label: 'Média', color: '#fbbf24' },
  low:    { label: 'Baixa', color: '#4ade80' },
}

interface ModalState { mode: 'create' | 'edit'; task?: AgentTask }

const EMPTY_FORM: AgentTaskInput = {
  title: '', description: '', status: 'TODO', ownerAgent: 'jarvis', priority: 'medium',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<AgentTaskInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await ipc.tasks.list()
      setTasks(list)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function openCreate() {
    setForm(EMPTY_FORM)
    setModal({ mode: 'create' })
  }

  function openEdit(task: AgentTask) {
    setForm({
      title: task.title, description: task.description,
      status: task.status, ownerAgent: task.ownerAgent, priority: task.priority,
    })
    setModal({ mode: 'edit', task })
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (modal?.mode === 'create') {
        const created = await ipc.tasks.create(form)
        setTasks(prev => [created, ...prev])
      } else if (modal?.task) {
        const updated = await ipc.tasks.update(modal.task.id, form)
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
      }
      setModal(null)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await ipc.tasks.delete(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (e) { console.error(e) } finally { setDeletingId(null) }
  }

  async function advanceStatus(task: AgentTask) {
    const next = STATUS_NEXT[task.status]
    if (!next) return
    setMovingId(task.id)
    try {
      const updated = await ipc.tasks.update(task.id, { status: next })
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    } catch (e) { console.error(e) } finally { setMovingId(null) }
  }

  const byStatus = (status: TaskStatus) => tasks.filter(t => t.status === status)
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'DONE').length

  return (
    <div className="flex flex-col h-full" style={{ background: '#080612' }}>

      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,10,36,0.8)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.2)' }}
          >
            <ClipboardList size={15} style={{ color: '#D9A441' }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold" style={{ color: '#F2C879' }}>Tarefas do Squad</h1>
            <p className="text-[10px]" style={{ color: 'rgba(248,248,252,0.3)' }}>
              {total} tarefas · {done} concluídas
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.25)', color: '#F2C879' }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(217,164,65,0.18)' }}
          onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(217,164,65,0.1)' }}
        >
          <Plus size={13} />
          Nova tarefa
        </button>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin" style={{ color: 'rgba(248,248,252,0.2)' }} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-5">
          <div className="flex gap-4 h-full min-w-[800px]">
            {COLUMNS.map(col => {
              const cards = byStatus(col.status)
              return (
                <div key={col.status} className="flex flex-col flex-1 min-w-[200px]">
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 rounded-t-xl mb-2 shrink-0"
                    style={{ background: col.bg, border: `1px solid ${col.border}`, borderBottom: 'none' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                      <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
                    </div>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(248,248,252,0.4)' }}
                    >
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div
                    className="flex-1 overflow-y-auto space-y-2 p-2 rounded-b-xl"
                    style={{ background: col.bg, border: `1px solid ${col.border}`, borderTop: 'none', minHeight: 100 }}
                  >
                    {cards.length === 0 && (
                      <p className="text-center text-[10px] py-6 italic" style={{ color: 'rgba(248,248,252,0.15)' }}>
                        Vazio
                      </p>
                    )}
                    {cards.map(task => {
                      const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium
                      const isMoving = movingId === task.id
                      const isDeleting = deletingId === task.id
                      const canAdvance = !!STATUS_NEXT[task.status]
                      return (
                        <div
                          key={task.id}
                          className="group rounded-xl p-3 cursor-pointer transition-all"
                          style={{
                            background: 'rgba(13,10,36,0.7)',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                          onClick={() => openEdit(task)}
                          onMouseEnter={e => { (e.currentTarget).style.borderColor = col.border }}
                          onMouseLeave={e => { (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.07)' }}
                        >
                          {/* Priority + agent */}
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: prio.color }} />
                              <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: prio.color }}>
                                {prio.label}
                              </span>
                            </div>
                            <span className="text-[11px]" title={task.ownerAgent}>
                              {AGENT_EMOJI[task.ownerAgent] ?? '🤖'}
                            </span>
                          </div>

                          {/* Title */}
                          <p className="text-xs font-medium leading-snug mb-1" style={{ color: 'rgba(248,248,252,0.85)' }}>
                            {task.title}
                          </p>

                          {/* Description */}
                          {task.description && (
                            <p className="text-[10px] leading-relaxed line-clamp-2 mb-2" style={{ color: 'rgba(248,248,252,0.35)' }}>
                              {task.description}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canAdvance ? (
                              <button
                                onClick={e => { e.stopPropagation(); void advanceStatus(task) }}
                                disabled={isMoving}
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg transition-all"
                                style={{ background: 'rgba(255,255,255,0.05)', color: col.color, border: `1px solid ${col.border}` }}
                              >
                                {isMoving ? <Loader2 size={9} className="animate-spin" /> : <ChevronRight size={9} />}
                                {STATUS_NEXT[task.status] === 'IN_PROGRESS' ? 'Iniciar' :
                                 STATUS_NEXT[task.status] === 'DONE' ? 'Concluir' : 'Resetar'}
                              </button>
                            ) : <span />}
                            <button
                              onClick={e => { e.stopPropagation(); void handleDelete(task.id) }}
                              disabled={isDeleting}
                              className="p-1 rounded transition-colors"
                              style={{ color: 'rgba(248,113,113,0.4)' }}
                              onMouseEnter={e => { (e.currentTarget).style.color = '#f87171' }}
                              onMouseLeave={e => { (e.currentTarget).style.color = 'rgba(248,113,113,0.4)' }}
                            >
                              {isDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal create/edit */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: '#0D0A24', border: '1px solid rgba(217,164,65,0.2)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: '#F2C879' }}>
                {modal.mode === 'create' ? 'Nova tarefa' : 'Editar tarefa'}
              </h2>
              <button onClick={() => setModal(null)} style={{ color: 'rgba(248,248,252,0.3)' }}>
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wide mb-1 block" style={{ color: 'rgba(248,248,252,0.4)' }}>Título *</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Implementar autenticação OAuth"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-600 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium uppercase tracking-wide mb-1 block" style={{ color: 'rgba(248,248,252,0.4)' }}>Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Detalhes, contexto, critérios de aceitação…"
                  rows={3}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-600 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide mb-1 block" style={{ color: 'rgba(248,248,252,0.4)' }}>Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value as TaskStatus }))}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-600 transition-colors"
                  >
                    <option value="TODO">A fazer</option>
                    <option value="IN_PROGRESS">Em andamento</option>
                    <option value="BLOCKED">Bloqueada</option>
                    <option value="DONE">Concluída</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide mb-1 block" style={{ color: 'rgba(248,248,252,0.4)' }}>Prioridade</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-600 transition-colors"
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide mb-1 block" style={{ color: 'rgba(248,248,252,0.4)' }}>Agente</label>
                  <select
                    value={form.ownerAgent}
                    onChange={e => setForm(p => ({ ...p, ownerAgent: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-600 transition-colors"
                  >
                    {AGENT_NAMES.map(a => (
                      <option key={a} value={a}>{AGENT_EMOJI[a]} {a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-1.5 rounded-lg text-xs transition-colors"
                style={{ color: 'rgba(248,248,252,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!form.title.trim() || saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(217,164,65,0.15)', border: '1px solid rgba(217,164,65,0.3)', color: '#F2C879' }}
              >
                {saving && <Loader2 size={11} className="animate-spin" />}
                {modal.mode === 'create' ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
