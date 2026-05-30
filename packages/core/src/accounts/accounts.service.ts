import { getPrismaClient } from '@cwm/db'
import { ClaudeAccountSchema, type ClaudeAccountInput } from '@cwm/config'

export class AccountsService {
  private get db() {
    return getPrismaClient()
  }

  async list() {
    return this.db.claudeAccount.findMany({
      orderBy: { createdAt: 'asc' },
      include: { vpsServer: true },
    })
  }

  async findById(id: string) {
    const account = await this.db.claudeAccount.findUnique({
      where: { id },
      include: { vpsServer: true },
    })
    if (!account) throw new Error(`Conta não encontrada: ${id}`)
    return account
  }

  async create(input: ClaudeAccountInput) {
    const data = ClaudeAccountSchema.parse(input)
    return this.db.claudeAccount.create({
      data,
      include: { vpsServer: true },
    })
  }

  async update(id: string, input: Partial<ClaudeAccountInput>) {
    await this.findById(id)
    const data = ClaudeAccountSchema.partial().parse(input)
    return this.db.claudeAccount.update({
      where: { id },
      data,
      include: { vpsServer: true },
    })
  }

  async delete(id: string) {
    await this.findById(id)
    return this.db.claudeAccount.delete({ where: { id } })
  }
}
