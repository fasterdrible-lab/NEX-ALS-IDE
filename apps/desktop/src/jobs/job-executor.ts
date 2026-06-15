import { Notification } from 'electron'
import {
  AiService, ContextBuilder, ScheduledJobsService,
  AGENTS, type AgentName, type ScheduledJob,
} from '@cwm/core'

export class JobExecutor {
  private readonly jobsSvc = new ScheduledJobsService()
  private readonly aiSvc = new AiService()
  private readonly ctxBuilder = new ContextBuilder()
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly running = new Set<string>()

  start(): void {
    void this.checkDueJobs()
    this.timer = setInterval(() => { void this.checkDueJobs() }, 60_000)
    console.log('[JobExecutor] iniciado — verificando jobs a cada 60s')
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  async runNow(jobId: string): Promise<string> {
    const job = await this.jobsSvc.get(jobId)
    if (!job) throw new Error('Job não encontrado')
    if (this.running.has(jobId)) throw new Error('Job já em execução')
    this.running.add(jobId)
    try {
      const result = await this.executeJob(job)
      await this.jobsSvc.markRan(jobId, result)
      return result
    } finally {
      this.running.delete(jobId)
    }
  }

  private async checkDueJobs(): Promise<void> {
    const due = await this.jobsSvc.getDue().catch(() => [])
    for (const job of due) {
      if (this.running.has(job.id)) continue
      this.running.add(job.id)
      // Advance nextRunAt immediately to prevent double-execution on slow runs
      await this.jobsSvc.markRan(job.id, undefined).catch(() => {})
      this.executeJob(job)
        .then(result => this.jobsSvc.markRan(job.id, result))
        .catch(err => {
          console.error(`[JobExecutor] Falha no job "${job.title}":`, err)
          this.jobsSvc.markRan(job.id, `Erro: ${(err as Error).message}`).catch(() => {})
        })
        .finally(() => this.running.delete(job.id))
    }
  }

  private async executeJob(job: ScheduledJob): Promise<string> {
    const agentName = (job.agentName as AgentName) in AGENTS ? job.agentName as AgentName : 'jarvis'
    const agentCfg = AGENTS[agentName]

    const ctxResult = await this.ctxBuilder.build({ query: job.instruction, maxChars: 4000 }).catch(() => ({ text: '' }))
    const systemPrompt = ctxResult.text
      ? `${agentCfg.systemPrompt}\n\n${ctxResult.text}`
      : agentCfg.systemPrompt

    const res = await this.aiSvc.chatAgent({
      provider: agentCfg.preferredProvider,
      messages: [{ role: 'user', content: job.instruction }],
      systemPrompt,
      tools: [],
      maxTokens: 1024,
    })

    const text = res.type === 'text' ? res.content : (res.text ?? '')

    try {
      new Notification({
        title: `⚙ ${job.title}`,
        body: text.slice(0, 150) || '(sem resposta)',
      }).show()
    } catch { /* Notification não disponível */ }

    return text
  }
}
