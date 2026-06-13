# TASKS.md — NEX-ALS IDE

## Em andamento

- [ ] **Phase 2 — LSP auto-start local** — iniciar TypeScript language server localmente em modo local sem exigir túnel SSH manual; maior ganho de qualidade pendente no IDE

## Concluídas recentemente (v3.22.0 → v3.25.0)

- [x] **monacoSetup.ts reescrito** — TypeScript language service via type cast (`MonacoTsDefaults`/`MonacoTsLang`); compiler options ESNext+JSX ReactJSX+allowJs; inlay hints com `setInlayHintsOptions`; semantic highlighting via `'semanticHighlighting.enabled': true` — v3.25.0 · 2026-06-12
- [x] **IDEPage: Breadcrumbs bar** — barra fina acima do Monaco mostrando últimos 4 segmentos do caminho + símbolo atual (roxo `text-brand-500`) via `currentSymbol` state + `outlineRef` (evita closure stale no handler de cursor) — v3.25.0 · 2026-06-12
- [x] **IDEPage: Outline View** — aba "Outline" (`List` icon) no painel esquerdo; TypeScript/JS via `getTypeScriptWorker()` + `getNavigationBarItems()`; regex fallback para outras linguagens; `OutlineTree` component com ícones por kind, entrada ativa realçada, clique navega; auto-refresh debounce 450ms — v3.25.0 · 2026-06-12
- [x] **Squad: robocopy `/XD node_modules`** — fix freeze crítico (10+ min copiando 30k arquivos); `handlers.ts` system prompt + `agents.ts` regra 9 atualizados; `npm install --prefix` após robocopy; timeout 600s adicionado ao regex de robocopy — v3.25.0 · 2026-06-12
- [x] **Versão 3.25.0** — bumps nos 3 package.json + Layout.tsx + CHANGELOG + CURRENT_STATE + TASKS — v3.25.0 · 2026-06-12

## Concluídas recentemente (v3.21.0 → v3.22.0)

- [x] **IDEPage: badges git estilo VS Code na SFTP tree** — `gitFileMap` (Map path→{letter,color}) e `dirtyDirSet` (Set de prefixos de pastas sujas) via `useMemo`; `flatTree.map()` convertido para arrow function `=>{}` com variáveis `relPath`, `gitInfo`, `dirtyFolder`; nome do arquivo colorido com `gitInfo.color`; badge letra (M/A/D/?) à direita para arquivos; ponto âmbar para pastas com filhos sujos; auto-load git status quando tree carrega pela primeira vez — v3.22.0 · 2026-06-12
- [x] **SquadPage: "Arquivos modificados" estilo VS Code Explorer** — cada entrada mostra ícone `FileCheck2` colorido por extensão (ts/tsx/js/py/json/css…), nome em negrito na cor da extensão, path pai em `text-slate-600` ao lado, badge 'W' verde à direita; paleta `extColor` com 12 extensões — v3.22.0 · 2026-06-12
- [x] **Versão 3.22.0** — bumps nos 3 package.json + Layout — v3.22.0 · 2026-06-12

## Concluídas recentemente (v3.20.0 → v3.21.0)

- [x] **Squad: `parseActions` segundo passo implementado** — `parseActions` agora tem dois passes: Pass 1 com regex `\[\/ACTION\]?` (aceita fechamento sem `]` final); Pass 2 com lookahead `(?=\[ACTION:|$)` captura blocos completamente truncados antes de `[/ACTION`; `Set<number>` evita duplicatas; `makeBlock`/`extractParams` extraídos para funções auxiliares; `stripActions` atualizado para limpar ambas as formas — v3.21.0 · 2026-06-12
- [x] **Squad: regra 9 — OneDrive bloqueia scaffolds** — `EXECUTOR_RULES` regra 9 instrui a usar `C:\Users\%USERNAME%\AppData\Local\Temp\squad-scaffold` como staging quando `cwd` estiver em OneDrive; scaffold executa no Temp; cópia com `xcopy /E /Y /H /I` para destino final; apaga staging após copiar — v3.21.0 · 2026-06-12
- [x] **SquadPage: painel de monitoramento de atividade (4 painéis)** — interfaces `ActivityEntry` e `SessionStats`; estado + refs (`activityLog`, `sessionStats`, `modifiedFiles`) para evitar closures stale; `pushActivity`/`updateActivity`/`clearActivity`; `executeAction` e `executeActionsAuto` instrumentados; painel direito com 3 tabs: Histórico | Atividade | Contexto; tab Atividade com stats bar (R/W/⚡/✗), arquivos modificados, log expandível com status e duração — v3.21.0 · 2026-06-12
- [x] **Versão 3.21.0** — bumps nos 3 package.json + Layout — v3.21.0 · 2026-06-12

## Concluídas recentemente (v3.19.0 → v3.20.0)

- [x] **Squad: Friday — regra npm lowercase + flags corretas** — `EXECUTOR_RULES` regra 8: nomes npm sempre lowercase; se diretório tem maiúsculas criar em subpasta (ex: apps/web); usar `--ts` em vez de `--typescript`; aspas em `--import-alias "@/*"` — v3.20.0 · 2026-06-12

## Concluídas recentemente (v3.18.0 → v3.19.0)

- [x] **Squad: parser tolerante a ACTION malformada** — `parseActions` com passe primário (regex `\[\/ACTION\]?`) e passe secundário para tags sem fechamento; `stripActions` alinhado — v3.19.0 · 2026-06-12
- [x] **Squad: `autoExecRound()`** — executa actions, envia resultado ao root agent, obtém próxima resposta, repete até sem actions ou `[PRONTO]` (máx 6 rodadas); elimina loop infinito de Jarvis repetindo READ_DIR sem feedback — v3.19.0 · 2026-06-12
- [x] **Squad: Jarvis fluxo READ_DIR→READ_FILE→delegação** — instrução passo a passo em `JARVIS_ACTION_INSTRUCTIONS`; proibido misturar ação com delegação; proibido repetir ação já executada — v3.19.0 · 2026-06-12
- [x] **Versão 3.19.0** — bumps nos 3 package.json + Layout; CHANGELOG, CURRENT_STATE, TASKS, AGENTE atualizados; instalador gerado — v3.19.0 · 2026-06-12

## Concluídas recentemente (v3.17.0 → v3.18.0)

- [x] **Squad: Jarvis somente leitura** — `JARVIS_ACTION_INSTRUCTIONS` em `agents.ts` com apenas `READ_DIR` e `READ_FILE`; SHELL e WRITE_FILE removidos; system prompt reforça: delegue para `@friday` / `@tester`, nunca implemente diretamente — v3.18.0 · 2026-06-12
- [x] **Squad: toggle "Exec auto"** — botão Zap âmbar no cabeçalho; padrão ON; `autoExecute` state + `autoExecuteRef` + `useEffect` sync com `localStorage['squad_auto_execute']`; após `streamAgent` resolve em `handleSend`, se `autoExecuteRef.current` e não autônomo → `executeActionsAuto(lastBubble.actions)` — v3.18.0 · 2026-06-12
- [x] **Versão 3.18.0** — bumps nos 3 package.json; CHANGELOG, CURRENT_STATE, TASKS, AGENTE atualizados; instalador `NEX-ALS IDE Setup 3.18.0.exe` + portable gerados — v3.18.0 · 2026-06-12

## Concluídas recentemente (v3.16.1 → v3.17.0)

- [x] **KB Global do Desenvolvedor — modelo Prisma** — `KnowledgeEntry` em `schema.prisma` (`knowledge_entries`): id cuid, title, content, category enum 8 valores, tags string, isActive, timestamps — v3.17.0 · 2026-06-11
- [x] **KB Global — `KnowledgeService`** — `packages/core/src/knowledge/knowledge.service.ts`; `list()`, `listActive()`, `create(input)`, `update(id, input)`, `delete(id)`, `buildContext()` (agrupa por categoria, formata markdown); padrão `get db()` = `getPrismaClient()`; exportado em `packages/core/src/index.ts` — v3.17.0 · 2026-06-11
- [x] **KB Global — IPC handlers** — `handlers.ts`: 5 handlers `knowledge:*`; `knowledgeSvc.buildContext()` injetado antes de `squad:stream:start` e `ai:stream:start`; preload.ts com 5 channels na allowlist; `ipc.ts` com namespace `knowledge.*` — v3.17.0 · 2026-06-11
- [x] **KB Global — KnowledgePage** — rota `/knowledge`; busca full-text, filtro por categoria (8 cores), toggle isActive, edição inline, painel lateral para novo item, tags; adicionada ao App.tsx e ao nav (ícone `BookMarked`) — v3.17.0 · 2026-06-11
- [x] **Rebrand NEX-ALS Dark Luxury — Tailwind** — `tailwind.config.ts` reescrito: override `slate` mapeado para `#080612`–`#F8F8FC`; namespace `brand` (dourado); namespace `nex`; sombras e gradientes customizados — v3.17.0 · 2026-06-11
- [x] **Rebrand NEX-ALS Dark Luxury — CSS Global** — `index.css` reescrito: Inter Google Fonts; 14 CSS vars `--nex-*`; scrollbar dourada 4px; componentes `.card`, `.btn-primary` (gradiente animado), `.input` (focus dourado), `.glass`; utilitários `glow-*` — v3.17.0 · 2026-06-11
- [x] **Rebrand NEX-ALS Dark Luxury — Layout** — sidebar redesenhada: gradiente `#0D0A24→#080612`; faixa dourada esquerda; logo `logo-nexals.png` c/ fallback `⬡`; brand "NEX-ALS IDE" dourado; tagline; botões AI HUB (roxo) e SQUAD (dourado) com glow hover; nav ativo borda/texto dourado; footer versão dourada — v3.17.0 · 2026-06-11
- [x] **Versão 3.17.0** — bumps em `package.json` raiz, `apps/desktop/package.json`, `apps/web/package.json`; CHANGELOG, CURRENT_STATE, TASKS, AGENTE atualizados; instalador Windows `NEX-ALS IDE Setup 3.17.0.exe` + portable gerados — v3.17.0 · 2026-06-11

## Concluídas recentemente (v3.15.8 → v3.16.1)

- [x] **Squad: READ_DIR + auto-detecção de diretório em READ_FILE** — nova `ActionType` `'read_dir'`; handler local com `fs.readdir({ withFileTypes: true })` retorna lista `[DIR]/[ARQ]`; `read_file` local faz `fs.stat` e se for diretório lista conteúdo ao invés de erro; handler VPS usa `ls -la`; `ACTION_INSTRUCTIONS` adicionadas a Jarvis e Shuri — v3.15.8 · 2026-06-11
- [x] **Squad: instruções anti-loop no modo autônomo** — system prompt do modo autônomo proíbe reler arquivos já no histórico; exige `READ_DIR` antes de `READ_FILE` em pastas; lista ações disponíveis explicitamente; exige `[PRONTO]` ao concluir — v3.15.8 · 2026-06-11
- [x] **Squad: Base de Conhecimento estruturada** — interface `KnowledgeBase` com 8 seções (projeto, stack, estrutura, status, convenções, regras, agentes, notas); substitui campo livre "Contexto do Projeto"; accordeon no painel direito; 3 templates prontos (Next.js SaaS, Node.js API, React+Vite); persistência `localStorage`; `buildKBString()` gera contexto formatado — v3.15.9 · 2026-06-11
- [x] **Squad: KB isolada por projeto** — `localStorage['squad_knowledge_bases']` como `Record<string, KnowledgeBase>` keyed por `localPath || '__global__'`; `useEffect([localPath])` recarrega KB ao trocar pasta; badge roxo com nome da pasta — v3.16.0 · 2026-06-11
- [x] **Squad: rootAgentRef — delegação autônoma corrigida** — `rootAgentRef` (useRef) gravado no `handleSend`; loop autônomo sempre envia resultados ao agente raiz independente de qual agente delegado executou ações; agente delegado sem ações dispara síntese com root ao invés de parar — v3.16.0 · 2026-06-11
- [x] **Squad: botão Sincronizar KB** — `syncKBFromProject()` lê `README.md`/`CURRENT_STATE.md`/`TASKS.md`/`ARCHITECTURE.md` via `ipc.squad.action.execute({ type: 'read_file', vpsId: '__local__' })`; auto-detecta separador de caminho; preenche seções projeto/status/estrutura da KB; spinner durante sincronização — v3.16.1 · 2026-06-11
- [x] **Squad: iterações autônomas configuráveis** — `maxAutoIter` state (padrão 30, range 5–200); input numérico visível quando modo autônomo ativo; `maxAutoIterRef` padrão ref+state sincronizados por `useEffect` para uso correto dentro de loops async — v3.16.1 · 2026-06-11
- [x] **Squad: relatório final do ciclo autônomo** — bubble de sistema ao final do loop com contadores: iterações, leituras, escritas, shells, erros, lista de arquivos escritos — v3.16.1 · 2026-06-11

## Concluídas recentemente (v3.15.2 → v3.15.7)

- [x] **Squad: "Erro ao processar resposta" com Claude Code** — stderr acumulado em buffer; erro enviado apenas ao fechar com código ≠ 0 e sem stdout; regex de auth refinada; UI passa `chunk.error` real ao invés de mensagem genérica — v3.15.2 · 2026-06-11
- [x] **Squad: botão excluir conversa** — ícone 🗑 no hover de cada sessão; `stopPropagation`; remove do banco e da lista; se sessão ativa, limpa o chat — v3.15.2 · 2026-06-11
- [x] **Fix `shell: true`** — `.cmd` npm binaries no Windows precisam de shell para receber stdin; Claude CLI spawned com `shell: true` — v3.15.3 · 2026-06-11
- [x] **Fix `--no-color`** — flag não suportada em claude 2.1.170; removida de ambos os spawn paths (`squad:stream:start` e `ai:stream:start`) — v3.15.3 · 2026-06-11
- [x] **Fix Claude CLI security sandbox** — `cwd` era o diretório do Electron (sem acesso ao projeto); corrigido para `cwd: data.localPath || homedir()` + flag `--add-dir data.localPath` — v3.15.4 · 2026-06-11
- [x] **Squad: painéis redimensionáveis** — drag handles entre os 3 painéis; `dragState` via `useRef`; listeners `mousemove`/`mouseup` globais no `window`; min/max por lado — v3.15.5 · 2026-06-11
- [x] **Squad: botão Limpar** — limpa bubbles + bubblesRef + sessionId; ícone Eraser; desabilitado sem conteúdo ou durante streaming — v3.15.5 · 2026-06-11
- [x] **Squad: botão Acompanhar** — `autoScroll` state; `handleChatScroll` detecta distância ao fundo < 80px; botão sticky `ArrowDown` aparece quando usuário rola para cima — v3.15.5 · 2026-06-11
- [x] **Squad: modal Conta Claude** — botão "Uso" (azul, com ícone `User2`) no header Histórico; modal mostra email + plano lidos de `.credentials.json` da conta ativa; botão "Abrir claude.ai" via `shell:openExternal`; IPC handlers `claude:usage` e `shell:openExternal` com allowlist de domínios — v3.15.7 · 2026-06-11

## Concluídas recentemente (v3.15.1)

- [x] **Testes E2E Playwright para página Squad** — `e2e/tests/05-squad.spec.ts` com 14 testes cobrindo: navegação, 8 agentes no painel, header do agente ativo, troca de agente, mensagem vazia do chat, textarea de input, botão enviar (disabled/enabled), Nova sessão, toggle VPS/Local, pasta local, toggle Contexto do Projeto, indicador de contexto ativo, histórico vazio, botão Voltar — 2026-06-11

## Concluídas recentemente (v3.13.0)

- [x] **Squad: fallback para provider padrão quando sem API Key** — `squad:stream:start` verifica API Key do provider preferido do agente; cai no padrão (claude-code) se não tiver — 2026-06-10
- [x] **Múltiplas contas Claude Code** — tabela `claude_code_accounts`; `getActiveClaudeEnv()`; `claude:accounts:*` IPC; UI com lista, status, alternância, botão copiar comando PowerShell; conta existente `~/.claude` importável via checkbox — 2026-06-10
- [x] **Fix verificação de auth** — `claude:accounts:check` usa `.credentials.json` em vez de `--version`; comando PowerShell `$env:CLAUDE_CONFIG_DIR=...` com botão copiar — 2026-06-10
- [x] **Versão v3.13.0** — bumps em `package.json`, `Layout.tsx`; CHANGELOG, CURRENT_STATE, TASKS atualizados — 2026-06-10

## Concluídas recentemente (v3.11.0)

- [x] **Claude Code como provedor de conta** — subprocess `claude` CLI; PATH enriquecido npm global bin Windows; `claude:check` IPC; `ClaudeCodeCard` em Settings; streaming sem API Key — 2026-06-10
- [x] **CURRENT_STATE.md / TASKS.md atualizados para v3.11.0** — Squad, Pipeline e Claude Code documentados; limitações corrigidas — 2026-06-10

## Concluídas recentemente (v3.10.0)

- [x] **Squad — 8 agentes com ACTION tags e Pipeline** — SquadPage fullscreen; streaming por agente; blocos SHELL/WRITE_FILE/READ_FILE executados via SSH/SFTP; toggle Pipeline com gate homolog→prod; estados visuais do gate; `agents.ts`, `actions.ts`, `squad.service.ts` em `packages/core/src/squad/` — 2026-06-10
- [x] **Squad — persistência de sessões SQLite** — `squad_sessions` + `squad_messages` via Prisma; histórico no painel direito; carregar sessão restaura mensagens — 2026-06-10
- [x] **Squad — delegação automática @agente** — `detectDelegations()` + `extractTask()` no renderer; `streamAgent()` re-invocado com depth=1; badge "delegado por @X" no chat — 2026-06-10

## Concluídas recentemente (v3.9.0)

- [x] **Rename inline F2** — `selectedEntryRef` + `selectedPath` state; click/contextmenu atualizam ref; F2 no keydown abre rename inline sem context menu — 2026-06-04
- [x] **Ctrl+Shift+T reabrir aba** — `closedTabsRef` (stack 15); `closeTab` faz push; Ctrl+Shift+T restaura a última aba fechada — 2026-06-04
- [x] **Busca em arquivos modo local** — `handleSearch` com branch `isLocal`: `rg || findstr` via `local:exec`; caminhos absolutos; display relativo à raiz — 2026-06-04
- [x] **Diffview modo local** — `handleLocalDiff`: `git diff -- file` via `local:exec`; mesmo Monaco diff viewer; botão Diff no top bar em modo local — 2026-06-04

## Concluídas recentemente (v3.8.0)

- [x] **Autenticação interna multi-usuário** — `AuthService` (bcryptjs, SQLite `app_users`), sessão em memória no main, guards `requireAdmin/requireAuth` em todos os mutantes, `AuthContext`+`SetupPage`+`LoginPage`, sidebar com user card + logout, seção Usuários no Settings (admin CRUD) — 2026-06-04

## Concluídas recentemente (v3.7.0)

- [x] **LSP multi-linguagem (IDE-22)** — `lsp.ts` refatorado: `LSP_CONFIGS` (TS/PY/RS/GO), `monacoLangToLspKey`, `disconnectAllLSP`; botão LSP na status bar muda label/porta/tooltip conforme arquivo ativo; cleanup no unmount — 2026-06-04

## Concluídas recentemente (v3.6.0)

- [x] **Testes E2E com Playwright** — `@playwright/test` + `electron` na raiz; `e2e/playwright.config.ts` (workers=1, timeout 40s, HTML report); `global-setup.ts` limpa DB de teste; `helpers/app.ts` (launchApp/closeApp, DB isolado por run); 4 spec files: `01-launch` (5 testes), `02-navigation` (8), `03-vps` (8), `04-settings` (8) = **29 testes E2E**; scripts `test:e2e` e `test:e2e:ci` — 2026-06-04

## Concluídas recentemente (v3.5.3)

- [x] **ARCHITECTURE.md atualizado para v3.5.2** — adicionadas seções: NotificationMonitor (polling/thresholds/cooldown/IPC), Modo Local filesystem IPC (local:readdir/writeFile/exec/touch com criação de pastas pai), Agente Autônomo (loop 500 iterações, stop, snapshot/rollback, modo VPS vs local); schema settings com `notificationsEnabled`; módulo `notifications/` no diagrama de pacotes — 2026-06-04

## Concluídas recentemente (v3.5.2)

- [x] **Configurações simplificadas** — removidas seções VS Code e SSH da UI; campos mantidos no banco com padrões; Manual de Uso atualizado com todas as features v3.4–v3.5 — 2026-06-04

## Concluídas recentemente (v3.5.1)

- [x] **Bugfix local:writeFile/touch** — `fs.mkdir({ recursive: true })` antes de escrever; resolve "Falha ao salvar" ao criar arquivos em subpastas inexistentes — 2026-06-04

## Concluídas recentemente (v3.5.0)

- [x] **Agente autônomo local** — `local:exec` IPC; `execute_command` + `search_files` funcionando em modo local; loop auto-continua até 500 ações sem pausa; botão Parar substitui "Continuar" — 2026-06-04

## Concluídas recentemente (v3.4.0)

- [x] **Notificações de sistema** — `NotificationMonitor` (polling 60s, cooldown 30min); alertas Disco ≥ 85% / CPU ≥ 90% / RAM ≥ 90%; erro IA Hub; toggle em Configurações com persistência — 2026-06-04

## Concluídas recentemente (v3.3.1)

- [x] **Manual de Uso — redesign UX** — Mapa do App em cards por objetivo (Gerenciamento · Desenvolvimento · IA · Deploy · Incidentes); copy orientado a benefício; seção "Dois modos de operação"; versão corrigida na sidebar — 2026-06-02
- [x] **GUIA_INICIANTE.md** — documento em linguagem acessível: conceitos (VPS/SSH/SFTP/API Key), mapa de telas, IDE, AI Hub, Modo Agente, fluxo passo a passo, FAQ, glossário — 2026-06-02

## Concluídas recentemente (v1.6.0 → v3.3.0)

- [x] **AI Hub UI Completo v3.3.0** — Project Memory CRUD, Context Selector, ToolExecutor confirmação CONFIRMO — 2026-06-01
- [x] **Deploy Assistant v3.2.0** — plano IA em JSON/markdown; tiers risco; confirmação modal para high; rollback automático; smoke test HTTP — 2026-06-01
- [x] **Incident Mode v3.1.0** — janela 4-painéis (Diagnóstico IA + Logs + Docker/PM2 + Terminal); diagnóstico automático com streaming; botão Siren no Launcher e IDEPage — 2026-06-01
- [x] **NEX-ALS AI HUB v3.0.0** — BaseProvider, 6 providers (Anthropic/OpenAI/Gemini/DeepSeek/OpenRouter/Ollama), KeyStore, ProviderManager, ModelRegistry, ResponseStreamer, ContextManager, PromptBuilder, ConversationManager, ToolExecutor, AIHubPage com streaming — 2026-06-01

- [x] **Multi-monitor** (v2.8.0) — createIdeWindow; HashRouter hash nav; botão ExternalLink no Launcher e IDEPage top bar; janelas totalmente independentes — 2026-06-01
- [x] **Snapshot/Rollback** (v2.7.0) — snapshot antes de write_file; painel 📦 Snapshots com ↩ Restaurar por arquivo; limpo em nova sessão; preservado no Continuar — 2026-06-01
- [x] **Limite agente 50 iter + botão Continuar** (v2.6.0) — MAX 15→50; agentResumeRef preserva histórico; banner âmbar + botão Continuar; SFTP reaberto automaticamente — 2026-06-01
- [x] **Verificação de fingerprint SSH** (v2.5.0) — armazena na 1ª conexão; rejeita se mudar; badge ShieldCheck/ShieldOff + botão Limpar; todos os serviços SSH — 2026-06-01
- [x] **Analisador de Disco** (v2.4.0) — botão por VPS no Monitor; modal com dirs / Docker / PM2 logs / /var/log; cores por tamanho — 2026-06-01
- [x] **Modo Agente IA** (v2.3.0) — tool use; agentic loop 15 iter; read/write/exec/search; display inline; Anthropic + OpenAI-compat — 2026-05-31
- [x] **Manual de Uso** (v2.3.0) — Help.tsx reescrito com todas as features v1.5→v2.4 — 2026-05-31
- [x] **Histórico de lançamentos** (v2.2.0) — página /history; filtros VPS/projeto/status; taxa de sucesso — 2026-05-31
- [x] **Logs Viewer** (v2.1.0) — aba Logs no IDE; presets; Watch 3s — 2026-05-31
- [x] **PM2 / Process Manager** (v2.0.0) — aba PM2; Restart/Stop/Logs; CPU%, RAM — 2026-05-31
- [x] **Docker Explorer** (v1.9.0) — aba Docker; Start/Stop/Logs/Remover; badge — 2026-05-31
- [x] **Chat IA direto** (v1.8.0) — ai:chat API direta; fallback SSH; histórico completo — 2026-05-31
- [x] **Provedores de IA** (v1.7.0) — 7 providers; AiService; Settings UI; AES-256 — 2026-05-31
- [x] **Monitor de VPS** (v1.6.0) — CPU/RAM/Disco/Uptime; auto-refresh 30s — 2026-05-31

## Próximas tarefas sugeridas — AI HUB v2

- [x] **Incident Mode** — entregue em v3.1.0
- [x] **Deploy Assistant** — entregue em v3.2.0
- [x] **Project Memory UI** — entregue em v3.3.0
- [x] **Context Selector UI** — entregue em v3.3.0
- [x] **ToolExecutor confirmação UI** — entregue em v3.3.0

---

## Backlog IDE — P0 BLOQUEADORES

- [x] **IDE-01 · Criar arquivo** — `FilePlus` + input inline + `SftpSession.touch()` + IPC `sftp:touch` — 2026-05-30
- [x] **IDE-02 · Tree view aninhada** — `flattenTree()` + expand/collapse inline + lazy load + `activeDir` — 2026-05-30
- [x] **IDE-03 · Find in Files (Ctrl+Shift+F)** — painel Search + grep SSH + resultados clicáveis com reveal de linha — 2026-05-30

## Backlog IDE — P1 ALTA PRIORIDADE

- [x] **IDE-04 · Git integrado** — painel Source Control, diff viewer Monaco, stage/unstage/commit/push/pull, branch na status bar — 2026-05-30
- [x] **IDE-05 · Múltiplas abas de terminal** — tab bar + N sessões SSH independentes + callback ref pattern para xterm — 2026-05-30
- [x] **IDE-06 · Status bar completa** — branch git (clicável), Ln/Col ao editar, hint paleta — 2026-05-30
- [x] **IDE-07 · Paleta de comandos (Ctrl+Shift+P)** — mapeado + botão `⌘` na top bar — 2026-05-30

## Backlog IDE — P2 MÉDIA PRIORIDADE

- [x] **IDE-08 · Find/Replace no arquivo (Ctrl+H)** — `addCommand` no `handleEditorMount` garante que o atalho não seja interceptado pelo Electron — 2026-05-30
- [x] **IDE-09 · Go to Line (Ctrl+G)** — `addCommand` no `handleEditorMount` garante que o atalho não seja interceptado — 2026-05-30
- [ ] **IDE-10 · Breadcrumbs no editor** — N/A: opção não existe em `IStandaloneEditorConstructionOptions` (exclusiva do VS Code completo).
- [x] **IDE-11 · Preview de imagem** — base64 via SFTP + `<img>` no editor; tab integrada — 2026-05-30
- [x] **IDE-12 · Painel de Problemas** — erros/warnings do Monaco como tab no painel inferior; `onDidChangeMarkers`; `jumpToLine` — 2026-05-30
- [x] **IDE-13 · Copiar/mover arquivos** — "Duplicar" (`cp -rp`) + "Copiar caminho" (clipboard) no context menu — 2026-05-30
- [x] **IDE-14 · Auto-refresh da tree** — refresh ao salvar + polling 30s com `expandedFoldersRef` — 2026-05-30

## Concluídas recentemente

- [x] **IDE-19 · Badge PRODUÇÃO** — indicador vermelho pulsante na top bar do modo remoto VPS — 2026-05-30
- [x] **IDE-20 · Modo Local** — rota `/ide/local`; dialog de pasta nativa; IPC `local:*`; filesystem abstraction; badge verde "Local"; terminal e Git ocultos; botão "Abrir pasta local" no Launcher — 2026-05-30
- [x] **IDE-21 · Chat Claude** — painel lateral direito redimensionável; `claude -p` via SSH; prompt via arquivo SFTP (sem escaping); contexto completo (árvore 2 níveis + docs + arquivo ativo); seletor de VPS; timer de espera; botões Copiar/Aplicar/Salvar como nos blocos de código; paste de print Ctrl+V (badge "📷 Print anexado"); instrução offline para Claude usar conteúdo inline — 2026-05-31

## Backlog IDE — P3 BAIXA PRIORIDADE — todos concluídos

- [x] **IDE-15 · Split editor** — dois painéis 50/50, abas independentes, Ctrl+S no painel focado, botão Columns2 na top bar — 2026-05-31
- [x] **IDE-16 · LSP TypeScript** — `monaco-languageclient` v10 via WebSocket; botão TS LSP na status bar; requer túnel 6009 + `typescript-language-server` na VPS — 2026-05-31
- [x] **IDE-17 · Port Forwarding** — `TunnelService` (ssh2.forwardOut); aba Portas no painel esquerdo; IPC tunnel:open/close/list; link "Abrir no navegador" — 2026-05-31
- [x] **IDE-18 · DAP debug remoto** — `debug:openDevTools` abre janela Electron com Chrome DevTools conectado a `ws://localhost:9229`; requer túnel 9229 + `node --inspect` na VPS — 2026-05-31

---

## Backlog App (funcionalidades não-IDE)

- [x] **Testes automatizados** — Vitest: 13 testes em @cwm/config + 5 em @cwm/core (18 total) — 2026-05-31
- [x] **Import/export** — exportar/importar VPS+projetos+contas em JSON; botões na página de Configurações — 2026-05-31
- [x] **SSH passphrase** — campo "Senha SSH" vira passphrase quando chave privada está configurada; Windows OpenSSH agent via named pipe — 2026-05-31
- [x] **Auto-update** — electron-updater instalado; verifica GitHub Releases silenciosamente em produção — 2026-05-31
- [x] **Packaging** — NSIS installer + portable .exe; `pnpm package:win`; wizard com atalhos e licença — 2026-05-31

---

## Concluídas

- [x] **V.0.1.0** — Scaffold completo: monorepo, docs, packages, Electron app, React UI — 2026-05-29
- [x] **Migrar build para electron-vite** — main process bundado via Rollup — 2026-05-30
- [x] **SSH real via ssh2** — `VpsService.testConnection` com `ssh2` nativo — 2026-05-30
- [x] **Claude Code check** — badges de status no Launcher — 2026-05-30
- [x] **NEX-ALS IDE v1** — Explorer SFTP + Monaco Editor + Terminal xterm.js em painéis redimensionáveis; rotas fullscreen; botão IDE no Lançador — 2026-05-30
- [x] **Fix startup bloqueadores** — remover `app.isPackaged` de nível de módulo; `scripts/dev.js` deleta `ELECTRON_RUN_AS_NODE` antes de spawnar; `pnpm dev` funciona — 2026-05-30
- [x] **IDE-01 Criar arquivo** — FilePlus + touch() + abre automaticamente — 2026-05-30
- [x] **IDE-04 Git integrado** — GitService completo (status/diff/add/restore/commit/push/pull); painel Source Control no IDE; branch na status bar — 2026-05-30
- [x] **IDE-06 Status bar melhorada** — branch git, Ln/Col, hint paleta — 2026-05-30
- [x] **IDE-07 Paleta de comandos** — Ctrl+Shift+P mapeado + botão ⌘ na top bar — 2026-05-30
- [x] **IDE-08 Find/Replace (Ctrl+H)** — addCommand garante atalho no Electron — 2026-05-30
- [x] **IDE-09 Go to Line (Ctrl+G)** — addCommand garante atalho no Electron — 2026-05-30
- [x] **IDE-11 Preview de imagem** — base64 SFTP + img tag — 2026-05-30
- [x] **IDE-12 Painel de Problemas** — onDidChangeMarkers + jumpToLine + badge — 2026-05-30
- [x] **IDE-13 Copiar/Duplicar arquivos** — cp -rp + clipboard — 2026-05-30
- [x] **IDE-14 Auto-refresh tree** — save + polling 30s — 2026-05-30
