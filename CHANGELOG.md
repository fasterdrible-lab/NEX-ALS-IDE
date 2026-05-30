# CHANGELOG — Claude Workspace Manager

## [1.0.5] — 2026-05-30

### Adicionado

- Branding: **HEXAGON TECNOLOGIA** — copyright, versão e marca em toda a UI
- Página **Manual de Uso** (`/help`) com 9 seções expansíveis: início rápido, VPS, projetos, contas Claude, lançador, autenticação Claude Code, configurações, chave SSH, solução de problemas, sobre
- Botão **"Criar pasta na VPS"** / **"Clonar repositório na VPS"** no formulário de projetos — executa `mkdir -p` ou `git clone` via SSH diretamente da UI
- Modal de autenticação Claude Code reescrito com instrução de janela anônima (resolve conflito de conta já logada no browser)
- Terminal SSH corrigido para abrir janela independente via `cmd /c start` (funcionava apenas em dev, agora funciona no app empacotado)

### Alterado

- Versão global: `0.1.x` → `1.0.5`
- Sidebar mostra versão e marca HEXAGON TECNOLOGIA
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
