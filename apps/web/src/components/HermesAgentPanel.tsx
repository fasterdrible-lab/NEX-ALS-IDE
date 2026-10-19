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
  type HermesAutonomyLevel, type DodItem, type AgentTask, type TaskStatus,
  type HermesActivity, type HermesApprovalRequest, type TaskRisk,
  type HermesDelivery, type DeliveryVerdict, type DeliveryCheck,
} from '../lib/ipc'
import {
  AUTONOMY_LEVELS, AUTONOMY_POLICIES, getAutonomyPolicy, classifyTaskRisk, needsRiskGate,
} from '../lib/autonomy-policy'
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

function parseTaskPlan(text: string): { title: string; description: string; parallelizable: boolean; risk: TaskRisk }[] {
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : (text.match(/\[[\s\S]*\]/)?.[0] ?? null)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const tasks = parsed
          .filter((p): p is { title: string; description?: string; parallelizable?: unknown; risk?: unknown } =>
            !!p && typeof p === 'object' && typeof (p as { title?: unknown }).title === 'string')
          .map(p => {
            const t = { title: p.title, description: typeof p.description === 'string' ? p.description : '' }
            return { ...t, parallelizable: p.parallelizable === true, risk: classifyTaskRisk(t, p.risk) }
          })
        if (tasks.length > 0) return tasks
      }
    } catch { /* cai no fallback abaixo */ }
  }
  const whole = { title: 'Objetivo completo', description: text.slice(0, 2000) }
  return [{ ...whole, parallelizable: false, risk: classifyTaskRisk(whole) }]
}

function buildPlanPrompt(objective: string): string {
  return `Antes de implementar, gere a lista de tarefas para o seguinte objetivo:\n\n${objective}\n\n`
    + 'Responda APENAS com um bloco ```json contendo um array no formato '
    + '[{"title":"...","description":"...","parallelizable":true|false,"risk":"low|medium|high"}], sem nenhum texto antes ou depois do bloco. '
    + 'Marque "parallelizable":true apenas para tarefas que podem rodar ao mesmo tempo que outras sem conflito '
    + '(ex.: arquivos/módulos diferentes, sem depender do resultado de outra tarefa). Na dúvida, use false. '
    + 'Marque "risk":"high" para tarefas que mexem em deploy/produção, migração ou remoção de dados, secrets/credenciais, '
    + 'pagamentos ou infraestrutura do servidor; "medium" para autenticação, banco de dados, dependências ou CI; '
    + '"low" para o resto. Na dúvida, escolha o risco maior.'
}

const RISK_BADGE: Record<TaskRisk, { label: string; cls: string } | null> = {
  low: null,
  medium: { label: 'risco médio', cls: 'text-amber-400 bg-amber-950/40' },
  high: { label: 'risco alto', cls: 'text-red-400 bg-red-950/40' },
}

/**
 * Revisão de fechamento da entrega (ETAPAS 24/27): código + segurança, build e testes, sem alterar
 * nada. Os comandos informados precisam ser simples para o NEX conseguir reexecutá-los e conferir
 * o resultado pelo exit code (lista segura em packages/core/src/hermes/delivery.ts).
 */
function buildReviewPrompt(objective: string, baseCommit: string): string {
  const range = baseCommit ? `git diff ${baseCommit}..HEAD (e git log ${baseCommit}..HEAD)` : 'o histórico e o código atual do repositório'
  return [
    'Faça a REVISÃO DE FECHAMENTO da entrega deste objetivo. NÃO altere, crie nem apague arquivos e NÃO faça commit — só leia e rode verificações.',
    '',
    `Objetivo: ${objective || '(ver histórico do repositório)'}`,
    '',
    `1. Leia as alterações do objetivo: ${range}.`,
    '2. Rode o build e os testes padrão do projeto, se existirem. Use o comando simples do projeto, sem && | ; nem redirecionamento',
    '   (ex.: npm test, pnpm build, pnpm run typecheck, pytest, go test ./..., cargo test, make test). Se não houver, use result "not_run".',
    '3. Revise o código: bugs, tratamento de erro, validação de entrada.',
    '4. Revise a segurança: secrets/credenciais no código, injeção (SQL, comando, path), autenticação/autorização, dados sensíveis em log, dependências perigosas.',
    '',
    'Responda APENAS com um bloco ```json neste formato, sem texto antes ou depois:',
    '{"build":{"command":"...","result":"passed|failed|not_run","summary":"..."},',
    ' "tests":{"command":"...","result":"passed|failed|not_run","summary":"..."},',
    ' "findings":[{"severity":"critical|high|medium|low","category":"security|bug|quality","file":"caminho","title":"...","detail":"..."}],',
    ' "summary":"resumo da revisão em 2 a 5 frases"}',
    'Use "critical" só para o que quebra a aplicação ou expõe dados; seja objetivo, sem achados genéricos.',
  ].join('\n')
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

function buildTaskPrompt(task: { title: string; description: string }): string {
  return [
    `Tarefa: ${task.title}`,
    task.description,
    '',
    'Instruções de finalização (obrigatório):',
    // ETAPA 25 do brief — commits frequentes, um por tarefa, para cada entrega ficar no histórico.
    '- Antes de marcar como concluída, faça um commit git com tudo desta tarefa: git add -A && git commit -m "<tipo>(<escopo>): <descrição>"',
    '  (tipo: feat, fix, refactor, test, docs, chore). Se o diretório ainda não for um repositório, rode git init antes.',
    '  Nunca faça push, reset --hard nem force — só commits locais.',
    '- Sucesso → termine sua resposta com a tag: [TAREFA_CONCLUIDA]',
    '- Bloqueio técnico real → termine com: [TAREFA_BLOQUEADA: <motivo>]',
    '- Decisão de negócio que você não pode inferir sozinho → termine com: [DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]',
    'Decida sozinho qualquer decisão técnica razoável — use DECISAO_NECESSARIA apenas para decisão de negócio real.',
  ].filter(Boolean).join('\n')
}

function buildParallelTaskPrompt(task: { title: string; description: string }): string {
  return buildTaskPrompt(task)
    + '\n\nVocê está trabalhando num git worktree isolado desta tarefa — o commit é o que o NEX mergeia de volta, '
    + 'então nenhuma alteração pode ficar fora dele.'
}

const PARALLEL_CAP = 3

/**
 * Loops autônomos ativos por projeto — em nível de módulo, não no componente. O loop é uma
 * função async que continua viva depois que o painel desmonta (Voltar); com o estado só no
 * componente, o painel reaberto mostrava "Continuar loop" travado e não havia como pará-lo.
 */
const activeLoops = new Map<string, { stop: boolean }>()
const loopListeners = new Set<() => void>()
const notifyLoops = () => loopListeners.forEach(fn => fn())

/**
 * Sessão do Hermes de uma tarefa do loop (`-c nex-task-<id> --create-if-missing`). Cada tarefa
 * começa com histórico curto em vez de herdar a conversa do projeto inteiro; o contexto entre
 * tarefas vem do repositório (código + commits) e do `.hermes.md`. O id vem do banco (UUID) —
 * só [A-Za-z0-9_-], que é o que o main aceita.
 */
const taskSession = (taskId: string) => `nex-task-${taskId.replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 80)

const REMINDER_PROMPT = 'Você não incluiu nenhuma tag obrigatória. Termine AGORA com [TAREFA_CONCLUIDA], '
  + '[TAREFA_BLOQUEADA: motivo] ou [DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]. Não repita o trabalho, apenas finalize com a tag correta.'

interface PendingDecision { taskId: string; question: string; options: string[] }

/** Aprovação pendente + de onde veio: tarefa sequencial (dá para retomar a sessão) ou worktree paralelo (one-shot). */
interface PendingApproval extends HermesApprovalRequest { taskId: string | null; parallel: boolean }

interface ActivityEntry extends HermesActivity { at: number }

const ACTIVITY_CAP = 200

function buildApprovalFollowUp(a: PendingApproval, r: { executed: boolean; success: boolean; output: string }): string {
  if (!r.executed) {
    return `O usuário NEGOU o comando bloqueado: \`${a.command}\`. Não tente contorná-lo por outro caminho `
      + '(outro comando, script ou ferramenta com o mesmo efeito). Siga sem ele; se for indispensável, finalize com '
      + '[TAREFA_BLOQUEADA: motivo] ou [DECISAO_NECESSARIA pergunta="..." opcoes="A|B"].'
  }
  return `O usuário AUTORIZOU e o NEX executou por você o comando que estava bloqueado: \`${a.command}\`\n`
    + `Resultado (${r.success ? 'sucesso' : 'falhou'}):\n${r.output.slice(-3000)}\n\nContinue a partir daqui.`
}

/**
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
  const [output, setOutput] = useState('')
  const [streamId, setStreamId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  // ── Autonomous Loop (FASE 3) ──────────────────────────────────────────────
  const [goalInput, setGoalInput] = useState('')
  const [autonomyLevel, setAutonomyLevel] = useState<HermesAutonomyLevel>('manual')
  const policy = getAutonomyPolicy(autonomyLevel)
  // Semi-autônomo: tarefa de risco alto em que o loop parou, aguardando o usuário liberar.
  const [riskGateTaskId, setRiskGateTaskId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [planning, setPlanning] = useState(false)
  const [looping, setLooping] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null)
  const [decisionAnswer, setDecisionAnswer] = useState('')
  const [dodItems, setDodItems] = useState<DodItem[]>([])
  const [dodOpen, setDodOpen] = useState(false)
  const [runningDod, setRunningDod] = useState(false)
  const loopStopRef = useRef(false)
  // Re-render quando um loop (de qualquer instância do painel) começa/termina/recebe Parar.
  const [, setLoopTick] = useState(0)
  useEffect(() => {
    const fn = () => setLoopTick(t => t + 1)
    loopListeners.add(fn)
    return () => { loopListeners.delete(fn) }
  }, [])

  // ── Execução paralela via git worktree (FASE 4) ───────────────────────────
  const [activeParallel, setActiveParallel] = useState<Map<string, { title: string; branch: string }>>(new Map())

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
  const [reviewing, setReviewing] = useState(false)
  const [deliveryMsg, setDeliveryMsg] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  // runLoop é declarado antes do fechamento — chama a revisão automática por ref.
  const autoReviewRef = useRef<(() => void) | null>(null)

  // ── Quadro / agentes / logs por execução (ETAPAS 12/13/37) ────────────────
  const [rightTab, setRightTab] = useState<'live' | 'board' | 'logs'>('live')
  const [logTaskFilter, setLogTaskFilter] = useState('')
  // Só consulta enquanto o quadro ou os logs estão abertos.
  const runs = useHermesRuns(rightTab === 'live' ? '' : projectId)
  useEffect(() => { setLogTaskFilter('') }, [projectId])

  // ── Governança + activity feed (stream-json) ──────────────────────────────
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [resolvingApproval, setResolvingApproval] = useState<string | null>(null)
  // Execução do Hermes rodando na VPS sem stream deste app (órfã de antes de reabrir o NEX).
  const [orphanRunning, setOrphanRunning] = useState(false)
  const [stoppingOrphan, setStoppingOrphan] = useState(false)
  const approvalsRef = useRef<PendingApproval[]>([])
  const currentTaskRef = useRef<string | null>(null)
  const parallelStreamsRef = useRef<Set<string>>(new Set())
  useEffect(() => { approvalsRef.current = approvals }, [approvals])

  // Ao abrir o painel (ou trocar de projeto), reconecta ao que o main sabe que está em andamento:
  // a execução da sessão do projeto (vira "mensagem em andamento", com saída ao vivo e Cancelar,
  // e trava os botões) e os cartões Autorizar/Negar pendentes. Sem isso, Voltar → reabrir
  // liberava "Próxima" no meio de uma execução e o Hermes recusava a segunda na mesma sessão.
  useEffect(() => {
    setActivity([]); setApprovals([]); setOrphanRunning(false); setRiskGateTaskId(null)
    if (!projectId) return
    let cancelled = false
    ipc.hermes.agent.active(projectId).then(({ streamId: activeId, approvals: pending, orphanRunning: orphan }) => {
      if (cancelled) return
      setOrphanRunning(orphan)
      if (activeId) {
        setStreamId(activeId)
        setSending(true)
        setOutput('(reconectado a uma execução do Hermes em andamento — a saída anterior não é reexibida)\n\n')
      }
      if (pending.length > 0) setApprovals(pending.map(a => ({ ...a, taskId: null })))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [projectId])

  // Listener global (não depende de `sending`): captura atividade e bloqueios de qualquer
  // stream deste painel — mensagem livre, loop sequencial ou tarefa paralela.
  useEffect(() => {
    const unsub = ipc.hermes.agent.onChunk((chunk) => {
      if (chunk.type === 'activity' && chunk.activity) {
        const entry: ActivityEntry = { ...chunk.activity, at: Date.now() }
        setActivity(prev => [...prev.slice(-(ACTIVITY_CAP - 1)), entry])
      }
      if (chunk.type === 'approval_request' && chunk.approval) {
        const parallel = parallelStreamsRef.current.has(chunk.streamId)
        const pending: PendingApproval = { ...chunk.approval, parallel, taskId: parallel ? null : currentTaskRef.current }
        setApprovals(prev => prev.some(a => a.id === pending.id) ? prev : [...prev, pending])
      }
    })
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [])

  const scrollOutput = () => setTimeout(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, 60)

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

  // Enquanto houver órfã, confere a cada 20s — libera o painel sozinho quando ela terminar.
  // (Depois de loadStatus: arrays de dependência são avaliados no render — antes da declaração daria ReferenceError.)
  useEffect(() => {
    if (!orphanRunning || !projectId) return
    const t = setInterval(() => {
      ipc.hermes.agent.active(projectId)
        .then(r => { if (!r.orphanRunning) { setOrphanRunning(false); void loadStatus(projectId) } })
        .catch(() => {})
    }, 20_000)
    return () => clearInterval(t)
  }, [orphanRunning, projectId, loadStatus])

  const stopOrphan = useCallback(async () => {
    if (!projectId) return
    setStoppingOrphan(true)
    try {
      const { stopped } = await ipc.hermes.agent.stopRemote(projectId)
      setOutput(prev => `${prev}\n[governança] ${stopped} execução(ões) do Hermes encerrada(s) na VPS.\n`)
      setOrphanRunning(false)
      void loadStatus(projectId)
    } catch (e) {
      setOutput(prev => `${prev}\n[erro ao encerrar] ${String(e)}\n`)
    }
    setStoppingOrphan(false)
  }, [projectId, loadStatus])

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

  useEffect(() => {
    setDelivery(null); setDeliveryMsg(''); setReportOpen(false)
    if (!projectId) return
    let cancelled = false
    ipc.hermes.delivery.get(projectId).then(d => { if (!cancelled) setDelivery(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [projectId])

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
    currentTaskRef.current = null
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
  const sendAndWait = useCallback(async (prompt: string, sessionName?: string): Promise<{ text: string; ok: boolean }> => {
    try {
      const { streamId: id } = await ipc.hermes.agent.send(projectId, prompt, sessionName)
      return await waitForChunkStream(id)
    } catch (e) {
      setOutput(prev => `${prev}\n\n[erro] ${String(e)}`)
      return { text: '', ok: false }
    }
  }, [projectId, waitForChunkStream])

  const executeTask = useCallback(async (task: AgentTask): Promise<'done' | 'blocked' | 'decision' | 'error'> => {
    let prompt = buildTaskPrompt(task)
    currentTaskRef.current = task.id
    for (let attempt = 0; attempt < 2; attempt++) {
      // Sessão própria da tarefa: o lembrete de tag (2ª tentativa) continua a mesma conversa.
      const { text, ok } = await sendAndWait(prompt, taskSession(task.id))
      if (!ok) {
        // Execução não aconteceu ou caiu (ex.: barrada por já haver outra na sessão): a tarefa
        // volta para Pendente em vez de ficar "Em andamento" sem nada rodando.
        await ipc.tasks.update(task.id, { status: 'TODO' }).catch(() => {})
        return 'error'
      }
      // Comando bloqueado aguardando o usuário: a tarefa espera a decisão (resolveApproval
      // reenvia a tarefa com o desfecho e lê a tag dali) em vez de gastar o lembrete.
      if (approvalsRef.current.some(a => a.taskId === task.id)) return 'decision'
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
    parallelStreamsRef.current.add(start.streamId)
    setActiveParallel(prev => new Map(prev).set(task.id, { title: task.title, branch: start.branch }))
    const { text, ok } = await waitForChunkStream(start.streamId)
    parallelStreamsRef.current.delete(start.streamId)
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

  /** `approvedTaskId`: tarefa de risco alto que o usuário acabou de liberar (Semi-autônomo) — passa pelo gate uma vez. */
  const runLoop = useCallback(async (approvedTaskId?: string) => {
    if (looping || activeLoops.has(projectId)) return
    const handle = { stop: false }
    activeLoops.set(projectId, handle)
    notifyLoops()
    setLooping(true)
    setRiskGateTaskId(null)
    loopStopRef.current = false
    // Fila esvaziada com tudo concluído depois de ter executado algo nesta rodada → fechar a entrega.
    let executedAny = false
    let finishedAll = false
    try {
      let guard = 0
      const cap = 20
      while (!loopStopRef.current && !handle.stop) {
        // Governança: nunca segue com comando perigoso aguardando Autorizar/Negar.
        if (approvalsRef.current.length > 0) break
        const current = await ipc.tasks.list({ projectId, ownerAgent: 'hermes' }).catch(() => [] as AgentTask[])
        setTasks(current)
        const todo = current.filter(t => t.status === 'TODO')
        if (todo.length === 0) {
          finishedAll = executedAny && current.length > 0 && current.every(t => t.status === 'DONE')
          break
        }
        guard++
        if (guard > Math.max(cap, todo.length * 3)) break

        // Paralelo só para tarefas paralelizáveis CONSECUTIVAS no início da fila, na ordem do plano.
        // Antes pegava todas as paralelizáveis da lista inteira — rodava a 05/06/07/21 antes da
        // 03/04, sem a fundação que elas pressupõem.
        // Uma tarefa que a política manda parar antes (risco alto no Semi-autônomo) também fecha o lote.
        const leading: AgentTask[] = []
        if (policy.allowParallel) {
          for (const t of todo) { if (!t.parallelizable || needsRiskGate(policy, t)) break; leading.push(t) }
        }
        // Worktree nasce do último commit: com trabalho não commitado na pasta principal, as cópias
        // paralelas não teriam esse trabalho. Nesse caso roda em sequência (que vê o diretório real).
        const clean = leading.length > 1 && agentInfo
          ? await ipc.git.status(agentInfo.vpsId, agentInfo.workspace)
              .then(s => s.isRepo && s.staged.length === 0 && s.unstaged.length === 0 && s.untracked.length === 0)
              .catch(() => false)
          : false
        if (leading.length > 1 && clean) {
          const batch = leading.slice(0, PARALLEL_CAP)
          await Promise.all(batch.map(t => ipc.tasks.update(t.id, { status: 'IN_PROGRESS' }).catch(() => {})))
          await loadTasks()
          await runParallelBatch(batch)
          await loadTasks()
          executedAny = true
          continue
        }

        const next = todo[0]
        if (needsRiskGate(policy, next) && next.id !== approvedTaskId) {
          setRiskGateTaskId(next.id)
          break
        }
        await ipc.tasks.update(next.id, { status: 'IN_PROGRESS' }).catch(() => {})
        await loadTasks()
        const result = await executeTask(next)
        await loadTasks()
        executedAny = true
        if (result !== 'done') break
      }
    } finally {
      if (activeLoops.get(projectId) === handle) activeLoops.delete(projectId)
      notifyLoops()
      setLooping(false)
      void loadStatus(projectId)
    }
    if (finishedAll && !handle.stop && policy.autoAdvance) autoReviewRef.current?.()
  }, [looping, projectId, agentInfo, policy, executeTask, runParallelBatch, loadTasks, loadStatus])

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
    currentTaskRef.current = null
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
        status: 'TODO', parallelizable: t.parallelizable, risk: t.risk,
      }).catch(() => {})
    }
    setGoalInput('')
    setDelivery(null)
    await loadTasks()
    await loadStatus(projectId)
    if (policy.autoAdvance) void runLoop()
  }, [projectId, goalInput, planning, looping, sendAndWait, loadTasks, loadStatus, policy, runLoop])

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
      const { text, ok } = await sendAndWait(prompt, taskSession(task.id))
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
      if (policy.autoAdvance && !stillPending) void runLoop()
    }
  }, [pendingDecision, tasks, sendAndWait, loadTasks, policy, runLoop])

  /**
   * Autorizar/Negar um comando que o Hermes teve bloqueado. Autorizar = o NEX executa (main
   * process, auditado em tool_execution_log). Depois avisa o Hermes do desfecho na mesma sessão;
   * se o bloqueio veio de uma tarefa sequencial, reenvia a tarefa e lê a tag — igual ao Decision
   * Request. Tarefa paralela é one-shot (worktree sem sessão): o comando roda no worktree e a
   * tarefa fica para revisão manual.
   */
  const resolveApproval = useCallback(async (a: PendingApproval, approve: boolean) => {
    if (sending || planning || looping || resolvingApproval) return
    setResolvingApproval(a.id)
    let result = { executed: false, success: false, output: '' }
    try {
      if (a.executable) result = await ipc.hermes.agent.resolveApproval(a.id, approve)
      setOutput(prev => `${prev}\n\n[governança] ${approve ? 'Autorizado' : 'Negado'}: ${a.command}`
        + (result.executed ? `\n${result.output.slice(-1500)}` : ''))
      scrollOutput()
    } catch (e) {
      setOutput(prev => `${prev}\n\n[erro ao resolver aprovação] ${String(e)}`)
      setResolvingApproval(null)
      return
    }
    setApprovals(prev => prev.filter(x => x.id !== a.id))
    setResolvingApproval(null)
    if (a.parallel) return

    const task = a.taskId ? tasks.find(t => t.id === a.taskId) : undefined
    setLooping(true)
    let stillPending = false
    try {
      const followUp = buildApprovalFollowUp(a, result)
      const { text, ok } = task
        ? await sendAndWait(`${buildTaskPrompt(task)}\n\n${followUp}`, taskSession(task.id))
        : await sendAndWait(followUp)
      if (ok && task) {
        currentTaskRef.current = task.id
        const tag = parseTaskTag(text)
        if (approvalsRef.current.some(x => x.taskId === task.id)) stillPending = true
        else if (tag.kind === 'done') await ipc.tasks.update(task.id, { status: 'DONE' }).catch(() => {})
        else if (tag.kind === 'blocked') {
          await ipc.tasks.update(task.id, {
            status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] ${tag.reason}`.trim(),
          }).catch(() => {})
        } else if (tag.kind === 'decision') {
          setPendingDecision({ taskId: task.id, question: tag.question, options: tag.options })
          stillPending = true
        }
        await loadTasks()
      }
    } finally {
      setLooping(false)
      if (policy.autoAdvance && !stillPending && approvalsRef.current.length === 0) void runLoop()
    }
  }, [sending, planning, looping, resolvingApproval, tasks, sendAndWait, loadTasks, policy, runLoop])

  const changeAutonomy = useCallback(async (level: HermesAutonomyLevel) => {
    setAutonomyLevel(level)
    // Saiu do Semi-autônomo: o gate pendente não vale mais (Autônomo segue com "Continuar loop").
    if (!getAutonomyPolicy(level).gateHighRisk) setRiskGateTaskId(null)
    if (projectId) await ipc.hermes.agent.setAutonomy(projectId, level).catch(() => {})
  }, [projectId])

  const createCorrections = useCallback(async (d: HermesDelivery) => {
    for (const c of d.corrections) {
      await ipc.tasks.create({
        title: c.title, description: c.description, projectId, ownerAgent: 'hermes',
        status: 'TODO', parallelizable: false, risk: classifyTaskRisk(c),
      }).catch(() => {})
    }
    await loadTasks()
  }, [projectId, loadTasks])

  /**
   * Fecha a entrega: o Hermes revisa (sessão própria, não suja a do projeto) → o main reexecuta
   * build/testes seguros, atualiza a DoD, aplica o gate e gera o relatório. `auto` (fim do loop no
   * Semi-autônomo/Autônomo): se bloquear por algo corrigível, cria as tarefas de correção e volta
   * ao loop — no máximo MAX_DELIVERY_ROUNDS rodadas, para não virar um ciclo infinito.
   */
  const runDeliveryReview = useCallback(async (auto = false) => {
    if (!projectId || reviewing || activeLoops.has(projectId)) return
    setReviewing(true)
    setDeliveryMsg('O Hermes está revisando código e segurança e rodando build/testes…')
    currentTaskRef.current = null
    try {
      const session = `nex-review-${projectId.replace(/[^A-Za-z0-9_-]/g, '')}-${Date.now()}`.slice(0, 80)
      const { text, ok } = await sendAndWait(buildReviewPrompt(agentInfo?.objective ?? '', agentInfo?.baseCommit ?? ''), session)
      if (!ok) { setDeliveryMsg('A revisão não terminou — veja a saída ao lado e tente de novo.'); return }
      setDeliveryMsg('Conferindo build/testes no servidor e aplicando a Definition of Done…')
      const d = await ipc.hermes.delivery.close(projectId, text)
      setDelivery(d)
      setDodItems(await ipc.hermes.dod.get(projectId).catch(() => dodItems))
      setDeliveryMsg('')
      if (auto && d.verdict === 'blocked' && d.corrections.length > 0 && d.round < MAX_DELIVERY_ROUNDS && approvalsRef.current.length === 0) {
        setDeliveryMsg(`Entrega bloqueada — ${d.corrections.length} tarefa(s) de correção criada(s) (rodada ${d.round}/${MAX_DELIVERY_ROUNDS}).`)
        await createCorrections(d)
        setReviewing(false)
        // Por ref: a revisão leva minutos, e o runLoop capturado aqui teria o estado de antes dela.
        setTimeout(() => { void runLoopRef.current() }, 0)
      }
    } catch (e) {
      setDeliveryMsg(`Erro no fechamento: ${String(e)}`)
    } finally {
      setReviewing(false)
    }
  }, [projectId, reviewing, agentInfo, sendAndWait, dodItems, createCorrections])

  const runLoopRef = useRef(runLoop)
  useEffect(() => { runLoopRef.current = runLoop }, [runLoop])
  useEffect(() => { autoReviewRef.current = () => { setTimeout(() => { void runDeliveryReview(true) }, 0) } }, [runDeliveryReview])

  const reevaluateDelivery = useCallback(async () => {
    if (!projectId) return
    try { setDelivery(await ipc.hermes.delivery.reevaluate(projectId)); setDeliveryMsg('') }
    catch (e) { setDeliveryMsg(`Erro: ${String(e)}`) }
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
  // Loop deste projeto rodando em qualquer instância do painel (inclusive uma já desmontada).
  const loopHandle = projectId ? activeLoops.get(projectId) : undefined
  const busy = sending || planning || looping || reviewing || orphanRunning || !!loopHandle
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
                    looping || loopHandle ? (
                      <button
                        onClick={() => { loopStopRef.current = true; if (loopHandle) loopHandle.stop = true; notifyLoops() }}
                        disabled={loopHandle?.stop}
                        className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-60 flex items-center gap-1"
                        title="Termina a tarefa atual e não começa a próxima"
                      >
                        <Square size={11} /> {loopHandle?.stop ? 'Parando após a tarefa atual…' : 'Parar'}
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
                      disabled={busy || resolvingApproval !== null}
                      className="flex-1 text-[11px] py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-1"
                    >
                      {resolvingApproval === a.id ? <Loader2 size={11} className="animate-spin" /> : null} Autorizar
                    </button>
                    <button
                      onClick={() => void resolveApproval(a, false)}
                      disabled={busy || resolvingApproval !== null}
                      className="flex-1 text-[11px] py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                    >
                      Negar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => void resolveApproval(a, false)}
                    disabled={busy || resolvingApproval !== null}
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
                    onClick={() => void runDeliveryReview(false)}
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
                      onClick={() => void createCorrections(delivery).then(() => { if (policy.autoAdvance) void runLoop() })}
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
                        onClick={() => { void navigator.clipboard.writeText(delivery.report).then(() => setDeliveryMsg('Relatório copiado.')) }}
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
