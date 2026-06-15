import { KnowledgeService } from '../knowledge/knowledge.service.js'
import { SkillsService } from '../skills/skills.service.js'
import { TasksService } from '../tasks/tasks.service.js'

export interface ContextBuildOptions {
  query?: string
  maxChars?: number
}

export interface BuiltContext {
  text: string
  knowledgeCount: number
  skillCount: number
}

export class ContextBuilder {
  private knowledge = new KnowledgeService()
  private skills = new SkillsService()
  private tasks = new TasksService()

  async build(opts: ContextBuildOptions = {}): Promise<BuiltContext> {
    const { query = '', maxChars = 12_000 } = opts
    const parts: string[] = []
    let knowledgeCount = 0
    let skillCount = 0

    // P1: KB — quando há query, busca só entradas relevantes via FTS5;
    //          fallback para todas as ativas se a busca retornar vazio.
    if (query.trim()) {
      const relevant = await this.knowledge.search(query, 8).catch(() => [])
      if (relevant.length > 0) {
        parts.push(this.knowledge.buildContextFromEntries(relevant))
        knowledgeCount = relevant.length
      } else {
        const kbText = await this.knowledge.buildContext().catch(() => '')
        if (kbText) { parts.push(kbText); knowledgeCount = 1 }
      }
    } else {
      const kbText = await this.knowledge.buildContext().catch(() => '')
      if (kbText) { parts.push(kbText); knowledgeCount = 1 }
    }

    // P2: Skills matched by query triggers
    const matchedSkills = query
      ? await this.skills.matchTriggers(query).catch(() => [])
      : []

    if (matchedSkills.length > 0) {
      parts.push(this.skills.buildContext(matchedSkills))
      skillCount = matchedSkills.length
    }

    // P3: Pending tasks (TODO + IN_PROGRESS + BLOCKED)
    const pendingTasks = await this.tasks.listActive().catch(() => [])
    if (pendingTasks.length > 0) {
      parts.push(this.tasks.buildContext(pendingTasks))
    }

    let text = parts.join('\n\n').trim()

    // Truncate to budget
    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + '\n\n[...contexto truncado por limite de tokens]'
    }

    return { text, knowledgeCount, skillCount }
  }
}
