import { getPrismaClient } from '@cwm/db'
import { KnowledgeEntrySchema, type KnowledgeEntry, type KnowledgeEntryInput } from '@cwm/config'

export class KnowledgeService {
  private get db() { return getPrismaClient() }

  async list(): Promise<KnowledgeEntry[]> {
    return this.db.knowledgeEntry.findMany({ orderBy: { updatedAt: 'desc' } }) as Promise<KnowledgeEntry[]>
  }

  async listActive(): Promise<KnowledgeEntry[]> {
    return this.db.knowledgeEntry.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    }) as Promise<KnowledgeEntry[]>
  }

  async create(input: KnowledgeEntryInput): Promise<KnowledgeEntry> {
    const data = KnowledgeEntrySchema.parse(input)
    return this.db.knowledgeEntry.create({ data }) as Promise<KnowledgeEntry>
  }

  async update(id: string, input: Partial<KnowledgeEntryInput>): Promise<KnowledgeEntry> {
    const data = KnowledgeEntrySchema.partial().parse(input)
    return this.db.knowledgeEntry.update({ where: { id }, data }) as Promise<KnowledgeEntry>
  }

  async delete(id: string): Promise<void> {
    await this.db.knowledgeEntry.delete({ where: { id } })
  }

  async buildContext(): Promise<string> {
    const entries = await this.listActive()
    if (entries.length === 0) return ''

    const byCategory = new Map<string, KnowledgeEntry[]>()
    for (const e of entries) {
      const list = byCategory.get(e.category) ?? []
      list.push(e)
      byCategory.set(e.category, list)
    }

    const lines: string[] = ['## BASE DE CONHECIMENTO DO DESENVOLVEDOR\n']
    for (const [cat, items] of byCategory) {
      lines.push(`### ${cat.toUpperCase()}`)
      for (const item of items) {
        const tagStr = item.tags ? ` [${item.tags}]` : ''
        lines.push(`**${item.title}**${tagStr}`)
        lines.push(item.content)
        lines.push('')
      }
    }
    return lines.join('\n')
  }
}
