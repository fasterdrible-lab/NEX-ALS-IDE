import { describe, it, expect } from 'vitest'
import { runKindFromSession } from './run-log'

describe('runKindFromSession', () => {
  it('sessão de tarefa do loop → kind task com o id da tarefa', () => {
    expect(runKindFromSession('nex-task-1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'))
      .toEqual({ kind: 'task', taskId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed' })
  })
  it('sessão de revisão → review sem tarefa', () => {
    expect(runKindFromSession('nex-review-abc-1792371461977')).toEqual({ kind: 'review', taskId: null })
  })
  it('sem sessão nomeada (plano, mensagem livre) → project', () => {
    expect(runKindFromSession(undefined)).toEqual({ kind: 'project', taskId: null })
    expect(runKindFromSession('outra')).toEqual({ kind: 'project', taskId: null })
  })
})
