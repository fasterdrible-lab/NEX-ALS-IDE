import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { HermesAgentRunner, type RunnerDeps, type RunnerEvent } from './agent-runner.js'
import type { AgentTask } from '../tasks/tasks.service.js'

/** Stream falso do Hermes: emite o texto (e eventos), depois `result` + close. */
class FakeStream extends EventEmitter {
  result: { ok: boolean; error: string } | null = null
  strayOutput = ''
  kill(): void { /* nada */ }
}

type Reply = { text: string; blocked?: { command: string } }

function setup(replies: (prompt: string) => Reply, level: 'manual' | 'semi' | 'autonomous' = 'autonomous') {
  const tasks: AgentTask[] = []
  const prompts: string[] = []
  const events: RunnerEvent[] = []
  const now = new Date().toISOString()
  const deps = {
    hermes: {
      getAgentStatus: async () => ({ autonomyLevel: level, vpsId: 'v', workspace: '/w', objective: 'obj', baseCommit: '' }),
      isRunningOnVps: async () => false,
      markAgentActivity: async () => {},
      setObjective: async () => {},
      syncProjectContext: async () => ({ written: false, path: '' }),
      stopRunsOnVps: async () => 0,
      runApprovedCommand: async () => ({ success: true, output: 'ok' }),
      getDelivery: async () => null,
      closeDelivery: async () => ({ verdict: 'approved', corrections: [], round: 1 }),
      streamObjective: async (_p: string, prompt: string) => {
        prompts.push(prompt)
        const s = new FakeStream()
        const r = replies(prompt)
        setTimeout(() => {
          if (r.blocked) s.emit('event', { kind: 'blocked', tool: 'terminal', command: r.blocked.command, reason: 'perigoso' })
          s.emit('data', r.text)
          s.result = { ok: true, error: '' }
          s.emit('close', 0)
        }, 5)
        return { vpsId: 'v', stream: s }
      },
    },
    runLog: { start: () => 'run', appendText: () => {}, appendActivity: () => {}, finish: () => {} },
    tasks: {
      list: async () => tasks.map(t => ({ ...t })),
      create: async (i: Partial<AgentTask>) => {
        const t = { id: `t${tasks.length + 1}`, title: i.title ?? '', description: i.description ?? '', status: i.status ?? 'TODO',
          ownerAgent: 'hermes', priority: 'medium', projectId: 'p', sessionId: null, parallelizable: false, risk: i.risk ?? 'low',
          createdAt: now, updatedAt: now } as AgentTask
        tasks.push(t); return t
      },
      update: async (id: string, patch: Partial<AgentTask>) => { const t = tasks.find(x => x.id === id)!; Object.assign(t, patch); return t },
    },
    git: { status: async () => ({ branch: 'main', ahead: 0, behind: 0, isRepo: true, staged: [], unstaged: [], untracked: [] }) },
    emit: (e: RunnerEvent) => { events.push(e) },
  } as unknown as RunnerDeps
  return { runner: new HermesAgentRunner(deps), tasks, prompts, events }
}

async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout esperando condição')
    await new Promise(r => setTimeout(r, 10))
  }
}

describe('HermesAgentRunner', () => {
  it('plano → loop executa todas as tarefas e fecha a entrega sozinho (Autônomo)', async () => {
    const { runner, tasks, prompts } = setup(p =>
      p.includes('gere a lista de tarefas')
        ? { text: '```json\n[{"title":"A"},{"title":"B"}]\n```' }
        : p.includes('REVISÃO DE FECHAMENTO') ? { text: '{"build":{},"tests":{},"findings":[],"summary":"ok"}' }
        : { text: 'feito [TAREFA_CONCLUIDA]' })
    runner.startObjective('p', 'fazer algo')
    await waitFor(() => prompts.some(p => p.includes('REVISÃO DE FECHAMENTO')) && runner.snapshot('p').state.mode === 'idle')
    expect(tasks.map(t => t.status)).toEqual(['DONE', 'DONE'])
    expect(runner.snapshot('p').output).toContain('[TAREFA_CONCLUIDA]')
  })

  it('comando bloqueado para o loop; Negar avisa o Hermes e a tarefa termina', async () => {
    let first = true
    const { runner, tasks, prompts } = setup(p => {
      if (first && p.startsWith('Tarefa:')) { first = false; return { text: 'preciso rodar isso', blocked: { command: 'rm -rf build' } } }
      return { text: 'ok [TAREFA_CONCLUIDA]' }
    })
    await (runner as unknown as { d: RunnerDeps }).d.tasks.create({ title: 'A', projectId: 'p', ownerAgent: 'hermes', status: 'TODO' })
    runner.runLoop('p')
    await waitFor(() => runner.snapshot('p').state.approvals.length === 1 && runner.snapshot('p').state.mode === 'idle')
    expect(tasks[0].status).toBe('IN_PROGRESS')

    runner.resolveApproval(runner.snapshot('p').state.approvals[0].id, false)
    await waitFor(() => tasks[0].status === 'DONE' && runner.snapshot('p').state.mode === 'idle')
    expect(prompts.some(p => p.includes('NEGOU o comando bloqueado: `rm -rf build`'))).toBe(true)
    expect(runner.snapshot('p').state.approvals).toHaveLength(0)
  })

  it('Parar termina a tarefa atual e não começa a próxima', async () => {
    const { runner, tasks } = setup(() => ({ text: 'ok [TAREFA_CONCLUIDA]' }))
    const d = (runner as unknown as { d: RunnerDeps }).d
    await d.tasks.create({ title: 'A', projectId: 'p', ownerAgent: 'hermes', status: 'TODO' })
    await d.tasks.create({ title: 'B', projectId: 'p', ownerAgent: 'hermes', status: 'TODO' })
    runner.runLoop('p')
    runner.stop('p')
    await waitFor(() => runner.snapshot('p').state.mode === 'idle')
    expect(tasks.map(t => t.status)).toEqual(['TODO', 'TODO'])
  })

  it('uma operação por projeto', () => {
    const { runner } = setup(() => ({ text: 'x' }))
    runner.sendMessage('p', 'oi')
    expect(() => runner.sendMessage('p', 'de novo')).toThrow(/em andamento/)
  })
})
