import { getPrismaClient } from '@cwm/db'
import type { TerminalService, ExecStream } from '../terminal/terminal.service.js'
import type { SftpService } from '../sftp/sftp.service.js'
import type { GitService } from '../git/git.service.js'
import type { KnowledgeService } from '../knowledge/knowledge.service.js'
import type { ProjectMemoryService } from '../ai/hub/project-memory.js'
import { HermesClient } from './hermes-client.js'
import { runInstall } from './hermes-installer.js'
import type {
  HermesCommandResult, HermesInstanceInfo, HermesInstallResult, HermesStatus,
  HermesProjectAgentInfo, HermesAgentStatus, HermesAutonomyLevel, DodItem, HermesSkillInfo,
} from './hermes.types.js'

function parseSkillFiles(raw: string): HermesSkillInfo[] {
  const chunks = raw.split('@@@FILE:').slice(1)
  const skills: HermesSkillInfo[] = []
  for (const chunk of chunks) {
    const nl = chunk.indexOf('\n')
    if (nl === -1) continue
    const path = chunk.slice(0, nl).trim()
    const body = chunk.slice(nl + 1)
    const frontmatter = body.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? ''
    const get = (key: string) => frontmatter
      .match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'))?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
    const name = get('name') || path.split('/').slice(-2, -1)[0] || 'skill'
    skills.push({ name, description: get('description'), version: get('version') || '—', path })
  }
  return skills
}

const DEFAULT_DOD_ITEMS: DodItem[] = [
  { id: 'build', label: 'Aplicação inicia / build passa sem erro', auto: false, done: false },
  { id: 'requirements', label: 'Requisitos principais implementados', auto: false, done: false },
  { id: 'db', label: 'Banco de dados funcional / migrations válidas', auto: false, done: false },
  { id: 'tests', label: 'Operações principais testadas', auto: false, done: false },
  { id: 'env_example', label: '.env.example existe', auto: true, done: false },
  { id: 'git_commits', label: 'Há commits no repositório', auto: true, done: false },
  { id: 'readme', label: 'README atualizado', auto: false, done: false },
]

export class HermesService {
  private readonly client: HermesClient
  private get db() { return getPrismaClient() }

  constructor(
    private readonly terminal: TerminalService,
    private readonly sftp: SftpService,
    private readonly git: GitService,
    private readonly knowledge: KnowledgeService,
    private readonly memory: ProjectMemoryService,
  ) {
    this.client = new HermesClient(terminal, sftp)
  }

  private toInfo(row: {
    vpsServerId: string; status: string; version: string; installPath: string
    pid: number | null; lastSeen: Date | null; lastError: string
  }): HermesInstanceInfo {
    return {
      vpsServerId: row.vpsServerId,
      status: row.status as HermesStatus,
      version: row.version,
      installPath: row.installPath,
      pid: row.pid,
      lastSeen: row.lastSeen ? row.lastSeen.toISOString() : null,
      lastError: row.lastError,
    }
  }

  private async upsert(vpsId: string, data: Partial<{
    status: HermesStatus; version: string; installPath: string
    pid: number | null; lastSeen: Date; lastError: string
  }>): Promise<HermesInstanceInfo> {
    const row = await this.db.hermesInstance.upsert({
      where: { vpsServerId: vpsId },
      create: { vpsServerId: vpsId, ...data },
      update: data,
    })
    return this.toInfo(row)
  }

  async getStatus(vpsId: string): Promise<HermesInstanceInfo> {
    const existing = await this.db.hermesInstance.findUnique({ where: { vpsServerId: vpsId } })

    try {
      const found = await this.client.detect(vpsId)
      if (!found) {
        return this.upsert(vpsId, { status: 'not_installed', lastSeen: new Date(), lastError: '' })
      }

      const pid = existing?.pid ?? null
      const running = await this.client.isRunning(vpsId, pid)
      const version = await this.client.version(vpsId)
      const installPath = await this.client.installPath(vpsId)

      return this.upsert(vpsId, {
        status: running ? 'running' : 'installed',
        version, installPath, pid: running ? pid : null,
        lastSeen: new Date(), lastError: '',
      })
    } catch (err) {
      return this.upsert(vpsId, {
        status: 'error', lastSeen: new Date(),
        lastError: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async install(vpsId: string): Promise<HermesInstallResult> {
    try {
      const result = await runInstall(this.client, vpsId)
      await this.upsert(vpsId, {
        status: result.success ? 'installed' : 'error',
        version: result.version, installPath: result.installPath,
        lastSeen: new Date(), lastError: result.success ? '' : 'Instalação não confirmou binário hermes no PATH',
      })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.upsert(vpsId, { status: 'error', lastSeen: new Date(), lastError: message })
      return { success: false, output: message, version: 'unknown', installPath: '' }
    }
  }

  async update(vpsId: string): Promise<HermesCommandResult> {
    try {
      const output = await this.client.update(vpsId)
      const version = await this.client.version(vpsId)
      await this.upsert(vpsId, { version, lastSeen: new Date(), lastError: '' })
      return { success: true, output }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.upsert(vpsId, { status: 'error', lastSeen: new Date(), lastError: message })
      return { success: false, output: message }
    }
  }

  async start(vpsId: string): Promise<HermesCommandResult> {
    try {
      const pid = await this.client.startGateway(vpsId)
      if (!pid) {
        await this.upsert(vpsId, { status: 'error', lastError: 'Falha ao obter PID do gateway', lastSeen: new Date() })
        return { success: false, output: 'Não foi possível confirmar o PID do processo hermes gateway.' }
      }
      await this.upsert(vpsId, { status: 'running', pid, lastSeen: new Date(), lastError: '' })
      return { success: true, output: `hermes gateway iniciado (PID ${pid})` }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.upsert(vpsId, { status: 'error', lastSeen: new Date(), lastError: message })
      return { success: false, output: message }
    }
  }

  async stop(vpsId: string): Promise<HermesCommandResult> {
    try {
      const existing = await this.db.hermesInstance.findUnique({ where: { vpsServerId: vpsId } })
      await this.client.stopGateway(vpsId, existing?.pid ?? null)
      await this.upsert(vpsId, { status: 'installed', pid: null, lastSeen: new Date(), lastError: '' })
      return { success: true, output: 'hermes gateway parado.' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: message }
    }
  }

  async restart(vpsId: string): Promise<HermesCommandResult> {
    const stopped = await this.stop(vpsId)
    if (!stopped.success) return stopped
    return this.start(vpsId)
  }

  async execCommand(vpsId: string, args: string): Promise<HermesCommandResult> {
    try {
      const output = await this.client.execCommand(vpsId, args)
      return { success: true, output }
    } catch (err) {
      return { success: false, output: err instanceof Error ? err.message : String(err) }
    }
  }

  async getLogs(vpsId: string, lines = 200): Promise<HermesCommandResult> {
    try {
      const output = await this.client.readLogs(vpsId, lines)
      return { success: true, output }
    } catch (err) {
      return { success: false, output: err instanceof Error ? err.message : String(err) }
    }
  }

  /** Resolve/garante o par (HermesInstance, HermesProjectAgent) de um projeto — sem checagem SSH ao vivo. */
  async getAgentStatus(projectId: string): Promise<HermesProjectAgentInfo> {
    const project = await this.db.project.findUnique({ where: { id: projectId }, include: { vpsServer: true } })
    if (!project) throw new Error(`Projeto não encontrado: ${projectId}`)
    if (!project.vpsServer) throw new Error('Projeto sem VPS associada — configure a VPS do projeto antes de usar o Agent Mode.')

    const instance = await this.db.hermesInstance.upsert({
      where: { vpsServerId: project.vpsServerId },
      create: { vpsServerId: project.vpsServerId },
      update: {},
    })

    const agent = await this.db.hermesProjectAgent.upsert({
      where: { projectId },
      create: { projectId, hermesInstanceId: instance.id, workspace: project.remotePath },
      update: { workspace: project.remotePath, hermesInstanceId: instance.id },
    })

    return {
      projectId,
      vpsId: project.vpsServerId,
      vpsName: project.vpsServer.name,
      workspace: agent.workspace,
      status: agent.status as HermesAgentStatus,
      sessionStarted: agent.sessionStarted,
      lastActivity: agent.lastActivity ? agent.lastActivity.toISOString() : null,
      lastError: agent.lastError,
      hermesStatus: instance.status as HermesStatus,
      objective: agent.objective,
      autonomyLevel: agent.autonomyLevel as HermesAutonomyLevel,
    }
  }

  async setObjective(projectId: string, objective: string): Promise<void> {
    await this.db.hermesProjectAgent.update({ where: { projectId }, data: { objective } })
  }

  async setAutonomyLevel(projectId: string, level: HermesAutonomyLevel): Promise<void> {
    await this.db.hermesProjectAgent.update({ where: { projectId }, data: { autonomyLevel: level } })
  }

  /** Abre o stream de execução do objetivo — quem chama é responsável por consumir os eventos do ExecStream. */
  async streamObjective(projectId: string, objective: string): Promise<{ vpsId: string; stream: ExecStream }> {
    const project = await this.db.project.findUnique({ where: { id: projectId }, include: { vpsServer: true } })
    if (!project) throw new Error(`Projeto não encontrado: ${projectId}`)
    if (!project.vpsServer) throw new Error('Projeto sem VPS associada — configure a VPS do projeto antes de usar o Agent Mode.')

    const instance = await this.db.hermesInstance.findUnique({ where: { vpsServerId: project.vpsServerId } })
    if (!instance || instance.status !== 'running') {
      throw new Error('Hermes não está rodando nesta VPS. Abra a tela Hermes (botão na VPS) e clique em Iniciar antes de enviar um objetivo.')
    }

    const agent = await this.db.hermesProjectAgent.upsert({
      where: { projectId },
      create: { projectId, hermesInstanceId: instance.id, workspace: project.remotePath, status: 'running' },
      update: { workspace: project.remotePath, status: 'running' },
    })

    const stream = await this.client.streamObjective(project.vpsServerId, {
      workspace: project.remotePath,
      objective,
      resume: agent.sessionStarted,
    })

    return { vpsId: project.vpsServerId, stream }
  }

  /**
   * FASE 6 — execução não-assistida: roda um objetivo até o fim sem depender de uma janela do
   * renderer consumindo o stream (usado pelo cron/JobExecutor). Reaproveita `streamObjective`
   * (mesma marcação de status/resume da FASE 2) e bufferiza a saída completa aqui mesmo, com o
   * mesmo watchdog de inatividade (300s) do `wireHermesStream` do handlers.ts, mais um teto duro
   * (padrão 20min) — sem UI para cancelar manualmente, um cron travado não pode rodar pra sempre.
   */
  async runObjectiveUnattended(
    projectId: string, objective: string, opts?: { hardCapMs?: number }
  ): Promise<{ success: boolean; output: string }> {
    const { stream } = await this.streamObjective(projectId, objective)
    const hardCapMs = opts?.hardCapMs ?? 20 * 60_000

    return new Promise((resolve) => {
      let buf = ''
      let hasData = false
      let lastChunkAt = Date.now()
      let settled = false

      const finish = (ok: boolean, lastError?: string) => {
        if (settled) return
        settled = true
        clearInterval(watchdog)
        clearTimeout(hardCap)
        void this.markAgentActivity(projectId, {
          status: ok ? 'idle' : 'error',
          sessionStarted: ok ? true : undefined,
          lastError: lastError ?? '',
        })
        resolve({ success: ok, output: buf || (lastError ?? '') })
      }

      const watchdog = setInterval(() => {
        if (Date.now() - lastChunkAt > 300_000) {
          stream.kill()
          finish(false, 'Timeout: Hermes não respondeu em 300s (execução não-assistida).')
        }
      }, 15_000)
      const hardCap = setTimeout(() => {
        stream.kill()
        finish(hasData, hasData ? undefined : `Execução não-assistida excedeu o limite de ${Math.round(hardCapMs / 60_000)}min.`)
      }, hardCapMs)

      stream.on('data', (chunk: string) => { buf += chunk; hasData = true; lastChunkAt = Date.now() })
      stream.on('close', (code: number | null) => finish(code === 0 || hasData))
      stream.on('error', (err: Error) => finish(false, err.message))
    })
  }

  /**
   * FASE 6 — recovery de sessão interrompida: chamado uma vez no boot do main process. Qualquer
   * `HermesProjectAgent` com status 'running' nesse momento é necessariamente órfão — o processo
   * Electron acabou de (re)iniciar, então nenhum ExecStream anterior pode estar vivo (eram objetos
   * em memória, não sobrevivem a restart). Marca como erro com uma mensagem reconhecível pela UI
   * (`lastError.includes('interrompida')`) para oferecer "Retomar sessão" — o resume funciona porque
   * `sessionStarted` não é tocado aqui, então o próximo streamObjective já usa `--resume latest`.
   * Também devolve ao TODO qualquer tarefa 'hermes' que ficou IN_PROGRESS no meio do loop autônomo.
   */
  async recoverInterruptedSessions(): Promise<number> {
    const stale = await this.db.hermesProjectAgent.findMany({ where: { status: 'running' } })
    if (stale.length === 0) return 0

    await this.db.hermesProjectAgent.updateMany({
      where: { status: 'running' },
      data: {
        status: 'error',
        lastError: 'Sessão interrompida por reinício do NEX-ALS IDE — clique em "Retomar sessão" para continuar de onde parou (usa --resume automaticamente).',
      },
    })

    const now = new Date().toISOString()
    for (const row of stale) {
      await this.db.$executeRawUnsafe(
        `UPDATE agent_tasks SET status='TODO', updatedAt=? WHERE projectId=? AND ownerAgent='hermes' AND status='IN_PROGRESS'`,
        now, row.projectId,
      ).catch(() => { /* agent_tasks pode não existir ainda em instalações muito antigas */ })
    }

    return stale.length
  }

  async markAgentActivity(projectId: string, patch: {
    status: HermesAgentStatus; sessionStarted?: boolean; lastError?: string
  }): Promise<void> {
    await this.db.hermesProjectAgent.update({
      where: { projectId },
      data: {
        status: patch.status,
        ...(patch.sessionStarted !== undefined ? { sessionStarted: patch.sessionStarted } : {}),
        lastError: patch.lastError ?? '',
        lastActivity: new Date(),
      },
    }).catch(() => { /* linha pode não existir se o projeto foi excluído no meio do stream */ })
  }

  async getDodChecklist(projectId: string): Promise<DodItem[]> {
    const agent = await this.db.hermesProjectAgent.findUnique({ where: { projectId } })
    if (!agent) throw new Error(`Agente Hermes não encontrado para o projeto: ${projectId}`)
    let items: DodItem[] = []
    try { items = JSON.parse(agent.dodChecklist) } catch { items = [] }
    if (!Array.isArray(items) || items.length === 0) {
      items = DEFAULT_DOD_ITEMS.map(i => ({ ...i }))
      await this.db.hermesProjectAgent.update({ where: { projectId }, data: { dodChecklist: JSON.stringify(items) } })
    }
    return items
  }

  async toggleDodItem(projectId: string, itemId: string, done: boolean): Promise<DodItem[]> {
    const items = await this.getDodChecklist(projectId)
    const next = items.map(i => i.id === itemId ? { ...i, done } : i)
    await this.db.hermesProjectAgent.update({ where: { projectId }, data: { dodChecklist: JSON.stringify(next) } })
    return next
  }

  /** Roda os itens auto-verificáveis do DoD via SSH direto (sem passar pelo CLI hermes). */
  async runDodAutoChecks(projectId: string): Promise<DodItem[]> {
    const agentRow = await this.db.hermesProjectAgent.findUnique({ where: { projectId } })
    if (!agentRow) throw new Error(`Agente Hermes não encontrado para o projeto: ${projectId}`)
    const project = await this.db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new Error(`Projeto não encontrado: ${projectId}`)

    const items = await this.getDodChecklist(projectId)
    const workspace = agentRow.workspace

    const envCheck = await this.terminal.exec(
      project.vpsServerId,
      `test -f "${workspace}/.env.example" && echo yes || echo no`,
      15000
    ).catch(() => 'no')
    const gitCheck = await this.terminal.exec(
      project.vpsServerId,
      `git -C "${workspace}" log -1 --oneline 2>/dev/null && echo yes || echo no`,
      15000
    ).catch(() => 'no')

    const next = items.map(i => {
      if (i.id === 'env_example') return { ...i, done: envCheck.includes('yes') }
      if (i.id === 'git_commits') return { ...i, done: gitCheck.includes('yes') }
      return i
    })
    await this.db.hermesProjectAgent.update({ where: { projectId }, data: { dodChecklist: JSON.stringify(next) } })
    return next
  }

  /**
   * Inicia uma tarefa em execução paralela: cria um git worktree isolado (gerenciado pelo NEX,
   * não pela flag `-w` do Hermes, que é pouco documentada) e roda o objetivo dentro dele, sem
   * `--resume` (cada worktree é uma execução one-shot, não uma sessão conversacional).
   */
  async startParallelTask(
    projectId: string, taskId: string, objective: string
  ): Promise<{ vpsId: string; stream: ExecStream; worktreePath: string; branch: string }> {
    const project = await this.db.project.findUnique({ where: { id: projectId }, include: { vpsServer: true } })
    if (!project) throw new Error(`Projeto não encontrado: ${projectId}`)
    if (!project.vpsServer) throw new Error('Projeto sem VPS associada — configure a VPS do projeto antes de usar o Agent Mode.')

    const instance = await this.db.hermesInstance.findUnique({ where: { vpsServerId: project.vpsServerId } })
    if (!instance || instance.status !== 'running') {
      throw new Error('Hermes não está rodando nesta VPS. Abra a tela Hermes e clique em Iniciar antes de rodar tarefas em paralelo.')
    }

    const shortId = taskId.slice(0, 8)
    const worktreePath = `${project.remotePath}-worktrees/task-${shortId}`
    const branch = `nex/task-${shortId}`

    await this.git.worktreeAdd(project.vpsServerId, project.remotePath, worktreePath, branch)

    const stream = await this.client.streamObjective(project.vpsServerId, {
      workspace: worktreePath, objective, resume: false,
    })

    return { vpsId: project.vpsServerId, stream, worktreePath, branch }
  }

  /**
   * Finaliza uma tarefa paralela. Só tenta merge se `merge=true` (a tarefa terminou com sucesso);
   * em conflito, nunca força — preserva o worktree/branch para revisão manual do usuário.
   */
  async finishParallelTask(
    projectId: string, worktreePath: string, branch: string, merge: boolean
  ): Promise<{ merged: boolean; output: string }> {
    const project = await this.db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new Error(`Projeto não encontrado: ${projectId}`)
    if (!merge) {
      return { merged: false, output: 'Merge não solicitado — branch e worktree preservados para revisão manual.' }
    }
    const result = await this.git.merge(project.vpsServerId, project.remotePath, branch)
    if (result.success) {
      await this.git.worktreeRemove(project.vpsServerId, project.remotePath, worktreePath).catch(() => {})
    }
    return { merged: result.success, output: result.output }
  }

  /** Lê (só leitura — nunca cria/edita) os SKILL.md instalados na VPS. */
  async getSkills(vpsId: string): Promise<HermesSkillInfo[]> {
    const raw = await this.client.listSkillFiles(vpsId)
    return parseSkillFiles(raw)
  }

  /** Resumo bruto de sessões — formato de saída do CLI não é confirmado pela doc, por isso texto corrido. */
  async getSessionsSummary(vpsId: string): Promise<HermesCommandResult> {
    try {
      const stats = await this.client.execCommand(vpsId, 'sessions stats')
      const list = await this.client.execCommand(vpsId, 'sessions list')
      return { success: true, output: `=== Estatísticas ===\n${stats}\n\n=== Sessões recentes ===\n${list}` }
    } catch (err) {
      return { success: false, output: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * Adapter ETAPA 18: o Hermes já injeta automaticamente `.hermes.md` (entre outros) do diretório
   * do projeto no system prompt — sem flag nenhuma. Este método só escreve o arquivo com o que o
   * NEX já tem (KB Global + memória do projeto); não duplica nada, só disponibiliza.
   */
  async syncProjectContext(projectId: string): Promise<{ written: boolean; path: string }> {
    const project = await this.db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new Error(`Projeto não encontrado: ${projectId}`)

    const kb = await this.knowledge.buildContext().catch(() => '')
    const mem = await this.memory.buildBlock(project.vpsServerId, projectId).catch(() => '')
    const parts = [kb, mem].map(p => p.trim()).filter(Boolean)
    if (parts.length === 0) return { written: false, path: '' }

    const content = [
      '<!-- Gerado automaticamente pelo NEX-ALS IDE — não editar manualmente, será sobrescrito -->',
      '# Contexto do projeto (NEX)',
      '',
      ...parts,
    ].join('\n')

    const path = `${project.remotePath}/.hermes.md`
    const session = await this.sftp.openSession(project.vpsServerId)
    try {
      await session.writeFile(path, content)
    } finally {
      session.destroy()
    }
    return { written: true, path }
  }
}
