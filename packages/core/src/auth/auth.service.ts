import { getPrismaClient } from '@cwm/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export type UserRole = 'admin' | 'viewer'

export interface AppUser {
  id: string
  username: string
  role: UserRole
  createdAt: string
}

const SALT_ROUNDS = 12

export class AuthService {
  private db = getPrismaClient()

  async countUsers(): Promise<number> {
    const rows = await (this.db.$queryRawUnsafe(
      'SELECT COUNT(*) as n FROM app_users'
    ) as Promise<{ n: number }[]>)
    return Number(rows[0]?.n ?? 0)
  }

  async createUser(username: string, password: string, role: UserRole = 'viewer'): Promise<AppUser> {
    const trimmed = username.trim().toLowerCase()
    if (!trimmed) throw new Error('Username não pode ser vazio')
    if (password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres')

    const existing = await (this.db.$queryRawUnsafe(
      'SELECT id FROM app_users WHERE username = ?', trimmed
    ) as Promise<{ id: string }[]>)
    if (existing.length > 0) throw new Error(`Usuário "${trimmed}" já existe`)

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const id = randomUUID()
    const now = new Date().toISOString()

    await this.db.$executeRawUnsafe(
      'INSERT INTO app_users (id, username, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      id, trimmed, passwordHash, role, now, now
    )
    return { id, username: trimmed, role, createdAt: now }
  }

  async validatePassword(username: string, password: string): Promise<AppUser | null> {
    const rows = await (this.db.$queryRawUnsafe(
      'SELECT id, username, passwordHash, role, createdAt FROM app_users WHERE username = ?',
      username.trim().toLowerCase()
    ) as Promise<{ id: string; username: string; passwordHash: string; role: UserRole; createdAt: string }[]>)

    if (rows.length === 0) return null
    const user = rows[0]
    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) return null
    return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt }
  }

  async listUsers(): Promise<AppUser[]> {
    const rows = await (this.db.$queryRawUnsafe(
      'SELECT id, username, role, createdAt FROM app_users ORDER BY createdAt ASC'
    ) as Promise<AppUser[]>)
    return rows
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.$executeRawUnsafe('DELETE FROM app_users WHERE id = ?', id)
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres')
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    const now = new Date().toISOString()
    await this.db.$executeRawUnsafe(
      'UPDATE app_users SET passwordHash = ?, updatedAt = ? WHERE id = ?',
      hash, now, id
    )
  }
}
