import type { DodItem } from './hermes.types.js'
import { extractJsonObject } from './json-loose.js'

/**
 * Fechamento da entrega de um objetivo Hermes (ETAPAS 9, 24, 27, 40): revisão de código e de
 * segurança feita pelo Hermes, checks de build/testes reexecutados pelo próprio NEX quando o
 * comando é seguro, DoD como gate e relatório final. Módulo puro — sem SSH nem banco — para ser
 * testável; a orquestração fica em HermesService.closeDelivery().
 */

export type CheckResult = 'passed' | 'failed' | 'not_run'
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'
export type FindingCategory = 'security' | 'bug' | 'quality'

export interface ReviewCheck { command: string; result: CheckResult; summary: string }

export interface ReviewFinding {
  severity: FindingSeverity
  category: FindingCategory
  file: string
  title: string
  detail: string
}

export interface HermesReview {
  /** false = o Hermes não devolveu o JSON esperado (a entrega não pode ser aprovada sem evidência). */
  parsed: boolean
  parseError?: string
  build: ReviewCheck
  tests: ReviewCheck
  findings: ReviewFinding[]
  summary: string
}

/** Resultado de um check depois da verificação do NEX. */
export interface VerifiedCheck extends ReviewCheck {
  /** 'nex' = o NEX reexecutou o comando e o resultado é do exit code; 'hermes' = só o que o Hermes informou. */
  source: 'nex' | 'hermes'
  output: string
}

export type DeliveryVerdict = 'approved' | 'approved_with_notes' | 'blocked'

export interface DeliveryResult {
  verdict: DeliveryVerdict
  blockingReasons: string[]
  notes: string[]
  build: VerifiedCheck
  tests: VerifiedCheck
  findings: ReviewFinding[]
  reviewSummary: string
  reviewParsed: boolean
  /** Rodada de fechamento (1 = primeira); limita o ciclo correção → revisão. */
  round: number
  report: string
  /** Tarefas de correção sugeridas (correctionTasks) — o painel cria quando a entrega bloqueia. */
  corrections: { title: string; description: string }[]
  at: string
}

export const MAX_DELIVERY_ROUNDS = 3

const CHECK_RESULTS: CheckResult[] = ['passed', 'failed', 'not_run']
const SEVERITIES: FindingSeverity[] = ['critical', 'high', 'medium', 'low']
const CATEGORIES: FindingCategory[] = ['security', 'bug', 'quality']

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const pick = <T extends string>(v: unknown, allowed: T[], fallback: T): T =>
  (allowed as string[]).includes(v as string) ? (v as T) : fallback

function toCheck(v: unknown): ReviewCheck {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    command: str(o['command'], 300),
    result: pick(o['result'], CHECK_RESULTS, 'not_run'),
    summary: str(o['summary'], 1500),
  }
}

/** Extrai o JSON da revisão (bloco ```json ou o primeiro {...}); tolerante a texto em volta. */
export function parseReview(text: string): HermesReview {
  const empty: HermesReview = {
    parsed: false,
    build: { command: '', result: 'not_run', summary: '' },
    tests: { command: '', result: 'not_run', summary: '' },
    findings: [],
    summary: text.trim().slice(0, 1500),
  }
  const json = extractJsonObject(text)
  if ('error' in json) return { ...empty, parseError: json.error }
  const o = json.value
  const findings = (Array.isArray(o['findings']) ? o['findings'] : [])
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map(f => ({
      severity: pick(f['severity'], SEVERITIES, 'medium'),
      category: pick(f['category'], CATEGORIES, 'quality'),
      file: str(f['file'], 300),
      title: str(f['title'], 200) || 'Achado sem título',
      detail: str(f['detail'], 1500),
    }))
    .slice(0, 50)
  return { parsed: true, build: toCheck(o['build']), tests: toCheck(o['tests']), findings, summary: str(o['summary'], 3000) }
}

// Só comandos de build/teste conhecidos, sem nenhum metacaractere de shell: o NEX reexecuta o
// comando que o Hermes informou, e um texto vindo do modelo nunca pode virar um comando arbitrário.
const SAFE_CHECK_COMMANDS: RegExp[] = [
  /^(?:npm|pnpm|yarn|bun)(?: run)? (?:test|build|typecheck|lint|check)(?::[\w-]+)?$/,
  /^npm test$/,
  /^npx tsc --noEmit(?: -p [\w./-]+)?$/,
  /^(?:python3? -m )?pytest(?: -q)?(?: [\w./-]+)?$/,
  /^go (?:test|build|vet) \.\/\.\.\.$/,
  /^cargo (?:test|build|check)$/,
  /^make (?:test|build|check)$/,
]

export function isSafeCheckCommand(cmd: string): boolean {
  const c = cmd.trim().replace(/\s+/g, ' ')
  if (!c || c.length > 120) return false
  if (/[;&|$`<>(){}\\'"\n\r*?~!#]/.test(c)) return false
  return SAFE_CHECK_COMMANDS.some(r => r.test(c))
}

const CHECK_LABEL: Record<'build' | 'tests', string> = { build: 'Build', tests: 'Testes' }

/** Gate da entrega: só aprova com evidência. */
export function evaluateDelivery(input: {
  dod: DodItem[]
  build: VerifiedCheck
  tests: VerifiedCheck
  findings: ReviewFinding[]
  reviewParsed: boolean
}): { verdict: DeliveryVerdict; blockingReasons: string[]; notes: string[] } {
  const blocking: string[] = []
  const notes: string[] = []

  if (!input.reviewParsed) blocking.push('A revisão do Hermes não voltou no formato esperado — sem evidência para aprovar. Rode a revisão de novo.')

  for (const key of ['build', 'tests'] as const) {
    const c = input[key]
    if (c.result === 'failed') {
      blocking.push(`${CHECK_LABEL[key]} falhou${c.command ? ` (\`${c.command}\`)` : ''}${c.source === 'nex' ? ' — reexecutado pelo NEX' : ''}.`)
    } else if (c.result === 'not_run') {
      notes.push(`${CHECK_LABEL[key]} não foi executado${c.summary ? `: ${c.summary}` : '.'}`)
    } else if (c.source === 'hermes') {
      notes.push(`${CHECK_LABEL[key]} passou segundo o Hermes, mas o NEX não reexecutou (comando fora da lista segura: \`${c.command || '—'}\`).`)
    }
  }

  for (const f of input.findings) {
    const where = f.file ? ` (${f.file})` : ''
    if (f.severity === 'critical' || (f.severity === 'high' && f.category === 'security')) {
      blocking.push(`[${f.severity}/${f.category}] ${f.title}${where}`)
    } else if (f.severity === 'high' || f.severity === 'medium') {
      notes.push(`[${f.severity}/${f.category}] ${f.title}${where}`)
    }
  }

  const pending = input.dod.filter(i => !i.done)
  if (pending.length > 0) blocking.push(`Definition of Done pendente: ${pending.map(i => i.label).join('; ')}.`)

  const verdict: DeliveryVerdict = blocking.length > 0 ? 'blocked' : notes.length > 0 ? 'approved_with_notes' : 'approved'
  return { verdict, blockingReasons: blocking, notes }
}

/** Correções que viram tarefas novas: o que bloqueia e o Hermes consegue resolver (não a DoD manual). */
export function correctionTasks(d: Pick<DeliveryResult, 'build' | 'tests' | 'findings' | 'round'>): { title: string; description: string }[] {
  const tag = `[correção da entrega — rodada ${d.round}]`
  const out: { title: string; description: string }[] = []
  for (const key of ['build', 'tests'] as const) {
    const c = d[key]
    if (c.result === 'failed') {
      out.push({
        title: `Corrigir: ${CHECK_LABEL[key].toLowerCase()} falhando`,
        description: `${tag}\nComando: ${c.command || '(não informado)'}\n${(c.output || c.summary).slice(-1500)}`,
      })
    }
  }
  for (const f of d.findings) {
    if (f.severity === 'critical' || (f.severity === 'high' && f.category === 'security')) {
      out.push({
        title: `Corrigir: ${f.title}`.slice(0, 200),
        description: `${tag}\n[${f.severity}/${f.category}]${f.file ? ` ${f.file}` : ''}\n${f.detail}`,
      })
    }
  }
  return out
}

const VERDICT_LABEL: Record<DeliveryVerdict, string> = {
  approved: 'APROVADA', approved_with_notes: 'APROVADA COM RESSALVAS', blocked: 'BLOQUEADA',
}
const RESULT_LABEL: Record<CheckResult, string> = { passed: 'passou', failed: 'falhou', not_run: 'não executado' }

export function buildDeliveryReport(r: {
  projectName: string
  objective: string
  tasks: { title: string; status: string }[]
  commits: string
  dod: DodItem[]
  result: Omit<DeliveryResult, 'report' | 'corrections'>
}): string {
  const { result: d } = r
  const check = (label: string, c: VerifiedCheck) =>
    `- **${label}:** ${RESULT_LABEL[c.result]}${c.command ? ` — \`${c.command}\`` : ''} · ${c.source === 'nex' ? 'verificado pelo NEX' : 'informado pelo Hermes'}`
  const lines = [
    `# Relatório de entrega — ${r.projectName}`,
    '',
    `**Veredito:** ${VERDICT_LABEL[d.verdict]} · rodada ${d.round} · ${new Date(d.at).toLocaleString('pt-BR')}`,
    '',
    '## Objetivo',
    r.objective.trim() || '(não informado)',
    '',
    `## Tarefas (${r.tasks.filter(t => t.status === 'DONE').length}/${r.tasks.length} concluídas)`,
    ...r.tasks.map(t => `- [${t.status === 'DONE' ? 'x' : ' '}] ${t.title}${t.status !== 'DONE' ? ` (${t.status})` : ''}`),
    '',
    '## Commits',
    r.commits.trim() ? r.commits.trim().split('\n').map(l => `- ${l}`).join('\n') : '(nenhum commit encontrado)',
    '',
    '## Verificações',
    check('Build', d.build),
    check('Testes', d.tests),
    '',
    '## Definition of Done',
    ...r.dod.map(i => `- [${i.done ? 'x' : ' '}] ${i.label}`),
    '',
    '## Revisão de código e segurança',
    d.reviewParsed ? (d.reviewSummary || '(sem resumo)') : '(a revisão não voltou no formato esperado)',
    '',
    ...(d.findings.length
      ? d.findings.map(f => `- **[${f.severity}/${f.category}]** ${f.title}${f.file ? ` — \`${f.file}\`` : ''}${f.detail ? `\n  ${f.detail.replace(/\n/g, '\n  ')}` : ''}`)
      : ['Nenhum achado.']),
  ]
  if (d.blockingReasons.length) lines.push('', '## Motivos do bloqueio', ...d.blockingReasons.map(b => `- ${b}`))
  if (d.notes.length) lines.push('', '## Ressalvas', ...d.notes.map(n => `- ${n}`))
  return lines.join('\n')
}
