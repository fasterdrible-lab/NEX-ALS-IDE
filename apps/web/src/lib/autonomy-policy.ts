import type { HermesAutonomyLevel } from './ipc'

/**
 * Rótulos dos níveis de autonomia do Hermes para a tela. Quem DECIDE (avançar, parar em risco
 * alto, paralelo, classificar risco) é o loop no main, com a política de
 * packages/config/src/autonomy-policy.ts — mantenha os dois iguais. Cópia porque o renderer não
 * importa valores do @cwm/config (CommonJS, e o index puxa node:crypto).
 */
export interface AutonomyPolicy {
  level: HermesAutonomyLevel
  label: string
  description: string
  autoAdvance: boolean
  gateHighRisk: boolean
  allowParallel: boolean
}

export const AUTONOMY_POLICIES: Record<HermesAutonomyLevel, AutonomyPolicy> = {
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

export const AUTONOMY_LEVELS: HermesAutonomyLevel[] = ['manual', 'semi', 'autonomous']

/** Nível desconhecido (banco antigo/corrompido) cai no mais restritivo. */
export function getAutonomyPolicy(level: string | null | undefined): AutonomyPolicy {
  return AUTONOMY_POLICIES[level as HermesAutonomyLevel] ?? AUTONOMY_POLICIES.manual
}
