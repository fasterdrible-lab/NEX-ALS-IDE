import { describe, it, expect } from 'vitest'
import { parsePorcelain, explainGitError } from './local-git.service'

describe('parsePorcelain', () => {
  it('separa preparados, não preparados e novos', () => {
    const r = parsePorcelain(['M  a.ts', ' M b.ts', 'MM c.ts', '?? novo.txt', 'A  d.ts', ' D e.ts', ''].join('\n'))
    expect(r.staged.map(f => f.path)).toEqual(['a.ts', 'c.ts', 'd.ts'])
    expect(r.unstaged.map(f => `${f.status}:${f.path}`)).toEqual(['M:b.ts', 'M:c.ts', 'D:e.ts'])
    expect(r.untracked.map(f => f.path)).toEqual(['novo.txt'])
  })
  it('renomeado fica com o nome novo; nome com espaço/acentos sem aspas', () => {
    const r = parsePorcelain(['R  velho.ts -> novo.ts', '?? "pasta com espaço/ação.md"'].join('\n'))
    expect(r.staged[0]).toEqual({ path: 'novo.ts', status: 'R', type: 'staged' })
    expect(r.untracked[0]?.path).toBe('pasta com espaço/ação.md')
  })
  it('pasta aberta dentro do repo: só o que está nela, relativo a ela', () => {
    const r = parsePorcelain(['?? app/src/x.ts', ' M outro/y.ts', 'M  app/z.ts'].join('\r\n'), 'app/')
    expect(r.untracked.map(f => f.path)).toEqual(['src/x.ts'])
    expect(r.staged.map(f => f.path)).toEqual(['z.ts'])
    expect(r.unstaged).toEqual([])
  })
})

describe('explainGitError', () => {
  it('traduz os casos que pedem ação do usuário', () => {
    expect(explainGitError('*** Please tell me who you are.')).toMatch(/user.name/)
    expect(explainGitError('fatal: The current branch main has no upstream branch.\n    git push --set-upstream origin main')).toBe(
      'O branch ainda não existe no remoto. Rode uma vez no terminal: git push -u origin main')
    expect(explainGitError('fatal: No configured push destination.')).toMatch(/não tem remoto/)
    expect(explainGitError('fatal: could not read Username for \'https://github.com\': terminal prompts disabled')).toMatch(/login/)
  })
  it('o resto passa como veio', () => {
    expect(explainGitError('error: algo diferente')).toBe('error: algo diferente')
  })
})
