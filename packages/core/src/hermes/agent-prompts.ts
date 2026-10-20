import { classifyTaskRisk, type AutonomyTaskRisk } from '@cwm/config'

/**
 * Protocolo do loop de tarefas do Hermes (FASE 3+): prompts que o NEX envia e leitura das tags
 * que o Hermes devolve. Funções puras — testadas em agent-prompts.test.ts; quem orquestra é o
 * HermesAgentRunner (main process). Antes viviam no painel (HermesAgentPanel.tsx).
 */

export type TaskTag =
  | { kind: 'done' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'decision'; question: string; options: string[] }
  | { kind: 'none' }

export function parseTaskTag(text: string): TaskTag {
  if (/\[TAREFA_CONCLUIDA\]/i.test(text)) return { kind: 'done' }
  const blocked = text.match(/\[TAREFA_BLOQUEADA:?\s*([^\]]*)\]/i)
  if (blocked) return { kind: 'blocked', reason: (blocked[1] || '').trim() || 'motivo não informado' }
  const decision = text.match(/\[DECISAO_NECESSARIA([^\]]*)\]/i)
  if (decision) {
    const params: Record<string, string> = {}
    const pr = /(\w+)="([^"]*)"/g
    let pm: RegExpExecArray | null
    while ((pm = pr.exec(decision[1])) !== null) params[pm[1]] = pm[2]
    const options = (params['opcoes'] ?? '').split('|').map(s => s.trim()).filter(Boolean)
    return { kind: 'decision', question: params['pergunta'] ?? 'Decisão necessária', options }
  }
  return { kind: 'none' }
}

export interface PlannedTask { title: string; description: string; parallelizable: boolean; risk: AutonomyTaskRisk }

export function parseTaskPlan(text: string): PlannedTask[] {
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : (text.match(/\[[\s\S]*\]/)?.[0] ?? null)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const tasks = parsed
          .filter((p): p is { title: string; description?: string; parallelizable?: unknown; risk?: unknown } =>
            !!p && typeof p === 'object' && typeof (p as { title?: unknown }).title === 'string')
          .map(p => {
            const t = { title: p.title, description: typeof p.description === 'string' ? p.description : '' }
            return { ...t, parallelizable: p.parallelizable === true, risk: classifyTaskRisk(t, p.risk) }
          })
        if (tasks.length > 0) return tasks
      }
    } catch { /* cai no fallback abaixo */ }
  }
  const whole = { title: 'Objetivo completo', description: text.slice(0, 2000) }
  return [{ ...whole, parallelizable: false, risk: classifyTaskRisk(whole) }]
}

export function buildPlanPrompt(objective: string): string {
  return `Antes de implementar, gere a lista de tarefas para o seguinte objetivo:\n\n${objective}\n\n`
    + 'Responda APENAS com um bloco ```json contendo um array no formato '
    + '[{"title":"...","description":"...","parallelizable":true|false,"risk":"low|medium|high"}], sem nenhum texto antes ou depois do bloco. '
    + 'Marque "parallelizable":true apenas para tarefas que podem rodar ao mesmo tempo que outras sem conflito '
    + '(ex.: arquivos/módulos diferentes, sem depender do resultado de outra tarefa). Na dúvida, use false. '
    + 'Marque "risk":"high" para tarefas que mexem em deploy/produção, migração ou remoção de dados, secrets/credenciais, '
    + 'pagamentos ou infraestrutura do servidor; "medium" para autenticação, banco de dados, dependências ou CI; '
    + '"low" para o resto. Na dúvida, escolha o risco maior.'
}

/**
 * Revisão de fechamento da entrega (ETAPAS 24/27): código + segurança, build e testes, sem alterar
 * nada. Os comandos informados precisam ser simples para o NEX conseguir reexecutá-los e conferir
 * o resultado pelo exit code (lista segura em delivery.ts).
 */
export function buildReviewPrompt(objective: string, baseCommit: string): string {
  const range = baseCommit ? `git diff ${baseCommit}..HEAD (e git log ${baseCommit}..HEAD)` : 'o histórico e o código atual do repositório'
  return [
    'Faça a REVISÃO DE FECHAMENTO da entrega deste objetivo. NÃO altere, crie nem apague arquivos e NÃO faça commit — só leia e rode verificações.',
    '',
    `Objetivo: ${objective || '(ver histórico do repositório)'}`,
    '',
    `1. Leia as alterações do objetivo: ${range}.`,
    '2. Rode o build e os testes padrão do projeto, se existirem. Use o comando simples do projeto, sem && | ; nem redirecionamento',
    '   (ex.: npm test, pnpm build, pnpm run typecheck, pytest, go test ./..., cargo test, make test). Se não houver, use result "not_run".',
    '3. Revise o código: bugs, tratamento de erro, validação de entrada.',
    '4. Revise a segurança: secrets/credenciais no código, injeção (SQL, comando, path), autenticação/autorização, dados sensíveis em log, dependências perigosas.',
    '',
    'Responda APENAS com um bloco ```json neste formato, sem texto antes ou depois:',
    '{"build":{"command":"...","result":"passed|failed|not_run","summary":"..."},',
    ' "tests":{"command":"...","result":"passed|failed|not_run","summary":"..."},',
    ' "findings":[{"severity":"critical|high|medium|low","category":"security|bug|quality","file":"caminho","title":"...","detail":"..."}],',
    ' "summary":"resumo da revisão em 2 a 5 frases"}',
    'Use "critical" só para o que quebra a aplicação ou expõe dados; seja objetivo, sem achados genéricos.',
  ].join('\n')
}

/** `git add -A` sem .gitignore levaria node_modules/.env para o histórico — a conferência de commit não pode empurrar isso. */
export const GITIGNORE_RULE = 'Antes do commit, garanta um .gitignore com node_modules/, dist/, .next/, .env e .env.local: nunca commite dependências instaladas, saída de build nem .env.'

export function buildTaskPrompt(task: { title: string; description: string }): string {
  return [
    `Tarefa: ${task.title}`,
    task.description,
    '',
    'Instruções de finalização (obrigatório):',
    '- Rode os testes do projeto (se existirem) e só faça o commit com eles passando; se falharem, corrija antes.',
    `- ${GITIGNORE_RULE}`,
    // ETAPA 25 do brief — commits frequentes, um por tarefa, para cada entrega ficar no histórico.
    '- Antes de marcar como concluída, faça um commit git com tudo desta tarefa: git add -A && git commit -m "<tipo>(<escopo>): <descrição>"',
    '  O NEX confere o repositório depois: tarefa com alteração sem commit não é dada como concluída.',
    '  (tipo: feat, fix, refactor, test, docs, chore). Se o diretório ainda não for um repositório, rode git init antes.',
    '  Nunca faça push, reset --hard nem force — só commits locais.',
    '- Sucesso → termine sua resposta com a tag: [TAREFA_CONCLUIDA]',
    '- Bloqueio técnico real → termine com: [TAREFA_BLOQUEADA: <motivo>]',
    '- Decisão de negócio que você não pode inferir sozinho → termine com: [DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]',
    'Decida sozinho qualquer decisão técnica razoável — use DECISAO_NECESSARIA apenas para decisão de negócio real.',
  ].filter(Boolean).join('\n')
}

export function buildParallelTaskPrompt(task: { title: string; description: string }): string {
  return buildTaskPrompt(task)
    + '\n\nVocê está trabalhando num git worktree isolado desta tarefa — o commit é o que o NEX mergeia de volta, '
    + 'então nenhuma alteração pode ficar fora dele.'
}

/**
 * Sessão do Hermes de uma tarefa do loop (`-c nex-task-<id> --create-if-missing`). Cada tarefa
 * começa com histórico curto em vez de herdar a conversa do projeto inteiro; o contexto entre
 * tarefas vem do repositório (código + commits) e do `.hermes.md`. Só [A-Za-z0-9_-].
 */
export const taskSession = (taskId: string) => `nex-task-${taskId.replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 80)

/** Hermes disse que terminou, mas o repositório tem alteração sem commit: pede (uma vez) testar e commitar. */
export function buildCommitFollowUp(files: string[]): string {
  return [
    'Você marcou a tarefa como concluída, mas o NEX conferiu o repositório e ainda há alterações sem commit:',
    ...files.slice(0, 15).map(f => `- ${f}`),
    files.length > 15 ? `- (+${files.length - 15} arquivo(s))` : '',
    '',
    'Faça agora, nesta ordem:',
    '1. Rode os testes do projeto (se existirem). Se falharem, corrija até passarem.',
    `   ${GITIGNORE_RULE} Se algum arquivo da lista acima for gerado (dependências, build, .env), ele deve ser ignorado, não commitado.`,
    '2. Faça o commit de tudo desta tarefa: git add -A && git commit -m "<tipo>(<escopo>): <descrição>". Se a pasta não for um repositório git, rode git init antes.',
    '3. Termine com [TAREFA_CONCLUIDA]. Se não for possível commitar com os testes passando, termine com [TAREFA_BLOQUEADA: motivo].',
    'Nunca faça push, reset --hard nem force.',
  ].filter(Boolean).join('\n')
}

export const REMINDER_PROMPT = 'Você não incluiu nenhuma tag obrigatória. Termine AGORA com [TAREFA_CONCLUIDA], '
  + '[TAREFA_BLOQUEADA: motivo] ou [DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]. Não repita o trabalho, apenas finalize com a tag correta.'

export const RESUME_PROMPT = 'Continue de onde você parou. Revise o estado atual do workspace (git status/diff) antes de prosseguir.'

export function buildApprovalFollowUp(command: string, r: { executed: boolean; success: boolean; output: string }): string {
  if (!r.executed) {
    return `O usuário NEGOU o comando bloqueado: \`${command}\`. Não tente contorná-lo por outro caminho `
      + '(outro comando, script ou ferramenta com o mesmo efeito). Siga sem ele; se for indispensável, finalize com '
      + '[TAREFA_BLOQUEADA: motivo] ou [DECISAO_NECESSARIA pergunta="..." opcoes="A|B"].'
  }
  return `O usuário AUTORIZOU e o NEX executou por você o comando que estava bloqueado: \`${command}\`\n`
    + `Resultado (${r.success ? 'sucesso' : 'falhou'}):\n${r.output.slice(-3000)}\n\nContinue a partir daqui.`
}
