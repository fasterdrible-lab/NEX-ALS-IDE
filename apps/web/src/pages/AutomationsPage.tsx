import { useState, useEffect, useCallback } from 'react'
import { Timer, Plus, Play, Trash2, ToggleLeft, ToggleRight, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { ipc, type ScheduledJob, type ScheduledJobInput } from '../lib/ipc'

// ── client-side schedule preview (mirrors packages/core/src/jobs/jobs.service.ts) ──
type JobSchedule =
  | { type: 'interval'; minutes: number }
  | { type: 'hourly'; minute: number }
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number }

function extractHourMinute(t: string): { hour: number; minute: number } | null {
  const m = t.match(/(?:às?|at)\s*(\d{1,2})(?::(\d{2}))?h?|(?<!\d)(\d{1,2}):(\d{2})|(?<!\d)(\d{1,2})h(\d{0,2})/i)
  if (!m) return null
  const hour = parseInt(m[1] ?? m[3] ?? m[5] ?? '0')
  const minute = parseInt(m[2] ?? m[4] ?? m[6] ?? '0') || 0
  if (hour < 0 || hour > 23) return null
  return { hour, minute }
}

function parseSchedulePreview(text: string): JobSchedule {
  const t = text.toLowerCase()
  const intervalM = t.match(/(?:a cada|every|todo|toda)\s+(\d+)\s*min/i)
  if (intervalM) return { type: 'interval', minutes: Math.max(5, parseInt(intervalM[1])) }
  if (/toda\s*hora|a cada\s*hora|every\s*hour/.test(t)) return { type: 'hourly', minute: 0 }
  const DAYS: Record<string, number> = {
    domingo: 0, dom: 0, segunda: 1, seg: 1, 'terça': 2, ter: 2,
    quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, 'sábado': 6, sab: 6,
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  }
  for (const [k, d] of Object.entries(DAYS)) {
    if (t.includes(k)) {
      const hm = extractHourMinute(t)
      return { type: 'weekly', weekday: d, hour: hm?.hour ?? 9, minute: hm?.minute ?? 0 }
    }
  }
  if (/todo\s*dia|todos\s*os\s*dias|diariamente|every\s*day|daily/.test(t)) {
    const hm = extractHourMinute(t)
    return { type: 'daily', hour: hm?.hour ?? 9, minute: hm?.minute ?? 0 }
  }
  if (/de\s*manh[ãa]/.test(t)) return { type: 'daily', hour: 9, minute: 0 }
  if (/[aà]\s*noite/.test(t)) return { type: 'daily', hour: 20, minute: 0 }
  if (/[aà]\s*tarde/.test(t)) return { type: 'daily', hour: 15, minute: 0 }
  const hm = extractHourMinute(t)
  if (hm) return { type: 'daily', hour: hm.hour, minute: hm.minute }
  return { type: 'daily', hour: 9, minute: 0 }
}

function describeSchedule(schedule: JobSchedule): string {
  const p = (n: number) => String(n).padStart(2, '0')
  switch (schedule.type) {
    case 'interval': return `A cada ${schedule.minutes} min`
    case 'hourly':   return 'A cada hora'
    case 'daily':    return `Diariamente às ${p(schedule.hour)}:${p(schedule.minute)}`
    case 'weekly': {
      const d = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][schedule.weekday] ?? '?'
      return `Toda ${d} às ${p(schedule.hour)}:${p(schedule.minute)}`
    }
  }
}

const AGENT_NAMES = ['jarvis', 'friday', 'fury', 'shuri', 'pepper', 'vision', 'requis', 'tester', 'reviewer', 'devops']
const AGENT_EMOJI: Record<string, string> = {
  jarvis: '🎯', friday: '⚡', fury: '🔍', shuri: '🎨', pepper: '📣',
  vision: '📊', requis: '📋', tester: '🧪', reviewer: '👁', devops: '🚀',
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`
  return `${Math.floor(diff / 86_400_000)}d atrás`
}

function formatNext(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'agora'
  if (diff < 60_000) return `em ${Math.ceil(diff / 1000)}s`
  if (diff < 3_600_000) return `em ${Math.ceil(diff / 60_000)}min`
  if (diff < 86_400_000) return `em ${Math.floor(diff / 3_600_000)}h`
  return `em ${Math.floor(diff / 86_400_000)}d`
}

// ── Styles ────────────────────────────────────────────────────────────────────
const panel = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
}

export default function AutomationsPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  // Form state
  const [formInstruction, setFormInstruction] = useState('')
  const [formAgent, setFormAgent] = useState('jarvis')
  const [formSaving, setFormSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setJobs(await ipc.jobs.list())
    } catch { /* silently ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // Auto-refresh every 30s so nextRunAt / lastRunAt stay fresh
  useEffect(() => {
    const t = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(t)
  }, [load])

  async function handleCreate() {
    if (!formInstruction.trim()) return
    setFormSaving(true)
    try {
      const input: ScheduledJobInput = {
        instruction: formInstruction.trim(),
        agentName: formAgent,
      }
      await ipc.jobs.create(input)
      setFormInstruction('')
      setFormAgent('jarvis')
      setShowModal(false)
      await load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setFormSaving(false)
    }
  }

  async function handleToggle(job: ScheduledJob) {
    try {
      await ipc.jobs.toggle(job.id, job.isActive === 0)
      await load()
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta automação?')) return
    try {
      await ipc.jobs.delete(id)
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch { /* ignore */ }
  }

  async function handleRunNow(job: ScheduledJob) {
    setRunningId(job.id)
    try {
      await ipc.jobs.runNow(job.id)
      await load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setRunningId(null)
    }
  }

  const schedulePreview = formInstruction.trim()
    ? describeSchedule(parseSchedulePreview(formInstruction))
    : null

  return (
    <div className="h-full flex flex-col" style={{ background: '#080612' }}>
      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Timer size={20} style={{ color: '#D9A441' }} />
            <div>
              <h1 className="text-lg font-semibold" style={{ color: '#F2C879' }}>Automações</h1>
              <p className="text-xs" style={{ color: 'rgba(248,248,252,0.35)' }}>
                {jobs.length} job{jobs.length !== 1 ? 's' : ''} · {jobs.filter(j => j.isActive).length} ativo{jobs.filter(j => j.isActive).length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'rgba(217,164,65,0.12)', border: '1px solid rgba(217,164,65,0.25)', color: '#F2C879' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,164,65,0.2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,164,65,0.12)' }}
          >
            <Plus size={13} />
            Nova automação
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin" style={{ color: 'rgba(217,164,65,0.5)' }} />
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Timer size={36} style={{ color: 'rgba(217,164,65,0.15)' }} />
            <p className="text-sm" style={{ color: 'rgba(248,248,252,0.3)' }}>Nenhuma automação criada ainda.</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs px-4 py-2 rounded-lg transition-all"
              style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.2)', color: '#D9A441' }}
            >
              Criar primeira automação
            </button>
          </div>
        )}

        <div className="space-y-3">
          {jobs.map(job => {
            const sched: JobSchedule = (() => { try { return JSON.parse(job.schedule) } catch { return { type: 'daily', hour: 9, minute: 0 } } })()
            const isExpanded = expandedId === job.id
            const isRunning = runningId === job.id

            return (
              <div key={job.id} className="rounded-xl overflow-hidden" style={panel}>
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0 mt-0.5">{AGENT_EMOJI[job.agentName] ?? '⚙'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium truncate" style={{ color: 'rgba(248,248,252,0.9)' }}>
                          {job.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: job.isActive ? 'rgba(96,217,176,0.1)' : 'rgba(255,255,255,0.05)', color: job.isActive ? '#60D9B0' : 'rgba(248,248,252,0.3)' }}>
                          {job.isActive ? 'ativo' : 'pausado'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px]" style={{ color: 'rgba(248,248,252,0.4)' }}>
                        <span className="flex items-center gap-1">
                          <Timer size={10} />
                          {describeSchedule(sched)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          próximo: {formatNext(job.nextRunAt)}
                        </span>
                        {job.lastRunAt && (
                          <span>último: {formatRelative(job.lastRunAt)}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRunNow(job)}
                        disabled={isRunning}
                        title="Executar agora"
                        className="p-1.5 rounded transition-colors disabled:opacity-40"
                        style={{ color: 'rgba(248,248,252,0.4)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#60D9B0' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(248,248,252,0.4)' }}
                      >
                        {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                      </button>

                      <button
                        onClick={() => handleToggle(job)}
                        title={job.isActive ? 'Pausar' : 'Ativar'}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: job.isActive ? '#60D9B0' : 'rgba(248,248,252,0.3)' }}
                      >
                        {job.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                      </button>

                      <button
                        onClick={() => handleDelete(job.id)}
                        title="Excluir"
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'rgba(248,248,252,0.3)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(248,248,252,0.3)' }}
                      >
                        <Trash2 size={13} />
                      </button>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : job.id)}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'rgba(248,248,252,0.3)' }}
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: instruction + last result */}
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="pt-3">
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(248,248,252,0.25)' }}>Instrução</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(248,248,252,0.65)' }}>{job.instruction}</p>
                    </div>
                    {job.lastResult && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(248,248,252,0.25)' }}>Último resultado</p>
                        <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'rgba(248,248,252,0.55)' }}>{job.lastResult}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ background: '#0F0C22', border: '1px solid rgba(217,164,65,0.2)' }}>
            <h2 className="text-base font-semibold mb-5" style={{ color: '#F2C879' }}>Nova automação</h2>

            <div className="space-y-4">
              {/* Instruction */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(248,248,252,0.5)' }}>
                  Instrução em linguagem natural
                </label>
                <textarea
                  autoFocus
                  value={formInstruction}
                  onChange={e => setFormInstruction(e.target.value)}
                  placeholder='Ex: "Verifique a VPS prod todo dia às 8h e reporte o uso de CPU"'
                  rows={3}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(217,164,65,0.15)', color: 'rgba(248,248,252,0.9)', caretColor: '#D9A441' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(217,164,65,0.35)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(217,164,65,0.15)' }}
                />
                {schedulePreview && (
                  <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#D9A441' }}>
                    <Timer size={10} />
                    Agendamento detectado: <strong>{schedulePreview}</strong>
                  </p>
                )}
              </div>

              {/* Agent */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(248,248,252,0.5)' }}>Agente</label>
                <select
                  value={formAgent}
                  onChange={e => setFormAgent(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(248,248,252,0.9)' }}
                >
                  {AGENT_NAMES.map(a => (
                    <option key={a} value={a}>{AGENT_EMOJI[a]} {a.charAt(0).toUpperCase() + a.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setFormInstruction(''); setFormAgent('jarvis') }}
                className="px-4 py-2 rounded-lg text-xs"
                style={{ color: 'rgba(248,248,252,0.4)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!formInstruction.trim() || formSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40 flex items-center gap-2"
                style={{ background: 'rgba(217,164,65,0.15)', border: '1px solid rgba(217,164,65,0.3)', color: '#F2C879' }}
              >
                {formSaving && <Loader2 size={11} className="animate-spin" />}
                Criar automação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
