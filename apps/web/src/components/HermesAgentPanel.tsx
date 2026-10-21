import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, Send, Loader2, Square, ExternalLink, Play, ListChecks,
  ChevronDown, ChevronRight, RefreshCw, CheckCircle2, ShieldAlert, Wrench, AlertTriangle,
  ShieldCheck, FileText, Copy,
} from 'lucide-react'
import type { Project } from '@cwm/config'
import {
  ipc, type HermesProjectAgentInfo, type HermesStatus, type HermesAgentStatus,
  type HermesAutonomyLevel, type DodItem, type AgentTask, type TaskStatus, type TaskRisk,
  type HermesDelivery, type DeliveryVerdict, type DeliveryCheck,
  type HermesRunnerState, type HermesRunnerActivity, type HermesRunnerApproval,
} from '../lib/ipc'
import { AUTONOMY_LEVELS, AUTONOMY_POLICIES, getAutonomyPolicy } from '../lib/autonomy-policy'
import { HermesBoard, HermesRunLogs, useHermesRuns } from './HermesTaskBoard'

const HERMES_STATUS_LABEL: Record<HermesStatus, string> = {
  unknown: 'Desconhecido', not_installed: 'Não instalado', installed: 'Instalado (parado)',
  running: 'Rodando', stopped: 'Parado', error: 'Erro',
}
const HERMES_STATUS_COLOR: Record<HermesStatus, string> = {
  unknown: 'text-slate-400 bg-slate-800', not_installed: 'text-amber-400 bg-amber-950/40',
  installed: 'text-sky-400 bg-sky-950/40', running: 'text-emerald-400 bg-emerald-950/40',
  stopped: 'text-slate-400 bg-slate-800', error: 'text-red-400 bg-red-950/40',
}
const AGENT_STATUS_LABEL: Record<HermesAgentStatus, string> = {
  idle: 'Ocioso', running: 'Executando', error: 'Erro',
}
const AGENT_STATUS_COLOR: Record<HermesAgentStatus, string> = {
  idle: 'text-slate-400 bg-slate-800', running: 'text-purple-300 bg-purple-950/40', error: 'text-red-400 bg-red-950/40',
}
/** Interrupção: a do boot do Zeus (recoverInterruptedSessions, em português) ou a do próprio Hermes ("Interrupted"). */
const isInterrupted = (lastError: string) => /interromp|interrupt/i.test(lastError)
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'Pendente', IN_PROGRESS: 'Em andamento', BLOCKED: 'Bloqueada', DONE: 'Concluída',
}
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: 'text-slate-400 bg-slate-800', IN_PROGRESS: 'text-purple-300 bg-purple-950/40',
  BLOCKED: 'text-red-400 bg-red-950/40', DONE: 'text-emerald-400 bg-emerald-950/40',
}

const RISK_BADGE: Record<TaskRisk, { label: string; cls: string } | null> = {
  low: null,
  medium: { label: 'risco médio', cls: 'text-amber-400 bg-amber-950/40' },
  high: { label: 'risco alto', cls: 'text-red-400 bg-red-950/40' },
}

/** Igual a MAX_DELIVERY_ROUNDS do core: teto do ciclo revisão → correção automática. */
const MAX_DELIVERY_ROUNDS = 3

const VERDICT_STYLE: Record<DeliveryVerdict, { label: string; cls: string }> = {
  approved: { label: 'Aprovada', cls: 'text-emerald-300 bg-emerald-950/50 border-emerald-700/50' },
  approved_with_notes: { label: 'Aprovada com ressalvas', cls: 'text-amber-300 bg-amber-950/40 border-amber-700/50' },
  blocked: { label: 'Bloqueada', cls: 'text-red-300 bg-red-950/40 border-red-700/50' },
}
const CHECK_LABEL: Record<DeliveryCheck['result'], string> = { passed: 'passou', failed: 'falhou', not_run: 'não executado' }

const DEV_RULES_TEMPLATE = [
  '- Siga a arquitetura e as convenções que já existem no repositório; não reestruture sem necessidade.',
  '- Tipagem estrita: nada de `any` sem justificativa; trate os erros (nada de catch vazio).',
  '- Valide toda entrada externa (formulários, APIs, arquivos) antes de usar ou gravar.',
  '- Nunca escreva secrets, tokens ou senhas no código nem nos commits; use variáveis de ambiente e mantenha o .env.example atualizado.',
  '- Funcionalidade nova vem com teste; rode os testes antes de concluir a tarefa.',
  '- Commits pequenos, um por tarefa, em Conventional Commits.',
  '- Não adicione dependências novas sem necessidade clara; prefira o que o projeto já usa.',
].join('\n')

const ACTIVITY_CAP = 200

/** Nome de repositório sugerido a partir do projeto (mesma regra do "Publicar no GitHub"). */
const suggestRepo = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 100) || 'projeto'

/**
 * GitHub de um projeto que roda no serviço da VPS. Ligar = criar o repositório privado na conta do GitHub
 * logada no PC (ou usar um existente) e cadastrar nele a chave do projeto na VPS. Depois, o serviço envia
 * cada tarefa concluída para o branch `hermes`; o `main` fica para juntar por Pull Request.
 */
function GithubSection({ agentInfo, projectName, onLinked }: { agentInfo: HermesProjectAgentInfo; projectName: string; onLinked: () => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [name, setName] = useState(() => suggestRepo(projectName))
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const linked = /^git@github\.com:(.+)\.git$/.exec(agentInfo.gitRepo)?.[1]

  const link = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await ipc.hermes.github.link(mode === 'new' ? { projectId: agentInfo.projectId, name: name.trim() } : { projectId: agentInfo.projectId, url: url.trim() })
      setMsg(r.pushed
        ? { ok: true, text: `${r.created ? 'Repositório criado e ligado' : 'Repositório ligado'}: ${r.repo}. Trabalho enviado ao branch ${r.branch}.` }
        : { ok: false, text: `Repositório ligado (${r.repo}), mas o primeiro envio falhou: ${r.output}` })
      setOpen(false)
      onLinked()
    } catch (e) { setMsg({ ok: false, text: String(e instanceof Error ? e.message : e) }) }
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-widest">GitHub</p>
      {linked ? (
        <p className="text-[11px] text-slate-300 break-all">
          <span className="font-mono">{linked}</span>
          <span className="text-slate-500"> · cada tarefa concluída vai para o branch <span className="font-mono">hermes</span></span>
        </p>
      ) : !open ? (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-500 leading-relaxed">Sem GitHub: o trabalho fica só no git da VPS.</p>
          <button onClick={() => setOpen(true)} className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Ligar ao GitHub</button>
        </div>
      ) : (
        <div className="space-y-1.5 border border-slate-700/60 rounded p-2">
          <div className="flex gap-1 text-[10px]">
            <button onClick={() => setMode('new')} className={`px-2 py-0.5 rounded ${mode === 'new' ? 'bg-purple-700 text-white' : 'text-slate-400'}`}>Criar repositório</button>
            <button onClick={() => setMode('existing')} className={`px-2 py-0.5 rounded ${mode === 'existing' ? 'bg-purple-700 text-white' : 'text-slate-400'}`}>Já tenho</button>
          </div>
          {mode === 'new' ? (
            <input value={name} onChange={e => setName(e.target.value)} maxLength={100} aria-label="Nome do repositório"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-purple-500" />
          ) : (
            <input value={url} onChange={e => setUrl(e.target.value)} maxLength={300} placeholder="https://github.com/dono/repositorio" aria-label="Endereço do repositório"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500" />
          )}
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {mode === 'new' ? 'Privado, na conta do GitHub logada neste PC. ' : ''}
            A VPS recebe uma chave que só grava neste repositório.
          </p>
          <div className="flex gap-1.5">
            <button onClick={() => void link()} disabled={busy || (mode === 'new' ? !name.trim() : !url.trim())}
              className="text-[11px] px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-30 flex items-center gap-1">
              {busy && <Loader2 size={10} className="animate-spin" />} Ligar e enviar
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} className="text-[11px] px-2 py-1 rounded text-slate-400 hover:text-slate-200">Cancelar</button>
          </div>
        </div>
      )}
      {msg && <p className={`text-[10px] break-all ${msg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{msg.text}</p>}
    </div>
  )
}
const LOOP_MODES = new Set(['loop', 'single', 'decision', 'approval'])

/**
 * Painel do Hermes de um projeto. O loop de tarefas roda no processo principal (HermesAgentRunner):
 * este painel só mostra o estado e manda comandos — fechar o painel ou a janela não interrompe nada,
 * e qualquer janela aberta no mesmo projeto mostra o mesmo loop.
 *
 * `compact` (ETAPA 16 — painel lateral da IDE): as duas colunas ficam empilhadas para caber ao lado
 * do editor. `vpsId`: só lista projetos daquela VPS (a IDE está aberta numa VPS específica).
 */
export default function HermesAgentPanel({ initialProjectId, compact = false, vpsId: vpsFilter }: {
  initialProjectId?: string
  compact?: boolean
  vpsId?: string
} = {}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [agentInfo, setAgentInfo] = useState<HermesProjectAgentInfo | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const outputRef = useRef<HTMLPreElement>(null)

  // ── Estado do loop (vem do main) ──────────────────────────────────────────
  const [rstate, setRstate] = useState<HermesRunnerState | null>(null)
  const [output, setOutput] = useState('')
  const outputEndRef = useRef(0)
  const [activity, setActivity] = useState<HermesRunnerActivity[]>([])
  // Execução do Hermes rodando na VPS sem stream deste app (órfã de antes de reabrir o Zeus).
  const [orphanRunning, setOrphanRunning] = useState(false)
  const [stoppingOrphan, setStoppingOrphan] = useState(false)
  const projectIdRef = useRef(projectId)
  useEffect(() => { projectIdRef.current = projectId }, [projectId])

  // ── Objetivo / autonomia / tarefas / DoD ──────────────────────────────────
  const [goalInput, setGoalInput] = useState('')
  const [autonomyLevel, setAutonomyLevel] = useState<HermesAutonomyLevel>('manual')
  const policy = getAutonomyPolicy(autonomyLevel)
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [decisionAnswer, setDecisionAnswer] = useState('')
  const [dodItems, setDodItems] = useState<DodItem[]>([])
  const [dodOpen, setDodOpen] = useState(false)
  const [runningDod, setRunningDod] = useState(false)

  // ── Adapter de contexto NEX→Hermes (FASE 5) ───────────────────────────────
  const [syncingContext, setSyncingContext] = useState(false)
  const [syncContextMsg, setSyncContextMsg] = useState('')

  // ── Development Rules (ETAPA 21) — vão para o .hermes.md ──────────────────
  const [devRulesOpen, setDevRulesOpen] = useState(false)
  const [devRulesDraft, setDevRulesDraft] = useState('')
  const [devRulesSaved, setDevRulesSaved] = useState('')
  const [savingDevRules, setSavingDevRules] = useState(false)
  const [devRulesMsg, setDevRulesMsg] = useState('')
  // loadStatus roda depois de cada execução — só carrega as regras ao trocar de projeto, para não apagar a edição.
  const devRulesProjectRef = useRef<string | null>(null)

  // ── Fechamento da entrega (ETAPAS 9/24/27/40) ─────────────────────────────
  const [delivery, setDelivery] = useState<HermesDelivery | null>(null)
  const [localDeliveryMsg, setLocalDeliveryMsg] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  // ── Quadro / agentes / logs por execução (ETAPAS 12/13/37) ────────────────
  const [rightTab, setRightTab] = useState<'live' | 'board' | 'logs'>('live')
  const [logTaskFilter, setLogTaskFilter] = useState('')
  // Só consulta enquanto o quadro ou os logs estão abertos.
  const runs = useHermesRuns(rightTab === 'live' ? '' : projectId)
  useEffect(() => { setLogTaskFilter('') }, [projectId])

  const scrollOutput = () => setTimeout(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, 60)

  const fail = useCallback((e: unknown) => {
    setOutput(prev => `${prev}\n\n[erro] ${e instanceof Error ? e.message : String(e)}`)
    scrollOutput()
  }, [])

  useEffect(() => {
    ipc.projects.list().then(ps => setProjects(vpsFilter ? ps.filter(p => p.vpsServerId === vpsFilter) : ps)).catch(() => {})
  }, [vpsFilter])

  const loadStatus = useCallback(async (id: string) => {
    if (!id) { setAgentInfo(null); return }
    setLoadingStatus(true)
    try {
      const info = await ipc.hermes.agent.status(id)
      setAgentInfo(info)
      setAutonomyLevel(info.autonomyLevel)
      if (devRulesProjectRef.current !== id) {
        devRulesProjectRef.current = id
        setDevRulesDraft(info.devRules); setDevRulesSaved(info.devRules); setDevRulesMsg('')
      }
    } catch (e) { setAgentInfo(null); setOutput(`Erro ao consultar status: ${String(e)}`) }
    setLoadingStatus(false)
  }, [])

  useEffect(() => { void loadStatus(projectId) }, [projectId, loadStatus])

  const loadTasks = useCallback(async () => {
    if (!projectId) { setTasks([]); return }
    try { setTasks(await ipc.tasks.list({ projectId, ownerAgent: 'hermes' })) } catch { /* silencioso */ }
  }, [projectId])

  useEffect(() => { void loadTasks() }, [projectId, loadTasks])

  const loadDod = useCallback(async () => {
    if (!projectId || !agentInfo) { setDodItems([]); return }
    try { setDodItems(await ipc.hermes.dod.get(projectId)) } catch { setDodItems([]) }
  }, [projectId, agentInfo])

  useEffect(() => { void loadDod() }, [loadDod])

  const loadDelivery = useCallback(async (id: string) => {
    if (!id) { setDelivery(null); return }
    try { setDelivery(await ipc.hermes.delivery.get(id)) } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    setDelivery(null); setLocalDeliveryMsg(''); setReportOpen(false)
    void loadDelivery(projectId)
  }, [projectId, loadDelivery])

  // Ao abrir o painel (ou trocar de projeto), pega do main o que está acontecendo: estado do loop,
  // saída ao vivo guardada, atividade e aprovações pendentes.
  useEffect(() => {
    setRstate(null); setOutput(''); outputEndRef.current = 0; setActivity([]); setOrphanRunning(false)
    if (!projectId) return
    let cancelled = false
    ipc.hermes.runner.snapshot(projectId).then(s => {
      if (cancelled) return
      setRstate(s.state)
      setOutput(s.output)
      outputEndRef.current = s.outputEnd
      setActivity(s.activity)
      setOrphanRunning(s.orphanRunning)
      scrollOutput()
    }).catch(() => {})
    return () => { cancelled = true }
  }, [projectId])

  // Eventos do loop — estado, saída ao vivo e atividade do projeto aberto.
  const prevStateRef = useRef<HermesRunnerState | null>(null)
  useEffect(() => { prevStateRef.current = rstate }, [rstate])
  useEffect(() => {
    const unsub = ipc.hermes.runner.onEvent(e => {
      if (e.projectId !== projectIdRef.current) return
      if (e.kind === 'state') {
        const prev = prevStateRef.current
        prevStateRef.current = e.state
        setRstate(e.state)
        if (!prev || prev.tasksVersion !== e.state.tasksVersion) void loadTasks()
        if (!prev || prev.deliveryVersion !== e.state.deliveryVersion) {
          void loadDelivery(e.projectId)
          ipc.hermes.dod.get(e.projectId).then(setDodItems).catch(() => {})
        }
        if (prev && prev.mode !== 'idle' && e.state.mode === 'idle') void loadStatus(e.projectId)
        if (e.state.mode !== 'idle') setOrphanRunning(false)
      } else if (e.kind === 'output') {
        if (e.reset) setOutput('')
        const fresh = e.end - outputEndRef.current
        if (fresh > 0 && e.text) {
          const part = e.text.slice(Math.max(0, e.text.length - fresh))
          setOutput(prev => prev + part)
          scrollOutput()
        }
        outputEndRef.current = Math.max(outputEndRef.current, e.end)
      } else if (e.kind === 'activity') {
        setActivity(prev => [...prev.slice(-(ACTIVITY_CAP - 1)), e.entry])
      }
    })
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [loadTasks, loadDelivery, loadStatus])

  // Enquanto houver órfã, confere a cada 20s — libera o painel sozinho quando ela terminar.
  useEffect(() => {
    if (!orphanRunning || !projectId) return
    const t = setInterval(() => {
      ipc.hermes.runner.snapshot(projectId)
        .then(r => { if (!r.orphanRunning) { setOrphanRunning(false); void loadStatus(projectId) } })
        .catch(() => {})
    }, 20_000)
    return () => clearInterval(t)
  }, [orphanRunning, projectId, loadStatus])

  const stopOrphan = useCallback(async () => {
    if (!projectId) return
    setStoppingOrphan(true)
    try {
      const { stopped } = await ipc.hermes.runner.stopRemote(projectId)
      setOutput(prev => `${prev}\n[governança] ${stopped} execução(ões) do Hermes encerrada(s) na VPS.\n`)
      setOrphanRunning(false)
      void loadStatus(projectId)
    } catch (e) {
      setOutput(prev => `${prev}\n[erro ao encerrar] ${String(e)}\n`)
    }
    setStoppingOrphan(false)
  }, [projectId, loadStatus])

  // ── Comandos (o main executa; o progresso volta pelos eventos) ────────────
  const mode = rstate?.mode ?? 'idle'
  const sending = mode === 'message'
  const planning = mode === 'planning'
  const reviewing = mode === 'review'
  const looping = LOOP_MODES.has(mode)
  const approvals: HermesRunnerApproval[] = rstate?.approvals ?? []
  const pendingDecision = rstate?.pendingDecision ?? null
  const riskGateTaskId = policy.gateHighRisk ? (rstate?.riskGateTaskId ?? null) : null
  const activeParallel = rstate?.parallel ?? []
  const deliveryMsg = rstate?.deliveryMsg || localDeliveryMsg

  const handleSend = useCallback(async () => {
    if (!projectId || !chatInput.trim()) return
    try { await ipc.hermes.runner.message(projectId, chatInput.trim()); setChatInput('') } catch (e) { fail(e) }
  }, [projectId, chatInput, fail])

  /** FASE 6 — recovery: o main reenvia com --resume (sessionStarted preservado). */
  const resumeInterrupted = useCallback(async () => {
    if (!projectId) return
    try { await ipc.hermes.runner.resume(projectId) } catch (e) { fail(e) }
  }, [projectId, fail])

  const handleCancel = useCallback(async () => {
    if (!projectId) return
    await ipc.hermes.runner.cancel(projectId).catch(fail)
  }, [projectId, fail])

  /** `approvedTaskId`: tarefa de risco alto que o usuário acabou de liberar (Semi-autônomo). */
  const runLoop = useCallback(async (approvedTaskId?: string) => {
    if (!projectId) return
    await ipc.hermes.runner.loop(projectId, approvedTaskId).catch(fail)
  }, [projectId, fail])

  const runNextTaskOnce = useCallback(async () => {
    if (!projectId) return
    await ipc.hermes.runner.next(projectId).catch(fail)
  }, [projectId, fail])

  const stopLoop = useCallback(async () => {
    if (!projectId) return
    await ipc.hermes.runner.stop(projectId).catch(fail)
  }, [projectId, fail])

  const startAutonomousObjective = useCallback(async () => {
    if (!projectId || !goalInput.trim()) return
    try {
      await ipc.hermes.runner.startObjective(projectId, goalInput.trim())
      setGoalInput('')
      setDelivery(null)
    } catch (e) { fail(e) }
  }, [projectId, goalInput, fail])

  const resolveDecision = useCallback(async (answer: string) => {
    if (!projectId || !answer.trim()) return
    try { await ipc.hermes.runner.decision(projectId, answer.trim()); setDecisionAnswer('') } catch (e) { fail(e) }
  }, [projectId, fail])

  /** Autorizar/Negar — o main executa (ou descarta), avisa o Hermes e segue o loop. */
  const resolveApproval = useCallback(async (a: HermesRunnerApproval, approve: boolean) => {
    await ipc.hermes.runner.approval(a.id, approve).catch(fail)
  }, [fail])

  const changeAutonomy = useCallback(async (level: HermesAutonomyLevel) => {
    setAutonomyLevel(level)
    if (projectId) await ipc.hermes.agent.setAutonomy(projectId, level).catch(() => {})
  }, [projectId])

  const createCorrections = useCallback(async () => {
    if (!projectId) return
    await ipc.hermes.runner.corrections(projectId).catch(fail)
  }, [projectId, fail])

  /** Fecha a entrega: o main pede a revisão ao Hermes, reexecuta build/testes seguros e aplica a DoD. */
  const runDeliveryReview = useCallback(async () => {
    if (!projectId) return
    setLocalDeliveryMsg('')
    await ipc.hermes.runner.review(projectId).catch((e: unknown) => setLocalDeliveryMsg(`Erro no fechamento: ${String(e)}`))
  }, [projectId])

  const reevaluateDelivery = useCallback(async () => {
    if (!projectId) return
    try { setDelivery(await ipc.hermes.delivery.reevaluate(projectId)); setLocalDeliveryMsg('') }
    catch (e) { setLocalDeliveryMsg(`Erro: ${String(e)}`) }
  }, [projectId])

  const saveDevRules = useCallback(async () => {
    if (!projectId) return
    setSavingDevRules(true)
    setDevRulesMsg('')
    try {
      const r = await ipc.hermes.agent.setDevRules(projectId, devRulesDraft)
      setDevRulesSaved(devRulesDraft)
      setDevRulesMsg(r.written ? `Salvo e gravado em ${r.path}` : 'Salvo.')
    } catch (e) {
      setDevRulesMsg(`Erro: ${String(e)}`)
    }
    setSavingDevRules(false)
  }, [projectId, devRulesDraft])

  const toggleDod = useCallback(async (item: DodItem) => {
    if (item.auto || !projectId) return
    try { setDodItems(await ipc.hermes.dod.toggle(projectId, item.id, !item.done)) } catch { /* silencioso */ }
  }, [projectId])

  const runDodChecks = useCallback(async () => {
    if (!projectId) return
    setRunningDod(true)
    try { setDodItems(await ipc.hermes.dod.runChecks(projectId)) } catch { /* silencioso */ }
    setRunningDod(false)
  }, [projectId])

  /** O Hermes injeta `.hermes.md` automaticamente no system prompt — este botão só garante que ele existe/está atualizado. */
  const syncContext = useCallback(async () => {
    if (!projectId) return
    setSyncingContext(true)
    setSyncContextMsg('')
    try {
      const result = await ipc.hermes.agent.syncContext(projectId)
      setSyncContextMsg(result.written ? `.hermes.md atualizado (${result.path})` : 'Nada para sincronizar — sem KB Global ou memória do projeto.')
    } catch (e) {
      setSyncContextMsg(`Erro: ${String(e)}`)
    }
    setSyncingContext(false)
  }, [projectId])

  const selectedProject = projects.find(p => p.id === projectId)
  const hermesReady = agentInfo?.hermesStatus === 'running'
  const busy = mode !== 'idle' || orphanRunning
  const canSendChat = hermesReady && !busy && chatInput.trim().length > 0
  const canStartGoal = hermesReady && !busy && goalInput.trim().length > 0
  const doneCount = tasks.filter(t => t.status === 'DONE').length
  const hasTodo = tasks.some(t => t.status === 'TODO')

  return (
    <div className={`flex-1 flex overflow-hidden ${compact ? 'flex-col' : ''}`}>
      {/* ═══ Coluna esquerda — objetivo autônomo, tarefas, DoD (no modo compacto: em cima) ═══ */}
      <div className={compact
        ? 'max-h-[55%] shrink-0 border-b border-slate-800/60 flex flex-col overflow-hidden'
        : 'w-80 shrink-0 border-r border-slate-800/60 flex flex-col overflow-hidden'}>
        <div className="p-4 space-y-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-purple-400 shrink-0" />
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">Selecione um projeto…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.vpsServer?.name ?? p.vpsServerId}</option>
              ))}
            </select>
            {loadingStatus && <Loader2 size={13} className="animate-spin text-slate-500" />}
          </div>

          {selectedProject && agentInfo && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded font-semibold ${HERMES_STATUS_COLOR[agentInfo.hermesStatus]}`}>
                Hermes: {HERMES_STATUS_LABEL[agentInfo.hermesStatus]}
              </span>
              {/* O status do banco só é relido ao fim de cada execução — durante o loop vale o estado da tela. */}
              {sending || planning || looping ? (
                <span className={`px-1.5 py-0.5 rounded font-semibold ${AGENT_STATUS_COLOR.running}`}>{AGENT_STATUS_LABEL.running}</span>
              ) : agentInfo.status === 'error' && isInterrupted(agentInfo.lastError) ? (
                <span className="px-1.5 py-0.5 rounded font-semibold text-amber-300 bg-amber-950/40" title={agentInfo.lastError}>Interrompida</span>
              ) : (
                <span className={`px-1.5 py-0.5 rounded font-semibold ${AGENT_STATUS_COLOR[agentInfo.status]}`}
                  title={agentInfo.status === 'error' ? agentInfo.lastError : undefined}>
                  {AGENT_STATUS_LABEL[agentInfo.status]}
                </span>
              )}
              {!hermesReady && (
                <Link
                  to={`/hermes/${agentInfo.vpsId}/${encodeURIComponent(agentInfo.vpsName)}`}
                  className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
                >
                  Iniciar Hermes <ExternalLink size={10} />
                </Link>
              )}
            </div>
          )}

          {orphanRunning && (
            <div className="border border-sky-700/50 bg-sky-950/30 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[10px] text-sky-300 leading-relaxed">
                O Hermes ainda está trabalhando na VPS numa execução iniciada antes de o app ser reaberto.
                O trabalho dela continua sendo salvo na pasta do projeto, mas este painel não recebe a saída.
                Aguarde ela terminar (o painel libera sozinho) ou encerre agora.
              </p>
              <button
                onClick={() => void stopOrphan()}
                disabled={stoppingOrphan}
                className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-40 flex items-center gap-1"
              >
                {stoppingOrphan ? <Loader2 size={10} className="animate-spin" /> : <Square size={10} />} Encerrar execução na VPS
              </button>
            </div>
          )}

          {/* FASE 6 — sessão interrompida detectada no boot do NEX (ex: app fechado no meio de um loop) */}
          {agentInfo?.status === 'error' && isInterrupted(agentInfo.lastError) && !(sending || planning || looping) && (
            <div className="border border-amber-700/50 bg-amber-950/30 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[10px] text-amber-300 leading-relaxed">
                {agentInfo.lastError.includes('interrompida')
                  ? agentInfo.lastError
                  : 'A última execução do Hermes foi interrompida no meio. Clique em "Retomar sessão" para continuar de onde parou (usa --resume automaticamente).'}
              </p>
              <button
                onClick={() => void resumeInterrupted()}
                disabled={!hermesReady || sending || planning || looping}
                className="text-[10px] text-amber-400 hover:text-amber-300 disabled:opacity-40 flex items-center gap-1"
              >
                <RefreshCw size={10} /> Retomar sessão
              </button>
            </div>
          )}
        </div>

        {projectId && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Novo objetivo autônomo */}
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Novo objetivo autônomo</p>
              <textarea
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="Descreva o que quer desenvolver…"
                disabled={!hermesReady || busy}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none"
              />
              <div role="radiogroup" aria-label="Nível de autonomia" className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 w-fit">
                {AUTONOMY_LEVELS.map(level => (
                  <button
                    key={level}
                    role="radio"
                    aria-checked={autonomyLevel === level}
                    onClick={() => void changeAutonomy(level)}
                    title={AUTONOMY_POLICIES[level].description}
                    className={`px-2 py-1 text-[10px] rounded-md transition-colors ${autonomyLevel === level ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {AUTONOMY_POLICIES[level].label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {policy.description} Comandos perigosos sempre pedem Autorizar/Negar.
              </p>
              <button
                onClick={() => void startAutonomousObjective()}
                disabled={!canStartGoal}
                className="w-full text-xs py-1.5 rounded flex items-center justify-center gap-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-30"
              >
                {planning ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
                {planning ? 'Gerando plano…' : 'Iniciar desenvolvimento'}
              </button>
              <button
                onClick={() => void syncContext()}
                disabled={!projectId || syncingContext}
                className="w-full text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-40 flex items-center justify-center gap-1"
                title="Atualiza .hermes.md com KB Global + memória do projeto — o Hermes já injeta esse arquivo automaticamente"
              >
                {syncingContext ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Sincronizar contexto
              </button>
              {syncContextMsg && <p className="text-[10px] text-slate-500 text-center">{syncContextMsg}</p>}
            </div>

            {/* GitHub — projetos do serviço na VPS: cada tarefa concluída vai para o branch hermes */}
            {agentInfo?.remote && <GithubSection agentInfo={agentInfo} projectName={selectedProject?.name ?? ''} onLinked={() => void loadStatus(projectId)} />}

            {/* Development Rules (ETAPA 21) — gravadas no .hermes.md, que o Hermes lê em toda execução */}
            {agentInfo && (
              <div className="space-y-2">
                <button
                  onClick={() => setDevRulesOpen(v => !v)}
                  aria-expanded={devRulesOpen}
                  className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest hover:text-slate-300"
                >
                  {devRulesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Regras de desenvolvimento{devRulesSaved.trim() ? ' · ativas' : ''}
                </button>
                {devRulesOpen && (
                  <div className="space-y-1.5 pl-1">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Regras que o Hermes deve seguir neste projeto. Ficam no início do <span className="font-mono">.hermes.md</span>, lido em toda execução.
                    </p>
                    <textarea
                      value={devRulesDraft}
                      onChange={e => setDevRulesDraft(e.target.value)}
                      maxLength={20_000}
                      rows={7}
                      aria-label="Regras de desenvolvimento do projeto"
                      placeholder="Ex.: - Testes para toda funcionalidade nova&#10;- Nada de secrets no código"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-y"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void saveDevRules()}
                        disabled={savingDevRules || devRulesDraft === devRulesSaved}
                        className="text-[10px] px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-30 flex items-center gap-1"
                      >
                        {savingDevRules && <Loader2 size={10} className="animate-spin" />} Salvar
                      </button>
                      {!devRulesDraft.trim() && (
                        <button
                          onClick={() => setDevRulesDraft(DEV_RULES_TEMPLATE)}
                          className="text-[10px] text-slate-400 hover:text-slate-200"
                        >
                          Usar modelo
                        </button>
                      )}
                      <span className="text-[9px] text-slate-600 ml-auto">{devRulesDraft.length}/20000</span>
                    </div>
                    {devRulesMsg && <p className="text-[10px] text-slate-500 break-all">{devRulesMsg}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Agentes ativos — execuções paralelas em andamento */}
            {activeParallel.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  Agentes ativos ({activeParallel.length})
                </p>
                {activeParallel.map(info => (
                  <div key={info.taskId} className="flex items-center gap-2 bg-purple-950/30 border border-purple-800/40 rounded px-2 py-1.5">
                    <Loader2 size={11} className="animate-spin text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-200 truncate">{info.title}</p>
                      <p className="text-[9px] text-slate-500 font-mono truncate">{info.branch}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de tarefas */}
            {tasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Tarefas — {doneCount}/{tasks.length} concluídas
                  </p>
                  {!policy.autoAdvance && hasTodo && (
                    <button
                      onClick={() => void runNextTaskOnce()}
                      disabled={busy}
                      className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1"
                    >
                      {looping ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Próxima
                    </button>
                  )}
                  {policy.autoAdvance && (
                    looping ? (
                      <button
                        onClick={() => void stopLoop()}
                        disabled={rstate?.stopRequested}
                        className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-60 flex items-center gap-1"
                        title="Termina a tarefa atual e não começa a próxima"
                      >
                        <Square size={11} /> {rstate?.stopRequested ? 'Parando após a tarefa atual…' : 'Parar'}
                      </button>
                    ) : hasTodo && !riskGateTaskId ? (
                      <button
                        onClick={() => void runLoop()}
                        disabled={busy}
                        className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1"
                      >
                        <Play size={11} /> Continuar loop
                      </button>
                    ) : null
                  )}
                </div>
                <div className="space-y-1.5">
                  {tasks.map(t => (
                    <div key={t.id} className="bg-slate-800/60 border border-slate-700/60 rounded px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-200 truncate flex items-center gap-1.5">
                          {t.title}
                          {t.parallelizable && (
                            <span className="shrink-0 px-1 py-0.5 rounded text-[8px] font-semibold text-sky-400 bg-sky-950/40" title="Pode rodar em paralelo, em worktree isolado">
                              paralelo
                            </span>
                          )}
                          {RISK_BADGE[t.risk] && (
                            <span className={`shrink-0 px-1 py-0.5 rounded text-[8px] font-semibold ${RISK_BADGE[t.risk]!.cls}`}>
                              {RISK_BADGE[t.risk]!.label}
                            </span>
                          )}
                        </span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold ${TASK_STATUS_COLOR[t.status]}`}>
                          {TASK_STATUS_LABEL[t.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Semi-autônomo — loop parado antes de uma tarefa de risco alto */}
            {riskGateTaskId && (() => {
              const gated = tasks.find(t => t.id === riskGateTaskId)
              if (!gated || gated.status !== 'TODO') return null
              return (
                <div className="border border-amber-700/50 bg-amber-950/30 rounded-lg p-3 space-y-2">
                  <p className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <ShieldAlert size={12} /> Tarefa de risco alto
                  </p>
                  <p className="text-xs text-slate-200">{gated.title}</p>
                  {gated.description && (
                    <p className="text-[10px] text-slate-400 whitespace-pre-wrap max-h-24 overflow-auto">{gated.description}</p>
                  )}
                  <p className="text-[10px] text-slate-500">O loop parou aqui (Semi-autônomo). Revise e libere para continuar.</p>
                  <button
                    onClick={() => void runLoop(gated.id)}
                    disabled={busy}
                    className="w-full text-[11px] py-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-30 flex items-center justify-center gap-1"
                  >
                    <Play size={11} /> Liberar e continuar
                  </button>
                </div>
              )
            })()}

            {/* Governança — comandos que o Hermes teve bloqueados por serem perigosos */}
            {approvals.map(a => (
              <div key={a.id} className="border border-red-700/50 bg-red-950/30 rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-red-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <ShieldAlert size={12} /> Hermes deseja executar
                </p>
                <pre className="text-[11px] font-mono text-slate-100 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-32 overflow-auto">{a.command || '(comando não informado)'}</pre>
                <p className="text-[10px] text-slate-400">
                  Motivo do bloqueio: <span className="text-slate-300">{a.reason}</span>
                  {a.parallel && ' · tarefa paralela (worktree)'}
                </p>
                {a.executable ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => void resolveApproval(a, true)}
                      disabled={busy}
                      className="flex-1 text-[11px] py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-1"
                    >
                      Autorizar
                    </button>
                    <button
                      onClick={() => void resolveApproval(a, false)}
                      disabled={busy}
                      className="flex-1 text-[11px] py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                    >
                      Negar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => void resolveApproval(a, false)}
                    disabled={busy}
                    className="w-full text-[11px] py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                    title="Código Python arbitrário não é reexecutado pelo NEX"
                  >
                    Negar (não executável pelo NEX)
                  </button>
                )}
                {busy && <p className="text-[9px] text-slate-500">Aguarde a execução atual terminar para decidir.</p>}
              </div>
            ))}

            {/* Decision Request */}
            {pendingDecision && (
              <div className="border border-amber-700/50 bg-amber-950/30 rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold">Decisão necessária</p>
                <p className="text-xs text-slate-200">{pendingDecision.question}</p>
                <div className="flex flex-col gap-1.5">
                  {pendingDecision.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => void resolveDecision(opt)}
                      disabled={busy}
                      className="text-left text-xs px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded disabled:opacity-40"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={decisionAnswer}
                    onChange={e => setDecisionAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void resolveDecision(decisionAnswer) }}
                    placeholder="Responder livremente…"
                    disabled={busy}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => void resolveDecision(decisionAnswer)}
                    disabled={busy || !decisionAnswer.trim()}
                    className="px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-30 rounded text-[11px]"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            )}

            {/* Definition of Done */}
            {agentInfo && (
              <div className="space-y-2">
                <button
                  onClick={() => setDodOpen(v => !v)}
                  className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest hover:text-slate-300"
                >
                  {dodOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Definition of Done ({dodItems.filter(d => d.done).length}/{dodItems.length})
                </button>
                {dodOpen && (
                  <div className="space-y-1.5 pl-1">
                    {dodItems.map(item => (
                      <label key={item.id} className={`flex items-center gap-2 text-[11px] ${item.auto ? 'text-slate-500' : 'text-slate-300 cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          disabled={item.auto}
                          onChange={() => void toggleDod(item)}
                          className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 disabled:opacity-50"
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.auto && <span className="text-[9px] text-slate-600">auto</span>}
                      </label>
                    ))}
                    <button
                      onClick={() => void runDodChecks()}
                      disabled={runningDod}
                      className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1 pt-1"
                    >
                      {runningDod ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Rodar verificações automáticas
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Fechamento da entrega — revisão + checks conferidos pelo NEX + DoD como gate + relatório */}
            {tasks.length > 0 && !hasTodo && !looping && (
              <div className="space-y-2 border border-slate-700/60 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck size={12} /> Entrega
                  </p>
                  {delivery && (
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${VERDICT_STYLE[delivery.verdict].cls}`}>
                      {VERDICT_STYLE[delivery.verdict].label} · rodada {delivery.round}
                    </span>
                  )}
                </div>

                {!delivery && (
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    <CheckCircle2 size={11} className="inline text-emerald-400 mr-1" />
                    Tarefas processadas. Feche a entrega: o Hermes revisa código e segurança e roda build/testes; o NEX reexecuta
                    esses comandos no servidor e só aprova com evidência e a Definition of Done completa.
                  </p>
                )}

                {delivery && (
                  <div className="space-y-1.5 text-[10px]">
                    {(['build', 'tests'] as const).map(k => {
                      const c = delivery[k]
                      const color = c.result === 'passed' ? 'text-emerald-400' : c.result === 'failed' ? 'text-red-400' : 'text-slate-500'
                      return (
                        <p key={k} className="text-slate-400">
                          {k === 'build' ? 'Build' : 'Testes'}: <span className={color}>{CHECK_LABEL[c.result]}</span>
                          {c.command && <span className="font-mono text-slate-500"> · {c.command}</span>}
                          <span className="text-slate-600"> · {c.source === 'nex' ? 'conferido pelo NEX' : 'informado pelo Hermes'}</span>
                        </p>
                      )
                    })}
                    {delivery.blockingReasons.length > 0 && (
                      <ul className="space-y-0.5 text-red-300 list-disc pl-4">
                        {delivery.blockingReasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}
                    {delivery.notes.length > 0 && (
                      <ul className="space-y-0.5 text-amber-300/90 list-disc pl-4">
                        {delivery.notes.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    )}
                    {delivery.verdict === 'blocked' && delivery.round >= MAX_DELIVERY_ROUNDS && (
                      <p className="text-slate-500">Limite de {MAX_DELIVERY_ROUNDS} rodadas automáticas atingido — as correções seguintes ficam com você.</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => void runDeliveryReview()}
                    disabled={!hermesReady || busy}
                    className="text-[10px] px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-30 flex items-center gap-1"
                  >
                    {reviewing ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                    {delivery ? 'Revisar de novo' : 'Revisar e fechar entrega'}
                  </button>
                  {delivery && (
                    <button
                      onClick={() => void reevaluateDelivery()}
                      disabled={busy}
                      title="Recalcula o veredito com a Definition of Done atual, sem refazer a revisão"
                      className="text-[10px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                    >
                      Reavaliar DoD
                    </button>
                  )}
                  {delivery?.verdict === 'blocked' && delivery.corrections.length > 0 && (
                    <button
                      onClick={() => void createCorrections()}
                      disabled={busy}
                      className="text-[10px] px-2 py-1 rounded bg-red-800 hover:bg-red-700 disabled:opacity-30"
                    >
                      Criar {delivery.corrections.length} tarefa(s) de correção
                    </button>
                  )}
                </div>
                {deliveryMsg && <p className="text-[10px] text-slate-500">{deliveryMsg}</p>}

                {delivery?.report && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReportOpen(v => !v)}
                        aria-expanded={reportOpen}
                        className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                      >
                        {reportOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        <FileText size={11} /> Relatório final
                      </button>
                      <button
                        onClick={() => { void navigator.clipboard.writeText(delivery.report).then(() => setLocalDeliveryMsg('Relatório copiado.')) }}
                        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 ml-auto"
                      >
                        <Copy size={10} /> Copiar
                      </button>
                    </div>
                    {reportOpen && (
                      <pre className="text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded p-2 whitespace-pre-wrap max-h-72 overflow-auto">{delivery.report}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Coluna direita — ao vivo | quadro | logs, + mensagem livre ═══ */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div role="tablist" aria-label="Visão do Hermes" className="shrink-0 flex items-center gap-1 border-b border-slate-800 px-2 pt-1.5 bg-slate-900/40">
          {([['live', 'Ao vivo'], ['board', 'Quadro'], ['logs', 'Logs']] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={rightTab === id}
              onClick={() => setRightTab(id)}
              disabled={!projectId}
              className={`px-3 py-1.5 text-[11px] rounded-t-md border-b-2 transition-colors disabled:opacity-40 ${rightTab === id ? 'border-purple-500 text-slate-100 bg-slate-800/60' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {rightTab === 'board' && projectId && (
          <HermesBoard
            tasks={tasks}
            runs={runs}
            onOpenLogs={(taskId) => { setLogTaskFilter(taskId); setRightTab('logs') }}
          />
        )}
        {rightTab === 'logs' && projectId && (
          <HermesRunLogs tasks={tasks} runs={runs} taskFilter={logTaskFilter} onTaskFilter={setLogTaskFilter} />
        )}

        {(rightTab === 'live' || !projectId) && activity.length > 0 && (
          <div className="shrink-0 max-h-40 overflow-y-auto border-b border-slate-800 bg-slate-900/60 px-3 py-2 space-y-0.5">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest pb-1">Atividade</p>
            {activity.slice(-40).map((e, i) => (
              <div key={`${e.at}-${i}`} className="flex items-start gap-2 text-[10px] font-mono">
                <span className="text-slate-600 shrink-0">{new Date(e.at).toLocaleTimeString('pt-BR')}</span>
                {e.kind === 'tool_error'
                  ? <AlertTriangle size={10} className="text-amber-400 shrink-0 mt-0.5" />
                  : e.kind === 'init'
                    ? <Bot size={10} className="text-purple-400 shrink-0 mt-0.5" />
                    : <Wrench size={10} className="text-sky-400 shrink-0 mt-0.5" />}
                <span className={`truncate ${e.kind === 'tool_error' ? 'text-amber-300' : 'text-slate-400'}`}>
                  {e.kind === 'init' ? `sessão iniciada · ${e.summary}` : `${e.tool}${e.summary ? ` — ${e.summary}` : ''}`}
                </span>
              </div>
            ))}
          </div>
        )}
        <pre ref={outputRef} className={`flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-slate-300 bg-slate-950 ${rightTab === 'live' || !projectId ? '' : 'hidden'}`}>
          {output || (projectId ? '(nenhuma saída ainda)' : 'Selecione um projeto para começar.')}
        </pre>

        <div className="border-t border-slate-800 px-3 py-2 flex gap-2 shrink-0">
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            placeholder={hermesReady ? 'Mensagem livre para o Hermes (fora do fluxo de tarefas)…' : 'Inicie o Hermes na VPS deste projeto para habilitar o envio'}
            disabled={!projectId || busy}
            rows={2}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none"
          />
          {sending ? (
            <button onClick={() => void handleCancel()} className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs flex items-center gap-1.5 self-end">
              <Square size={12} /> Cancelar
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!canSendChat}
              className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-30 rounded text-xs flex items-center gap-1.5 self-end"
            >
              <Send size={12} /> Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
