import { describe, it, expect } from 'vitest'
import {
  encryptPassword, decryptPassword,
  VpsServerSchema, ProjectSchema, ClaudeAccountSchema, SettingsSchema, projectLocationError, projectWorkspaceMode, LocalProjectCreateSchema,
  HermesAutonomyLevelSchema, HermesDevRulesSchema, HERMES_DEV_RULES_MAX,
  isUnderRemotePath, ProjectEnvironmentSchema, GitBranchSchema, SmokeUrlSchema,
} from './index'

describe('HermesAutonomyLevelSchema', () => {
  it('aceita os 3 níveis', () => {
    for (const l of ['manual', 'semi', 'autonomous']) expect(HermesAutonomyLevelSchema.parse(l)).toBe(l)
  })
  it('rejeita valor fora do enum', () => {
    expect(HermesAutonomyLevelSchema.safeParse('yolo').success).toBe(false)
  })
})

describe('HermesDevRulesSchema', () => {
  it('aceita texto vazio e texto no limite', () => {
    expect(HermesDevRulesSchema.safeParse('').success).toBe(true)
    expect(HermesDevRulesSchema.safeParse('x'.repeat(HERMES_DEV_RULES_MAX)).success).toBe(true)
  })
  it('rejeita acima do limite e não-string', () => {
    expect(HermesDevRulesSchema.safeParse('x'.repeat(HERMES_DEV_RULES_MAX + 1)).success).toBe(false)
    expect(HermesDevRulesSchema.safeParse(42).success).toBe(false)
  })
})

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

  it('accepts a local-only project (Project First)', () => {
    const r = ProjectSchema.safeParse({ name: 'Projeto', localPath: 'C:\\Users\\me\\OneDrive\\Projeto' })
    expect(r.success).toBe(true)
  })

  it('accepts local + VPS (hybrid)', () => {
    const r = ProjectSchema.safeParse({ name: 'P', localPath: 'C:/p', remotePath: '/root/p', vpsServerId: 'v1' })
    expect(r.success && projectWorkspaceMode(r.data)).toBe('hybrid')
  })

  it('rejects a project with neither local folder nor VPS', () => {
    expect(ProjectSchema.safeParse({ name: 'Projeto' }).success).toBe(false)
  })

  it('rejects relative local paths and remote paths without /', () => {
    expect(ProjectSchema.safeParse({ name: 'P', localPath: '..\\outro' }).success).toBe(false)
    expect(ProjectSchema.safeParse({ name: 'P', remotePath: 'root/p', vpsServerId: 'v1' }).success).toBe(false)
  })
})

describe('LocalProjectCreateSchema (Fase 2)', () => {
  it('accepts the three modes', () => {
    expect(LocalProjectCreateSchema.safeParse({ mode: 'new', parent: 'C:\\Users\\me\\OneDrive', name: 'app' }).success).toBe(true)
    expect(LocalProjectCreateSchema.safeParse({ mode: 'clone', parent: 'C:/x', url: 'https://github.com/a/b.git' }).success).toBe(true)
    expect(LocalProjectCreateSchema.safeParse({ mode: 'clone', parent: 'C:/x', url: 'git@github.com:a/b.git' }).success).toBe(true)
    expect(LocalProjectCreateSchema.safeParse({ mode: 'existing', folder: 'D:\\code\\app' }).success).toBe(true)
  })

  it('rejects dangerous clone URLs and relative folders', () => {
    for (const url of ['--upload-pack=calc', 'ext::sh -c calc', 'file:///C:/x', 'http://github.com/a/b', 'https://github.com/a/b;calc']) {
      expect(LocalProjectCreateSchema.safeParse({ mode: 'clone', parent: 'C:/x', url }).success).toBe(false)
    }
    expect(LocalProjectCreateSchema.safeParse({ mode: 'existing', folder: '..\\fora' }).success).toBe(false)
  })
})

describe('projectLocationError / projectWorkspaceMode', () => {
  it('explains what is missing', () => {
    expect(projectLocationError({ vpsServerId: 'v1' })).toMatch(/caminho/)
    expect(projectLocationError({ remotePath: '/root/p' })).toMatch(/VPS/)
    expect(projectLocationError({ localPath: 'C:/p' })).toBeNull()
  })

  it('classifies local and remote', () => {
    expect(projectWorkspaceMode({ localPath: 'C:/p', vpsServerId: null })).toBe('local')
    expect(projectWorkspaceMode({ localPath: '', vpsServerId: 'v1' })).toBe('remote')
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

describe('Ambientes (Fase 4b)', () => {
  it('isUnderRemotePath: dentro, igual e fora', () => {
    expect(isUnderRemotePath('/srv/app', '/srv/app')).toBe(true)
    expect(isUnderRemotePath('/srv/app/src/x.ts', '/srv/app/')).toBe(true)
    expect(isUnderRemotePath('/srv/app-copia/x', '/srv/app')).toBe(false)
    expect(isUnderRemotePath('/srv/outro', '/srv/app')).toBe(false)
  })
  it('isUnderRemotePath: resolve .. antes de comparar (não escapa da proteção)', () => {
    expect(isUnderRemotePath('/srv/outro/../app/x', '/srv/app')).toBe(true)
    expect(isUnderRemotePath('/srv/app/../outro', '/srv/app')).toBe(false)
    expect(isUnderRemotePath('//srv//app//x', '/srv/app')).toBe(true)
    expect(isUnderRemotePath('app/x', '/srv/app')).toBe(false)
  })
  it('pasta do ambiente: absoluta, sem .., sem aspas/espaço, não a raiz', () => {
    const base = { projectId: 'p', kind: 'staging', vpsServerId: 'v' }
    expect(ProjectEnvironmentSchema.safeParse({ ...base, remotePath: '/srv/app' }).success).toBe(true)
    for (const remotePath of ['/', 'srv/app', '/srv/../etc', "/srv/a'b", '/srv/a b', '/srv/$(x)']) {
      expect(ProjectEnvironmentSchema.safeParse({ ...base, remotePath }).success, remotePath).toBe(false)
    }
  })
  it('branch e URL do smoke test', () => {
    for (const b of ['main', 'release/1.2', 'feat_x-y']) expect(GitBranchSchema.safeParse(b).success, b).toBe(true)
    for (const b of ['-x', 'a..b', 'a b', 'a;rm', 'x.lock', 'a/']) expect(GitBranchSchema.safeParse(b).success, b).toBe(false)
    for (const u of ['', 'https://x.com/health', 'http://10.0.0.1:3000/']) expect(SmokeUrlSchema.safeParse(u).success, u).toBe(true)
    for (const u of ['ftp://x', 'https://x.com/"a', 'javascript:alert(1)']) expect(SmokeUrlSchema.safeParse(u).success, u).toBe(false)
  })
})
