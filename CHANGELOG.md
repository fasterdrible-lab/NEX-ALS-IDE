# CHANGELOG — HEXAGON IDE

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
- `CLAUDE.md` e `AGENTE.md` reescritos para refletir o nome oficial **HEXAGON IDE** e incluir a URL do repositório
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
- **IDE-04 · Git integrado** — painel Source Control completo no HEXAGON IDE:
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

- **HEXAGON IDE** — layout IDE completo com três painéis integrados e redimensionáveis:
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
