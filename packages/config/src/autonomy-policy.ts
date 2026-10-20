/**
 * AutonomyPolicy (ETAPAS 22/23) — o que o loop de tarefas do Hermes pode fazer sozinho em cada
 * nível. Em todos os níveis os comandos perigosos continuam passando por Autorizar/Negar (o NEX
 * nunca liga `--yolo`); a política só decide quando o loop avança sem o usuário.
 * Compartilhado: o loop (core, main process) decide com ela; o painel (renderer) mostra os rótulos.
 */

export type AutonomyLevel = 'manual' | 'semi' | 'autonomous'
export type AutonomyTaskRisk = 'low' | 'medium' | 'high'

export interface AutonomyPolicy {
  level: AutonomyLevel
  label: string
  description: string
  /** O loop passa para a próxima tarefa sozinho. */
  autoAdvance: boolean
  /** Para antes de uma tarefa de risco alto e espera o usuário liberar. */
  gateHighRisk: boolean
  /** Pode rodar tarefas paralelizáveis em worktrees. */
  allowParallel: boolean
}

export const AUTONOMY_POLICIES: Record<AutonomyLevel, AutonomyPolicy> = {
  manual: {
    level: 'manual', label: 'Assistido',
    description: 'Você libera cada tarefa com "Próxima".',
    autoAdvance: false, gateHighRisk: false, allowParallel: false,
  },
  semi: {
    level: 'semi', label: 'Semi-autônomo',
    description: 'Avança sozinho, mas para antes de tarefa de risco alto até você liberar.',
    autoAdvance: true, gateHighRisk: true, allowParallel: true,
  },
  autonomous: {
    level: 'autonomous', label: 'Autônomo',
    description: 'Avança por todas as tarefas sozinho.',
    autoAdvance: true, gateHighRisk: false, allowParallel: true,
  },
}

export const AUTONOMY_LEVELS: AutonomyLevel[] = ['manual', 'semi', 'autonomous']

/** Nível desconhecido (banco antigo/corrompido) cai no mais restritivo. */
export function getAutonomyPolicy(level: string | null | undefined): AutonomyPolicy {
  return AUTONOMY_POLICIES[level as AutonomyLevel] ?? AUTONOMY_POLICIES.manual
}

// Rede de segurança determinística: o Hermes declara o risco no plano, mas um modelo barato pode
// subestimar. O risco final é o maior entre o declarado e o detectado no texto da tarefa.
const HIGH_RISK = [
  /\bdeploy/i, /produ[cç][aã]o|\bproduction\b|\bprod\b/i,
  /migra(?:[cç][aã]o|r|tion)\b.*(?:banco|dados|database|schema)|\bmigrations?\b/i,
  /\bdrop\b|\btruncate\b/i,
  /(?:apagar|deletar|excluir|remover|limpar)\s+(?:os\s+|as\s+|o\s+|a\s+)?(?:dados|tabelas?|banco|registros|usu[aá]rios|arquivos)/i,
  /credencia|\bsecrets?\b|\.env\b|chave\s+(?:ssh|privada|de\s+api)|\bapi[\s_-]?keys?\b/i,
  /pagamento|\bpayments?\b|\bbilling\b|cobran[cç]a|\bstripe\b/i,
  /\bnginx\b|\bsystemd\b|\bdns\b|\bssl\b|certificado|firewall|iptables|\bufw\b/i,
  /\bbackup\b|\brestore\b|restaura[cç][aã]o/i,
]
const MEDIUM_RISK = [
  /autentica|\bauth\b|\blogin\b|\bsenhas?\b|\bpasswords?\b|\bjwt\b|\btokens?\b|permiss/i,
  /banco de dados|\bdatabase\b|\bschema\b|\bprisma\b|\bsql\b/i,
  /\bdocker\b|\bci\b|\bpipeline\b/i,
  /depend[eê]ncias?|\bupgrade\b|atualizar\s+vers/i,
]

const RANK: Record<AutonomyTaskRisk, number> = { low: 0, medium: 1, high: 2 }

export function toTaskRisk(v: unknown): AutonomyTaskRisk {
  return v === 'medium' || v === 'high' ? v : 'low'
}

export function classifyTaskRisk(task: { title: string; description: string }, declared?: unknown): AutonomyTaskRisk {
  const text = `${task.title}\n${task.description}`
  const detected: AutonomyTaskRisk = HIGH_RISK.some(r => r.test(text)) ? 'high'
    : MEDIUM_RISK.some(r => r.test(text)) ? 'medium' : 'low'
  const d = toTaskRisk(declared)
  return RANK[d] >= RANK[detected] ? d : detected
}

/** A tarefa precisa ser liberada pelo usuário antes de o loop executá-la? */
export function needsRiskGate(policy: AutonomyPolicy, task: { risk: AutonomyTaskRisk }): boolean {
  return policy.gateHighRisk && task.risk === 'high'
}
