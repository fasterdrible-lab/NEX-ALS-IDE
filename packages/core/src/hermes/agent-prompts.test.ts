import { describe, expect, it } from 'vitest'
import { parseTaskPlan, parseTaskTag, taskSession, buildApprovalFollowUp } from './agent-prompts.js'

describe('parseTaskTag', () => {
  it('reconhece concluída, bloqueada e decisão', () => {
    expect(parseTaskTag('feito.\n[TAREFA_CONCLUIDA]')).toEqual({ kind: 'done' })
    expect(parseTaskTag('[TAREFA_BLOQUEADA: falta a chave da API]')).toEqual({ kind: 'blocked', reason: 'falta a chave da API' })
    expect(parseTaskTag('[TAREFA_BLOQUEADA]')).toEqual({ kind: 'blocked', reason: 'motivo não informado' })
    expect(parseTaskTag('[DECISAO_NECESSARIA pergunta="Qual banco?" opcoes="Postgres|SQLite"]'))
      .toEqual({ kind: 'decision', question: 'Qual banco?', options: ['Postgres', 'SQLite'] })
    expect(parseTaskTag('sem tag')).toEqual({ kind: 'none' })
  })
})

describe('parseTaskPlan', () => {
  it('lê o JSON do plano e aplica o risco detectado quando o declarado é menor', () => {
    const plan = parseTaskPlan('```json\n[{"title":"Fazer o deploy em produção","description":"","risk":"low"},{"title":"Tela de login","parallelizable":true}]\n```')
    expect(plan).toHaveLength(2)
    expect(plan[0].risk).toBe('high')
    expect(plan[1]).toMatchObject({ parallelizable: true, risk: 'medium' })
  })

  it('JSON inválido vira uma tarefa única com o texto', () => {
    const plan = parseTaskPlan('não consegui gerar o plano')
    expect(plan).toHaveLength(1)
    expect(plan[0].title).toBe('Objetivo completo')
  })
})

describe('taskSession / buildApprovalFollowUp', () => {
  it('nome de sessão só com caracteres aceitos pelo main', () => {
    expect(taskSession('abc-123_x')).toBe('nex-task-abc-123_x')
    expect(taskSession('a b;c')).toBe('nex-task-abc')
  })

  it('recusa avisa para não contornar; autorização leva o resultado', () => {
    expect(buildApprovalFollowUp('rm -rf x', { executed: false, success: false, output: '' })).toContain('NEGOU')
    expect(buildApprovalFollowUp('npm i', { executed: true, success: true, output: 'ok' })).toContain('Resultado (sucesso)')
  })
})
