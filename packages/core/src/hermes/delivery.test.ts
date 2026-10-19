import { describe, it, expect } from 'vitest'
import {
  parseReview, isSafeCheckCommand, evaluateDelivery, correctionTasks, buildDeliveryReport,
  type VerifiedCheck,
} from './delivery'
import type { DodItem } from './hermes.types'

const ok = (command = 'npm test'): VerifiedCheck => ({ command, result: 'passed', summary: '', source: 'nex', output: '' })
const dodAllDone: DodItem[] = [{ id: 'build', label: 'Build passa', auto: false, done: true }]

describe('parseReview', () => {
  it('lê o JSON dentro de bloco ```json com texto em volta', () => {
    const r = parseReview('Revisei.\n```json\n{"build":{"command":"pnpm build","result":"passed","summary":"ok"},"tests":{"command":"pnpm test","result":"failed","summary":"2 falhas"},"findings":[{"severity":"high","category":"security","file":"src/a.ts","title":"SQL injection","detail":"concatena input"}],"summary":"resumo"}\n```')
    expect(r.parsed).toBe(true)
    expect(r.build).toEqual({ command: 'pnpm build', result: 'passed', summary: 'ok' })
    expect(r.tests.result).toBe('failed')
    expect(r.findings[0]).toMatchObject({ severity: 'high', category: 'security', title: 'SQL injection' })
  })
  it('valores fora do enum caem no padrão seguro', () => {
    const r = parseReview('{"build":{"result":"ok"},"findings":[{"severity":"enorme","title":"x"}]}')
    expect(r.build.result).toBe('not_run')
    expect(r.findings[0].severity).toBe('medium')
  })
  it('texto sem JSON → parsed=false', () => {
    expect(parseReview('não consegui revisar').parsed).toBe(false)
    expect(parseReview('{quebrado').parsed).toBe(false)
  })
})

describe('isSafeCheckCommand', () => {
  it('aceita comandos padrão de build/teste', () => {
    for (const c of ['npm test', 'pnpm build', 'pnpm run typecheck', 'yarn test', 'npm run test:unit', 'npx tsc --noEmit', 'pytest', 'python -m pytest -q', 'go test ./...', 'cargo test', 'make check']) {
      expect(isSafeCheckCommand(c), c).toBe(true)
    }
  })
  it('recusa encadeamento, substituição e comandos fora da lista', () => {
    for (const c of ['npm test && rm -rf /', 'npm test; curl x', 'pnpm build | sh', 'npm test $(id)', 'npm test `id`', 'rm -rf .', 'npm install', 'bash -c "npm test"', 'npm run deploy', '', 'npm test > /etc/passwd']) {
      expect(isSafeCheckCommand(c), c).toBe(false)
    }
  })
})

describe('evaluateDelivery', () => {
  const base = { dod: dodAllDone, build: ok('pnpm build'), tests: ok(), findings: [], reviewParsed: true }
  it('tudo ok → aprovada', () => {
    expect(evaluateDelivery(base).verdict).toBe('approved')
  })
  it('build ou testes falhando → bloqueada', () => {
    expect(evaluateDelivery({ ...base, tests: { ...ok(), result: 'failed' } }).verdict).toBe('blocked')
    expect(evaluateDelivery({ ...base, build: { ...ok(), result: 'failed' } }).verdict).toBe('blocked')
  })
  it('achado crítico ou de segurança alto → bloqueada; alto não-segurança → ressalva', () => {
    const f = (severity: 'critical' | 'high', category: 'security' | 'bug') => [{ severity, category, file: '', title: 't', detail: '' }]
    expect(evaluateDelivery({ ...base, findings: f('critical', 'bug') }).verdict).toBe('blocked')
    expect(evaluateDelivery({ ...base, findings: f('high', 'security') }).verdict).toBe('blocked')
    expect(evaluateDelivery({ ...base, findings: f('high', 'bug') }).verdict).toBe('approved_with_notes')
  })
  it('DoD pendente bloqueia (gate)', () => {
    const r = evaluateDelivery({ ...base, dod: [{ id: 'readme', label: 'README', auto: false, done: false }] })
    expect(r.verdict).toBe('blocked')
    expect(r.blockingReasons.join()).toContain('README')
  })
  it('revisão sem formato bloqueia; testes não executados e check só do Hermes viram ressalva', () => {
    expect(evaluateDelivery({ ...base, reviewParsed: false }).verdict).toBe('blocked')
    expect(evaluateDelivery({ ...base, tests: { ...ok(), result: 'not_run' } }).verdict).toBe('approved_with_notes')
    expect(evaluateDelivery({ ...base, build: { ...ok('./build.sh'), source: 'hermes' } }).verdict).toBe('approved_with_notes')
  })
})

describe('correctionTasks', () => {
  it('gera tarefa para check falho e achado bloqueante, não para ressalva', () => {
    const tasks = correctionTasks({
      round: 2,
      build: ok(), tests: { ...ok(), result: 'failed', output: 'FAIL a.test.ts' },
      findings: [
        { severity: 'high', category: 'security', file: 'a.ts', title: 'Secret no código', detail: 'd' },
        { severity: 'medium', category: 'quality', file: '', title: 'Nome ruim', detail: '' },
      ],
    })
    expect(tasks.map(t => t.title)).toEqual(['Corrigir: testes falhando', 'Corrigir: Secret no código'])
    expect(tasks[0].description).toContain('rodada 2')
  })
})

describe('buildDeliveryReport', () => {
  it('inclui veredito, tarefas, commits, checks e motivos', () => {
    const md = buildDeliveryReport({
      projectName: 'Demo', objective: 'Fazer X',
      tasks: [{ title: 'T1', status: 'DONE' }, { title: 'T2', status: 'BLOCKED' }],
      commits: 'abc123 feat: x', dod: dodAllDone,
      result: {
        verdict: 'blocked', blockingReasons: ['Testes falhou.'], notes: [], build: ok('pnpm build'), tests: { ...ok(), result: 'failed' },
        findings: [], reviewSummary: 'ok', reviewParsed: true, round: 1, at: new Date(0).toISOString(),
      },
    })
    expect(md).toContain('BLOQUEADA')
    expect(md).toContain('- [x] T1')
    expect(md).toContain('- abc123 feat: x')
    expect(md).toContain('verificado pelo NEX')
    expect(md).toContain('## Motivos do bloqueio')
  })
})
