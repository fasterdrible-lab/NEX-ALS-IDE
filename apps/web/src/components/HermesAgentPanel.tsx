import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, Send, Loader2, Square, ExternalLink, Play, ListChecks,
  ChevronDown, ChevronRight, RefreshCw, CheckCircle2,
} from 'lucide-react'
import type { Project } from '@cwm/config'
import {
  ipc, type HermesProjectAgentInfo, type HermesStatus, type HermesAgentStatus,
  type HermesAutonomyLevel, type DodItem, type AgentTask, type TaskStatus,
} from '../lib/ipc'

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
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'Pendente', IN_PROGRESS: 'Em andamento', BLOCKED: 'Bloqueada', DONE: 'Concluída',
}
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: 'text-slate-400 bg-slate-800', IN_PROGRESS: 'text-purple-300 bg-purple-950/40',
  BLOCKED: 'text-red-400 bg-red-950/40', DONE: 'text-emerald-400 bg-emerald-950/40',
}

type TaskTag =
  | { kind: 'done' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'decision'; question: string; options: string[] }
  | { kind: 'none' }

function parseTaskTag(text: string): TaskTag {
  if (/\[TAREFA_CONCLUIDA\]/i.test(text)) return { kind: 'done' }
  const blocked = text.match(/\[TAREFA_BLOQUEADA:?\s*([^\]]*)\]/i)
  if (blocked) return { kind: 'blocked', reason: (blocked[1] || '').trim() || 'motivo não informado' }
  const decision = text.match(/\[DECISAO_NECESSARIA([^\]]*)\]/i)
  if (decision) {
    const params: Record<string, string> = {}
    const pr = /(\w+)="([^"]*)"/g
    let pm: RegExpExecArray | null
    while ((pm = pr.exec(decision[1])) !== null) params[pm[1]] = pm[2]
    const options = (params['opcoes'] ?? '').split('|').map(s => s.trim()).filter(Boolean)
    return { kind: 'decision', question: params['pergunta'] ?? 'Decisão necessária', options }
  }
  return { kind: 'none' }
}

function parseTaskPlan(text: string): { title: string; description: string; parallelizable: boolean }[] {
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : (text.match(/\[[\s\S]*\]/)?.[0] ?? null)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const tasks = parsed
          .filter((p): p is { title: string; description?: string; parallelizable?: unknown } =>
            !!p && typeof p === 'object' && typeof (p as { title?: unknown }).title === 'string')
          .map(p => ({
            title: p.title,
            description: typeof p.description === 'string' ? p.description : '',
            parallelizable: p.parallelizable === true,
          }))
        if (tasks.length > 0) return tasks
      }
    } catch { /* cai no fallback abaixo */ }
  }
  return [{ title: 'Objetivo completo', description: text.slice(0, 2000), parallelizable: false }]
}

function buildPlanPrompt(objective: string): string {
  return `Antes de implementar, gere a lista de tarefas para o seguinte objetivo:\n\n${objective}\n\n`
    + 'Responda APENAS com um bloco ```json contendo um array no formato '
    + '[{"title":"...","description":"...","parallelizable":true|false}], sem nenhum texto antes ou depois do bloco. '
    + 'Marque "parallelizable":true apenas para tarefas que podem rodar ao mesmo tempo que outras sem conflito '
    + '(ex.: arquivos/módulos diferentes, sem depender do resultado de outra tarefa). Na dúvida, use false.'
}

function buildTaskPrompt(task: { title: string; description: string }): string {
  return [
    `Tarefa: ${task.title}`,
    task.description,
    '',
    'Instruções de finalização (obrigatório):',
    '- Sucesso → termine sua resposta com a tag: [TAREFA_CONCLUIDA]',
    '- Bloqueio técnico real → termine com: [TAREFA_BLOQUEADA: <motivo>]',
    '- Decisão de negócio que você não pode inferir sozinho → termine com: [DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]',
    'Decida sozinho qualquer decisão técnica razoável — use DECISAO_NECESSARIA apenas para decisão de negócio real.',
  ].filter(Boolean).join('\n')
}

function buildParallelTaskPrompt(task: { title: string; description: string }): string {
  return buildTaskPrompt(task)
    + '\n\nVocê está trabalhando num git worktree isolado desta tarefa. Ao concluir, garanta que TODAS as '
    + 'alterações estejam commitadas (git add -A && git commit) antes de finalizar com a tag.'
}

const PARALLEL_CAP = 3

const REMINDER_PROMPT = 'Você não incluiu nenhuma tag obrigatória. Termine AGORA com [TAREFA_CONCLUIDA], '
  + '[TAREFA_BLOQUEADA: motivo] ou [DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]. Não repita o trabalho, apenas finalize com a tag correta.'

interface PendingDecision { taskId: string; question: string; options: string[] }

export default function HermesAgentPanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [agentInfo, setAgentInfo] = useState<HermesProjectAgentInfo | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [output, setOutput] = useState('')
  const [streamId, setStreamId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  // ── Autonomous Loop (FASE 3) ──────────────────────────────────────────────
  const [goalInput, setGoalInput] = useState('')
  const [autonomyLevel, setAutonomyLevel] = useState<HermesAutonomyLevel>('manual')
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [planning, setPlanning] = useState(false)
  const [looping, setLooping] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null)
  const [decisionAnswer, setDecisionAnswer] = useState('')
  const [dodItems, setDodItems] = useState<DodItem[]>([])
  const [dodOpen, setDodOpen] = useState(false)
  const [runningDod, setRunningDod] = useState(false)
  const loopStopRef = useRef(false)

  // ── Execução paralela via git worktree (FASE 4) ───────────────────────────
  const [activeParallel, setActiveParallel] = useState<Map<string, { title: string; branch: string }>>(new Map())

  // ── Adapter de contexto NEX→Hermes (FASE 5) ───────────────────────────────
  const [syncingContext, setSyncingContext] = useState(false)
  const [syncContextMsg, setSyncContextMsg] = useState('')

  const scrollOutput = () => setTimeout(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, 60)

  useEffect(() => { ipc.projects.list().then(setProjects).catch(() => {}) }, [])

  const loadStatus = useCallback(async (id: string) => {
    if (!id) { setAgentInfo(null); return }
    setLoadingStatus(true)
    try {
      const info = await ipc.hermes.agent.status(id)
      setAgentInfo(info)
      setAutonomyLevel(info.autonomyLevel)
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

  // Listener do fluxo de "mensagem livre" (FASE 2) — ignora chunks enquanto o loop autônomo
  // está usando o mesmo canal via sendAndWait (guardado por `sending`).
  useEffect(() => {
    const unsub = ipc.hermes.agent.onChunk((chunk) => {
      if (!sending) return
      if (streamId && chunk.streamId !== streamId) return
      if (chunk.type === 'text_delta' && chunk.delta) {
        setOutput(prev => prev + chunk.delta)
        scrollOutput()
      }
      if (chunk.type === 'error' && chunk.error) {
        setOutput(prev => `${prev}\n\n[erro] ${chunk.error}`)
        scrollOutput()
      }
      if (chunk.type === 'done' || chunk.type === 'error') {
        setSending(false)
        setStreamId(null)
        void loadStatus(projectId)
      }
    })
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [streamId, sending, projectId, loadStatus])

  const handleSend = useCallback(async () => {
    if (!projectId || !chatInput.trim() || sending || planning || looping) return
    setSending(true)
    setOutput('')
    try {
      const { streamId: id } = await ipc.hermes.agent.send(projectId, chatInput.trim())
      setStreamId(id)
      setChatInput('')
    } catch (e) {
      setOutput(`Erro: ${String(e)}`)
      setSending(false)
    }
  }, [projectId, chatInput, sending, planning, looping])

  /** FASE 6 — recovery: reenvia via o mesmo fluxo de mensagem livre; resume funciona porque
   *  `sessionStarted` não é tocado por `recoverInterruptedSessions()`, então o backend já manda
   *  `--resume latest --in <workspace>` sozinho. */
  const resumeInterrupted = useCallback(async () => {
    if (!projectId || sending || planning || looping) return
    setSending(true)
    setOutput('')
    try {
      const { streamId: id } = await ipc.hermes.agent.send(
        projectId,
        'Continue de onde você parou. Revise o estado atual do workspace (git status/diff) antes de prosseguir.'
      )
      setStreamId(id)
    } catch (e) {
      setOutput(`Erro: ${String(e)}`)
      setSending(false)
    }
  }, [projectId, sending, planning, looping])

  const handleCancel = useCallback(async () => {
    if (!streamId) return
    await ipc.hermes.agent.cancel(streamId).catch(() => {})
    setSending(false)
    setStreamId(null)
  }, [streamId])

  /** Espera a conclusão de um stream já iniciado (streamId conhecido), devolvendo o texto completo. */
  const waitForChunkStream = useCallback((knownId: string): Promise<{ text: string; ok: boolean }> => {
    return new Promise((resolve) => {
      let acc = ''
      let settled = false
      const unsub = ipc.hermes.agent.onChunk((chunk) => {
        if (chunk.streamId !== knownId) return
        if (chunk.type === 'text_delta' && chunk.delta) {
          acc += chunk.delta
          setOutput(prev => prev + chunk.delta)
          scrollOutput()
        }
        if (chunk.type === 'done' && !settled) {
          settled = true; unsub(); resolve({ text: acc, ok: true })
        }
        if (chunk.type === 'error' && !settled) {
          settled = true
          setOutput(prev => `${prev}\n\n[erro] ${chunk.error ?? 'erro desconhecido'}`)
          unsub(); resolve({ text: acc, ok: false })
        }
      })
    })
  }, [])

  /** Envia um prompt no fluxo principal (sessão do projeto) e aguarda a conclusão. Usado pelo loop/plano sequencial. */
  const sendAndWait = useCallback(async (prompt: string): Promise<{ text: string; ok: boolean }> => {
    try {
      const { streamId: id } = await ipc.hermes.agent.send(projectId, prompt)
      return await waitForChunkStream(id)
    } catch (e) {
      setOutput(prev => `${prev}\n\n[erro] ${String(e)}`)
      return { text: '', ok: false }
    }
  }, [projectId, waitForChunkStream])

  const executeTask = useCallback(async (task: AgentTask): Promise<'done' | 'blocked' | 'decision' | 'error'> => {
    let prompt = buildTaskPrompt(task)
    for (let attempt = 0; attempt < 2; attempt++) {
      const { text, ok } = await sendAndWait(prompt)
      if (!ok) return 'error'
      const tag = parseTaskTag(text)
      if (tag.kind === 'done') {
        await ipc.tasks.update(task.id, { status: 'DONE' }).catch(() => {})
        return 'done'
      }
      if (tag.kind === 'blocked') {
        await ipc.tasks.update(task.id, {
          status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] ${tag.reason}`.trim(),
        }).catch(() => {})
        return 'blocked'
      }
      if (tag.kind === 'decision') {
        setPendingDecision({ taskId: task.id, question: tag.question, options: tag.options })
        return 'decision'
      }
      prompt = REMINDER_PROMPT
    }
    await ipc.tasks.update(task.id, {
      status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] sem tag de conclusão após lembrete`.trim(),
    }).catch(() => {})
    return 'blocked'
  }, [sendAndWait])

  /**
   * Roda uma tarefa isolada num git worktree próprio (gerenciado pelo NEX via GitService, não via
   * `hermes -w`, que é pouco documentado). Execução one-shot — sem sessão pra retomar, então
   * DECISAO_NECESSARIA/tag ausente aqui viram bloqueio para revisão manual em vez de um turno de volta.
   */
  const runParallelTask = useCallback(async (task: AgentTask): Promise<'done' | 'blocked' | 'error'> => {
    let start: { streamId: string; worktreePath: string; branch: string }
    try {
      start = await ipc.hermes.parallel.start(projectId, task.id, buildParallelTaskPrompt(task))
    } catch (e) {
      setOutput(prev => `${prev}\n\n[erro ao iniciar tarefa paralela "${task.title}"] ${String(e)}`)
      await ipc.tasks.update(task.id, { status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] falha ao iniciar execução paralela` }).catch(() => {})
      return 'error'
    }
    setActiveParallel(prev => new Map(prev).set(task.id, { title: task.title, branch: start.branch }))
    const { text, ok } = await waitForChunkStream(start.streamId)
    setActiveParallel(prev => { const next = new Map(prev); next.delete(task.id); return next })

    if (!ok) {
      await ipc.tasks.update(task.id, { status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] falha na execução paralela (branch ${start.branch} preservado)` }).catch(() => {})
      return 'error'
    }

    const tag = parseTaskTag(text)
    const merge = await ipc.hermes.parallel.finish(projectId, start.worktreePath, start.branch, tag.kind === 'done')
      .catch(() => ({ merged: false, output: 'erro ao finalizar' }))

    if (tag.kind === 'done') {
      const note = merge.merged ? '' : `\n\n[atenção] merge automático falhou — branch "${start.branch}" preservado para revisão manual.\n${merge.output.slice(0, 500)}`
      await ipc.tasks.update(task.id, { status: 'DONE', description: `${task.description}${note}` }).catch(() => {})
      return 'done'
    }
    const reason = tag.kind === 'blocked' ? tag.reason
      : tag.kind === 'decision' ? `decisão necessária ("${tag.question}") — não suportado em execução paralela, revise manualmente`
      : 'terminou sem tag de conclusão'
    await ipc.tasks.update(task.id, {
      status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] ${reason} (branch ${start.branch})`.trim(),
    }).catch(() => {})
    return 'blocked'
  }, [projectId, waitForChunkStream])

  const runParallelBatch = useCallback(async (candidates: AgentTask[]): Promise<void> => {
    const batch = candidates.slice(0, PARALLEL_CAP)
    await Promise.all(batch.map(t => runParallelTask(t)))
  }, [runParallelTask])

  const runLoop = useCallback(async () => {
    if (looping) return
    setLooping(true)
    loopStopRef.current = false
    try {
      let guard = 0
      const cap = 20
      while (!loopStopRef.current) {
        const current = await ipc.tasks.list({ projectId, ownerAgent: 'hermes' }).catch(() => [] as AgentTask[])
        setTasks(current)
        const todo = current.filter(t => t.status === 'TODO')
        if (todo.length === 0) break
        guard++
        if (guard > Math.max(cap, todo.length * 3)) break

        const parallelizable = todo.filter(t => t.parallelizable)
        if (parallelizable.length > 0) {
          await Promise.all(parallelizable.slice(0, PARALLEL_CAP).map(t => ipc.tasks.update(t.id, { status: 'IN_PROGRESS' }).catch(() => {})))
          await loadTasks()
          await runParallelBatch(parallelizable)
          await loadTasks()
          continue
        }

        const next = todo[0]
        await ipc.tasks.update(next.id, { status: 'IN_PROGRESS' }).catch(() => {})
        await loadTasks()
        const result = await executeTask(next)
        await loadTasks()
        if (result !== 'done') break
      }
    } finally {
      setLooping(false)
      void loadStatus(projectId)
    }
  }, [looping, projectId, executeTask, runParallelBatch, loadTasks, loadStatus])

  const runNextTaskOnce = useCallback(async () => {
    if (looping) return
    const current = await ipc.tasks.list({ projectId, ownerAgent: 'hermes' }).catch(() => [] as AgentTask[])
    const next = current.find(t => t.status === 'TODO')
    if (!next) return
    setLooping(true)
    try {
      await ipc.tasks.update(next.id, { status: 'IN_PROGRESS' }).catch(() => {})
      await loadTasks()
      await executeTask(next)
      await loadTasks()
    } finally {
      setLooping(false)
      void loadStatus(projectId)
    }
  }, [looping, projectId, executeTask, loadTasks, loadStatus])

  const startAutonomousObjective = useCallback(async () => {
    if (!projectId || !goalInput.trim() || planning || looping) return
    const obj = goalInput.trim()
    setPlanning(true)
    setOutput('')
    await ipc.hermes.agent.setObjective(projectId, obj).catch(() => {})
    // Best-effort: mantém .hermes.md (KB Global + memória do projeto) atualizado — o Hermes já
    // injeta esse arquivo automaticamente no system prompt, sem precisar de flag nenhuma.
    await ipc.hermes.agent.syncContext(projectId).catch(() => {})
    const { text, ok } = await sendAndWait(buildPlanPrompt(obj))
    setPlanning(false)
    if (!ok) return
    const planned = parseTaskPlan(text)
    for (const t of planned) {
      await ipc.tasks.create({
        title: t.title, description: t.description, projectId, ownerAgent: 'hermes',
        status: 'TODO', parallelizable: t.parallelizable,
      }).catch(() => {})
    }
    setGoalInput('')
    await loadTasks()
    await loadStatus(projectId)
    if (autonomyLevel === 'autonomous') void runLoop()
  }, [projectId, goalInput, planning, looping, sendAndWait, loadTasks, loadStatus, autonomyLevel, runLoop])

  const resolveDecision = useCallback(async (answer: string) => {
    if (!pendingDecision || !answer.trim()) return
    const task = tasks.find(t => t.id === pendingDecision.taskId)
    const decision = pendingDecision
    setPendingDecision(null)
    setDecisionAnswer('')
    if (!task) return
    setLooping(true)
    let stillPending = false
    try {
      const prompt = `${buildTaskPrompt(task)}\n\nDecisão do usuário para "${decision.question}": ${answer.trim()}`
      const { text, ok } = await sendAndWait(prompt)
      if (ok) {
        const tag = parseTaskTag(text)
        if (tag.kind === 'done') await ipc.tasks.update(task.id, { status: 'DONE' }).catch(() => {})
        else if (tag.kind === 'blocked') {
          await ipc.tasks.update(task.id, {
            status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] ${tag.reason}`.trim(),
          }).catch(() => {})
        } else if (tag.kind === 'decision') {
          setPendingDecision({ taskId: task.id, question: tag.question, options: tag.options })
          stillPending = true
        }
      }
      await loadTasks()
    } finally {
      setLooping(false)
      if (autonomyLevel === 'autonomous' && !stillPending) void runLoop()
    }
  }, [pendingDecision, tasks, sendAndWait, loadTasks, autonomyLevel, runLoop])

  const changeAutonomy = useCallback(async (level: HermesAutonomyLevel) => {
    setAutonomyLevel(level)
    if (projectId) await ipc.hermes.agent.setAutonomy(projectId, level).catch(() => {})
  }, [projectId])

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
  const busy = sending || planning || looping
  const canSendChat = hermesReady && !busy && chatInput.trim().length > 0
  const canStartGoal = hermesReady && !busy && goalInput.trim().length > 0
  const doneCount = tasks.filter(t => t.status === 'DONE').length
  const hasTodo = tasks.some(t => t.status === 'TODO')

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ═══ Coluna esquerda — objetivo autônomo, tarefas, DoD ═══ */}
      <div className="w-80 shrink-0 border-r border-slate-800/60 flex flex-col overflow-hidden">
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
              <span className={`px-1.5 py-0.5 rounded font-semibold ${AGENT_STATUS_COLOR[agentInfo.status]}`}>
                {AGENT_STATUS_LABEL[agentInfo.status]}
              </span>
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

          {/* FASE 6 — sessão interrompida detectada no boot do NEX (ex: app fechado no meio de um loop) */}
          {agentInfo?.status === 'error' && agentInfo.lastError.includes('interrompida') && (
            <div className="border border-amber-700/50 bg-amber-950/30 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[10px] text-amber-300 leading-relaxed">{agentInfo.lastError}</p>
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
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 w-fit">
                <button
                  onClick={() => void changeAutonomy('manual')}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors ${autonomyLevel === 'manual' ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Manual
                </button>
                <button
                  onClick={() => void changeAutonomy('autonomous')}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors ${autonomyLevel === 'autonomous' ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Autônomo
                </button>
              </div>
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

            {/* Agentes ativos — execuções paralelas em andamento */}
            {activeParallel.size > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  Agentes ativos ({activeParallel.size})
                </p>
                {[...activeParallel.entries()].map(([taskId, info]) => (
                  <div key={taskId} className="flex items-center gap-2 bg-purple-950/30 border border-purple-800/40 rounded px-2 py-1.5">
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
                  {autonomyLevel === 'manual' && hasTodo && (
                    <button
                      onClick={() => void runNextTaskOnce()}
                      disabled={busy}
                      className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1"
                    >
                      {looping ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Próxima
                    </button>
                  )}
                  {autonomyLevel === 'autonomous' && (
                    looping ? (
                      <button
                        onClick={() => { loopStopRef.current = true }}
                        className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <Square size={11} /> Parar
                      </button>
                    ) : hasTodo ? (
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

            {tasks.length > 0 && !hasTodo && !looping && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded px-2 py-1.5">
                <CheckCircle2 size={13} /> Todas as tarefas foram processadas — revise o DoD acima.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Coluna direita — saída ao vivo + mensagem livre ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <pre ref={outputRef} className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-slate-300 bg-slate-950">
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
