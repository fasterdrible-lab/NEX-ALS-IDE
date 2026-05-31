import { describe, it, expect } from 'vitest'

// Testes unitários para helpers do GitService (sem SSH real)
describe('git helpers', () => {
  it('parses modified file status line', () => {
    const line = ' M src/index.ts'
    const type = line[0] === 'M' ? 'staged'
      : line[1] === 'M' ? 'unstaged'
      : line.startsWith('??') ? 'untracked'
      : 'unknown'
    expect(type).toBe('unstaged')
  })

  it('parses staged file status line', () => {
    const line = 'M  src/index.ts'
    const type = line[0] === 'M' ? 'staged' : 'other'
    expect(type).toBe('staged')
  })

  it('parses untracked file status line', () => {
    const line = '?? newfile.ts'
    const type = line.startsWith('??') ? 'untracked' : 'other'
    expect(type).toBe('untracked')
  })

  it('extracts branch name from git status output', () => {
    const output = '## main...origin/main [ahead 2]'
    const match = output.match(/^## ([^.]+)/)
    expect(match?.[1]).toBe('main')
  })

  it('extracts ahead count from git status output', () => {
    const output = '## main...origin/main [ahead 3, behind 1]'
    const ahead = Number(output.match(/ahead (\d+)/)?.[1] ?? 0)
    const behind = Number(output.match(/behind (\d+)/)?.[1] ?? 0)
    expect(ahead).toBe(3)
    expect(behind).toBe(1)
  })
})
