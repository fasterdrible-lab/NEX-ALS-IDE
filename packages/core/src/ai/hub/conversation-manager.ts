import { getPrismaClient } from '@cwm/db'
import { randomUUID } from 'node:crypto'

export interface Conversation {
  id: string
  title: string
  provider: string
  model: string
  vpsId: string | null
  projectId: string | null
  isPinned: boolean
  totalTokens: number
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'tool'
  content: string  // JSON serializado para suportar multimodal e tool results
  toolCallId: string | null
  createdAt: string
}

type ConvRow = {
  id: string; title: string; provider: string; model: string
  vpsId: string | null; projectId: string | null
  isPinned: number | bigint; totalTokens: number | bigint
  createdAt: string; updatedAt: string
}
type MsgRow = {
  id: string; conversationId: string; role: string; content: string
  toolCallId: string | null; createdAt: string
}

function toConv(r: ConvRow): Conversation {
  return { ...r, isPinned: r.isPinned === 1 || r.isPinned === 1n, totalTokens: Number(r.totalTokens) }
}

export class ConversationManager {
  private get db() { return getPrismaClient() }

  async create(data: Pick<Conversation, 'provider' | 'model'> & Partial<Pick<Conversation, 'title' | 'vpsId' | 'projectId'>>): Promise<Conversation> {
    const id = randomUUID()
    const title = data.title ?? 'Nova conversa'
    await this.db.$executeRawUnsafe(
      `INSERT INTO ai_conversations (id, title, provider, model, vpsId, projectId) VALUES (?, ?, ?, ?, ?, ?)`,
      id, title, data.provider, data.model, data.vpsId ?? null, data.projectId ?? null
    )
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ai_conversations WHERE id = ?`, id) as ConvRow[]
    return toConv(rows[0])
  }

  async list(limit = 50): Promise<Conversation[]> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT * FROM ai_conversations ORDER BY isPinned DESC, updatedAt DESC LIMIT ?`, limit
    ) as ConvRow[]
    return rows.map(toConv)
  }

  async get(id: string): Promise<Conversation | null> {
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ai_conversations WHERE id = ?`, id) as ConvRow[]
    return rows.length ? toConv(rows[0]) : null
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await this.db.$executeRawUnsafe(
      `UPDATE ai_conversations SET title = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, title, id
    )
  }

  async togglePin(id: string): Promise<void> {
    await this.db.$executeRawUnsafe(
      `UPDATE ai_conversations SET isPinned = CASE WHEN isPinned = 1 THEN 0 ELSE 1 END, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, id
    )
  }

  async delete(id: string): Promise<void> {
    await this.db.$executeRawUnsafe(`DELETE FROM ai_conversations WHERE id = ?`, id)
  }

  async addTokens(id: string, tokens: number): Promise<void> {
    await this.db.$executeRawUnsafe(
      `UPDATE ai_conversations SET totalTokens = totalTokens + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, tokens, id
    )
  }

  // ── Mensagens ────────────────────────────────────────────────────────────

  async addMessage(data: Pick<Message, 'conversationId' | 'role' | 'content'> & Partial<Pick<Message, 'toolCallId'>>): Promise<Message> {
    const id = randomUUID()
    await this.db.$executeRawUnsafe(
      `INSERT INTO ai_messages (id, conversationId, role, content, toolCallId) VALUES (?, ?, ?, ?, ?)`,
      id, data.conversationId, data.role, data.content, data.toolCallId ?? null
    )
    // Atualiza updatedAt da conversa
    await this.db.$executeRawUnsafe(
      `UPDATE ai_conversations SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, data.conversationId
    )
    const rows = await this.db.$queryRawUnsafe(`SELECT * FROM ai_messages WHERE id = ?`, id) as MsgRow[]
    return rows[0] as Message
  }

  async getMessages(conversationId: string, limit = 200): Promise<Message[]> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT * FROM ai_messages WHERE conversationId = ? ORDER BY createdAt ASC LIMIT ?`,
      conversationId, limit
    ) as MsgRow[]
    return rows as Message[]
  }
}
