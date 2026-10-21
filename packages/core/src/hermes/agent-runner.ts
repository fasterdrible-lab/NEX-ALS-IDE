import crypto from 'node:crypto'
import { getAutonomyPolicy, needsRiskGate, classifyTaskRisk, type AutonomyPolicy } from '@cwm/config'
import type { HermesService } from './hermes.service.js'
import type { HermesEventStream, HermesEvent } from './hermes-events.js'
import type { HermesRunLog, HermesRunKind } from './run-log.js'
import { runKindFromSession } from './run-log.js'
import { MAX_DELIVERY_ROUNDS, parseReview } from './delivery.js'
import { buildJsonFixPrompt } from './incident.js'
import type { TasksService, AgentTask } from '../tasks/tasks.service.js'
import type { GitService } from '../git/git.service.js'
import {
  parseTaskTag, parseTaskPlan, buildPlanPrompt, buildReviewPrompt, buildTaskPrompt, buildParallelTaskPrompt,
  taskSession, buildCommitFollowUp, buildApprovalFollowUp, REMINDER_PROMPT, RESUME_PROMPT,
} from './agent-prompts.js'

/**
 * Loop de tarefas do Hermes no processo principal (Passo 0 do Zeus Mobile, docs/ZEUS_MOBILE_PLAN.md).
 * Antes vivia no painel (HermesAgentPanel.tsx): fechar o painel ou o app interrompia a tarefa.
 * Aqui não há nada de Electron — o runner avisa por `emit` e quem o hospeda (main do Zeus hoje,
 * um serviço na VPS depois) repassa às telas. O painel só mostra o estado e manda comandos.
 */

export type RunnerMode = 'idle' | 'message' | 'planning' | 'loop' | 'single' | 'decision' | 'approval' | 'review'

export interface RunnerApproval {
  id: string
  tool: string
  command: string
  reason: string
  /** false para execute_code (Python arbitrário) — o NEX só informa, não reexecuta. */
  executable: boolean
  /** Veio de uma tarefa paralela (worktree, sem sessão para retomar). */
  parallel: boolean
  /** Tarefa sequencial que pediu o comando (null = mensagem livre/paralela). */
  taskId: string | null
}

export interface RunnerActivity { at: number; kind: 'init' | 'tool' | 'tool_error'; tool: string; summary: string }

export interface RunnerState {
  projectId: string
  mode: RunnerMode
  /** Parar pedido: termina a tarefa atual e não começa a próxima. */
  stopRequested: boolean
  currentTaskId: string | null
  /** Semi-autônomo: tarefa de risco alto em que o loop parou, aguardando liberar. */
  riskGateTaskId: string | null
  pendingDecision: { taskId: string; question: string; options: string[] } | null
  approvals: RunnerApproval[]
  parallel: { taskId: string; title: string; branch: string }[]
  /** Mensagem da seção Entrega ('' = nenhuma). */
  deliveryMsg: string
  /** Muda quando as tarefas do projeto mudam — o painel recarrega a lista. */
  tasksVersion: number
  /** Muda quando a entrega/DoD muda. */
  deliveryVersion: number
}

export interface RunnerSnapshot {
  state: RunnerState
  /** Fim da saída ao vivo guardada (cauda); `outputEnd` = total de caracteres já emitidos. */
  output: string
  outputEnd: number
  activity: RunnerActivity[]
}

export type RunnerEvent =
  | { kind: 'state'; projectId: string; state: RunnerState }
  /** `reset`: a saída foi limpa (novo objetivo/mensagem) antes deste texto. `end`: total emitido até aqui. */
  | { kind: 'output'; projectId: string; text: string; end: number; reset?: boolean }
  | { kind: 'activity'; projectId: string; entry: RunnerActivity }
  /** Compatibilidade com quem escuta o fim de cada execução (IDE recarrega árvore/Git; projeto local conta alterações). */
  | { kind: 'chunk'; streamId: string; type: 'done' | 'error'; error?: string }

export interface RunnerDeps {
  hermes: HermesService
  runLog: HermesRunLog
  tasks: TasksService
  git: GitService
  emit: (e: RunnerEvent) => void
}

const OUTPUT_CAP = 300_000
const ACTIVITY_CAP = 200
const PARALLEL_CAP = 3
const LOOP_GUARD = 20
const WATCHDOG_MS = 900_000

interface ProjectRun {
  state: RunnerState
  output: string
  outputEnd: number
  activity: RunnerActivity[]
}

interface ApprovalEntry extends RunnerApproval { projectId: string; workspace?: string }

type TaskOutcome = 'done' | 'blocked' | 'decision' | 'error'

export class HermesAgentRunner {
  private readonly runs = new Map<string, ProjectRun>()
  private readonly streams = new Map<string, HermesEventStream>()
  /** projectId → streamId da execução sequencial (sessão do projeto/tarefa) em andamento. */
  private readonly activeByProject = new Map<string, string>()
  private readonly approvals = new Map<string, ApprovalEntry>()

  constructor(private readonly d: RunnerDeps) {}

  // ── Estado ────────────────────────────────────────────────────────────────

  private run(projectId: string): ProjectRun {
    let r = this.runs.get(projectId)
    if (!r) {
      r = {
        state: {
          projectId, mode: 'idle', stopRequested: false, currentTaskId: null, riskGateTaskId: null,
          pendingDecision: null, approvals: [], parallel: [], deliveryMsg: '', tasksVersion: 0, deliveryVersion: 0,
        },
        output: '', outputEnd: 0, activity: [],
      }
      this.runs.set(projectId, r)
    }
    return r
  }

  /** Cópia do estado com as aprovações pendentes do projeto (o mapa de aprovações é a fonte). */
  private stateOf(projectId: string): RunnerState {
    const s = this.run(projectId).state
    const approvals = [...this.approvals.values()].filter(a => a.projectId === projectId)
      .map(({ projectId: _p, workspace: _w, ...a }) => a)
    return { ...s, approvals, parallel: [...s.parallel] }
  }

  private emitState(projectId: string): void {
    this.d.emit({ kind: 'state', projectId, state: this.stateOf(projectId) })
  }

  private patch(projectId: string, p: Partial<RunnerState>): void {
    Object.assign(this.run(projectId).state, p)
    this.emitState(projectId)
  }

  private tasksChanged(projectId: string): void {
    this.run(projectId).state.tasksVersion++
    this.emitState(projectId)
  }

  private append(projectId: string, text: string): void {
    if (!text) return
    const r = this.run(projectId)
    r.output = (r.output + text).slice(-OUTPUT_CAP)
    r.outputEnd += text.length
    this.d.emit({ kind: 'output', projectId, text, end: r.outputEnd })
  }

  private clearOutput(projectId: string): void {
    const r = this.run(projectId)
    r.output = ''
    this.d.emit({ kind: 'output', projectId, text: '', end: r.outputEnd, reset: true })
  }

  private note(projectId: string, text: string): void { this.append(projectId, `\n\n${text}`) }

  snapshot(projectId: string): RunnerSnapshot {
    const r = this.run(projectId)
    return { state: this.stateOf(projectId), output: r.output, outputEnd: r.outputEnd, activity: [...r.activity] }
  }

  /** Execução do Hermes rodando na VPS sem stream deste processo (órfã de antes de reabrir o app). */
  async orphanRunning(projectId: string): Promise<boolean> {
    if (this.activeByProject.has(projectId) || this.run(projectId).state.mode !== 'idle') return false
    return this.d.hermes.isRunningOnVps(projectId).catch(() => false)
  }

  /** Uma operação por projeto. Marca o modo de forma síncrona e roda o corpo em segundo plano. */
  private start(projectId: string, mode: RunnerMode, body: () => Promise<void>): void {
    const r = this.run(projectId)
    if (r.state.mode !== 'idle') throw new Error('Já há uma execução do Hermes em andamento neste projeto — aguarde terminar.')
    r.state.mode = mode
    r.state.stopRequested = false
    this.emitState(projectId)
    void body()
      .catch((e: unknown) => this.note(projectId, `[erro] ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => { r.state.mode = 'idle'; r.state.currentTaskId = null; this.emitState(projectId) })
  }

  private async policyOf(projectId: string): Promise<AutonomyPolicy> {
    const info = await this.d.hermes.getAgentStatus(projectId).catch(() => null)
    return getAutonomyPolicy(info?.autonomyLevel)
  }

  private listTasks(projectId: string): Promise<AgentTask[]> {
    return this.d.tasks.list({ projectId, ownerAgent: 'hermes' }).catch(() => [] as AgentTask[])
  }

  private async setTask(projectId: string, id: string, patch: Parameters<TasksService['update']>[1]): Promise<void> {
    await this.d.tasks.update(id, patch).catch(() => {})
    this.tasksChanged(projectId)
  }

  private block(projectId: string, task: AgentTask, reason: string): Promise<void> {
    return this.setTask(projectId, task.id, { status: 'BLOCKED', description: `${task.description}\n\n[bloqueado] ${reason}`.trim() })
  }

  private hasApprovalFor(taskId: string): boolean {
    return [...this.approvals.values()].some(a => a.taskId === taskId)
  }

  private hasApprovals(projectId: string): boolean {
    return [...this.approvals.values()].some(a => a.projectId === projectId)
  }

  // ── Streams ──────────────────────────────────────────────────────────────

  /**
   * Liga um stream do Hermes: grava o log da execução (ETAPA 37), repassa texto e atividade,
   * transforma comando bloqueado em pedido de Autorizar/Negar, aplica watchdog de inatividade
   * (900s — com delegação ao Claude Code, um `claude -p` pode trabalhar vários minutos sem evento).
   */
  private wire(
    projectId: string, streamId: string, stream: HermesEventStream,
    ctx: { workspace?: string; run: { kind: HermesRunKind; taskId: string | null }; parallel: boolean },
  ): Promise<{ text: string; ok: boolean; error?: string }> {
    this.streams.set(streamId, stream)
    const runId = this.d.runLog.start({ projectId, ...ctx.run })
    const taskIdAtStart = ctx.parallel ? null : this.run(projectId).state.currentTaskId
    return new Promise(resolve => {
      let text = ''
      let settled = false
      let hasData = false
      let lastChunkAt = Date.now()
      const finish = (ok: boolean, error?: string) => {
        if (settled) return
        settled = true
        clearInterval(watchdog)
        this.streams.delete(streamId)
        this.d.runLog.finish(runId, ok, error)
        if (!ok && error) this.note(projectId, `[erro] ${error}`)
        this.d.emit({ kind: 'chunk', streamId, type: ok ? 'done' : 'error', error })
        resolve({ text, ok, error })
      }
      const activity = (entry: Omit<RunnerActivity, 'at'>) => {
        const e = { ...entry, at: Date.now() }
        const r = this.run(projectId)
        r.activity = [...r.activity.slice(-(ACTIVITY_CAP - 1)), e]
        this.d.emit({ kind: 'activity', projectId, entry: e })
      }
      stream.on('data', (chunk: string) => {
        hasData = true
        lastChunkAt = Date.now()
        text += chunk
        this.d.runLog.appendText(runId, chunk)
        this.append(projectId, chunk)
      })
      stream.on('event', (e: HermesEvent) => {
        lastChunkAt = Date.now()
        if (e.kind === 'tool_use') {
          this.d.runLog.appendActivity(runId, { kind: 'tool', tool: e.tool, summary: e.summary })
          activity({ kind: 'tool', tool: e.tool, summary: e.summary })
        } else if (e.kind === 'tool_result' && !e.ok) {
          this.d.runLog.appendActivity(runId, { kind: 'tool_error', tool: e.tool, summary: e.summary })
          activity({ kind: 'tool_error', tool: e.tool, summary: e.summary })
        } else if (e.kind === 'init') {
          this.d.runLog.appendActivity(runId, { kind: 'init', tool: '', summary: e.model })
          activity({ kind: 'init', tool: '', summary: e.model })
        } else if (e.kind === 'blocked') {
          this.d.runLog.appendActivity(runId, { kind: 'blocked', tool: e.tool, summary: `${e.command || e.tool} — ${e.reason}` })
          const id = crypto.randomUUID()
          this.approvals.set(id, {
            id, projectId, workspace: ctx.workspace, tool: e.tool, command: e.command, reason: e.reason,
            // execute_code (Python arbitrário) não é reexecutável com segurança pelo NEX — só informa.
            executable: e.tool === 'terminal' && e.command.length > 0,
            parallel: ctx.parallel, taskId: taskIdAtStart,
          })
          this.emitState(projectId)
        }
      })
      stream.on('close', (code: number | null) => {
        const r = stream.result
        const ok = r ? r.ok : (code === 0 && hasData)
        const stray = stream.strayOutput
        finish(ok, ok ? undefined : (r?.error || `hermes encerrou sem resultado (código ${code})${stray ? `: ${stray}` : ''}`))
      })
      stream.on('error', (err: Error) => finish(false, err.message))
      const watchdog = setInterval(() => {
        if (settled) { clearInterval(watchdog); return }
        if (Date.now() - lastChunkAt > WATCHDOG_MS) { stream.kill(); finish(false, 'Timeout: Hermes não respondeu em 900s.') }
      }, 15_000)
    })
  }

  /** Envia um prompt na sessão do projeto (ou da tarefa) e espera o fim. */
  private async sendAndWait(projectId: string, prompt: string, sessionName?: string): Promise<{ text: string; ok: boolean }> {
    if (sessionName !== undefined && !/^[A-Za-z0-9_-]{1,80}$/.test(sessionName)) throw new Error('Nome de sessão inválido')
    // Uma execução sequencial por projeto: o Hermes recusa a segunda na mesma sessão.
    const running = this.activeByProject.get(projectId)
    if (running && this.streams.has(running)) {
      this.note(projectId, '[erro] Já existe uma execução do Hermes em andamento neste projeto.')
      return { text: '', ok: false }
    }
    // Execução iniciada antes de o app ser reaberto continua na VPS segurando a sessão.
    if (await this.d.hermes.isRunningOnVps(projectId).catch(() => false)) {
      this.note(projectId, '[erro] Há uma execução do Hermes ainda rodando na VPS neste projeto (iniciada antes de o app ser reaberto). Aguarde ela terminar ou use "Encerrar execução na VPS".')
      return { text: '', ok: false }
    }
    const streamId = crypto.randomUUID()
    this.activeByProject.set(projectId, streamId)
    let stream: HermesEventStream
    try {
      ({ stream } = await this.d.hermes.streamObjective(projectId, prompt, { sessionName }))
    } catch (e) {
      this.activeByProject.delete(projectId)
      this.note(projectId, `[erro] ${e instanceof Error ? e.message : String(e)}`)
      return { text: '', ok: false }
    }
    const res = await this.wire(projectId, streamId, stream, { run: runKindFromSession(sessionName), parallel: false })
    if (this.activeByProject.get(projectId) === streamId) this.activeByProject.delete(projectId)
    await this.d.hermes.markAgentActivity(projectId, {
      status: res.ok ? 'idle' : 'error', sessionStarted: res.ok ? true : undefined, lastError: res.error,
    }).catch(() => {})
    return { text: res.text, ok: res.ok }
  }

  // ── Comandos do painel ────────────────────────────────────────────────────

  /** Mensagem livre (fora do fluxo de tarefas). */
  sendMessage(projectId: string, text: string): void {
    this.start(projectId, 'message', async () => {
      this.clearOutput(projectId)
      await this.sendAndWait(projectId, text)
    })
  }

  /** FASE 6 — sessão interrompida: o backend já usa --resume (sessionStarted preservado). */
  resume(projectId: string): void { this.sendMessage(projectId, RESUME_PROMPT) }

  /** Cancela a execução sequencial em andamento e pede para o loop não seguir. */
  async cancel(projectId: string): Promise<void> {
    this.run(projectId).state.stopRequested = true
    const streamId = this.activeByProject.get(projectId)
    if (streamId) {
      this.streams.get(streamId)?.kill()
      this.activeByProject.delete(projectId)
      // Fechar o canal SSH não mata o Hermes na VPS (sem pty, sem SIGHUP) — encerra de fato.
      await this.d.hermes.stopRunsOnVps(projectId).catch((e: unknown) => console.error('[Hermes] cancel remoto falhou:', e))
    }
    this.emitState(projectId)
  }

  /** Execução órfã (de um app anterior) segurando a sessão. */
  async stopRemote(projectId: string): Promise<number> {
    if (this.activeByProject.has(projectId)) throw new Error('Há uma execução deste app em andamento — use Cancelar.')
    return this.d.hermes.stopRunsOnVps(projectId)
  }

  /** Parar: termina a tarefa atual e não começa a próxima. */
  stop(projectId: string): void { this.patch(projectId, { stopRequested: true }) }

  startObjective(projectId: string, objective: string): void {
    this.start(projectId, 'planning', async () => {
      this.clearOutput(projectId)
      await this.d.hermes.setObjective(projectId, objective).catch(() => {})
      // Best-effort: .hermes.md (KB Global + memória do projeto) atualizado antes do plano.
      await this.d.hermes.syncProjectContext(projectId).catch(() => {})
      const { text, ok } = await this.sendAndWait(projectId, buildPlanPrompt(objective))
      if (!ok) return
      for (const t of parseTaskPlan(text)) {
        await this.d.tasks.create({
          title: t.title, description: t.description, projectId, ownerAgent: 'hermes',
          status: 'TODO', parallelizable: t.parallelizable, risk: t.risk,
        }).catch(() => {})
      }
      this.run(projectId).state.deliveryVersion++
      this.tasksChanged(projectId)
    })
    void this.afterIdle(projectId, async () => {
      if ((await this.policyOf(projectId)).autoAdvance) this.tryLoop(projectId)
    })
  }

  /** `approvedTaskId`: tarefa de risco alto que o usuário acabou de liberar (Semi-autônomo). */
  runLoop(projectId: string, approvedTaskId?: string): void {
    let finishedAll = false
    this.start(projectId, 'loop', async () => {
      this.patch(projectId, { riskGateTaskId: null })
      finishedAll = await this.loopBody(projectId, approvedTaskId)
    })
    void this.afterIdle(projectId, async () => {
      if (finishedAll && !this.run(projectId).state.stopRequested && (await this.policyOf(projectId)).autoAdvance) {
        this.tryReview(projectId, true)
      }
    })
  }

  /** Assistido: executa só a próxima tarefa pendente. */
  runNext(projectId: string): void {
    this.start(projectId, 'single', async () => {
      const next = (await this.listTasks(projectId)).find(t => t.status === 'TODO')
      if (!next) return
      await this.setTask(projectId, next.id, { status: 'IN_PROGRESS' })
      await this.executeTask(projectId, next)
    })
  }

  resolveDecision(projectId: string, answer: string): void {
    const r = this.run(projectId)
    const decision = r.state.pendingDecision
    if (!decision) throw new Error('Nenhuma decisão pendente neste projeto.')
    let stillPending = false
    this.start(projectId, 'decision', async () => {
      this.patch(projectId, { pendingDecision: null })
      const task = (await this.listTasks(projectId)).find(t => t.id === decision.taskId)
      if (!task) return
      r.state.currentTaskId = task.id
      const { text, ok } = await this.sendAndWait(projectId,
        `${buildTaskPrompt(task)}\n\nDecisão do usuário para "${decision.question}": ${answer}`, taskSession(task.id))
      if (ok) stillPending = (await this.handleTag(projectId, task, text)) === 'decision'
    })
    void this.afterIdle(projectId, async () => {
      if (!stillPending && (await this.policyOf(projectId)).autoAdvance) this.tryLoop(projectId)
    })
  }

  /** A aprovação é deste runner? (No Zeus, a que não for vem do serviço na VPS.) */
  hasApproval(approvalId: string): boolean { return this.approvals.has(approvalId) }

  /**
   * Autorizar/Negar um comando que o Hermes teve bloqueado. Autorizar = o NEX executa (auditado em
   * tool_execution_log). Depois avisa o Hermes na mesma sessão; se veio de uma tarefa sequencial,
   * reenvia a tarefa e lê a tag. Tarefa paralela é one-shot: fica para revisão manual.
   */
  resolveApproval(approvalId: string, approve: boolean): { projectId: string } {
    const a = this.approvals.get(approvalId)
    if (!a) throw new Error('Solicitação de aprovação não encontrada ou já resolvida')
    const projectId = a.projectId
    let stillPending = false
    this.start(projectId, 'approval', async () => {
      this.approvals.delete(approvalId)
      this.emitState(projectId)
      let result = { executed: false, success: false, output: '' }
      if (approve && a.executable) {
        const r = await this.d.hermes.runApprovedCommand(projectId, a.command, a.workspace)
        result = { executed: true, success: r.success, output: r.output }
      }
      this.note(projectId, `[governança] ${approve ? 'Autorizado' : 'Negado'}: ${a.command}${result.executed ? `\n${result.output.slice(-1500)}` : ''}`)
      if (a.parallel) { stillPending = true; return }
      const task = a.taskId ? (await this.listTasks(projectId)).find(t => t.id === a.taskId) : undefined
      const followUp = buildApprovalFollowUp(a.command, result)
      if (task) this.run(projectId).state.currentTaskId = task.id
      const { text, ok } = task
        ? await this.sendAndWait(projectId, `${buildTaskPrompt(task)}\n\n${followUp}`, taskSession(task.id))
        : await this.sendAndWait(projectId, followUp)
      if (ok && task) stillPending = (await this.handleTag(projectId, task, text)) === 'decision'
    })
    void this.afterIdle(projectId, async () => {
      if (!stillPending && !this.hasApprovals(projectId) && (await this.policyOf(projectId)).autoAdvance) this.tryLoop(projectId)
    })
    return { projectId }
  }

  /** Fechamento da entrega (manual). */
  review(projectId: string): void { this.reviewInner(projectId, false) }

  /** Cria as tarefas de correção da entrega bloqueada e, se a política avança sozinha, volta ao loop. */
  async createCorrections(projectId: string): Promise<void> {
    const d = await this.d.hermes.getDelivery(projectId)
    if (!d || d.corrections.length === 0) return
    await this.addCorrections(projectId, d.corrections)
    if ((await this.policyOf(projectId)).autoAdvance) this.tryLoop(projectId)
  }

  // ── Internos do loop ──────────────────────────────────────────────────────

  /** Roda `fn` assim que o projeto voltar a idle (depois do finally de `start`). */
  private async afterIdle(projectId: string, fn: () => Promise<void>): Promise<void> {
    const r = this.run(projectId)
    while (r.state.mode !== 'idle') await new Promise(res => setTimeout(res, 200))
    await fn().catch((e: unknown) => this.note(projectId, `[erro] ${e instanceof Error ? e.message : String(e)}`))
  }

  private tryLoop(projectId: string): void {
    try { this.runLoop(projectId) } catch { /* outra operação começou antes — o usuário segue pelo painel */ }
  }

  private tryReview(projectId: string, auto: boolean): void {
    try { this.reviewInner(projectId, auto) } catch { /* idem */ }
  }

  /** Devolve true se a fila esvaziou com tudo concluído depois de executar algo (→ fechar a entrega). */
  private async loopBody(projectId: string, approvedTaskId?: string): Promise<boolean> {
    const r = this.run(projectId)
    const policy = await this.policyOf(projectId)
    const info = await this.d.hermes.getAgentStatus(projectId)
    let executedAny = false
    let guard = 0
    while (!r.state.stopRequested) {
      // Governança: nunca segue com comando perigoso aguardando Autorizar/Negar.
      if (this.hasApprovals(projectId)) break
      const current = await this.listTasks(projectId)
      const todo = current.filter(t => t.status === 'TODO')
      if (todo.length === 0) return executedAny && current.length > 0 && current.every(t => t.status === 'DONE')
      if (++guard > Math.max(LOOP_GUARD, todo.length * 3)) break

      // Paralelo só para tarefas paralelizáveis CONSECUTIVAS no início da fila, na ordem do plano;
      // uma tarefa que a política manda parar antes (risco alto no Semi-autônomo) fecha o lote.
      const leading: AgentTask[] = []
      if (policy.allowParallel) {
        for (const t of todo) { if (!t.parallelizable || needsRiskGate(policy, t)) break; leading.push(t) }
      }
      // Worktree nasce do último commit: com trabalho não commitado, roda em sequência.
      const clean = leading.length > 1
        ? await this.d.git.status(info.vpsId, info.workspace)
            .then(s => s.isRepo && s.staged.length === 0 && s.unstaged.length === 0 && s.untracked.length === 0)
            .catch(() => false)
        : false
      if (leading.length > 1 && clean) {
        const batch = leading.slice(0, PARALLEL_CAP)
        for (const t of batch) await this.d.tasks.update(t.id, { status: 'IN_PROGRESS' }).catch(() => {})
        this.tasksChanged(projectId)
        await Promise.all(batch.map(t => this.runParallelTask(projectId, t)))
        this.tasksChanged(projectId)
        executedAny = true
        continue
      }

      const next = todo[0]
      if (needsRiskGate(policy, next) && next.id !== approvedTaskId) {
        this.patch(projectId, { riskGateTaskId: next.id })
        break
      }
      await this.setTask(projectId, next.id, { status: 'IN_PROGRESS' })
      const result = await this.executeTask(projectId, next)
      executedAny = true
      if (result !== 'done') break
    }
    return false
  }

  private async executeTask(projectId: string, task: AgentTask): Promise<TaskOutcome> {
    const r = this.run(projectId)
    r.state.currentTaskId = task.id
    this.emitState(projectId)
    let prompt = buildTaskPrompt(task)
    for (let attempt = 0; attempt < 2; attempt++) {
      // Sessão própria da tarefa: o lembrete de tag (2ª tentativa) continua a mesma conversa.
      const { text, ok } = await this.sendAndWait(projectId, prompt, taskSession(task.id))
      if (!ok) {
        // Execução não aconteceu ou caiu: volta para Pendente em vez de ficar "Em andamento" parada.
        await this.setTask(projectId, task.id, { status: 'TODO' })
        return 'error'
      }
      // Comando bloqueado aguardando o usuário: a tarefa espera a decisão em vez de gastar o lembrete.
      if (this.hasApprovalFor(task.id)) return 'decision'
      const outcome = await this.handleTag(projectId, task, text)
      if (outcome !== 'none') return outcome
      prompt = REMINDER_PROMPT
    }
    await this.block(projectId, task, 'sem tag de conclusão após lembrete')
    return 'blocked'
  }

  /** Aplica a tag que o Hermes devolveu para uma tarefa sequencial. */
  private async handleTag(projectId: string, task: AgentTask, text: string): Promise<TaskOutcome | 'none'> {
    if (this.hasApprovalFor(task.id)) return 'decision'
    const tag = parseTaskTag(text)
    if (tag.kind === 'done') return this.completeTask(projectId, task)
    if (tag.kind === 'blocked') { await this.block(projectId, task, tag.reason); return 'blocked' }
    if (tag.kind === 'decision') {
      this.patch(projectId, { pendingDecision: { taskId: task.id, question: tag.question, options: tag.options } })
      return 'decision'
    }
    return 'none'
  }

  /** Alterações sem commit numa pasta do projeto (ignora o `.hermes.md`). `null` = não deu para conferir. */
  private async uncommittedIn(projectId: string, dir: string | undefined): Promise<string[] | null> {
    if (!dir) return null
    try {
      const info = await this.d.hermes.getAgentStatus(projectId)
      const s = await this.d.git.status(info.vpsId, dir)
      if (!s.isRepo) return ['(a pasta ainda não é um repositório git com commit)']
      const files = [...s.staged, ...s.unstaged, ...s.untracked].map(f => f.path)
        .filter(p => p !== '.hermes.md' && !p.endsWith('/.hermes.md'))
      return [...new Set(files)]
    } catch { return null }
  }

  /**
   * Tarefa que o Hermes deu como concluída: o NEX confere o repositório. Sobrou alteração sem commit
   * → pede uma vez, na mesma sessão, para testar e commitar; decide pelo estado do repositório depois.
   */
  private async completeTask(projectId: string, task: AgentTask): Promise<TaskOutcome> {
    const markDone = async () => { await this.setTask(projectId, task.id, { status: 'DONE' }); return 'done' as const }
    const workspace = (await this.d.hermes.getAgentStatus(projectId).catch(() => null))?.workspace
    const left = await this.uncommittedIn(projectId, workspace)
    if (left === null || left.length === 0) return markDone()

    this.note(projectId, `[NEX] A tarefa terminou com ${left.length} alteração(ões) sem commit — pedindo ao Hermes para rodar os testes e commitar.`)
    const { text, ok } = await this.sendAndWait(projectId, buildCommitFollowUp(left), taskSession(task.id))
    if (ok) {
      if (this.hasApprovalFor(task.id)) return 'decision'
      const tag = parseTaskTag(text)
      if (tag.kind === 'blocked') { await this.block(projectId, task, tag.reason); return 'blocked' }
      if (tag.kind === 'decision') {
        this.patch(projectId, { pendingDecision: { taskId: task.id, question: tag.question, options: tag.options } })
        return 'decision'
      }
    }
    const after = await this.uncommittedIn(projectId, workspace)
    if (after !== null && after.length === 0) return markDone()
    const still = after ?? left
    await this.block(projectId, task, `concluída sem commit — alterações pendentes: ${still.slice(0, 10).join(', ')}${still.length > 10 ? ` (+${still.length - 10})` : ''}`)
    return 'blocked'
  }

  /**
   * Tarefa isolada num git worktree próprio. One-shot — sem sessão para retomar, então
   * DECISAO_NECESSARIA/tag ausente viram bloqueio para revisão manual.
   */
  private async runParallelTask(projectId: string, task: AgentTask): Promise<TaskOutcome> {
    const r = this.run(projectId)
    let start: { stream: HermesEventStream; worktreePath: string; branch: string }
    try {
      start = await this.d.hermes.startParallelTask(projectId, task.id, buildParallelTaskPrompt(task))
    } catch (e) {
      this.note(projectId, `[erro ao iniciar tarefa paralela "${task.title}"] ${e instanceof Error ? e.message : String(e)}`)
      await this.block(projectId, task, 'falha ao iniciar execução paralela')
      return 'error'
    }
    r.state.parallel = [...r.state.parallel, { taskId: task.id, title: task.title, branch: start.branch }]
    this.emitState(projectId)
    const { text, ok } = await this.wire(projectId, crypto.randomUUID(), start.stream,
      { workspace: start.worktreePath, run: { kind: 'parallel', taskId: task.id }, parallel: true })
    r.state.parallel = r.state.parallel.filter(p => p.taskId !== task.id)
    this.emitState(projectId)

    if (!ok) {
      await this.block(projectId, task, `falha na execução paralela (branch ${start.branch} preservado)`)
      return 'error'
    }
    const tag = parseTaskTag(text)
    // O merge leva só o que foi commitado no worktree e depois o apaga: alteração sem commit sumiria.
    if (tag.kind === 'done') {
      const left = await this.uncommittedIn(projectId, start.worktreePath)
      if (left && left.length > 0) {
        await this.d.hermes.finishParallelTask(projectId, start.worktreePath, start.branch, false).catch(() => {})
        await this.block(projectId, task, `concluída sem commit no worktree ${start.worktreePath} (branch ${start.branch} preservado) — alterações pendentes: ${left.slice(0, 10).join(', ')}`)
        return 'blocked'
      }
    }
    const merge = await this.d.hermes.finishParallelTask(projectId, start.worktreePath, start.branch, tag.kind === 'done')
      .catch(() => ({ merged: false, output: 'erro ao finalizar' }))
    if (tag.kind === 'done') {
      const note = merge.merged ? '' : `\n\n[atenção] merge automático falhou — branch "${start.branch}" preservado para revisão manual.\n${merge.output.slice(0, 500)}`
      await this.setTask(projectId, task.id, { status: 'DONE', description: `${task.description}${note}` })
      return 'done'
    }
    const reason = tag.kind === 'blocked' ? tag.reason
      : tag.kind === 'decision' ? `decisão necessária ("${tag.question}") — não suportado em execução paralela, revise manualmente`
      : 'terminou sem tag de conclusão'
    await this.block(projectId, task, `${reason} (branch ${start.branch})`)
    return 'blocked'
  }

  private async addCorrections(projectId: string, corrections: { title: string; description: string }[]): Promise<void> {
    for (const c of corrections) {
      await this.d.tasks.create({
        title: c.title, description: c.description, projectId, ownerAgent: 'hermes',
        status: 'TODO', parallelizable: false, risk: classifyTaskRisk(c),
      }).catch(() => {})
    }
    this.tasksChanged(projectId)
  }

  /**
   * Fecha a entrega: o Hermes revisa (sessão própria) → o NEX reexecuta build/testes seguros, aplica
   * a DoD e gera o relatório. `auto` (fim do loop no Semi/Autônomo): bloqueio corrigível vira tarefas
   * de correção e volta ao loop — no máximo MAX_DELIVERY_ROUNDS rodadas.
   */
  private reviewInner(projectId: string, auto: boolean): void {
    let loopAfter = false
    this.start(projectId, 'review', async () => {
      const msg = (deliveryMsg: string) => this.patch(projectId, { deliveryMsg })
      msg('O Hermes está revisando código e segurança e rodando build/testes…')
      const info = await this.d.hermes.getAgentStatus(projectId)
      const session = `nex-review-${projectId.replace(/[^A-Za-z0-9_-]/g, '')}-${Date.now()}`.slice(0, 80)
      let { text, ok } = await this.sendAndWait(projectId, buildReviewPrompt(info.objective, info.baseCommit), session)
      if (!ok) { msg('A revisão não terminou — veja a saída ao lado e tente de novo.'); return }
      // JSON ilegível: pede só o JSON corrigido, uma vez, antes de fechar (cada fechamento conta uma rodada).
      const parsed = parseReview(text)
      if (!parsed.parsed) {
        msg('A resposta da revisão veio com o JSON inválido — pedindo ao Hermes que reenvie corrigido…')
        const retry = await this.sendAndWait(projectId, buildJsonFixPrompt(parsed.parseError ?? 'formato inesperado'), session)
        if (retry.ok) ({ text, ok } = retry)
      }
      msg('Conferindo build/testes no servidor e aplicando a Definition of Done…')
      const d = await this.d.hermes.closeDelivery(projectId, text.slice(0, 200_000))
      this.run(projectId).state.deliveryVersion++
      msg('')
      if (auto && d.verdict === 'blocked' && d.corrections.length > 0 && d.round < MAX_DELIVERY_ROUNDS && !this.hasApprovals(projectId)) {
        msg(`Entrega bloqueada — ${d.corrections.length} tarefa(s) de correção criada(s) (rodada ${d.round}/${MAX_DELIVERY_ROUNDS}).`)
        await this.addCorrections(projectId, d.corrections)
        loopAfter = true
      }
    })
    void this.afterIdle(projectId, async () => { if (loopAfter) this.tryLoop(projectId) })
  }
}
