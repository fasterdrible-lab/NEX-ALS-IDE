import { describe, it, expect } from 'vitest'
import {
  encryptPassword, decryptPassword,
  VpsServerSchema, ProjectSchema, ClaudeAccountSchema, SettingsSchema,
} from './index'

describe('encryptPassword / decryptPassword', () => {
  it('round-trips a plain password', () => {
    const plain = 'minha-senha-segura'
    expect(decryptPassword(encryptPassword(plain))).toBe(plain)
  })

  it('produces different ciphertext on each call (random IV)', () => {
    const p = 'abc123'
    expect(encryptPassword(p)).not.toBe(encryptPassword(p))
  })

  it('returns empty string for invalid ciphertext', () => {
    expect(decryptPassword('invalido')).toBe('')
  })
})

describe('VpsServerSchema', () => {
  it('accepts valid VPS data', () => {
    const result = VpsServerSchema.safeParse({
      name: 'VPS-1', host: '1.2.3.4', port: 22, username: 'root',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = VpsServerSchema.safeParse({ name: '', host: '1.2.3.4', port: 22, username: 'root' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid port', () => {
    const result = VpsServerSchema.safeParse({ name: 'v', host: '1.2.3.4', port: 99999, username: 'root' })
    expect(result.success).toBe(false)
  })

  it('defaults port to 22', () => {
    const result = VpsServerSchema.safeParse({ name: 'v', host: 'h', username: 'u' })
    expect(result.success && result.data.port).toBe(22)
  })
})

describe('ProjectSchema', () => {
  it('accepts valid project', () => {
    const r = ProjectSchema.safeParse({ name: 'Projeto', remotePath: '/var/www', vpsServerId: 'v1' })
    expect(r.success).toBe(true)
  })

  it('rejects missing remotePath', () => {
    const r = ProjectSchema.safeParse({ name: 'Projeto', vpsServerId: 'v1' })
    expect(r.success).toBe(false)
  })

  it('rejects missing vpsServerId', () => {
    const r = ProjectSchema.safeParse({ name: 'Projeto', remotePath: '/var/www' })
    expect(r.success).toBe(false)
  })
})

describe('ClaudeAccountSchema', () => {
  it('accepts valid account', () => {
    const r = ClaudeAccountSchema.safeParse({ name: 'Conta A' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const r = ClaudeAccountSchema.safeParse({ name: 'Conta A', email: 'nao-e-email' })
    expect(r.success).toBe(false)
  })
})

describe('SettingsSchema', () => {
  it('defaults vscodePath to "code"', () => {
    const r = SettingsSchema.safeParse({})
    expect(r.success && r.data.vscodePath).toBe('code')
  })
})
