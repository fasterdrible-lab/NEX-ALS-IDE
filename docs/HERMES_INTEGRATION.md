# HERMES_INTEGRATION.md — NEX-ALS IDE × Hermes Agent

**Versão do documento:** cobre até a FASE 6 (v3.57.0)
**Repositório do Hermes Agent:** https://github.com/nousresearch/hermes-agent

Este documento é vivo — cresce a cada fase implementada. Ele complementa (não substitui) `docs/ARCHITECTURE.md`, que tem a seção técnica "Hermes Manager" com os detalhes de módulos/IPC/banco.

## Objetivo do "Autonomous Development"

Permitir que o usuário descreva uma ideia de software em linguagem natural e o sistema a desenvolva de forma majoritariamente autônoma — requisitos, arquitetura, plano, código, banco, testes, correção de erros — interrompendo o usuário apenas para decisões realmente importantes.

## Por que Hermes, e por que não duplicar o Squad

O NEX já tem um agent loop caseiro (Squad, 22 agentes, Pipeline autônomo). O Hermes Agent (Nous Research) é um runtime agentic externo com skills autônomas, memória persistente entre sessões e subagentes — capacidades que o Squad não tem hoje. Em vez de reconstruir isso em TypeScript dentro do Electron, o NEX trata o Hermes como um **runtime externo gerenciado via SSH**, mantendo:

- **Chat Mode** → AI Hub atual (inalterado)
- **Agent Mode** → Hermes rodando na VPS, gerenciado pelo NEX

Nenhum dos dois agent loops chama o outro. O NEX nunca reinterpreta as decisões do Hermes — ele só governa (SSH, segurança, aprovação de ações perigosas, UI).

## Fato real sobre o Hermes Agent (levantado do README do repositório)

- **Instalação:** `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash` (Linux/macOS/WSL2/Termux); PowerShell installer separado para Windows nativo (não relevante aqui — o alvo é sempre a VPS Linux)
- **Runtime:** Python 3.11 + Node.js, gerenciado via `uv`; config em `~/.hermes/`
- **CLI:** `hermes` (chat interativo), `hermes model`, `hermes tools`, `hermes gateway` (mensageria — Telegram/Discord/Slack/WhatsApp/Signal/Email), `hermes setup` (wizard interativo), `hermes update`, `hermes config get/set`
- **Sem HTTP API própria por padrão** — não há porta de bridge ainda
- **Conceitos internos:** Skills (memória procedural autoaprimorável), Memory (perfis persistentes, busca FTS5, Honcho), Cron (scheduler embutido), Subagents (isolados, paralelos), MCP (ferramentas externas)
- **Modo headless confirmado na FASE 2** — `hermes -z` / `hermes chat -q`, ver seção própria abaixo

## Fato real sobre o CLI `hermes` — modo headless (pesquisado em `docs/reference/cli-commands` e `docs/user-guide/cli` para a FASE 2)

- **`hermes -z "prompt"`** — "the purest one-shot entry point: single prompt in, final response text out, nothing else on stdout or stderr." Equivalente direto ao `claude -p`.
- **`hermes chat -q "prompt"`** — one-shot que inclui a saída de tools no transcript (usado pelo NEX — melhor para activity feed do que `-z`, que só devolve a resposta final).
- **`-Q`/`--quiet`** — modo programático, suprime banners/spinners.
- **`-m`/`--model`, `--provider`** — override por execução.
- **`--resume latest --in <dir>` / `hermes -w`** — retoma a sessão mais recente de um diretório de trabalho; `-w` roda em git worktree isolado, mas **não usado pelo NEX** (ver "Fato real — subagentes e `-w`" abaixo, pesquisado para a FASE 4).
- **`hermes sessions list` / `hermes sessions rename`** — gestão de sessões; persistência em `~/.hermes/state.db` (SQLite + FTS5).
- **ACP (stdio/JSON-RPC)** — adaptador existe na arquitetura (usado por VS Code/Zed/JetBrains), daria eventos estruturados em vez de texto puro, mas a página de docs específica retornou **404** no momento da pesquisa — não é base confiável ainda. Revisitar na fase 7.

## Fato real — subagentes e `-w` (pesquisado em `docs/reference/cli-commands` para a FASE 4)

- **Não existe API externa para "spawn de subagente".** A busca por "subagents"/"subagent" na referência de comandos não retornou nenhuma seção ou flag — é confirmado que subagentes são uma capacidade **interna** da `AIAgent`, invocada pelo próprio Hermes quando ele julga útil, sem controle externo do NEX.
- **`-w`/`--worktree`** existe: "Start in an isolated git worktree for parallel-agent workflows." Mas a documentação **não diz**: onde o worktree é criado em disco, se cada invocação cria um novo ou reaproveita, como nomear, como fazer merge de volta, nem se é seguro rodar múltiplas invocações `-w` concorrentes contra o mesmo repositório.
- **Decisão:** o NEX não usa `-w`. Ele cria e gerencia os worktrees ele mesmo com `git worktree add`/`merge`/`worktree remove` — comandos git padrão, 100% documentados, sob controle total do NEX (path e branch determinísticos, merge nunca forçado). O Hermes roda dentro do worktree já preparado sem saber que está em um — para ele é só um diretório comum. Ver `docs/ARCHITECTURE.md` → "Hermes Execução Paralela (FASE 4)" para o fluxo completo.

## Fato real — skills, sessões e auto-injeção de contexto (pesquisado em `docs/reference/cli-commands`, `docs/user-guide/features/skills`, `docs/user-guide/configuration` para a FASE 5)

Ao contrário das fases 3/4, aqui a pesquisa confirmou uma base sólida e documentada — nenhuma decisão de contorno foi necessária.

- **`hermes skills list`** é um comando externo real (além de `browse`/`search`/`install`/`inspect`/`check`/`update`/`audit`/`uninstall`/`config`). Skills vivem em `~/.hermes/skills/<categoria>/<nome>/SKILL.md` — markdown com frontmatter YAML documentado (`name`, `description`, `version`, restrição de plataforma opcional). Criadas automaticamente pelo próprio Hermes via `skill_manage` após tarefas complexas — a "aprendizado procedural" da ETAPA 20 do brief já acontece sozinha.
- **`hermes sessions list/stats/export/rename/prune/archive/optimize/repair/recover`** — gestão real de sessões, `~/.hermes/state.db` (SQLite+FTS5). `export` produz JSONL.
- **`hermes memory` (`setup`/`status`/`off`)** configura *provedores externos* de memória (Honcho/mem0/etc.) — não é um browser de conteúdo de memória. Não é o que a ETAPA 18 pede.
- **Auto-injeção de contexto:** o Hermes carrega automaticamente `SOUL.md`, `.hermes.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules` do diretório do projeto (e de `~/.hermes/`) para dentro do system prompt — **sem nenhuma flag**. Essa é exatamente a "ponte" que a ETAPA 18 pede; não precisou ser inventada, só aproveitada — ver `docs/ARCHITECTURE.md` → "Hermes Memory + Skills (FASE 5)".

## Roadmap de fases

| Fase | Escopo | Status |
|---|---|---|
| **1 — Base** | HermesManager: detectar/instalar/atualizar/status/iniciar/parar/reiniciar/exec/logs; model Prisma `HermesInstance`; IPC `hermes:*`; UI básica (`HermesPage.tsx`) | ✅ v3.52.0 |
| **2 — Agent Mode** | Toggle Chat/Agent no AI Hub, envio de objetivo, streaming, status, activity feed | ✅ v3.53.0 |
| **3 — Autonomous Loop** | Task planning (JSON), loop manual/autônomo, Definition of Done (checklist), decision requests | ✅ v3.54.0 |
| **4 — Execução Paralela** | Não é "spawn de subagente" (não existe API externa) — execução paralela real via git worktrees gerenciados pelo NEX, ownership por isolamento de worktree, painel de agentes ativos | ✅ v3.55.0 |
| **5 — Memory + Skills** | Visibilidade só-leitura de skills (`SKILL.md`) e sessões; adapter de contexto NEX→Hermes via `.hermes.md` (auto-injetado pelo Hermes, sem flag) | ✅ v3.56.0 |
| **6 — Automação** | Cron (`scheduled_jobs`+`projectId`), execução não-assistida (`runObjectiveUnattended`), recovery de sessão interrompida (`recoverInterruptedSessions`) | ✅ v3.57.0 |
| 7 — Monitoramento | Integração com `NotificationMonitor`, incident diagnostics, auto-repair seguro | ⏳ pendente |

## FASE 1 — o que foi entregue

Ver seção "Hermes Manager" em `docs/ARCHITECTURE.md` para o detalhamento técnico completo (módulos, banco, IPC, UI). Resumo funcional:

- Detectar se o Hermes está instalado numa VPS e qual a versão
- Instalar via o installer oficial (`install.sh`), com log completo retornado à UI
- Atualizar (`hermes update`)
- Iniciar/Parar/Reiniciar o processo `hermes gateway` em background (PID file, sem depender de systemd)
- Executar qualquer subcomando `hermes <args>` (ex.: `setup`, `model`, `tools`, `config get provider`) e ver a saída
- Ver os últimos logs do gateway

## Segurança e autonomia (FASE 1)

- `install`/`update`/`start`/`stop`/`restart`/`exec` exigem `requireAdmin` (mesmo nível de `vps:create`) — não passam pelo modal "CONFIRMO" reservado a ações destrutivas/irreversíveis, porque nenhuma delas é: instalar software num diretório do próprio usuário na VPS, ou matar um processo que o próprio NEX iniciou.
- Nenhum secret novo é armazenado pelo NEX. O Hermes configura seus próprios providers de LLM (Nous Portal/OpenAI/OpenRouter/custom) via `hermes setup`/`hermes config set` **dentro da própria VPS** — o mesmo padrão já usado para o Claude Code (autenticação acontece na VPS, o NEX nunca guarda token). Isso será revisitado na FASE 5, quando for decidido se o NEX passa a injetar credenciais do AI Hub no Hermes.
- Todo comando executado via `HermesClient` roda sobre `TerminalService.exec` (SSH), a mesma superfície já auditada usada por `GitService`, `TunnelService` etc. Nenhum novo canal SSH foi criado.

## Troubleshooting

| Sintoma | Causa provável | Verificação |
|---|---|---|
| `hermes:status` retorna `not_installed` mesmo após instalar | PATH não propagado — `ssh2.exec` não roda shell de login | Rodar manualmente `command -v hermes` numa sessão SSH normal e comparar com o PATH usado em `hermes-client.ts` |
| `hermes:install` demora e não retorna | Timeout de 600s no `hermes-client.ts` — instalação real pode baixar Python/Node/uv | Se recorrente, aumentar o timeout ou investigar rede da VPS |
| `hermes:start` falha em obter PID | `nohup ... & echo $!` não gravou o PID file a tempo | Conferir se `~/.hermes-nex/` existe e se o usuário SSH tem permissão de escrita no `$HOME` |
| Botão "Iniciar" fica desabilitado mesmo com Hermes instalado | Status desatualizado — clicar em "Atualizar status" força novo `detect`/`isRunning` | — |

## FASE 2 — o que foi entregue

Ver seção "Hermes Agent Mode (FASE 2)" em `docs/ARCHITECTURE.md` para o detalhamento técnico completo. Resumo funcional:

- Selecionar um projeto (com VPS já configurada) na aba **Agent** do AI Hub
- Enviar um objetivo em linguagem natural — vira `hermes chat -q` na VPS daquele projeto
- Acompanhar a resposta em streaming (texto corrido, incluindo saída de tools)
- Cancelar uma execução em andamento
- Continuidade automática: a segunda mensagem em diante usa `--resume latest --in <workspace>` (a primeira nunca usa `--resume`, evitando o caso não documentado de retomar sem sessão prévia)

## Segurança e autonomia (FASE 2)

- `hermes:agent:send`/`hermes:agent:cancel` exigem `requireAdmin` — é uma ação que dispara execução real (mesmo nível de `hermes:exec`).
- Exige que a instância Hermes da VPS esteja com `status === 'running'` (checado no banco, sem round-trip SSH extra) antes de aceitar um objetivo — erro claro se não estiver.
- O objetivo do usuário nunca é interpolado diretamente numa string de comando shell: é escrito num arquivo remoto via SFTP e lido de volta com `"$(cat arquivo)"`, eliminando a necessidade de escapar aspas/quebras de linha (mesma técnica do "Chat Claude" do IDE-21).

## Troubleshooting (FASE 2)

| Sintoma | Causa provável | Verificação |
|---|---|---|
| "Hermes não está rodando nesta VPS" ao enviar objetivo | `HermesInstance.status` no banco não é `running` (pode estar desatualizado) | Abrir `/hermes/:vpsId/:vpsName`, clicar "Atualizar status", depois "Iniciar" se necessário |
| Stream trava sem receber `done` | Watchdog de 300s deveria matar e emitir `error` — se não emitiu, a conexão SSH pode ter caído sem dispará-lo | Conferir se `execStream`'s `conn.on('error')` está repassando para o `ExecStream` (`terminal.service.ts`) |
| Segunda mensagem no mesmo projeto não lembra da primeira | `sessionStarted` não foi marcado `true` após a 1ª execução (só acontece se `hermes:agent:send` completou com `status: 'idle'`) | Conferir `HermesProjectAgent.sessionStarted` no banco para o projeto |

## FASE 3 — o que foi entregue

Ver seção "Hermes Autonomous Loop (FASE 3)" em `docs/ARCHITECTURE.md` para o detalhamento técnico completo. Resumo funcional:

- Descrever um objetivo autônomo → o Hermes gera uma lista de tarefas (JSON) → cada tarefa vira uma linha em `agent_tasks`
- Executar as tarefas uma a uma, manual (botão "Próxima") ou automaticamente (`Autônomo`), até todas concluídas, uma bloquear, ou uma decisão de negócio ser necessária
- Ver o progresso real ("X/N concluídas") e o status de cada tarefa (Pendente/Em andamento/Bloqueada/Concluída)
- Responder a uma Decision Request (opções sugeridas ou resposta livre) e o loop continua de onde parou
- Revisar/marcar manualmente um checklist de Definition of Done, com 2 itens auto-verificados por SSH

## Segurança e autonomia (FASE 3)

- `hermes:agent:setObjective/setAutonomy`, `hermes:dod:toggle/runChecks` exigem `requireAdmin` — mesmo padrão das fases anteriores.
- Nenhum comando novo interpola texto do usuário diretamente numa string shell: as tarefas/decisões viajam pelo mesmo mecanismo de `streamObjective` (arquivo temporário via SFTP + `"$(cat …)"`) já auditado na FASE 2.
- Os 2 checks automáticos de DoD rodam via `TerminalService.exec` direto — comandos fixos (`test -f`, `git log -1`), sem interpolar nada além do `workspace` já validado do projeto.
- O loop autônomo nunca fica "sem supervisão indefinidamente": para automaticamente em qualquer tarefa `BLOCKED`, em qualquer `DECISAO_NECESSARIA`, ou ao atingir o teto de segurança de iterações — nunca continua silenciosamente após um erro.

## Troubleshooting (FASE 3)

| Sintoma | Causa provável | Verificação |
|---|---|---|
| Plano gerado vira uma única tarefa "Objetivo completo" | O Hermes não respondeu com um bloco `\`\`\`json` válido | Revisar a saída bruta no painel — o prompt de plano pode precisar de ajuste fino para o modelo configurado no Hermes |
| Loop autônomo para sem motivo aparente | Alguma tarefa foi marcada `BLOCKED` "sem tag de conclusão após lembrete" — o Hermes respondeu texto livre 2x seguidas | Abrir a tarefa na lista, revisar a descrição (o motivo é anexado automaticamente); reenviar manualmente se for falso bloqueio |
| Decision Request não aparece mesmo o Hermes perguntando algo em texto livre | O Hermes não usou a tag `[DECISAO_NECESSARIA ...]` — protocolo baseado em texto, não é garantido | Reforçar a instrução no prompt da tarefa, ou responder livremente via mensagem direta (coluna direita) |
| DoD "Rodar verificações automáticas" não marca `.env.example`/commits mesmo existindo | Caminho do `workspace` incorreto, ou usuário SSH sem permissão de leitura | Conferir `HermesProjectAgent.workspace` no banco contra o caminho real na VPS |

## FASE 4 — o que foi entregue

Ver seção "Hermes Execução Paralela (FASE 4)" em `docs/ARCHITECTURE.md` para o detalhamento técnico completo. Resumo funcional:

- Tarefas que o próprio Hermes marca como `parallelizable` durante a geração do plano rodam em lotes de até 3 simultâneas, cada uma isolada num git worktree próprio
- Painel "Agentes ativos" mostra o título da tarefa + branch de cada execução paralela em andamento
- Ao concluir, o NEX tenta merge automático de volta ao branch principal — nunca força: em conflito, o branch/worktree fica intacto para revisão manual
- Tarefas sequenciais (não paralelizáveis) continuam funcionando exatamente como na FASE 3

## Segurança e autonomia (FASE 4)

- `hermes:parallel:start/finish` exigem `requireAdmin` — mesmo padrão das fases anteriores.
- Nenhum comando novo interpola texto do usuário diretamente numa string shell — o objetivo da tarefa paralela viaja pelo mesmo `streamObjective` (arquivo temporário via SFTP) já auditado na FASE 2; os comandos de worktree/merge usam apenas `taskId` (gerado internamente) e `workspace`/`remotePath` já validados.
- `git merge` nunca usa `--force` nem sobrescreve histórico — em erro, sempre `git merge --abort` e preserva o branch.
- `git worktree remove --force` só é chamado **depois** de um merge bem-sucedido — nesse ponto não há nada de exclusivo naquele worktree para perder (o conteúdo já está no branch principal).

## Troubleshooting (FASE 4)

| Sintoma | Causa provável | Verificação |
|---|---|---|
| `hermes:parallel:start` falha com erro do git | Repositório sem nenhum commit ainda — `git worktree add -b` precisa de um HEAD válido | Garantir que o projeto já tem ao menos 1 commit antes de rodar tarefas paralelas |
| Tarefa paralela fica `DONE` mas o código não aparece na branch principal | Merge automático falhou (conflito) — a nota "`[atenção] merge automático falhou`" fica anexada à descrição da tarefa | Acessar a VPS, revisar `git worktree list` e o branch `nex/task-<id>`, mergear manualmente |
| Várias tarefas paralelas travadas ao mesmo tempo | Múltiplos streams SSH concorrentes contra a mesma VPS — não testado em produção ainda | Reduzir para rodar tarefas sequencialmente (desmarcar `parallelizable` no plano, ou revisar a VPS/rede) |
| Worktrees "sobrando" em `<remotePath>-worktrees/` | Merge não foi tentado (`merge=false`, tarefa não terminou com `[TAREFA_CONCLUIDA]`) ou falhou | Esperado — nada é removido automaticamente até um merge bem-sucedido; limpar manualmente via `git worktree remove` se o branch já não for mais necessário |

## FASE 5 — o que foi entregue

Ver seção "Hermes Memory + Skills (FASE 5)" em `docs/ARCHITECTURE.md` para o detalhamento técnico completo. Resumo funcional:

- Ver as skills instaladas na VPS (nome, versão, descrição) — dado real, lido de `SKILL.md`, não uma suposição de formato
- Ver um resumo bruto das sessões do Hermes (`sessions stats` + `sessions list`)
- Manter `.hermes.md` atualizado com a KB Global do NEX + a memória específica do projeto — o Hermes injeta esse arquivo sozinho, sem o NEX precisar "empurrar" nada a cada mensagem

## Segurança e autonomia (FASE 5)

- `hermes:agent:syncContext` exige `requireAdmin`; `hermes:skills:list`/`hermes:sessions:summary` são `requireAuth` (só leitura).
- `listSkillFiles` só executa `cat` — nunca escreve, renomeia ou apaga nada em `~/.hermes/skills/`.
- `syncProjectContext` escreve exclusivamente em `<remotePath>/.hermes.md`, um caminho fixo derivado do `remotePath` já validado do projeto — nunca um caminho vindo de input livre do usuário.

## Troubleshooting (FASE 5)

| Sintoma | Causa provável | Verificação |
|---|---|---|
| Aba Skills vazia mesmo com skills instaladas | Estrutura real de `~/.hermes/skills/` não bate com nenhum dos 2 padrões de glob tentados | Rodar `hermes skills list` manualmente na VPS (aba Console) e comparar com a estrutura de pastas real via SSH |
| Card de skill sem descrição/versão | O `SKILL.md` daquela skill não segue o frontmatter documentado (`name`/`description`/`version`) | Normal — o parser é tolerante (campos ausentes ficam vazios/`—`), não é um erro |
| "Sincronizar contexto" diz "nada para sincronizar" | Nem a KB Global nem a memória do projeto (`project_memory`) têm conteúdo para esse projeto/VPS | Adicionar entradas em `/knowledge` (KB Global) ou memória do projeto no AI Hub antes de sincronizar |
| Hermes não parece "saber" o que está no `.hermes.md` | Arquivo pode não ter sido escrito antes do objetivo ser enviado, ou o Hermes despreza arquivos de contexto grandes demais (`context_file_max_chars`) | Conferir se o arquivo existe via SFTP/Explorer; se muito grande, reduzir o conteúdo da KB Global |

## FASE 6 — o que foi entregue

Ver seção "Hermes Automação (FASE 6)" em `docs/ARCHITECTURE.md` para o detalhamento técnico completo. Resumo funcional:

- Agendar um objetivo Hermes num projeto específico direto da tela de Automações — sem precisar abrir o AI Hub para disparar manualmente
- A execução agendada roda até o fim sem nenhuma janela aberta consumindo o stream (execução não-assistida) — o resultado chega como notificação desktop, igual às automações do Squad
- Se o NEX for fechado (ou travar) no meio de uma sessão Hermes em andamento, na próxima abertura o app detecta a sessão órfã automaticamente e oferece "Retomar sessão" — sem o usuário precisar descobrir manualmente que algo ficou pendente
- Tarefas do loop autônomo (FASE 3) que ficaram `IN_PROGRESS` no momento da interrupção voltam para `TODO` sozinhas, prontas para o loop retomar

## Segurança e autonomia (FASE 6)

- Nenhum handler IPC novo — `runObjectiveUnattended` só é chamado internamente pelo `JobExecutor` (processo main, nunca exposto ao renderer diretamente) e `recoverInterruptedSessions` roda automaticamente no boot, sem input do usuário.
- O objetivo do cron viaja pelo mesmo `streamObjective`/SFTP+`"$(cat …)"` já auditado na FASE 2 — nenhuma interpolação nova de texto do usuário numa string shell.
- Um cron travado não pode rodar indefinidamente: watchdog de inatividade 300s (igual ao fluxo interativo) + teto duro de 20min específico da execução não-assistida, já que não há usuário para clicar em "Cancelar".
- O recovery nunca reenvia nada sozinho — ele só corrige o estado no banco (`status`, `lastError`, tarefas `IN_PROGRESS`→`TODO`) e mostra um botão; retomar de fato exige um clique do usuário em "Retomar sessão".

## Troubleshooting (FASE 6)

| Sintoma | Causa provável | Verificação |
|---|---|---|
| Automação Hermes nunca dispara | `isActive` desligado, ou `nextRunAt` no passado mas o `JobExecutor` não está rodando (app fechado) | Conferir em Automações se o job está "ativo"; automações só rodam com o NEX aberto (sem daemon separado) |
| "Retomar sessão" não aparece após reabrir o app mesmo com uma sessão que ficou rodando | `HermesProjectAgent.status` já não estava `'running'` no banco no momento do restart (a sessão pode ter fechado normalmente antes do fechamento do app) | Não é um bug — o recovery só marca sessões genuinamente órfãs; conferir `lastActivity` no banco para confirmar quando a sessão realmente parou |
| Execução não-assistida sempre bate no teto de 20min | Objetivo complexo demais para rodar sem supervisão, ou o Hermes está preso num loop interno | Reduzir o escopo do objetivo agendado, ou rodar manualmente via AI Hub (Agent Mode) primeiro para calibrar o tempo esperado |
| Job Hermes falha com "sem projeto associado" | Job criado/editado sem `projectId` (ex.: via `jobs:update` direto, fora da UI) | Recriar o job pela tela de Automações, que valida o projeto obrigatório para `agentName: 'hermes'` |

## Limitações conhecidas

1. ~~Sem modo headless confirmado~~ — **resolvido na FASE 2**, ver seção própria acima.
2. **`hermes gateway` como proxy de "serviço"** — é a aproximação mais razoável disponível hoje; pode ser revisado quando existir um "Hermes Bridge" dedicado escutando em `127.0.0.1`.
3. **Sem teste de ponta a ponta contra VPS real** (FASE 1 a 6) — instalação, envio de objetivo, loop autônomo, execução paralela, sincronização de contexto e automação real ficam a cargo do usuário; validado via `pnpm typecheck && pnpm build` limpos e revisão manual dos comandos shell/SSH/git gerados (sem interpolação insegura de input do usuário). A FASE 4 continua sendo a de maior incerteza prática (múltiplos streams SSH concorrentes).
4. **Sem parsing estruturado de activity feed** (FASE 2) — depende do adaptador ACP, cuja página de documentação retornou 404 na pesquisa; o painel de saída é texto corrido.
5. **Duração de `hermes chat -q` não testada contra caso real** — o watchdog de inatividade de 300s é uma estimativa; pode precisar de ajuste depois de uso real com tarefas agenticas longas. Num loop autônomo (sequencial ou paralelo) isso se acumula por tarefa.
6. **3 tiers de autonomia não implementados** (FASE 3) — simplificado para binário Manual/Autônomo por decisão explícita do usuário; refinar quando houver mais sinal do que o Hermes expõe por tarefa (ex. classificação de risco).
7. **DoD não é gate automático** (FASE 3) — é checklist informativo; auto-detectar/rodar build de stack arbitrária ficou fora de escopo por risco de falso-positivo/negativo.
8. **Protocolo de tags depende do Hermes seguir a instrução** — como qualquer protocolo baseado em texto (o Squad já convive com isso hoje), não há garantia formal; mitigado com 1 lembrete antes de desistir.
9. **Subagentes nomeados não existem** (FASE 4) — não há API externa do Hermes para isso; o que existe é execução paralela de tarefas independentes via worktree, com rótulos conceituais do NEX na UI.
10. **`hermes -w` não utilizado** (FASE 4) — decisão consciente por falta de documentação sobre local/merge/concorrência; o NEX usa git worktree padrão sob seu próprio controle.
11. **Decision Request não resolvido em execução paralela** (FASE 4) — sem sessão para retomar num worktree one-shot; vira bloqueio para revisão manual.
12. **Sem grafo de dependências entre tarefas** (FASE 4) — `parallelizable` é uma decisão binária por tarefa, não um grafo explícito de "tarefa X depende de Y".
13. **Estrutura exata de `~/.hermes/skills/` não 100% confirmada** (FASE 5) — o parser cobre os 2 padrões de path mais prováveis (com e sem subpasta de categoria); pode precisar de ajuste após teste real.
14. **Sem parsing de `hermes sessions list`** (FASE 5) — formato de saída não confirmado pela doc; exibido como texto bruto.
15. **`.hermes.md` não é sincronizado a cada mensagem** (FASE 5) — só no início de um novo objetivo autônomo ou quando o usuário clica manualmente; se a KB mudar no meio de um loop longo, não reflete até a próxima sincronização.
16. **Automações não rodam sem o app aberto** (FASE 6) — `JobExecutor` roda dentro do processo Electron principal; não há daemon/serviço separado, então um cron agendado só dispara se o NEX estiver aberto no horário previsto (mesma limitação que já existia para automações do Squad desde o Ponto 7).
17. **Recovery não distingue causa da interrupção** (FASE 6) — todo `HermesProjectAgent` com `status:'running'` sobrevivente a um restart do processo é tratado como sessão interrompida; não há como saber se foi crash, fechamento normal do app, ou `kill -9` — na prática irrelevante, porque o `ExecStream` de qualquer uma dessas situações já está morto de qualquer forma.
18. **Decision Request pendente no momento da interrupção não é recuperada automaticamente** (FASE 6) — "Retomar sessão" reenvia um prompt genérico ("continue de onde parou"); se havia uma pergunta pendente, o usuário precisa reabri-la manualmente na conversa.
19. **Teto duro de 20min na execução não-assistida é uma estimativa** (FASE 6) — sem dado real de quanto tempo objetivos agenticos típicos levam; pode precisar de ajuste (ou de se tornar configurável por job) após uso real.
