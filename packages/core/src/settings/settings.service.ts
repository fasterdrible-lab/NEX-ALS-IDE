import { getPrismaClient } from '@cwm/db'
import { SettingsSchema, type SettingsInput } from '@cwm/config'

const SINGLETON_ID = 'default'

export class SettingsService {
  private get db() {
    return getPrismaClient()
  }

  async get() {
    const existing = await this.db.settings.findUnique({ where: { id: SINGLETON_ID } })
    if (existing) return existing

    return this.db.settings.create({
      data: {
        id: SINGLETON_ID,
        vscodePath: 'code',
        vscodeInsidersPath: 'code-insiders',
        sshKeyPath: '',
      },
    })
  }

  async update(input: Partial<SettingsInput>) {
    const data = SettingsSchema.partial().parse(input)
    return this.db.settings.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: { id: SINGLETON_ID, ...data },
    })
  }
}
