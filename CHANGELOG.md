# CHANGELOG — NEX-ALS IDE

## [3.12.0] — 2026-06-10

### Adicionado — Múltiplas contas Claude Code com alternância rápida

Suporte a N contas Claude Pro na mesma máquina. Cada conta tem seu próprio diretório de configuração isolado (`CLAUDE_CONFIG_DIR`). Trocar de conta é um clique — sem logout/login manual.

#### Como funciona
- Cada conta fica em `~/.claude-<nome>-<id>/` — completamente isolada
- O spawn do CLI recebe `CLAUDE_CONFIG_DIR=<dir>` no ambiente, apontando para a conta ativa
- `getActiveClaudeEnv()` — helper centralizado que resolve configDir da conta ativa e monta PATH correto; usado por `claude:check`, `ai:stream:start` e `squad:stream:start`
- Tabela `claude_code_accounts` no SQLite: `id`, `name`, `configDir`, `isActive`, `createdAt`

#### Fluxo para adicionar segunda conta
1. Configurações → Claude Code → **Adicionar conta** → digitar nome (ex: "Conta 2")
2. A IDE gera o `configDir` automaticamente e mostra o comando de autenticação
3. No terminal: `CLAUDE_CONFIG_DIR="<dir>" claude` → fazer login com a segunda conta
4. Clicar **Usar esta** para alternar — todos os streams (AI Hub, IDE chat, Squad) passam a usar a conta selecionada

#### Arquivos modificados
- `packages/db/src/index.ts` — tabela `claude_code_accounts`
- `apps/desktop/src/ipc/handlers.ts` — `getActiveClaudeEnv()`, handlers `claude:accounts:*`, spawns atualizados
- `apps/desktop/src/preload.ts` — novos canais autorizados
- `apps/web/src/lib/ipc.ts` — `ipc.claude.accounts.*`
- `apps/web/src/pages/SettingsPage.tsx` — `ClaudeCodeCard` redesenhado com lista de contas

---

## [3.11.0] — 2026-06-10

### Adicionado — Claude Code como provedor de conta (sem API Key)

Integração do Claude Code CLI instalado localmente como provedor de IA. Usa a conta Claude Pro do usuário via autenticação OAuth já existente no CLI — sem cobrar por token, sem precisar de API Key separada.

#### Como funciona
- O `ai:stream:start` detecta quando o provider é `claude-code` e roteia para um subprocess local em vez de chamar a API diretamente
- O subprocess executa `claude -p "<prompt>" --output-format text --no-color` e transmite stdout como chunks de streaming para o renderer
- O PATH do Electron é enriquecido com o diretório global do npm (`%APPDATA%\npm` no Windows) para garantir que o CLI seja encontrado
- Todo o AI Hub, IDE chat e Squad funcionam transparentemente com a conta Pro

#### Arquivos modificados
- `apps/desktop/src/ipc/handlers.ts`
  - `claudeProcs: Map` para rastrear subprocessos ativos
  - `ai:stream:start` — rota para subprocess quando `effectiveProvider === 'claude-code'`; detecta provider padrão no banco se não informado
  - `ai:stream:cancel` — cancela subprocess (`.kill()`) ou stream normal conforme o tipo
  - `claude:check` — detecta se `claude` CLI está instalado e autenticado; usa `spawn` com `shell: true` e PATH enriquecido
- `apps/desktop/src/preload.ts` — `claude:check` adicionado ao `ALLOWED_CHANNELS`
- `apps/web/src/lib/ipc.ts` — `ipc.claude.check()` adicionado
- `apps/web/src/pages/SettingsPage.tsx` — `ClaudeCodeCard`: detecta CLI, exibe versão e status, botão "Usar como padrão"

#### Instalação (uma vez)
```bash
npm install -g @anthropic-ai/claude-code
claude   # abre browser para login com conta Claude Pro
```

---

## [3.10.0] — 2026-06-10

### Adicionado — Squad: equipe de 8 agentes de IA com execução na VPS e Pipeline

#### Página Squad (`apps/web/src/pages/SquadPage.tsx`)
- 8 agentes especializados: Jarvis (PM/Claude), Friday (Dev/GPT), Fury (Pesquisa/Gemini), Shuri (UX/Claude), Pepper (Marketing/GPT), Vision (Growth/Gemini), Requis (Docs/Claude), Tester (QA/GPT)
- Chat com streaming em tempo real por agente; histórico de sessões persistido em SQLite
- Delegação automática: quando um agente menciona `@outro` na resposta, o segundo agente é invocado automaticamente (profundidade máxima 1, evita loops)
- Menção direta no input: `@friday implementa X` redireciona para Friday sem trocar o agente ativo manualmente
- Layout 3 painéis: lista de agentes (esquerda), chat central, configurações + histórico (direita)

#### Blocos de ação ACTION tags
- Friday e Tester podem gerar blocos executáveis: `SHELL`, `WRITE_FILE`, `READ_FILE`
- Botão "Executar" por bloco — executa via SSH/SFTP na VPS selecionada
- Resultado do comando aparece inline embaixo do bloco (verde = ok, vermelho = erro)
- Conteúdo ACTION é removido do texto da mensagem antes de exibir (fica só o bloco visual)

#### Modo Pipeline (homolog → confirmação → produção)
- Toggle "PIPELINE" no painel direito — ao ativar, exibe seletor de VPS de Produção
- Fluxo: Executar no Homolog → se OK, gate âmbar com botões Aprovar / Rejeitar → Aprovar executa em Prod
- Estados visuais do gate: âmbar (pendente), azul (executando), verde (concluído), vermelho (falha), cinza (rejeitado)
- Proteção: se o campo VPS Prod estiver vazio ("— VPS Prod —"), o Aprovar não executa nada

#### Infraestrutura
- `packages/core/src/squad/agents.ts` — personalidades, prompts e ACTION_INSTRUCTIONS dos 8 agentes
- `packages/core/src/squad/actions.ts` — `parseActions()` e `stripActions()` para processar ACTION tags
- `packages/core/src/squad/squad.service.ts` — serviço de streaming usando AiService existente
- `packages/db/src/index.ts` — tabelas `squad_sessions` e `squad_messages` criadas via DDL no `initializeDatabase()`
- `apps/desktop/src/ipc/handlers.ts` — handlers: `squad:session:*`, `squad:stream:*`, `squad:action:execute`
- `apps/desktop/src/preload.ts` — canais Squad adicionados ao `ALLOWED_CHANNELS`
- `apps/web/src/lib/ipc.ts` — namespace `ipc.squad.*` no renderer; guard null para `window.electron`
- `apps/desktop/src/main.ts` — `setupCSP()` movida para `if (app.isPackaged)` (dev mode sem bloqueio de scripts Vite)
- `apps/web/src/App.tsx` — `ErrorBoundary` adicionado para capturar erros de render sem crashar o app

#### Documentação
- `docs/GUIA_INICIANTE.md` — seção Squad adicionada: agentes, blocos de ação, Pipeline, glossário expandido

---

## [3.9.0] — 2026-06-04

### Adicionado — Melhorias incrementais no IDE

- **Rename inline com F2** — clicar em qualquer entrada no explorador a seleciona (highlight azul); pressionar `F2` abre o input de renomeação inline diretamente, sem precisar do menu de contexto. `Enter` confirma, `Esc` cancela. `selectedEntryRef` + `selectedPath` state; atualiza `onContextMenu` também.
- **Ctrl+Shift+T — Reabrir aba fechada** — `closeTab` empurra o arquivo removido para `closedTabsRef` (stack, máx 15 entradas, preserva conteúdo e estado `savedContent`). `Ctrl+Shift+T` no teclado faz pop do topo e reabre a aba; não reabre se o mesmo caminho já está aberto.
- **Busca em arquivos no Modo Local** — `handleSearch` agora funciona sem VPS: usa `ipc.local.exec('rg ... || findstr ...')` no diretório raiz da pasta aberta; ripgrep prioritário (mais rápido), findstr como fallback Windows; resultados normalizados para caminhos absolutos; display no painel mostra caminho relativo à raiz local. Guard `!vpsId` removido.
- **Diffview no Modo Local** — `handleLocalDiff` roda `git diff -- "<filePath>"` via `ipc.local.exec`; exibe no diff viewer Monaco (mesmo componente do modo VPS) com label relativo à raiz; toast quando sem alterações; botão **Diff** (ícone `GitCommit`) aparece no top bar do IDE quando em modo local e um arquivo está aberto.

---

## [3.8.0] — 2026-06-04

### Adicionado — Autenticação interna multi-usuário

- **`bcryptjs`** adicionado como dependência de `@cwm/core` (hash/verify de senha, puro JS, sem binários nativos)
- **Tabela `app_users`** no SQLite — `id`, `username` (UNIQUE), `passwordHash`, `role` (`admin`|`viewer`), `createdAt`, `updatedAt`; criada por DDL no `initializeDatabase()` existente (não quebra instalações sem usuários)
- **`AuthService`** em `packages/core/src/auth/auth.service.ts` — `createUser`, `validatePassword` (bcrypt compare), `listUsers`, `deleteUser`, `changePassword`, `countUsers`
- **IPC `auth:*`** (8 canais) — `auth:status`, `auth:setup`, `auth:login`, `auth:logout`, `auth:currentUser`, `auth:users:list`, `auth:users:create`, `auth:users:delete`, `auth:users:changePassword`
- **Sessão em memória** no main process (`handlers.ts`) — `session: AppUser | null`; `sessionRequired` inicializado assincronamente a partir do `countUsers()`
- **Modo backward-compat** — instalações sem usuários continuam funcionando sem login; auth é exigido apenas quando `sessionRequired = true` (ao menos 1 usuário no banco)
- **Guards de permissão** — `requireAdmin()` + `requireAuth()` nas operações mutantes: `vps:create/update/delete`, `projects:create/update/delete`, `accounts:create/update/delete`, `settings:update`, `config:export/import`, `notifications:setEnabled`
- **`AuthContext`** — `AuthProvider` + `useAuth()` hook; `auth:status` no mount; `login`, `logout`, `setup`, `refresh`
- **`SetupPage`** — wizard de primeiro uso; cria a conta admin; mostrada quando `needsSetup=true`
- **`LoginPage`** — formulário username + senha; botão show/hide; mostrada quando `sessionRequired && !user`
- **`App.tsx`** refatorado — `AuthProvider` envolve tudo; `AppRoutes` decide entre Setup/Login/app normal baseado no estado do `AuthContext`; spinner durante loading
- **Sidebar (`Layout.tsx`)** — card com avatar, username, role (`Administrador`/`Visualizador`), botão logout (LogOut icon); só visível quando `sessionRequired`
- **Seção "Usuários" em Configurações** — visível apenas para admins; lista usuários com role badge (`ShieldCheck`/`Shield`); botão excluir (bloqueia excluir a si mesmo); formulário criar novo usuário (username + senha + role)

---

## [3.7.0] — 2026-06-04

### Adicionado — LSP multi-linguagem (IDE-22)

- **`apps/web/src/lib/lsp.ts` refatorado** — suporta 4 language servers simultaneamente via WebSocket tunnel:
  - **TypeScript/JavaScript** — porta 6009 (`typescript-language-server`) — existente, sem alteração funcional
  - **Python** — porta 6010 (`pylsp` — `pip install python-lsp-server`)
  - **Rust** — porta 6011 (`rust-analyzer` — `rustup component add rust-analyzer`)
  - **Go** — porta 6012 (`gopls` — `go install golang.org/x/tools/gopls@latest`)
- **`LSP_CONFIGS`** — mapa exportado com `port`, `label`, `name`, `documentSelector` por linguagem
- **`monacoLangToLspKey(monacoLang)`** — helper que converte ID Monaco (`typescript`, `python`, `rust`, `go`) para chave LSP
- **`disconnectAllLSP()`** — desconecta todos os clientes ativos; chamado no unmount do IDEPage
- **Botão LSP dinâmico na status bar** — label muda conforme a linguagem do arquivo aberto: `TS LSP`, `PY LSP`, `RS LSP`, `GO LSP`; oculto para linguagens não suportadas; tooltip inclui porta do túnel necessário
- **Wrapper WebSocket** — mesmo padrão Node.js para todos os language servers (1 liner `node -e "..."` na VPS); documentado nos comentários de `lsp.ts`

---

## [3.6.0] — 2026-06-04

### Adicionado — Testes E2E com Playwright

- **`@playwright/test` + `electron`** adicionados como devDependencies no root `package.json`
- **Scripts** `test:e2e` (requer build prévio) e `test:e2e:ci` (`pnpm build &&` playwright) na raiz
- **`e2e/playwright.config.ts`** — timeout 40s, workers=1 (Electron serial), HTML report, screenshot on failure, trace on retry
- **`e2e/global-setup.ts`** — limpa `e2e/.test-db/` antes de cada run para garantir banco isolado
- **`e2e/helpers/app.ts`** — `launchApp()` inicia Electron com DB SQLite isolado por PID+timestamp + `ELECTRON_RENDERER_URL` apontando para `apps/web/dist/`; `closeApp()` encerra sem deixar processo zumbi
- **`e2e/tests/01-launch.spec.ts`** — 5 testes: título da janela, janela visível, sidebar brand, links de navegação presentes, botão AI HUB
- **`e2e/tests/02-navigation.spec.ts`** — 8 testes: navega para VPS, Projetos, Lançador, Monitor, Configurações, Manual, Diagnóstico; volta ao Dashboard
- **`e2e/tests/03-vps.spec.ts`** — 8 testes: estado vazio, abrir modal (2 formas), fechar, Salvar desabilitado sem campos, criar VPS (aparece na lista), botão Testar, editar VPS
- **`e2e/tests/04-settings.spec.ts`** — 8 testes: seção Notificações, toggle visível, toggle inicia ativado, toggle on/off, seção Provedores IA, Anthropic presente, seção Backup, botões Exportar/Importar

---

## [3.5.2] — 2026-06-04

### Alterado

- **Configurações simplificadas** — removidas as seções "VS Code" (vscodePath, vscodeInsidersPath) e "SSH" (sshKeyPath) da página de Configurações; os campos permanecem no banco com os valores padrão (`code`, `~/.ssh/id_rsa`); a página agora exibe apenas Notificações, Provedores de IA e Backup/Restauração
- **Subtítulo de Configurações** atualizado de "Caminhos, preferências e provedores de IA" para "Preferências e provedores de IA"
- **Manual de Uso atualizado** — versão corrigida para v3.5.1 em todo o Help.tsx; seção Modo Local atualizada com agente autônomo; seção Modo Agente reescrita com novos limites (500 ações, botão Parar, modo local); nova seção Notificações de Sistema adicionada

---

## [3.5.1] — 2026-06-04

### Corrigido

- **`local:writeFile` e `local:touch` criam pastas pai automaticamente** — ao salvar `api/controllers/user.js` em modo local, as pastas `api/` e `api/controllers/` são criadas com `fs.mkdir({ recursive: true })` antes de escrever o arquivo. Antes disso, o agente falhava silenciosamente ao tentar criar arquivos em subpastas inexistentes.

---

## [3.5.0] — 2026-06-04

### Adicionado — Agente Autônomo Local

- **IPC `local:exec`** — novo handler em `handlers.ts` que executa qualquer comando via `child_process.exec` no diretório do projeto local; timeout 120s; retorna `{ success, output }` com stdout+stderr combinados; adicionado ao preload e ao helper `ipc.local.exec(cmd, cwd?)`
- **`execute_command` no modo local** — a ferramenta do agente que antes retornava erro em modo local agora executa via `local:exec`; sem necessidade de VPS; suporta `npm install`, `node`, `build`, criação de pastas, qualquer comando Windows/PowerShell
- **`search_files` no modo local** — usa ripgrep (`rg`) se disponível no PATH, senão `findstr` nativo do Windows; busca em todos os arquivos do projeto sem VPS
- **Agente autônomo sem pausa** — o loop do agente passou de MAX=50 com pausa manual para MAX=500 com auto-continuar; a cada 50 ações uma mensagem de progresso é exibida automaticamente; o agente só para quando a IA retorna texto sem tool calls (conclusão natural) ou o usuário clica **Parar**
- **Botão Parar** — substitui o banner "Continuar"; visível durante execução do agente; interrompe o loop na próxima iteração sem perder o histórico; label "⏹ Parar"
- **Descrição das ferramentas atualizada** — `execute_command` não diz mais "apenas modo remoto"; deixa claro que funciona em ambos os modos

---

## [3.4.0] — 2026-06-04

### Adicionado — Notificações de Sistema

- **`NotificationMonitor`** em `packages/core/src/notifications/notification-monitor.ts` — serviço de background que roda no main process; polling a cada 60s para todas as VPS cadastradas; lê CPU/RAM/Disco via SSH; dispara callback com `NotificationAlert` quando limites ultrapassados; cooldown de 30 min por VPS × tipo para evitar spam; tolerante a VPS offline (falha silenciosa)
- **Limites de alerta** — Disco ≥ 85%, CPU ≥ 90%, RAM ≥ 90%
- **Notificação nativa de erro no AI Hub** — quando o streaming é interrompido por erro e a janela não está focada, exibe notificação nativa do SO com a mensagem do erro
- **IPC `notifications:getEnabled` / `notifications:setEnabled`** — lê e persiste preferência na coluna `notificationsEnabled` da tabela `settings` (SQLite)
- **Toggle em Configurações** — nova seção "Notificações" na página de Settings com switch liga/desliga; estado lido do banco ao carregar; persiste imediatamente ao alternar
- **Migração DDL incremental** — `ALTER TABLE "settings" ADD COLUMN "notificationsEnabled" INTEGER NOT NULL DEFAULT 1` (não quebra instalações existentes)

---

## [3.3.1] — 2026-06-02

### Melhorado

- **Manual de Uso (Help.tsx) — redesign completo** — Mapa do App refeito como grade de cards agrupados por objetivo (Gerenciamento · Desenvolvimento · IA · Deploy · Incidentes); copy orientado a benefício (máx. 1 linha por item, ~62% menos texto); hierarquia visual com dot colorido por grupo e cards destacados para AI Hub, Deploy Assistant e Incident Mode; nova seção "Dois modos de operação" com cards comparativos Remoto vs Local; novo subtítulo do cabeçalho descrevendo o app de forma completa
- **Layout.tsx** — versão na sidebar corrigida de `v3.0.0` para `v3.3.1`

### Adicionado

- **`docs/GUIA_INICIANTE.md`** — guia completo em linguagem acessível para desenvolvedores iniciantes: explica VPS, SSH, SFTP e API Key em termos simples; descreve cada tela do app; mostra o IDE, AI Hub, Modo Agente, Incident Mode e Deploy Assistant com diagramas ASCII; passo a passo do zero para configurar o app; FAQ e glossário de 13 termos técnicos

---

## [3.3.0] — 2026-06-01

### Adicionado

- **Project Memory UI** — `ProjectMemoryService` em `packages/core`; tabela `project_memory` (por VPS ou global); IPC `memory:list/save/delete/build`; aba **Memória** no painel lateral do AI Hub com CRUD inline (criar, editar, excluir blocos de contexto); filtro por VPS
- **Context Selector UI** — aba **Contexto** no painel lateral do AI Hub; seletor de VPS opcional; checkboxes: Logs, Docker, PM2, Métricas da VPS, Memória do projeto; ao enviar uma mensagem, os itens marcados são buscados em tempo real e injetados no `systemPrompt` da chamada de streaming; itens VPS-dependentes desabilitados quando nenhuma VPS está selecionada
- **Painel lateral direito** do AI Hub — colapsável (`PanelRightClose/PanelRightOpen`), duas abas: Contexto + Memória
- **ToolExecutor confirmação** no agente IDE — `execute_command` com padrões destrutivos (`docker rm/stop/restart`, `pm2 delete/stop/restart`, `git reset --hard`, `rm -rf`, `DROP TABLE`, `truncate`) exibe modal de confirmação; usuário precisa digitar **CONFIRMO** para autorizar; cancelar retorna aviso ao agente; funciona em modo VPS (não local)

---

## [3.2.0] — 2026-06-01

### Adicionado — Deploy Assistant

- **`createDeployWindow(vpsId, vpsName)`** em `main.ts` — janela 1200×800; IPC `window:openDeploy`; rota `#/deploy/:vpsId/:vpsName`
- **`DeployAssistantPage`** — layout 2 colunas:
  - **Esquerda:** formulário de descrição do deploy + campo de diretório do projeto; geração de plano via IA (streaming); lista de passos com status inline; botões "Executar Tudo" e "Executar" por passo; plano de rollback gerado automaticamente se um passo falhar
  - **Direita:** log de execução em tempo real (terminal-style); smoke test HTTP (`curl -s -o /dev/null -w "%{http_code}"`) com resultado de status code e latência
- **Parser de plano** — aceita resposta da IA em JSON (bloco ```json) ou formato markdown com `### Passo N` + `**Comando:**` + `**Risco:**`; fallback progressivo
- **Tiers de risco** — `low` executa direto; `medium` executa direto; `high` abre modal de confirmação antes de cada passo (ex: `docker stop`, `git reset --hard`, `rm -rf`)
- **Rollback automático** — ao falhar, envia os passos já executados à IA e pede plano de rollback; exibe e executa com botão "Executar Rollback"
- **Botão Rocket** no Launcher (por VPS) e na top bar do IDEPage (modo VPS)

---

## [3.1.0] — 2026-06-01

### Adicionado — Incident Mode

- **`createIncidentWindow(vpsId, vpsName)`** em `main.ts` — abre uma janela Electron dedicada (1440×900) em modo de emergência, título `🚨 INCIDENT MODE — {nome}`; IPC `window:openIncident`
- **`IncidentModePage`** (`/incident/:vpsId/:vpsName`) — layout 2×2 com 4 painéis:
  - **Diagnóstico IA** (top-left) — chat com streaming; ao montar, aguarda 1.5s para dados carregarem e dispara diagnóstico automático com contexto completo (CPU/RAM/Disco, Docker, PM2, logs recentes); continua como chat livre após o diagnóstico inicial
  - **Logs** (top-right) — campo de comando editável (default: `journalctl -n 100`); botão de refresh; auto-scroll para o final
  - **Docker + PM2** (bottom-left) — tabelas com estado de containers e processos; CPU%, RAM, restarts; cores: verde=ok, vermelho=problema
  - **Terminal de emergência** (bottom-right) — input de comando livre via `terminal:exec`; output acumulado com scroll
- **Top bar vermelha** — badge `🚨 INCIDENT MODE` pulsante; mini monitor inline (CPU/RAM/Disco/Uptime); botão Atualizar tudo; botão fechar
- **Botão `Siren`** no Launcher (por VPS) e na top bar do IDEPage (modo VPS) para abrir o Incident Mode
- **Auto-refresh 30s** para stats, docker e pm2

---

## [3.0.0] — 2026-06-01

### Adicionado — NEX-ALS AI HUB

- **Arquitetura multi-provider desacoplada** — `BaseProvider` abstrata com `sendMessage()`, `streamMessage()`, `validateKey()`, `listModels()`; providers isolados em `packages/core/src/ai/providers/`: `AnthropicProvider`, `OpenAICompatProvider` (OpenAI/DeepSeek/Groq/Mistral/xAI), `GeminiProvider`, `OpenRouterProvider`, `OllamaProvider`
- **KeyStore** (`key-store.ts`) — interface injetável para troca da implementação de armazenamento de chaves; implementação padrão em AES-256 SQLite; interface compatível com keytar para migração futura
- **ProviderManager** (`hub/provider-manager.ts`) — resolve o provider correto (padrão ou por nome), instancia a classe certa, consulta `KeyStore`
- **ModelRegistry** (`hub/model-registry.ts`) — catálogo de modelos por provider; cache 24h; `listModels()` dinâmico para OpenAI, OpenRouter e Ollama; estático para demais
- **ResponseStreamer** (`hub/response-streamer.ts`) — executa `streamMessage()` de forma assíncrona; emite chunks via callback; suporta cancelamento via `AbortController`; retorna `streamId`
- **ContextManager** (`hub/context-manager.ts`) — monta `context_block` a partir de `ContextSelection` (arquivo, seleção, árvore, código-fonte, logs, terminal, docker, pm2, vps, git diff, memória); prioridade de corte configurável quando estoura `maxChars` (80K default)
- **PromptBuilder** (`hub/prompt-builder.ts`) — templates de system prompt por modo: `chat`, `agent`, `sysadmin`, `deploy`, `incident`; injeta memória e contexto automaticamente
- **ConversationManager** (`hub/conversation-manager.ts`) — CRUD de sessões de chat persistidas em SQLite (`ai_conversations`, `ai_messages`); suporte a pin, título editável, paginação
- **ToolExecutor** (`hub/tool-executor.ts`) — tiers de autorização: `read` / `write` / `exec_safe` / `exec_dangerous`; `exec_dangerous` em PROD requer confirmação; log em `tool_execution_log`
- **AiService refatorado** — usa `ProviderManager.build()` em `chat()`, `chatAgent()`, `testProvider()`; novos métodos: `chatWithContext()`, `startStream()`, `cancelStream()`, `getModels()`; `conversations` getter para acesso ao `ConversationManager`
- **4 novas tabelas** em `initializeDatabase()`: `ai_conversations`, `ai_messages`, `project_memory`, `tool_execution_log`
- **Novos canais IPC**: `ai:models`, `ai:chatCtx`, `ai:stream:start`, `ai:stream:cancel`, `ai:stream:chunk` (push), `ai:conv:*` (8 handlers de conversa)
- **AIHubPage** (`/ai-hub`) — sidebar com histórico de conversas (pin, delete, edição de título), seletor de provider + modelo dinâmico, streaming token a token, cancelamento, cópia de mensagens
- **Botão AI HUB** na sidebar principal com destaque roxo (`Sparkles`)

---

## [2.8.0] — 2026-06-01

### Adicionado

- **Multi-monitor** — qualquer VPS pode ser aberta em uma janela Electron independente; `createIdeWindow(vpsId, vpsName)` em `main.ts` cria um `BrowserWindow` com a rota `#/ide/:vpsId/:vpsName` via HashRouter — dev: `loadURL` com hash; prod: `loadFile + { hash }`;  botão `ExternalLink` (⎋) no Lançador ao lado de cada botão IDE e na top bar do IDE (modo VPS); cada janela tem sessões SSH, SFTP, terminais e estado React completamente independentes; título da janela mostra o nome da VPS; IPC `window:openIde` registrado em `main.ts` (não em `handlers.ts` — não é serviço de negócio)

---

## [2.7.0] — 2026-06-01

### Adicionado

- **Snapshot/Rollback do Agente** — antes de cada `write_file`, o agente lê e salva o conteúdo original do arquivo em `agentSnapshotsRef` (apenas na primeira escrita por arquivo por sessão); painel laranja **📦 Snapshots** aparece no chat listando todos os arquivos modificados com botão **↩ Restaurar** por arquivo; clicar restaura o conteúdo original via SFTP ou `node:fs` e reabre o arquivo no editor; botão **✕ descartar** remove todos os snapshots da sessão; snapshots são limpos automaticamente ao iniciar nova conversa com o agente (preservados ao clicar em "Continuar"); arquivos **novos** criados pelo agente (sem conteúdo original) não geram snapshot

---

## [2.6.0] — 2026-06-01

### Adicionado

- **Modo Agente — 50 iterações + botão Continuar** — limite aumentado de 15 para 50 iterações; quando atingido, o histórico completo da conversa API (`apiMessages`) é preservado em `agentResumeRef`; um banner âmbar aparece no chat com o botão **▶ Continuar** que retoma o loop sem perder contexto; `handleAgentContinue` reabre a sessão SFTP e chama `runAgentLoop` com as mensagens salvas; o agente é marcado como não-pausado assim que termina naturalmente

---

## [2.5.0] — 2026-06-01

### Adicionado

- **Verificação de fingerprint SSH** — na primeira conexão com uma VPS, o fingerprint do host (SHA-256 da chave pública) é armazenado automaticamente no SQLite; nas conexões seguintes, o fingerprint é comparado e a conexão é **rejeitada** se mudar (possível ataque MITM); mensagem de erro clara com instrução para limpar via interface; aplica-se a todos os serviços SSH: VpsService, TerminalService, SftpService, GitService, TunnelService
- **Badge "Host verificado"** na listagem de VPS — ícone `ShieldCheck` verde quando fingerprint está armazenado; `ShieldOff` cinza quando não há fingerprint; tooltip exibe o fingerprint completo no formato `SHA256:...`
- **Botão "Limpar fingerprint"** (ícone âmbar `ShieldOff`) em cada card de VPS — abre confirmação e limpa o fingerprint armazenado; na próxima conexão, o novo fingerprint é aceito e armazenado automaticamente
- **`buildHostVerifier` helper** em `packages/core/src/ssh/ssh-connect.ts` — função centralizada que fabrica o `hostVerifier` para ssh2; usa `SHA256(rawKey).base64` para compatibilidade com ssh-keyscan
- **`VpsService.clearFingerprint(id)`** — método público para limpar o fingerprint via IPC `vps:clearFingerprint`
- **Campo `sshHostFingerprint TEXT`** na tabela `vps_servers` — adicionado via migração incremental em `initializeDatabase()`

---

## [2.4.0] — 2026-06-01

### Adicionado

- **Analisador de Disco por VPS** — botão "Analisar disco" em cada card do Monitor; abre modal com 4 seções: maiores diretórios (`du -sh /* | sort -rh | head -20`), uso Docker (`docker system df`), logs PM2 (`~/.pm2/logs/`) e logs do sistema (`/var/log/*`); cores por tamanho (verde < 1GB · amarelo 1-5GB · vermelho > 5GB); botão fica vermelho com ⚠ quando uso do disco ≥ 85%; IPC `monitor:diskUsage`; reutiliza `TerminalService.exec`

---

## [2.3.0] — 2026-05-31

### Adicionado

- **Modo Agente (AI Agent para VPS)** — ativa tool use no chat do IDE via botão 🤖; Claude pode chamar `read_file`, `write_file`, `list_directory`, `execute_command`, `search_files` por conta própria; agentic loop com até 15 iterações; display inline de cada tool call com input/output; suporte a Anthropic (tool use nativo) e todos os provedores OpenAI-compatible; Gemini não suportado; sessão SFTP aberta automaticamente durante o loop e fechada ao final
- **`AiService.chatAgent`** — novo método em `packages/core/src/ai/ai.service.ts`; normaliza formatos Anthropic e OpenAI-compatible em interface única; IPC `ai:chatAgent`; `ai:chatAgent` adicionado ao preload

### Corrigido

- **Chat idioma** — system prompt agora instrui Claude a responder sempre em português brasileiro
- **Botão "Aplicar todas as alterações"** — `root` nulo causava paths inválidos; agora valida o diretório raiz antes de salvar; mostra erro claro se não houver pasta aberta
- **Detecção de nomes de arquivos** — `extractFilenameHint` com 6 padrões (listas numeradas, bullet, hash, backtick, negrito)
- **Contexto do chat local** — incluía apenas árvore e docs; agora lê código-fonte (até 80KB, arquivos até 6KB cada)
- **"Aplicar" sobrescrevia todos os arquivos** — botões agora são "▶ arquivo.ts" + "Salvar como…" sempre visíveis e independentes

---

## [2.2.0] — 2026-05-31

### Adicionado

- **Histórico de Lançamentos** — página `/history` na sidebar; tabela com filtros por VPS, projeto e status (sucesso/erro); exibe timeAgo, data/hora, VPS, projeto e mensagem de erro; taxa de sucesso no header; IPC `history:list` com filtros via Prisma

---

## [2.1.0] — 2026-05-31

### Adicionado

- **Logs Viewer** — aba "Logs" no painel inferior do IDE; campo de comando livre; presets rápidos (syslog, nginx error, nginx access, PM2 all, journald); modo Watch com auto-refresh a cada 3 segundos; scroll automático para o final; reutiliza `terminal:exec` sem novo IPC

---

## [2.0.0] — 2026-05-31

### Adicionado

- **PM2 / Process Manager** — aba "PM2" no painel esquerdo do IDE; lista processos com nome, status, CPU%, RAM e número de reinicializações; ações: Restart, Stop, Start, Logs (overlay inline), Excluir; badge mostra N processos online; IPC `pm2:list/restart/stop/logs/delete` via `pm2 jlist` SSH exec; strip ANSI automático

---

## [1.9.0] — 2026-05-31

### Adicionado

- **Docker Explorer** — aba "Docker" no painel esquerdo do IDE; lista containers (nome, imagem, status, ports); ações: Start, Stop, Logs (overlay inline), Remover (confirmação); badge mostra N containers rodando; IPC `docker:list/start/stop/logs/remove` via SSH exec com formato JSON

---

## [1.8.0] — 2026-05-31

### Adicionado

- **Chat IA — API direta** — IDEPage detecta automaticamente se há provedor de IA configurado nas Settings; se sim, usa `ai:chat` (chamada HTTP direta, 2-5s) em vez de `claude -p` via SSH (15-30s); o histórico completo da conversa é enviado ao provedor; o cabeçalho do chat exibe o modo ativo ("Anthropic", "DeepSeek", "claude -p (SSH)", etc.); fallback transparente: sem provedor configurado, comportamento anterior é mantido; funciona sem VPS quando há provedor

### Alterado

- Tooltip do botão "Claude" na top bar passa a indicar o modo ativo
- Mensagem do estado vazio do chat diferencia API direta de SSH
- Guard `handleChatSend` permite enviar sem VPS quando há provedor IA

---

## [1.7.0] — 2026-05-31

### Adicionado

- **Provedores de IA multi-provider** — suporte a 7 provedores configuráveis: Anthropic (Claude), DeepSeek, OpenAI, Gemini, Groq, Mistral/Codestral, xAI Grok
- **AiService** — `packages/core/src/ai/ai.service.ts`; CRUD de providers + chat; usa `fetch` nativo (Node.js 22); cada provedor tem implementação separada: Anthropic (API própria), Gemini (API própria), todos os demais via formato OpenAI-compatible
- **Tabela `ai_providers`** — SQLite via DDL incremental em `initializeDatabase()`; campos: `provider` (PK), `apiKey` (AES-256), `model`, `enabled`, `isDefault`, `updatedAt`; sem migrations automáticas, sem quebrar instalações existentes
- **IPC** — `ai:list`, `ai:save`, `ai:delete`, `ai:test`, `ai:chat`; adicionados ao preload e ao `ipc.ts`
- **Settings — Provedores de IA** — nova seção na página de Configurações com cards expansíveis por provedor; cada card: toggle habilitado/padrão, seletor de modelo, input de API Key (com show/hide), botão Testar conexão, botão Remover; indicadores de status ("Configurado", "Padrão"); dica sobre custo (Groq grátis, DeepSeek o mais barato)
- **Tipos em `@cwm/config`** — `AiProviderConfig`, `AiChatMessage`, `AiChatInput`

### Segurança

- API Keys armazenadas criptografadas AES-256-CBC (mesmo sistema das senhas SSH)
- Chave mascarada na listagem (`••••••••1234`); chave plain usada apenas no momento da chamada HTTP
- Salvar sem alterar a key (campo vazio ou com mask) mantém a key existente — sem risco de apagar acidentalmente

---

## [1.6.0] — 2026-05-31

### Adicionado

- **Monitor de VPS** — nova página `/monitor` acessível pela sidebar; exibe cards por VPS com métricas coletadas via SSH exec: CPU (load average 1/5/15min + % calculado sobre núcleos), RAM (usado/total em MB), Disco (`/` — usado/total/disponível/%), Uptime; auto-refresh a cada 30s; refresh manual por card ou global; cores adaptativas: verde < 60%, amarelo 60-84%, vermelho ≥ 85%; loading skeleton durante primeira carga; estado de erro ao VPS offline
- **IPC `monitor:getStats`** — executa comando SSH único que retorna LOAD/CORES/MEM/DISK/UPTIME; parseia saída com fallbacks para comandos ausentes; reutiliza `TerminalService.exec` sem duplicar lógica SSH
- **Nav "Monitor"** com ícone `BarChart3` na sidebar

---

## [1.5.0] — 2026-05-31

### Adicionado

- **IDE-15 · Split editor** — botão `⊟` na top bar divide o editor em dois painéis horizontais (50/50); cada painel tem sua própria barra de abas; Ctrl+S salva no painel focado; clicar num painel muda o foco; abrir arquivo vai para o painel ativo; fechar split com o mesmo botão
- **IDE-16 · TypeScript LSP** — `monaco-languageclient` v10 conecta via WebSocket ao `typescript-language-server` da VPS; botão `TS LSP` na status bar (verde quando ativo); requer túnel SSH na porta 6009 e `typescript-language-server` instalado na VPS; `apps/web/src/lib/lsp.ts`
- **IDE-17 · Remote Port Forwarding** — nova aba "Portas" no painel esquerdo; cria túneis `localhost:X → VPS:Y` via `ssh2.forwardOut`; lista túneis ativos; botão "Abrir no navegador"; fechar túnel; `TunnelService` em `packages/core/src/tunnel/`; IPC `tunnel:open`, `tunnel:close`, `tunnel:list`
- **IDE-18 · Depuração remota DAP** — botão `⬡ DAP` na status bar; abre janela Electron com Chrome DevTools Protocol apontado para `ws://localhost:9229`; requer túnel 9229→9229 e `node --inspect` na VPS; `apps/web/src/lib/dap.ts`; IPC `debug:openDevTools`

### Fluxo de uso IDE-16 (LSP):
```
VPS: npm i -g typescript-language-server typescript ws websocat
     websocat --text -E tcp-l:0.0.0.0:6009 exec:typescript-language-server\ --stdio
IDE: Painel Portas → túnel 6009→6009 → status bar "TS LSP" → clique
```

### Fluxo de uso IDE-18 (DAP):
```
VPS: node --inspect=0.0.0.0:9229 server.js
IDE: Painel Portas → túnel 9229→9229 → status bar "⬡ DAP" → clique
```

---

## [1.4.0] — 2026-05-31

### Adicionado

- **Packaging Windows** — `pnpm package:win` gera instalador NSIS (`.exe`) + versão portátil (`.exe` standalone) com wizard de instalação (diretório configurável, atalho no Desktop e Start Menu, licença); config `publish` aponta para GitHub Releases (fasterdrible-lab/HEXAGON-IDE); pasta `apps/desktop/build/` com `LICENSE.txt` e instrução de ícone
- **Import/Export de configurações** — botões "Exportar backup (.json)" e "Importar backup" na página de Configurações; exporta todas as VPS, projetos e contas cadastradas em JSON com timestamp; importa de forma não-destrutiva (não sobrescreve registros existentes); senhas SSH não exportadas; IPC `config:export` e `config:import` com dialog nativo de salvar/abrir arquivo
- **SSH passphrase** — chave SSH com passphrase agora funciona: quando há chave privada configurada, o campo "Senha SSH" vira a passphrase da chave (em vez de senha do servidor); suporte ao SSH agent do Windows via named pipe `\\.\pipe\openssh-ssh-agent` (além de `SSH_AUTH_SOCK` no Unix)
- **Auto-update** — `electron-updater` instalado; em produção verifica atualizações silenciosamente ao iniciar via `autoUpdater.checkForUpdatesAndNotify()`; publicação via GitHub Releases configurada
- **Testes automatizados** — Vitest adicionado aos pacotes `@cwm/config` e `@cwm/core`; 18 testes passando: encryptPassword/decryptPassword, Zod schemas (VPS, Project, ClaudeAccount, Settings), parsing de status Git (staged/unstaged/untracked, ahead/behind)

### Alterado

- Descrição do `@cwm/desktop` atualizada para "NEX-ALS IDE — gerenciador de ambientes VPS com IDE integrado"
- Scripts `package:win` e `package:dir` adicionados ao `apps/desktop/package.json` e `pnpm package:win` na raiz
- `pnpm test` roda os testes dos pacotes

---

## [1.3.2] — 2026-05-31

### Adicionado

- **Chat · Botões Copiar e Aplicar** — mensagens do Claude com blocos de código ganham botão "Copiar" (clipboard) e "▶ Aplicar em arquivo.tsx" (substitui conteúdo do arquivo ativo no Monaco, marca como dirty para revisão com Ctrl+S)
- **Chat · Salvar como** — quando não há arquivo aberto, botão vira "▶ Salvar como…" com input inline para digitar caminho relativo; cria o arquivo no projeto, abre no editor e atualiza a tree
- **Chat · Colar print (Ctrl+V)** — textarea aceita paste de imagem; badge "📷 Print anexado" confirma recebimento; imagem enviada inline no prompt para o Claude
- **Chat · Contexto automático do projeto local** — ao usar o chat em modo local, envia automaticamente: árvore de pastas (2 níveis, ignorando `node_modules`/`.git`/etc.), arquivos-chave (`CLAUDE.md`, `README.md`, `docs/TASKS.md`, `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`) e conteúdo do arquivo aberto no editor
- **Chat · Instrução offline** — prompt inclui aviso explícito para Claude não tentar ler arquivos do disco e usar apenas o conteúdo fornecido inline
- **Chat · Timer de espera** — exibe "Claude pensando… Xs" com contagem durante o processamento
- **IPC `clipboard:readImage`** — main process usa `nativeImage` do Electron para ler imagem do clipboard; retorna path do arquivo temp PNG

### Corrigido

- **Chat · `stdin` warning** — adicionado `< /dev/null` no comando `claude -p` para suprimir aviso de stdin
- **Chat · Prompt via arquivo SFTP** — prompt escrito em `/tmp/hexagon_chat_<ts>.txt` via SFTP antes de executar, evitando escaping de shell e limite de tamanho de linha de comando
- **Chat · `--image` não suportado** — flag `--image` removida (não existe no `claude -p`); imagem enviada como bloco base64 inline no prompt
- **Chat · Contexto do projeto local** — adicionada instrução explícita para Claude usar conteúdo inline e não tentar acessar o filesystem da VPS
- **Botão Aplicar** — mostra nome do arquivo alvo ("Aplicar em arquivo.tsx") em vez de label genérico; exibe erro claro quando nenhum arquivo está aberto
- Timeout `terminal:exec` aumentado para 120s para respostas longas do Claude

### Limitações conhecidas

- `claude -p` não processa imagens como visão real (multimodal); para análise de imagem, prefer colar o **texto** do erro no chat
- Para suporte multimodal completo e respostas mais rápidas, seria necessário API Key da Anthropic

---

## [1.3.1] — 2026-05-30

### Corrigido / Melhorado

- **Chat Claude em modo local** — chat agora disponível ao editar pastas locais (OneDrive); seletor de VPS no header do painel permite escolher onde `claude -p` executa sem abrir a VPS no IDE
- **Botão Claude mais visível** — substituído ícone invisível por botão com label "Claude" + cor roxa na top bar de ambos os modos
- `chatVpsId` centraliza qual VPS é usada em `handleChatSend`; no modo remoto usa a VPS atual; no modo local carrega lista de VPS via `ipc.vps.list()`

---

## [1.3.0] — 2026-05-30

### Adicionado

- **IDE-19 · Badge PRODUÇÃO** — indicador vermelho pulsante na top bar sempre que o IDE estiver conectado a uma VPS remota; badge verde "Local" no modo local
- **IDE-20 · Modo Local** — nova rota `/ide/local`; botão "Abrir pasta local" no Lançador; dialog nativo do SO para escolha de pasta; IPC `local:*` completo (readdir, readFile, readFileBase64, writeFile, mkdir, delete, rename, touch); filesystem abstraction (`fsReaddir`, `fsReadFile`, etc.) que alterna entre SFTP e `node:fs/promises`; terminal e painel Git ocultos no modo local; badge verde "Local" na top bar
- **IDE-21 · Chat Claude via SSH** — painel lateral direito redimensionável (botão `Bot` na top bar, só modo remoto); contexto do arquivo ativo enviado automaticamente (até 3000 chars); executa `claude -p '...'` na VPS via `terminal:exec` com timeout de 60s; histórico de mensagens com bolhas visuais; Enter = enviar, Shift+Enter = nova linha; botão limpar histórico

### Alterado

- `terminal:exec` IPC aceita `timeout?` opcional (usado pelo chat para aguardar Claude)
- `ipc.terminal.exec()` atualizado para repassar `timeout`
- `setupIpcHandlers()` agora recebe `win?: BrowserWindow` para o dialog de pasta nativa
- `createWindow()` chamado antes de `setupIpcHandlers()` no main process

---

## [1.2.0] — 2026-05-30

### Alterado

- **Repositório renomeado** — `Claude-Workspace-Manager` → `HEXAGON-IDE` no GitHub (`https://github.com/fasterdrible-lab/HEXAGON-IDE.git`)
- Remote local atualizado (`git remote set-url origin`)
- `CLAUDE.md` e `AGENTE.md` reescritos para refletir o nome oficial **NEX-ALS IDE** e incluir a URL do repositório
- Versão bumped `1.1.1 → 1.2.0` (marco: IDE completo + rename oficial)

---

## [1.1.1] — 2026-05-30

### Adicionado

- **IDE-08 · Find/Replace (Ctrl+H)** — `addCommand` em `handleEditorMount` registra explicitamente `editor.action.startFindReplaceAction`, garantindo que o Electron não intercepte o atalho antes do Monaco
- **IDE-09 · Go to Line (Ctrl+G)** — `addCommand` em `handleEditorMount` registra explicitamente `editor.action.gotoLine`, garantindo que o atalho funcione mesmo com foco fora do editor
- **IDE-12 · Painel de Problemas** — aba "Problemas" no painel inferior (ao lado de "Terminal"); lista erros/avisos do Monaco via `onDidChangeMarkers`; badge com contagem colorido (vermelho/âmbar); clique em item navega para a linha (`jumpToLine`); ícone `Check` quando não há problemas

### Corrigido

- Import `WifiOff` não utilizado removido (TS6133)
- Parâmetro anônimo do `markers.map` tipado como `import('monaco-editor').editor.IMarker` (TS7006)

### Observação técnica

- **IDE-10 (Breadcrumbs)** — `breadcrumbs` não existe em `IStandaloneEditorConstructionOptions`; é propriedade exclusiva do VS Code completo. Tarefa marcada como N/A.

---

## [1.1.0] — 2026-05-30

### Adicionado

- **IDE-11 · Preview de imagem** — PNG, JPG, JPEG, GIF, WebP, ICO abrem no editor como `<img>` (background escuro, centralizado, max-height 75%); leitura via `sftp:readFileBase64`; MIME detectado por extensão; tab integrada ao sistema de tabs existente
- **IDE-13 · Copiar/Duplicar arquivos** — context menu expandido com "Duplicar" (`cp -rp` via SSH, nome `_copia`), "Copiar caminho" (clipboard) e separadores visuais; funciona para arquivos e diretórios
- **IDE-14 · Auto-refresh da tree** — refresh da pasta pai ao salvar (`Ctrl+S`); polling de 30s atualiza `/root` e todos os diretórios expandidos sem bloquear UI (usa `expandedFoldersRef` para evitar re-criação de interval)
- `SftpSession.readFileBase64(path)` — lê arquivo remoto como Buffer e retorna string base64
- IPC `sftp:readFileBase64` + preload whitelist + helper `ipc.sftp.readFileBase64`

### Alterado

- `BIN_EXT` removeu `png,jpg,jpeg,gif,webp,ico` (agora preview); adicionado `IMG_PREVIEW` set separado
- Context menu: 2 itens → 4 itens com separadores

---

## [1.0.9] — 2026-05-30

### Adicionado

- **IDE-02 · Tree view hierárquica** — explorer expandível inline por pasta (lazy load por pasta); chevron rotaciona ao expandir; indentação por profundidade; `activeDir` rastreia a pasta ativa para criação de arquivos/pastas; `flattenTree()` produz lista plana a partir do estado de expansão
- **IDE-03 · Find in Files (Ctrl+Shift+F)** — painel "Busca" no switcher esquerdo; input de query + filtro glob (ex: `*.ts,*.tsx`) + toggle case-sensitive; executa `grep -rn` via SSH (`terminal:exec`); resultados agrupados por arquivo com número de linha; click abre o arquivo e revela a linha no Monaco
- **IDE-05 · Múltiplas abas de terminal** — tab bar com título, indicador de status colorido (verde/vermelho/piscando), botão `+` para novo terminal, `×` para fechar; cada aba é uma sessão SSH independente (`ipc.terminal.open`); containers xterm montados via callback ref, visibilidade via `display: block/none` (preserva histórico); `switchTermTab` re-fits ao trocar
- `TerminalService.exec(vpsId, cmd, timeout)` — SSH exec one-shot para comandos não-interativos
- IPC `terminal:exec` + whitelist preload + helper `ipc.terminal.exec`

### Alterado

- IDEPage: `curPath`+`entries` substituídos por `rootEntries`+`expandedFolders`+`folderChildren`+`loadingFolders`+`activeDir` (estado de árvore hierárquica)
- IDEPage: terminal único → array `termTabs` + `termInstancesRef` Map (multi-tab)
- IDEPage: painel esquerdo tem 3 tabs (Files, Search, Git) em vez de 2
- `TerminalService.openShell` refatorado para usar `sshConnect()` privado (DRY)

---

## [1.0.8] — 2026-05-30

### Adicionado

- **IDE-07 · Paleta de comandos** — `Ctrl+Shift+P` abre a paleta nativa do Monaco; botão `⌘` na top bar; `Escape` fecha diff
- **IDE-01 · Criar arquivo** — botão `FilePlus` no explorer; input inline com `Enter`/`Escape`; arquivo aberto automaticamente após criação; IPC `sftp:touch` + `SftpSession.touch()`
- **IDE-04 · Git integrado** — painel Source Control completo no NEX-ALS IDE:
  - Tab "Git" na esquerda com badge de contagem de alterações
  - Status: branch atual, commits ahead/behind (↑↓)
  - Seções: Staged, Alterações, Não rastreados — com ícones de status (M/A/D/U)
  - Stage/Unstage por arquivo ou "Stage all" / "Unstage all"
  - Diff viewer: clique no arquivo → diff colorido no Monaco (linguagem `diff`)
  - Commit: textarea de mensagem + botão com contagem de arquivos staged
  - Push / Pull com feedback de resultado
  - Branch e contagem de alterações na **status bar** inferior
- **Status bar melhorada**: branch git (clicável → abre painel git), `Ln X, Col Y` ao editar, hint `Ctrl+Shift+P`
- **Cursor position tracking**: `editor.onDidChangeCursorPosition` atualiza status bar em tempo real
- `GitService` em `packages/core/src/git/git.service.ts` com: `status`, `diff`, `add`, `restore`, `commit`, `push`, `pull`, `log`
- IPC channels: `git:status`, `git:diff`, `git:add`, `git:restore`, `git:commit`, `git:push`, `git:pull`, `git:log`
- Tipos `GitStatus`, `GitFileStatus`, `GitCommit` adicionados ao `@cwm/config`

### Alterado

- `IDEPage.tsx`: painel esquerdo vira switcher Files/Git; adicionado `GitFileRow` sub-component
- Painel de arquivos: botão `FilePlus` ao lado do `FolderPlus`

---

## [1.0.7] — 2026-05-30

### Corrigido

- **Bloqueador crítico: `require('electron')` retornava npm stub no Windows + pnpm**
  - `app.isPackaged` acessado no nível do módulo causava crash antes de `app.whenReady()`
  - Corrigido: removida declaração `isDev` de nível de módulo; usa `ELECTRON_RENDERER_URL` env var (setada pelo electron-vite) ou fallback para `http://localhost:5173` quando `!app.isPackaged`
- **`ELECTRON_RUN_AS_NODE=1` no ambiente de execução quebrava Electron**
  - Electron verifica a EXISTÊNCIA da var (qualquer valor, inclusive `"0"`) para rodar como Node.js puro sem API Electron
  - Corrigido: `scripts/dev.js` deleta `ELECTRON_RUN_AS_NODE` do `process.env` antes de invocar o `concurrently`, eliminando a herança nos processos filhos
- `pnpm dev` substituído por `node scripts/dev.js` no package.json raiz

### Adicionado

- `cross-env ^7.0.3` como devDependency (auxílio a outras abordagens cross-platform)
- `scripts/dev.js` — launcher Node.js que limpa `ELECTRON_RUN_AS_NODE` e inicia o concurrently
- Script `dev:inner` no package.json raiz para separar lógica do launcher

---

## [1.0.6] — 2026-05-30

### Adicionado

- **NEX-ALS IDE** — layout IDE completo com três painéis integrados e redimensionáveis:
  - Explorer SFTP (esquerda) — navega, cria pastas, renomeia e exclui arquivos na VPS via SFTP
  - Monaco Editor (centro) — edição com syntax highlighting, IntelliSense, tabs múltiplas e Ctrl+S
  - Terminal SSH xterm.js (baixo, togglável com Ctrl+\`) — shell interativo full-color diretamente na VPS
- Rota `/ide/:vpsId/:vpsName` registrada no React Router
- Botão **IDE** (primário) no card de cada VPS no Lançador
- Rotas `/terminal`, `/explorer` e `/ide` movidas para fora do Layout → fullscreen sem sidebar
- `TerminalService` — sessão SSH interativa bidirecional (ssh2 shell)
- `SftpService` — sessão SFTP com readdir, readFile, writeFile, mkdir, delete, rename
- IPC channels: `terminal:*` e `sftp:*` (handler + preload whitelist)
- Monaco workers locais configurados (`monacoSetup.ts`) — funciona offline no Electron
- `@monaco-editor/react`, `monaco-editor`, `@xterm/xterm`, `@xterm/addon-fit` adicionados ao `@cwm/web`

### Alterado

- `App.tsx` reestruturado: páginas de gerenciamento com sidebar; ferramentas (terminal, explorer, IDE) fullscreen
- `Launcher.tsx`: estado `terminalStates` não usado removido

---

## [1.0.5] — 2026-05-30

### Adicionado

- Branding: **NEX-ALS** — copyright, versão e marca em toda a UI
- Página **Manual de Uso** (`/help`) com 9 seções expansíveis: início rápido, VPS, projetos, contas Claude, lançador, autenticação Claude Code, configurações, chave SSH, solução de problemas, sobre
- Botão **"Criar pasta na VPS"** / **"Clonar repositório na VPS"** no formulário de projetos — executa `mkdir -p` ou `git clone` via SSH diretamente da UI
- Modal de autenticação Claude Code reescrito com instrução de janela anônima (resolve conflito de conta já logada no browser)
- Terminal SSH corrigido para abrir janela independente via `cmd /c start` (funcionava apenas em dev, agora funciona no app empacotado)

### Alterado

- Versão global: `0.1.x` → `1.0.5`
- Sidebar mostra versão e marca NEX-ALS
- Seção "Sobre" do Manual com informações completas e copyright

---

## [0.1.2] — 2026-05-30

### Adicionado

- `ClaudeCheckResult` type em `@cwm/config`: `{ installed, version, loggedIn, message }`
- `VpsService.checkClaudeCode(vpsId)` — conecta via SSH, roda `bash -c 'command -v claude && claude --version && claude auth status'` e retorna status estruturado
- Método privado `_sshExec(vpsId, cmd)` extraído de `testConnection` para reusar a lógica SSH
- IPC channel `launcher:checkClaude` — handler no main, canal autorizado no preload
- `ipc.launcher.checkClaude(vpsId)` no helper frontend
- Launcher page: verificação automática ao montar (não-bloqueante, em paralelo para cada VPS); badge por VPS e por card de projeto exibindo: `Claude vX.X.X • Logado` | `Não logado` | `Não instalado` | spinner durante verificação

### Alterado

- `VpsService.testConnection` simplificado para delegar ao `_sshExec`
- `Launcher.tsx` reimplementado com estado `claudeStatuses` por VPS

---

## [0.1.1] — 2026-05-30

### Adicionado

- `ssh2` como dependência de `@cwm/core` com bindings nativos para Windows (crypto acelerado por hardware)

### Alterado

- `VpsService.testConnection` reescrito para usar `ssh2` em vez de `child_process.exec` — não depende mais do cliente SSH no PATH do sistema
- Timeout e erros tratados nativamente: `ECONNREFUSED`, `ETIMEDOUT`, falha de autenticação
- Verificação de host key desativada para teste de conexão (equivalente a `StrictHostKeyChecking=no`)
- `packages/core/tsconfig.json` atualizado de `moduleResolution: Node` para `Node16` para suporte ao prefixo `node:` nos imports
- `pnpm-workspace.yaml` atualizado para aprovar builds nativos de `ssh2` e `cpu-features`

### Corrigido

- Bloqueador crítico resolvido: `require("electron")` funciona corretamente via `electron-vite` (main bundado com Rollup, `electron` como external)

---

## [0.1.0] — 2026-05-29

### Adicionado

- Scaffold completo do monorepo pnpm com workspaces
- `packages/config` — Zod schemas e tipos compartilhados para VPS, Project, ClaudeAccount, Settings, LaunchHistory
- `packages/db` — Prisma schema SQLite com tabelas: vps_servers, projects, claude_accounts, settings, launch_history
- `packages/core` — Serviços de negócio: VpsService, ProjectsService, AccountsService, LauncherService, SettingsService, DiagnosticsService
- `apps/desktop` — Electron main process com BrowserWindow + contextBridge + IPC handlers completos
- `apps/web` — React + Vite + Tailwind CSS com 7 páginas: Dashboard, VPS, Projetos, Contas, Launcher, Settings, Diagnóstico
- Layout com sidebar de navegação e status bar
- Dashboard com cards de VPS, projetos recentes e ações rápidas
- CRUD completo de VPS com formulário modal e botão de teste de conexão
- CRUD completo de Projetos com associação a VPS e conta Claude
- CRUD completo de Contas Claude (sem armazenamento de credenciais)
- Launcher com grid de projetos e botão "Abrir no VS Code"
- Página de Settings (caminhos VS Code, SSH key path)
- Página de Diagnósticos (verifica VS Code, SSH, Git, Node.js, VPS)
- Todos os arquivos de documentação: CLAUDE.md, AGENTE.md, docs/, memory/
- `.gitignore` com exclusões para node_modules, dist, .env, banco SQLite local

### Decisões técnicas

- Stack: Electron + React + Vite + TypeScript + Tailwind CSS + Prisma + SQLite
- IPC via `contextBridge` com `contextIsolation: true` (segurança)
- DATABASE_URL configurado dinamicamente no main process via `app.getPath('userData')`
- Monorepo gerenciado via pnpm workspaces
- Validação de entrada via Zod em todos os handlers IPC
