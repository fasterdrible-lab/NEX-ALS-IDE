# ARCHITECTURE.md — NEX-ALS IDE v3.16.1

## Arquitetura geral

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  IPC Handler │  │  Core        │  │  DB (Prisma)     │  │
│  │  (handlers)  │→ │  Services    │→ │  SQLite          │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│          ↑                ↓                                 │
│          │    child_process (SSH, code, ssh-keyscan)        │
│          │                                                  │
│  ┌──────────────────────────┐                              │
│  │  contextBridge / preload │                              │
│  └──────────────────────────┘                              │
│          ↑                                                  │
├──────────┼──────────────────────────────────────────────────┤
│          │          RENDERER PROCESS                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React App (apps/web)                    │   │
│  │                                                      │   │
│  │  /dashboard  /vps  /projects  /accounts              │   │
│  │  /launcher   /settings  /diagnostics                 │   │
│  │                                                      │   │
│  │  window.electron.invoke(channel, data)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Diagrama de módulos

```
packages/
  config/       ← Zod schemas + TypeScript types (sem deps externas)
  db/           ← PrismaClient + schema (depende: prisma, better-sqlite3)
  core/         ← Serviços de negócio (depende: @cwm/config, @cwm/db)
    src/
      ai/                  ← NEX-ALS AI HUB (ver seção abaixo)
      auth/                ← AuthService (bcryptjs, CRUD app_users, validatePassword)
      notifications/       ← NotificationMonitor (polling VPS, alertas CPU/RAM/disco)

apps/
  desktop/      ← Electron main + preload (depende: @cwm/core, electron)
  web/          ← React + Vite (depende: @cwm/config, lucide-react, react-router)
```

## Fluxo de abertura de projeto

```
Usuário clica "Abrir Projeto"
        ↓
renderer: window.electron.invoke('launcher:openProject', { projectId })
        ↓
main: ipcMain.handle('launcher:openProject')
        ↓
LauncherService.openProject(projectId)
  1. Busca Project no banco (inclui VPS e Settings)
  2. Constrói URI: vscode-remote://ssh-remote+user@host/remote/path
  3. Executa: exec(`"${vscodePath}" --folder-uri "${uri}"`)
  4. Registra no launch_history
        ↓
renderer: recebe { success, message }
        ↓
UI: mostra toast de sucesso ou erro
```

## Fluxo de login Claude Code

```
Usuário clica "Instruções de Login" na conta Claude
        ↓
UI mostra modal com passo a passo:
  1. Clique em "Abrir Terminal SSH" → app abre PowerShell com SSH
  2. Na VPS, execute: claude
  3. Se não logado, Claude exibe URL de autenticação
  4. Usuário abre URL no navegador e faz login com conta Claude correta
  5. Claude Code fica autenticado SOMENTE dentro daquela VPS
        ↓
Isolamento garantido: cada VPS tem sua própria autenticação Claude
```

## Fluxo de teste de conexão SSH

```
Usuário clica "Testar Conexão"
        ↓
renderer: window.electron.invoke('vps:test', vpsId)
        ↓
VpsService.testConnection(id)
  1. Busca VPS no banco
  2. Executa: ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no
              -p {port} {user}@{host} "echo cwm-ok"
  3. Verifica stdout === "cwm-ok"
        ↓
renderer: recebe { success: boolean, message: string, latencyMs: number }
        ↓
UI: badge verde/vermelho com mensagem
```

## Banco de dados (SQLite)

```sql
-- vps_servers
id, name, host, port, username, defaultPath, createdAt, updatedAt

-- projects
id, name, description, remotePath, gitRepo, vpsServerId(FK), claudeAccountId(FK?),
createdAt, updatedAt

-- claude_accounts
id, name, email?, vpsServerId(FK?), createdAt, updatedAt

-- settings (singleton, id="default")
id, vscodePath, vscodeInsidersPath, sshKeyPath, notificationsEnabled, updatedAt

-- app_users
id, username (UNIQUE), passwordHash (bcrypt), role ('admin'|'viewer'), createdAt, updatedAt

-- launch_history
id, projectId(FK), launchedAt, success, errorMsg?
```

**Nota (v3.4.0):** `notificationsEnabled` adicionado por `ALTER TABLE ... ADD COLUMN ... DEFAULT 1` (migration incremental, não quebra instalações existentes).

**Nota:** O banco `cwm.db` é armazenado em `app.getPath('userData')`:
- Windows: `%APPDATA%\claude-workspace-manager\cwm.db`

## Isolamento de contas Claude

O problema central: VS Code compartilha sessão do Claude Code entre janelas. A solução arquitetural:

```
VPS 1 (204.168.180.25) ← Conta Claude A (autenticação isolada no SO da VPS)
VPS 2 (77.42.30.4)     ← Conta Claude B (autenticação isolada no SO da VPS)

VS Code Remote SSH → VPS 1 → claude → autenticado como Conta A
VS Code Remote SSH → VPS 2 → claude → autenticado como Conta B
```

Não há mistura de autenticação porque cada VPS é um servidor Linux independente.

## Segurança

| Medida | Implementação |
|---|---|
| contextIsolation | `contextIsolation: true` em toda BrowserWindow |
| nodeIntegration desabilitado | `nodeIntegration: false` sempre |
| IPC whitelist | preload só expõe `invoke` e `on` — sem acesso direto |
| Validação no main | Zod valida dados antes de persistir ou executar |
| Sem secrets no banco | Nenhuma senha ou token no SQLite |
| DATABASE_URL dinâmico | Definido via env var pelo main process |

## Decisões de stack

| Decisão | Escolha | Alternativa descartada | Motivo |
|---|---|---|---|
| Framework desktop | Electron | Tauri | Node.js-native, sem Rust, melhor suporte Windows, SSH via child_process mais simples |
| ORM | Prisma | TypeORM, Drizzle | DX superior, migrations automáticas, type-safety |
| Estilo | Tailwind CSS | CSS Modules, Styled Components | Sem build extra, classes utilitárias, manutenção simples |
| Validação | Zod | Yup, class-validator | Inferência TypeScript nativa, composição |
| Ícones | Lucide React | Heroicons, Phosphor | Leve, tree-shakable, consistente |

## Riscos técnicos

1. **SSH no Windows** — OpenSSH precisa estar instalado. Git Bash também funciona como fallback.
2. **VS Code no PATH** — `code` precisa estar no PATH do usuário. Configurável via Settings.
3. **Prisma + Electron** — Prisma precisa de `prisma generate` antes do build. Caminhos do binário devem ser incluídos no electron-builder.
4. **Atualizações do Prisma** — mudanças de schema exigem `prisma migrate` ou `prisma db push`.
5. **Remote SSH URI** — formato pode variar entre versões do VS Code. Implementado com fallback.
6. **[CRÍTICO] `ELECTRON_RUN_AS_NODE` + pnpm + Windows** — Quando `ELECTRON_RUN_AS_NODE=1` está no ambiente (definido por ferramentas como Claude Code para evitar janelas Electron durante tool calls), o binário Electron roda como Node.js puro, sem a API Electron. `require('electron')` retorna o npm stub (string com path do binário), tornando `electron.app`, `electron.BrowserWindow`, etc. `undefined`. **Solução:** `scripts/dev.js` deleta `process.env['ELECTRON_RUN_AS_NODE']` antes de iniciar o concurrently, eliminando a herança nos processos filhos. Nota: Electron verifica a EXISTÊNCIA da var (qualquer valor, inclusive `"0"` ou `"false"`, ativa o modo Node) — é necessário deletar, não setar.
7. **[CRÍTICO] `app.isPackaged` em nível de módulo** — Acessar `app.isPackaged` fora de uma função (no topo do módulo, antes de `app.whenReady()`) causa crash quando `require('electron')` retorna o npm stub. **Solução:** usar `process.env['ELECTRON_RENDERER_URL']` (definido pelo electron-vite em dev) para detecção de modo, com fallback para `!app.isPackaged` DENTRO de `createWindow()` (chamada apenas após `whenReady()`).

## Roteamento — fullscreen vs layout

```
/ (Layout com sidebar)
  /vps, /projects, /accounts, /launcher, /settings, /diagnostics, /help

/terminal/:vpsId/:vpsName  ← TerminalPage (fullscreen, sem sidebar)
/explorer/:vpsId/:vpsName  ← FileExplorerPage (fullscreen, sem sidebar)
/ide/:vpsId/:vpsName       ← IDEPage (fullscreen, sem sidebar)
```

Ferramentas de desenvolvimento são montadas fora do `<Layout />` para ocupar 100% da viewport.

## IDE — arquitetura de painéis

```
┌──────────────────────────────────────────────────────────┐
│                    TOP BAR (vps name, tabs, ações)       │
├──────────┬───┬───────────────────────────────────────────┤
│          │   │                                           │
│  Explorer│ ↔ │  Monaco Editor                            │
│  SFTP    │   │                                           │
│          │   ├───────────────────────────────────────────┤
│          │   │ ↕ drag handle                             │
│          │   ├───────────────────────────────────────────┤
│          │   │  xterm.js Terminal SSH (Ctrl+`)           │
├──────────┴───┴───────────────────────────────────────────┤
│                    STATUS BAR                            │
└──────────────────────────────────────────────────────────┘
```

- Painéis redimensionáveis via arrastar (hook `useResize`)
- SFTP e Terminal são sessões SSH independentes (2 conexões ssh2)
- Monaco workers locais (`monacoSetup.ts`) — funciona offline
- Ctrl+S salva o arquivo ativo; Ctrl+\` toggle do terminal

## NEX-ALS AI HUB (v3.0.0+)

```
packages/core/src/ai/
├── ai.service.ts              ← orquestrador público
├── key-store.ts               ← interface injetável para API keys (AES-256 SQLite)
├── providers/
│   ├── base.provider.ts       ← interface BaseProvider (sendMessage, streamMessage, validateKey, listModels)
│   ├── anthropic.provider.ts  ← Anthropic API + SSE
│   ├── openai.provider.ts     ← OpenAI-compat (OpenAI/DeepSeek/Groq/Mistral/xAI) + SSE
│   ├── gemini.provider.ts     ← Gemini API + SSE
│   ├── openrouter.provider.ts ← OpenRouter (300+ modelos, listModels dinâmico)
│   └── ollama.provider.ts     ← Ollama local (sem API key, /api/tags)
└── hub/
    ├── provider-manager.ts    ← instancia provider correto pelo nome
    ├── conversation-manager.ts← CRUD ai_conversations + ai_messages no SQLite
    ├── context-manager.ts     ← monta context_block com prioridade de corte (80K chars)
    ├── prompt-builder.ts      ← templates: chat / agent / sysadmin / deploy / incident
    ├── model-registry.ts      ← catálogo de modelos + cache 24h
    ├── tool-executor.ts       ← tiers: read/write/exec_safe/exec_dangerous + log SQLite
    ├── response-streamer.ts   ← SSE streaming + AbortController + cancel
    └── project-memory.ts      ← CRUD project_memory por VPS/projeto
```

**Tabelas SQLite novas (v3.0.0+):**
```
ai_conversations   — id, title, provider, model, vpsId, projectId, isPinned, totalTokens
ai_messages        — id, conversationId(FK), role, content, toolCallId
project_memory     — id, vpsId, projectId, key, value (UNIQUE vpsId+projectId+key)
tool_execution_log — id, conversationId, toolName, input, output, tier, confirmed
```

## Fluxo de Streaming SSE

```
Renderer → ipc: ai:stream:start(input)
                    ↓ handlers.ts
              ResponseStreamer.start(input, onChunk)
                    ↓ BaseProvider.streamMessage()
              fetch SSE do provider (Anthropic/OpenAI/Gemini/etc.)
                    ↓ ReadableStream tokens
              onChunk({ type: 'text_delta', delta, streamId })
                    ↓ ipcMain.emit('ai:stream:chunk', targetWin, chunk)
Renderer ← ipc push: ai:stream:chunk
              setChatMessages(append token)
              [Botão ■ Parar] → ipc: ai:stream:cancel(streamId)
```

## Janelas Especializadas (v3.1.0+)

```
main.ts
  createWindow()         ← janela principal (/)
  createIdeWindow()      ← /ide/:vpsId/:vpsName
  createIncidentWindow() ← /incident/:vpsId/:vpsName (1440×900, título 🚨)
  createDeployWindow()   ← /deploy/:vpsId/:vpsName (1200×800)
```

Todas usam o mesmo preload, HashRouter, `applyWindowDefaults()`.

## Roteamento completo (v3.3.0)

```
/ (Layout com sidebar + botão AI HUB)
  /vps, /projects, /accounts, /launcher, /monitor
  /history, /settings, /diagnostics, /help

Ferramentas fullscreen (sem sidebar):
  /ai-hub                      ← AIHubPage
  /ide/:vpsId/:vpsName         ← IDEPage (VPS)
  /ide/local                   ← IDEPage (local)
  /incident/:vpsId/:vpsName    ← IncidentModePage
  /deploy/:vpsId/:vpsName      ← DeployAssistantPage
  /terminal/:vpsId/:vpsName    ← TerminalPage
  /explorer/:vpsId/:vpsName    ← FileExplorerPage
```

## Fingerprint SSH (v2.5.0+)

```
Conexão SSH (qualquer serviço: VpsService/TerminalService/SftpService/GitService/TunnelService)
    ↓ antes de conn.connect(config)
buildHostVerifier(vpsId, storedFp)
    ↓ hostVerifier(rawKey: Buffer) → SHA256(rawKey).base64
  storedFp == null ?
    → persistFingerprint(vpsId, fp)  [fire-and-forget]
    → return true
  fp === storedFp ?
    → return true
  else
    → _mismatch = true
    → return false  [SSH fecha conexão, error event dispara]
  error handler checks wasMismatch()
    → msg: "Fingerprint SSH mudou — possível ataque MITM..."
```

## Autenticação multi-usuário (v3.8.0+)

```
packages/core/src/auth/auth.service.ts
  AuthService
    ├── createUser(username, password, role)   → bcrypt.hash (12 rounds) → INSERT app_users
    ├── validatePassword(username, password)   → bcrypt.compare → AppUser | null
    ├── listUsers()  deleteUser(id)            → SELECT / DELETE app_users
    ├── changePassword(id, newPassword)        → bcrypt.hash → UPDATE app_users
    └── countUsers()                           → COUNT(*) — usado para detectar modo single-user

Fluxo de autenticação:
  app.whenReady() → setupIpcHandlers()
    → authSvc.countUsers() [async] → sessionRequired = n > 0

  Renderer monta
    → auth:status → { user, needsSetup, sessionRequired }
    → needsSetup=true  → SetupPage → auth:setup → session = admin
    → sessionRequired && !user → LoginPage → auth:login → session = user
    → app normal

Sessão:
  let session: AppUser | null = null  [in-memory, main process]
  Cleared on: auth:logout
  Not persisted: requer login a cada restart do app

Guards em handlers.ts:
  requireAuth()  → lança erro se sessionRequired && !session
  requireAdmin() → lança erro se sessionRequired && (!session || role !== 'admin')

  Operações protegidas por requireAdmin():
    vps:create/update/delete · projects:create/update/delete
    accounts:create/update/delete · settings:update
    config:export/import · notifications:setEnabled
    auth:users:list/create/delete

  Operações protegidas por requireAuth():
    vps:list/test · projects:list/recent · accounts:list

  Backward-compat: sessionRequired=false (sem usuários) → todos os guards são no-op

IPC auth:*:
  auth:status          → { user, needsSetup, sessionRequired }
  auth:setup           → cria primeiro admin (só quando countUsers=0)
  auth:login           → validatePassword → session = user
  auth:logout          → session = null
  auth:currentUser     → { user: session }
  auth:users:list      → [admin] listUsers()
  auth:users:create    → [admin] createUser()
  auth:users:delete    → [admin] deleteUser() — bloqueia auto-exclusão
  auth:users:changePassword → [próprio ou admin] changePassword()
```

## LSP multi-linguagem (v3.7.0+)

```
apps/web/src/lib/lsp.ts
  LSP_CONFIGS: Record<string, LspConfig>
    typescript  → port 6009, documentSelector: [ts, js, tsx, jsx]
    python      → port 6010, documentSelector: [python]
    rust        → port 6011, documentSelector: [rust]
    go          → port 6012, documentSelector: [go]

  monacoLangToLspKey(monacoLang) → string | null
    Converte ID Monaco → chave LSP

  connectLSP(monaco, langKey)
    → LSP_CONFIGS[langKey] → wsUrl = ws://localhost:{port}
    → WebSocket handshake (timeout 5s)
    → MonacoLanguageClient({ documentSelector, messageTransports })
    → activeClients.set(langKey, { dispose })

  disconnectAllLSP() → chamado no cleanup de unmount do IDEPage

Status bar no IDEPage:
  activeFile → detectLang(name) → monacoLangToLspKey(lang) → cfg
  Renderiza: {cfg.label} LSP [✓] com tooltip "requer túnel porta {cfg.port}"

Wrapper WebSocket na VPS (padrão Node.js para qualquer language server):
  node -e "const W=require('ws'),{spawn}=require('child_process');
    new W.Server({port:PORT}).on('connection',ws=>{
      const p=spawn('LANG_SERVER_BIN');
      ws.on('message',d=>p.stdin.write(d)); p.stdout.on('data',d=>ws.send(d));
      p.on('exit',()=>ws.close())});"
```

## Content Security Policy (v3.6.0+)

```
apps/desktop/src/main.ts — setupCSP()
  session.defaultSession.webRequest.onHeadersReceived(callback)
    Injeta Content-Security-Policy em todas as respostas do renderer
    (funciona tanto em dev http://localhost:5173 quanto produção file://)

CSP configurada:
  default-src 'self'
  script-src  'self' 'unsafe-eval' blob:   ← Monaco precisa de unsafe-eval
  style-src   'self' 'unsafe-inline'       ← Tailwind + Monaco inline styles
  img-src     'self' data: blob:           ← SFTP image preview via data:
  font-src    'self' data:
  connect-src 'self' ws: wss: https: http://localhost:*  ← AI APIs + LSP WS
  worker-src  blob: 'self'                 ← Monaco web workers
```

## NotificationMonitor (v3.4.0+)

```
packages/core/src/notifications/notification-monitor.ts
  NotificationMonitor
    ├── start()          ← inicia setInterval 60s no main process
    ├── stop()           ← limpa o intervalo
    ├── setEnabled(bool) ← toggle em runtime (via IPC notifications:setEnabled)
    └── onAlert(cb)      ← callback chamado quando limiar ultrapassado

Fluxo de polling:
  setInterval(60s)
    ↓ poll(): busca todas VPS no SQLite
    ↓ checkVps(vpsId, vpsName): exec SSH único com 4 métricas inline
        cat /proc/loadavg · nproc · free -m · df /
    ↓ calcula cpuPct · ramPct · diskPct
    ↓ compara com THRESHOLDS { disk:85%, cpu:90%, ram:90% }
    ↓ canNotify(vpsId, type): cooldown 30min por vps×tipo
    ↓ emit(NotificationAlert) → callback no main.ts
        → new Notification({ title, body }).show()   [nativo OS]
    VPS offline → erro silencioso (Promise.allSettled)
```

**IPC de notificações:**
```
notifications:getEnabled  → { enabled: boolean }
notifications:setEnabled  ← { enabled: boolean } → persiste no SQLite + notifMonitor.setEnabled()
```

**Notificação de erro IA Hub:** quando streaming falha com a janela desfocada, o handler `ai:stream:start` chama `new Notification(...)` diretamente (sem passar pelo monitor de polling).

## Modo Local — Filesystem IPC (v3.5.0+)

Canais IPC para operar no sistema de arquivos local (Windows) sem SSH/VPS:

```
local:openFolder                → dialog.showOpenDialog (seleção de pasta)
local:readdir    (dirPath)      → fs.readdir com tipo (file/directory/symlink)
local:readFile   (filePath)     → fs.readFile UTF-8
local:readFileBase64 (filePath) → fs.readFile → base64
local:writeFile  ({filePath, content})
    → fs.mkdir({ recursive: true }) para criar pastas pai
    → fs.writeFile UTF-8
local:mkdir      (dirPath)      → fs.mkdir
local:delete     (filePath)     → fs.rm({ recursive: true, force: true })
local:rename     ({oldPath, newPath}) → fs.rename
local:touch      (filePath)
    → fs.mkdir({ recursive: true }) para criar pastas pai
    → fs.writeFile '' se não existir
local:exec       ({cmd, cwd?})
    → child_process.exec(cmd, { cwd, timeout: 120s })
    → retorna { success, output } (stdout + stderr combinados)
    → usado pelo agente autônomo em modo local (npm install, node, etc.)
```

## Agente Autônomo (v3.5.0+)

O agente IA no IDEPage opera em dois modos e suporta até 500 iterações sem pausa manual:

```
IDEPage.sendAgentMessage()
    ↓ loop: até MAX=500 iterações
    ↓ ai:agent:run (VPS) OU ai:stream:start com tools (local)
    ↓ IA retorna tool_use?
        NÃO → conclusão natural, loop para
        SIM → executa ferramenta:
          read_file    → sftp:readFile  OU local:readFile
          write_file   → sftp:writeFile OU local:writeFile (cria pastas pai)
          execute_command → terminal:exec (VPS) OU local:exec (local)
          search_files → grep SSH (VPS) OU rg/findstr (local)
          list_files   → sftp:readdir  OU local:readdir
    ↓ a cada 50 ações: mensagem de progresso automática no histórico
    ↓ usuário clica ⏹ Parar → stopAgentRef.current = true → loop para na próxima iteração

Comandos destrutivos em modo VPS: modal confirmação "CONFIRMO"
  padrões: docker rm/stop/restart · pm2 delete/stop/restart
           git reset --hard · rm -rf · DROP TABLE · truncate

Snapshot/Rollback:
  antes de write_file → snapshot em memória (Map<filePath, conteúdo anterior>)
  painel 📦 Snapshots → botão ↩ Restaurar por arquivo
  limpo em nova sessão; preservado ao continuar (stopAgentRef + história intacta)
```

## Melhorias incrementais do IDE (v3.9.0)

### F2 — Rename inline no explorador de arquivos

```
Estado no IDEPage:
  selectedEntryRef: useRef<FileEntry|null>  — última entrada clicada (sem re-render)
  selectedPath: useState<string|null>       — para highlight visual da seleção

Fluxo:
  Click / ContextMenu na tree → selectedEntryRef.current = entry; setSelectedPath(entry.path)
  Tecla F2 (window keydown handler) → if (selectedEntryRef.current && !renaming)
    → setRenaming(entry); setRenameVal(entry.name)
  Input inline → Enter: handleRename() | Escape: setRenaming(null)
```

### Ctrl+Shift+T — Reabrir aba fechada

```
Estado:
  closedTabsRef: useRef<OpenFile[]>   — stack LIFO, máx 15 entradas

Fluxo fechar:
  closeTab(path) → encontra OpenFile pelo path
    → closedTabsRef.current = [file, ...current].slice(0, 15)
    → remove de openFiles; atualiza activeTab

Fluxo reabrir:
  Ctrl+Shift+T (window keydown)
    → last = closedTabsRef.current[0]
    → closedTabsRef.current = current.slice(1)
    → setOpenFiles(f => [...f, last])  // só adiciona se path não está já aberto
    → setActiveTab(last.path)

Preserva: conteúdo, savedContent, language, imageDataUrl — estado completo da aba
```

### Busca em arquivos — Modo Local (Ctrl+Shift+F)

```
handleSearch() — antes: bail se !vpsId; agora: branch isLocal

Modo Local:
  root = localRootRef.current
  cmd = `rg ${caseFlag}"${esc}" . --line-number --no-heading --color=never -m 200 2>nul
         || findstr /n /s ${caseFlag}"${esc}" *`
  ipc.local.exec(cmd, root)
  Normalização: rel path → absoluto via `${rootNorm}/${rel}`
  Display no painel: `file.replace(rootNorm, '').replace(/^[\\/]/, '')`

Modo VPS (inalterado):
  ipc.terminal.exec(vpsId, `grep -r -n ... /root`)
```

### Diffview — Modo Local

```
handleLocalDiff():
  Só executa se isLocal && activeFile !== null
  root = localRootRef.current
  cmd = `git diff -- "${activeFile.path}"`
  ipc.local.exec(cmd, root) → content
  relPath = absPath.replace(rootNorm, '').replace(/^\//, '')
  setGitDiff({ content, filePath: relPath, staged: false })
  setActiveTab(null)   — ativa o Monaco diff viewer (mesmo componente do modo VPS)
  Toast se output vazio ("Sem alterações")

UI: botão "Diff" (GitCommitIcon) na top bar
  Condicional: isLocal && activeFile && !activeFile.imageDataUrl
  Posição: entre badge LOCAL e aba de arquivos
```

## Squad — Arquitetura (v3.10.0+)

### Módulos

```
packages/core/src/squad/
  actions.ts   ← ActionType = 'shell' | 'write_file' | 'read_file' | 'read_dir'
               ← SquadAction, ActionResult, parseActions(text) → SquadAction[]
  agents.ts    ← AgentName, AgentConfig, AGENTS (8 configs), ACTION_INSTRUCTIONS
               ← buildSystemPrompt(agentName, projectContext?, localPath?, isAutonomous?)

apps/web/src/pages/SquadPage.tsx  ← página fullscreen, toda a lógica UI
```

### Agentes

| Nome | Papel | Provider padrão |
|---|---|---|
| Jarvis | Orquestrador / PM | Claude Code |
| Friday | Desenvolvedor | GPT |
| Fury | Pesquisa / Intelligence | Gemini |
| Shuri | UX / Design | Claude Code |
| Pepper | Marketing | GPT |
| Vision | Growth | Gemini |
| Requis | Documentação | Claude Code |
| Tester | QA | GPT |

### ACTION Tags — execução local vs VPS

```
Texto do agente contém blocos:
  [ACTION:SHELL cmd="npm install"][/ACTION]
  [ACTION:WRITE_FILE path="src/foo.ts"]conteúdo[/ACTION]
  [ACTION:READ_FILE path="src/foo.ts"][/ACTION]
  [ACTION:READ_DIR path="C:\pasta"][/ACTION]

parseActions(text) → SquadAction[]

Execução via IPC squad:action:execute(action):

  vpsId === '__local__':
    SHELL     → child_process.exec(cmd, { cwd: localPath || homedir(), shell:true })
    WRITE_FILE→ fs.mkdir(dir, { recursive:true }) → fs.writeFile(path, content, 'utf-8')
    READ_FILE → fs.stat(path):
                  if isDirectory() → fs.readdir({ withFileTypes:true }) → lista [DIR]/[ARQ]
                  else → fs.readFile(path, 'utf-8')
    READ_DIR  → fs.readdir(path, { withFileTypes:true }) → lista [DIR]/[ARQ] com resolved path

  vpsId !== '__local__' (modo VPS via SSH):
    SHELL     → terminal.exec(vpsId, cmd, timeout)
    WRITE_FILE→ sftp.writeFile(vpsId, path, content)
    READ_FILE → sftp.readFile(vpsId, path)
    READ_DIR  → terminal.exec(vpsId, `ls -la "${path}"`, 10000)
```

### Loop Autônomo — fluxo

```
handleSend(msg, targetAgent)
    ↓ rootAgentRef.current = targetAgent   ← grava quem iniciou
    ↓ streamAgent(targetAgent, msg, sid)
    ↓ se autonomousMode → autonomousLoop(sid)

autonomousLoop(sid):
  while !stop && iter < maxAutoIterRef.current:
    lastBubble = último bubble de agente não-streaming

    se /[PRONTO]|[DONE]|[CONCLUÍDO]/i → para + bubble sistema "Tarefa concluída"

    hasActions = lastBubble.actions?.length > 0
    isRoot     = lastBubble.agentName === rootAgentRef.current

    se !hasActions && isRoot    → para (root sem ações = conclusão natural)
    se !hasActions && !isRoot   → streamAgent(rootAgent, "agentes delegados concluíram...")
                                  (síntese: delegado sem ações dispara root)
    se hasActions:
      results = await executeActionsAuto(actions)
      rastreia no report { reads, writes, shells, errors, filesWritten }
      streamAgent(rootAgent, resultLines.join('\n'))   ← SEMPRE retorna ao root

  após loop (se iter > 0):
    bubble sistema com relatório:
      📊 N iteração(ões) · N leituras · N escritas · N shells · N erros
      📄 Arquivos escritos: [lista]
```

**Padrão `maxAutoIterRef`:** `maxAutoIter` state (para UI) + `maxAutoIterRef.current` (para uso dentro do loop async). Sincronizados por `useEffect(() => { maxAutoIterRef.current = maxAutoIter }, [maxAutoIter])`. Necessário porque closures JavaScript capturam o valor de `state` no momento da criação do loop — o ref garante leitura do valor atual.

### Knowledge Base — arquitetura de persistência

```
interface KnowledgeBase {
  projeto: string   // nome, objetivo, linguagem
  stack: string     // frameworks, libs, ferramentas
  estrutura: string // pastas, módulos, convenções de arquivo
  status: string    // tarefas em andamento, bugs conhecidos
  convencoes: string// naming, padrões de código, commits
  regras: string    // regras de negócio, restrições, SLAs
  agentes: string   // papéis e instruções específicas por agente
  notas: string     // observações livres
}

localStorage['squad_knowledge_bases']: Record<string, KnowledgeBase>
  chave = localPath || '__global__'

useEffect([localPath]) → setKb(loadKB(localPath || '__global__'))
  Recarrega a KB ao trocar de projeto

buildKBString(kb) → string
  Itera sobre seções preenchidas (value.trim() !== '')
  Formata como: "## LABEL\ncontent\n\n"
  Injetado no system prompt de todos os agentes da sessão

syncKBFromProject():
  candidates: README.md→projeto, CURRENT_STATE.md→status,
              TASKS.md→status, ARCHITECTURE.md→estrutura
  Para cada candidate: ipc.squad.action.execute({ type:'read_file', vpsId:'__local__', path })
  Se read_file retornar pasta detectada → ignora
  Preenche updates{}; se seção já preenchida (status) → concatena com separador
  Trunca em 3000 chars por seção; setKb + saveKB
```

### IPC Squad

```
squad:stream:start   ← { agentName, messages, systemPrompt, provider, model,
                          localPath?, autonomousMode?, vpsId? }
                     → chunks SSE: { type:'text_delta'|'error'|'done', delta?, streamId }

squad:stream:cancel  ← streamId
squad:action:execute ← SquadAction (com vpsId, cwd?)  → ActionResult
squad:sessions:list  → SquadSession[]
squad:sessions:create← { title }  → SquadSession
squad:messages:list  ← sessionId  → SquadMessage[]
squad:messages:save  ← { sessionId, role, agentName, content }  → SquadMessage
squad:sessions:delete← sessionId  → void
```

## Hermes Manager (v3.52.0+) — FASE 1

Gerenciador de ciclo de vida do runtime agentic externo **Hermes Agent** (Nous Research) numa VPS. É a base do futuro modo "Autonomous Development" (ver `docs/HERMES_INTEGRATION.md`). Nesta fase o NEX **não** cria um novo agent loop — Squad continua sendo o único orquestrador de agentes do sistema. Hermes é tratado como um serviço externo cujo ciclo de vida (instalar/atualizar/iniciar/parar/status/logs) o NEX gerencia via SSH, reaproveitando `TerminalService.exec` sem novo transporte.

```
NEX-ALS IDE
  Chat Mode  → AI Hub atual (inalterado)
  Agent Mode → HermesService (packages/core/src/hermes/)
                  → HermesClient → TerminalService.exec (SSH, reuso)
                      → VPS: binário `hermes` (instalado via installer oficial)
```

### Módulos

```
packages/core/src/hermes/
  hermes.types.ts     ← HermesStatus, HermesInstanceInfo, HermesInstallResult, HermesCommandResult
  hermes-client.ts     ← comandos SSH brutos (detect/version/install/update/startGateway/
                          stopGateway/isRunning/execCommand/readLogs); todo comando reexporta
                          PATH porque ssh2.exec não roda shell de login
  hermes-installer.ts  ← roda o installer oficial e confirma o binário no PATH
  hermes.service.ts    ← orquestrador público; persiste HermesInstance via Prisma
```

### Gerenciamento de processo — `hermes gateway` em background

O Hermes Agent real não expõe HTTP API por padrão (confirmado no README do projeto) e não há garantia de systemd em toda VPS. "Iniciar/Parar/Reiniciar" gerenciam o processo `hermes gateway` via PID file:

```
start:  mkdir -p ~/.hermes-nex
        nohup hermes gateway > ~/.hermes-nex/gateway.log 2>&1 & echo $! > ~/.hermes-nex/gateway.pid

stop:   kill <pid>  (fallback: pkill -f "hermes gateway")
status: kill -0 <pid>  (exit code determina running/stopped)
logs:   tail -n <N> ~/.hermes-nex/gateway.log
```

### Banco de dados

```sql
-- hermes_instances (1:1 com vps_servers)
id, vpsServerId(FK UNIQUE), status, version, installPath, pid,
lastSeen, lastError, createdAt, updatedAt
```

Criada via Prisma (`schema.prisma`) + auto-criação `CREATE TABLE IF NOT EXISTS` em `handlers.ts` (mesmo padrão de `squad_memories`) para instalações existentes que não rodam `pnpm db:push`.

### IPC `hermes:*`

```
hermes:status   (vpsId)                → requireAuth  → HermesInstanceInfo
hermes:install  (vpsId)                → requireAdmin → HermesInstallResult
hermes:update   (vpsId)                → requireAdmin → HermesCommandResult
hermes:start    (vpsId)                → requireAdmin → HermesCommandResult
hermes:stop     (vpsId)                → requireAdmin → HermesCommandResult
hermes:restart  (vpsId)                → requireAdmin → HermesCommandResult
hermes:exec     ({vpsId, args})        → requireAdmin → HermesCommandResult
hermes:logs     ({vpsId, lines?})      → requireAuth  → HermesCommandResult
```

Sem streaming SSE nesta fase — `install`/`update` retornam o log completo ao final (mesmo modelo de `git:*`/`diagnostics:run`). `install`/`update`/`start`/`stop`/`restart`/`exec` exigem `requireAdmin` (mesmo nível de `vps:create`), sem o modal "CONFIRMO" de ações destrutivas — nenhuma dessas ações é irreversível.

### UI

`HermesPage.tsx` — rota fullscreen `/hermes/:vpsId/:vpsName`, acessível pelo botão "Hermes" na linha de ações por VPS em `Launcher.tsx`. Card de status + botões de ciclo de vida + painel de saída (`pre` monoespaçado) + campo para executar subcomandos `hermes <args>` arbitrários. Sem chat, sem activity feed, sem Project Commander — isso é FASE 2.

### Limitações conhecidas

1. ~~Sem modo headless confirmado do CLI `hermes`~~ — **resolvido na FASE 2** via pesquisa na documentação real: `hermes -z`/`hermes chat -q`. Ver seção "Hermes Agent Mode (FASE 2)" abaixo.
2. `hermes gateway` é a aproximação usada para "serviço" com o CLI real disponível hoje; pode ser revisado quando existir um "Hermes Bridge" dedicado.
3. Instalação de ponta a ponta não foi validada contra uma VPS real nesta fase — verificado via `pnpm typecheck && pnpm build` + revisão manual dos comandos shell.

## Hermes Agent Mode (v3.53.0+) — FASE 2

Envio de objetivo a um projeto com resposta em streaming via SSH. O NEX ainda não interpreta o objetivo nem o quebra em etapas — isso é escopo da FASE 3 ("Autonomous Loop"). Aqui a mensagem é simplesmente entregue ao Hermes, que já é agentic por conta própria (uma única classe `AIAgent` Python cuida de planejamento/tools/retries internamente, confirmado na arquitetura documentada do projeto).

### Modo headless real (pesquisado em `docs/reference/cli-commands` e `docs/user-guide/cli`)

```
hermes -z "prompt"        → one-shot puro: só a resposta final, nada mais no stdout/stderr
hermes chat -q "prompt"   → one-shot com saída de tools no transcript (usado aqui — melhor p/ activity feed)
-Q / --quiet               → suprime banners/spinners (modo programático)
--resume latest --in <dir> → retoma a última sessão daquele diretório de trabalho
```

Adaptador **ACP** (stdio/JSON-RPC, daria eventos estruturados) existe na arquitetura do Hermes, mas sua página de documentação (`/docs/developer-guide/acp`) retornou 404 na pesquisa — não é base confiável ainda; o activity feed desta fase é texto corrido.

### Fluxo

```
HermesAgentPanel (AI Hub, modo Agent)
  → ipc.hermes.agent.send(projectId, objective)
  → hermes:agent:send (handlers.ts)
      → HermesService.streamObjective(projectId, objective)
          → resolve Project → VPS; exige HermesInstance.status === 'running'
          → decide resume = HermesProjectAgent.sessionStarted
          → HermesClient.streamObjective(vpsId, { workspace, objective, resume })
              → SftpSession.writeFile(~/.hermes-nex/objective_<id>.txt, objective)
              → TerminalService.execStream(vpsId,
                  `PATH…; cd "<workspace>" && hermes -Q chat -q [--resume latest --in "<workspace>"] "$(cat …)"; rm -f …`)
      → ExecStream 'data' → ipcMain envia hermes:agent:chunk { streamId, type:'text_delta', delta }
      → ExecStream 'close'/'error' → HermesService.markAgentActivity(...) + hermes:agent:chunk { type:'done'|'error' }
      → watchdog: sem dado novo por 300s → mata o stream (agentic pode ser lento; maior que o watchdog de 90s do claude-code)
```

`"$(cat arquivo)"` evita escapar aspas/quebras de linha do texto do usuário no comando SSH (mesma técnica do "Chat Claude" do IDE-21).

### `TerminalService.execStream()` — nova primitiva

`TerminalService` tinha `exec()` (buffer completo) e `openShell()` (PTY interativo). `execStream()` é o meio-termo: exec SSH one-shot com dados incrementais via a classe `ExecStream extends EventEmitter` (eventos `data`/`close`/`error`; `kill()` fecha o channel e a conexão). Erros de conexão que chegam **depois** do `resolve()` da promise são repassados via `execStream.emit('error', …)` — do contrário seriam descartados silenciosamente pelo `reject()` (que não faz nada numa promise já resolvida).

### Banco de dados

```sql
-- hermes_project_agents (1:1 com projects)
id, projectId(FK UNIQUE), hermesInstanceId(FK), workspace,
status ('idle'|'running'|'error'), sessionStarted, lastActivity, lastError,
createdAt, updatedAt
```

Sem colunas `model`/`autonomyLevel` ainda — só serão adicionadas quando a FASE 3/5 realmente as usarem.

### IPC `hermes:agent:*`

```
hermes:agent:status  ({projectId})            → requireAuth  → HermesProjectAgentInfo
hermes:agent:send    ({projectId, objective}) → requireAdmin → { streamId } (+ eventos hermes:agent:chunk)
hermes:agent:cancel  (streamId)               → requireAdmin → { success }
```

### UI

`HermesAgentPanel.tsx` (`apps/web/src/components/`) — autocontido: seletor de projeto (`ipc.projects.list()`), badges de status (instância Hermes + sessão do agente), textarea de objetivo, painel de saída ao vivo, cancelar durante streaming. `AIHubPage.tsx` ganhou um header persistente com toggle **Chat/Agent**: em modo Agent, todo o corpo da página (sidebar de conversas + chat + painel de contexto) é substituído por `HermesAgentPanel`; o fluxo de chat existente não foi alterado.

### O que NÃO foi feito nesta fase (propositalmente)

- Persistência de transcript no NEX — o Hermes já guarda a conversa em `~/.hermes/state.db` (SQLite + FTS5) na própria VPS; o NEX só persiste `status`/`sessionStarted`/`lastActivity` para decidir quando usar `--resume`.
- Parsing estruturado de eventos (tool_started/tool_completed) — depende do ACP, ainda não confirmado.
- "Project Commander" como camada de orquestração — é a FASE 3.

## Hermes Autonomous Loop (v3.54.0+) — FASE 3

Quebra de um objetivo em tarefas rastreáveis, com execução em loop (manual ou autônomo), Definition of Done e Decision Requests. **Todo o motor do loop roda no renderer** (`HermesAgentPanel.tsx`), reaproveitando `hermes:agent:send`/`hermes:agent:chunk` da FASE 2 chamada após chamada — o mesmo padrão que `autonomousLoop()`/`runAgentUntilDone()` do Squad (`apps/web/src/pages/SquadPage.tsx:1223-1344`) já usam para os agentes internos. O backend desta fase só ganha persistência (objetivo/autonomia/DoD) — nenhum motor de orquestração novo.

### Protocolo de tags

Cada tarefa é enviada ao Hermes com instrução de finalização obrigatória (mesma convenção que o Squad já usa para `[PRONTO]`/`[APROVADO]`/`[BLOQUEADO]`):

```
[TAREFA_CONCLUIDA]                                        → sucesso
[TAREFA_BLOQUEADA: <motivo>]                              → bloqueio técnico real
[DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]        → decisão de negócio que o Hermes não pode inferir
```

`parseTaskTag()` (`HermesAgentPanel.tsx`) reconhece as 3 tags via regex (mesmo estilo de `extractParams` em `packages/core/src/squad/actions.ts:11-17`). Texto sem nenhuma tag → 1 mensagem de lembrete antes de marcar a tarefa `BLOCKED` com "sem tag de conclusão".

### Geração do plano

Prompt dedicado pede um bloco ` ```json ` com `[{"title":"...","description":"..."}]`. `parseTaskPlan()` extrai o bloco (ou o primeiro `[...]` no texto) e faz `JSON.parse`; se nada parsear, cai para uma única tarefa "Objetivo completo" com o texto bruto — o fluxo nunca quebra por plano malformado, só degrada para o comportamento simples da FASE 2.

### Fluxo do loop

```
startAutonomousObjective(objetivo)
  → HermesService.setObjective (persiste)
  → sendAndWait(buildPlanPrompt(objetivo))     — reusa hermes:agent:send, aguarda 'done'
  → parseTaskPlan(resposta) → ipc.tasks.create() por tarefa (agent_tasks, ownerAgent:'hermes')
  → se autonomyLevel === 'autonomous' → runLoop()

runLoop()
  enquanto houver tarefa TODO e loopStopRef não estiver setado:
    marca IN_PROGRESS → executeTask(tarefa) → recarrega lista
    resultado !== 'done' → para o loop (BLOCKED / decision / error)
  teto de segurança: tasks.length * 3 (mín. 10) iterações

executeTask(tarefa)
  envia buildTaskPrompt(tarefa) via sendAndWait
  tag 'done'     → marca DONE
  tag 'blocked'  → marca BLOCKED com o motivo
  tag 'decision' → seta pendingDecision, loop pausa
  tag 'none'     → 1 lembrete (REMINDER_PROMPT); se persistir → BLOCKED "sem tag de conclusão"
```

`sendAndWait(prompt)` é o helper que unifica plano e execução de tarefas: chama `ipc.hermes.agent.send`, escuta `ipc.hermes.agent.onChunk` localmente (com seu próprio filtro por `streamId`, independente do listener da mensagem livre — ver nota abaixo), acumula o texto e resolve no evento `done`/`error`.

**Isolamento entre os dois listeners de `hermes:agent:chunk`:** a mensagem livre (FASE 2) e o loop autônomo (FASE 3) usam o mesmo canal de eventos IPC. O listener da mensagem livre só processa chunks quando `sending === true` (guarda adicionada nesta fase); o listener do `sendAndWait` é local à chamada e se auto-desinscreve no `done`/`error`. Como as duas chamadas nunca ficam concorrentes de verdade (a UI desabilita a mensagem livre enquanto `planning`/`looping` está ativo), não há cross-talk entre os dois fluxos.

### Definition of Done — checklist, não gate automático

```
DEFAULT_DOD_ITEMS (7): build, requisitos, banco, testes, .env.example, commits, README
Auto-verificados via SSH direto (TerminalService.exec, não passa pelo CLI hermes):
  .env.example → test -f "<workspace>/.env.example"
  commits      → git -C "<workspace>" log -1 --oneline
Os outros 5 ficam manuais — o usuário marca via checkbox.
```

Decisão de escopo: tentar auto-detectar/rodar build ou testes de uma stack arbitrária de forma confiável é um projeto à parte (falso-negativo trava o usuário, falso-positivo mente pra ele) — por isso o DoD desta fase é informativo, não bloqueia o loop.

### Decision Request

Quando `executeTask`/`resolveDecision` encontram a tag `[DECISAO_NECESSARIA ...]`, o loop pausa e a UI mostra a pergunta + botões por opção + campo de resposta livre. A resposta do usuário vira uma nova mensagem (`buildTaskPrompt(tarefa) + "Decisão do usuário: <resposta>"`) via `sendAndWait`; se ainda `autonomyLevel === 'autonomous'` e nenhuma nova decisão foi levantada, `runLoop()` é re-disparado para continuar automaticamente.

### Autonomia — binário (decisão consciente, não os 3 tiers do brief original)

`HermesProjectAgent.autonomyLevel`: `'manual'` (usuário clica "Próxima" por tarefa) ou `'autonomous'` (`runLoop()` avança sozinho). Os rótulos Assistido/Semi-autônomo/Autônomo do brief original não aparecem nesta fase — simplificação escolhida explicitamente pelo usuário; motivo: não há sinal suficiente do que o Hermes expõe (ex. classificação de risco por tarefa) para diferenciar 3 comportamentos reais ainda.

### Banco de dados

```sql
-- hermes_project_agents ganha (ALTER TABLE, retrocompatível com FASE 2):
objective     TEXT NOT NULL DEFAULT ''
autonomyLevel TEXT NOT NULL DEFAULT 'manual'
dodChecklist  TEXT NOT NULL DEFAULT '[]'   -- JSON: [{id,label,auto,done}]
```

Tarefas continuam em `agent_tasks` (tabela do Squad, sem mudança de schema) — `TasksService.list()` ganhou filtro opcional `projectId`.

### IPC novo

```
hermes:agent:setObjective ({projectId, objective}) → requireAdmin
hermes:agent:setAutonomy  ({projectId, level})      → requireAdmin
hermes:dod:get            ({projectId})             → requireAuth  → DodItem[]
hermes:dod:toggle         ({projectId, itemId, done}) → requireAdmin → DodItem[]
hermes:dod:runChecks      ({projectId})             → requireAdmin → DodItem[]
```

### O que NÃO foi feito nesta fase (propositalmente)

- 3 tiers de autonomia (Assistido/Semi-autônomo/Autônomo) — simplificado para binário, decisão explícita do usuário.
- DoD como gate automático do loop — fica informativo/checklist.
- Parsing estruturado de eventos por subagente/tool — ainda depende do ACP (FASE 2 já registrou essa limitação).
- Task Board visual estilo kanban (ETAPA 12 completo) — lista simples com badges já entrega o essencial; quadro visual fica para quando FASE 4 (subagents) justificar mais colunas.

## Hermes Execução Paralela (v3.55.0+) — FASE 4

Pesquisa confirmou que o Hermes **não expõe** um comando externo de "spawn subagente" — "Subagents" é uma capacidade interna e opaca da `AIAgent` ("spawn isolated subagents for parallel workstreams"), sem equivalente tipo `hermes subagent spawn`. O que existe e é utilizável é `hermes -w`/`--worktree` ("isolated git worktree for parallel-agent workflows"), mas a documentação não diz onde o worktree é criado, como fazer merge de volta, nem se é seguro rodar vários simultaneamente.

**Decisão de arquitetura:** o NEX não depende da flag `-w`. Ele gerencia os git worktrees ele mesmo, com comandos git padrão totalmente documentados (`git worktree add/remove`, `git merge`), reaproveitando o `GitService` que já existe para o Source Control do IDE. O Hermes só roda dentro do worktree que o NEX já preparou — pra ele é só um diretório comum.

### Fluxo de uma tarefa paralela

```
runLoop() (HermesAgentPanel.tsx) separa as tarefas TODO em parallelizable vs sequenciais
  lote de até 3 parallelizable rodam via Promise.all:

    ipc.hermes.parallel.start(projectId, taskId, objective)
      → HermesService.startParallelTask()
          worktreePath = "<remotePath>-worktrees/task-<id curto>"
          branch       = "nex/task-<id curto>"
          GitService.worktreeAdd(vpsId, remotePath, worktreePath, branch)
          HermesClient.streamObjective(vpsId, { workspace: worktreePath, objective, resume: false })
      → { streamId, worktreePath, branch }

    waitForChunkStream(streamId) — mesmo canal hermes:agent:chunk das fases anteriores
    tag = parseTaskTag(texto)

    ipc.hermes.parallel.finish(projectId, worktreePath, branch, merge = tag.kind === 'done')
      → HermesService.finishParallelTask()
          merge=true  → GitService.merge() — git merge --no-ff
                          sucesso → GitService.worktreeRemove() (só depois do merge)
                          falha   → git merge --abort; branch/worktree preservados, nada é forçado
          merge=false → não toca em nada — branch preservado para revisão manual

    tarefa vira DONE (se a tag foi [TAREFA_CONCLUIDA], com nota se o merge falhou)
              ou BLOCKED (qualquer outro caso — incluindo decisão/tag ausente, que em modo
              paralelo não tem "turno de volta" simples: não há sessão pra retomar num worktree one-shot)
```

### `GitService` — 3 métodos novos (`packages/core/src/git/git.service.ts`)

```ts
worktreeAdd(vpsId, cwd, worktreePath, branch)   // mkdir -p do pai + git worktree add -b
worktreeRemove(vpsId, cwd, worktreePath)        // git worktree remove --force — só pós-merge OK
merge(vpsId, cwd, branch)                       // git merge --no-ff; em erro, git merge --abort, nunca força
```

Todos reaproveitam o `sshExec` privado que já existe em `GitService` (mesmo padrão de `add`/`commit`/`push`).

### `HermesService` — injeta `GitService`

Construtor passa a `(terminal, sftp, git)`. `startParallelTask`/`finishParallelTask` fazem a mesma validação de instância `running` que `streamObjective` (FASE 2), mas **não tocam** no `HermesProjectAgent` da sessão principal — é uma execução isolada, não a conversa do projeto.

### Banco de dados

`agent_tasks` (tabela raw-SQL do Squad, sem model Prisma — criada em `packages/db/src/index.ts:initializeDatabase()`, chamada em `apps/desktop/src/main.ts`) ganha `parallelizable INTEGER NOT NULL DEFAULT 0`, com `ALTER TABLE` incremental em `handlers.ts` para instalações existentes. O prompt de plano (`buildPlanPrompt`) pede ao próprio Hermes para marcar cada tarefa como paralelizável ou não.

### IPC novo

```
hermes:parallel:start  ({projectId, taskId, objective})           → requireAdmin → { streamId, worktreePath, branch }
hermes:parallel:finish ({projectId, worktreePath, branch, merge}) → requireAdmin → { merged, output }
```

Reaproveita `hermes:agent:chunk` (streaming) e `hermes:agent:cancel` (cancelar por streamId) — sem canais novos para isso.

### Refactor — `wireHermesStream()`

A lógica de plumbing de stream (registrar em `hermesStreams`, repassar `data`/`close`/`error` como `hermes:agent:chunk`, watchdog de 300s) existia só em `hermes:agent:send` (FASE 2). Com `hermes:parallel:start` precisando exatamente da mesma coisa, foi extraída para `wireHermesStream(targetWin, streamId, stream, onSettled)` em `handlers.ts` — os dois handlers chamam a mesma função, cada um com seu `onSettled` (um atualiza `HermesProjectAgent`, o outro não precisa).

### UI

`HermesAgentPanel.tsx`: painel "Agentes ativos" (compacto, só aparece com execução paralela em andamento — título + branch por slot); badge "paralelo" nos itens de tarefa `parallelizable`. `sendAndWait` foi dividido em `waitForChunkStream(streamId)` (espera um stream já iniciado) + `sendAndWait(prompt)` (chama `send` e delega ao anterior) — o fluxo paralelo usa só o primeiro, já que conhece o `streamId` de antemão.

### O que NÃO foi feito nesta fase (propositalmente)

- Depender de `hermes -w` — substituído por git worktree gerenciado pelo NEX (ver "Decisão de arquitetura" acima).
- Resolver Decision Request interativamente em execução paralela — vira bloqueio para revisão manual.
- Forçar merge em conflito — o branch/worktree fica intacto, sempre.
- Grafo de dependências entre tarefas — o campo `parallelizable` é uma decisão binária por tarefa (o Hermes decide durante o plano), não um grafo de dependências explícito; suficiente para o caso comum sem a complexidade de rastrear dependências entre IDs.

## Hermes Memory + Skills (v3.56.0+) — FASE 5

Visibilidade só-leitura de skills/sessões do Hermes + um adapter de contexto NEX→Hermes. Ao contrário das FASEs 3/4, a pesquisa aqui confirmou uma base real e documentada (não precisou de decisão de contorno): `hermes skills list` é comando externo de verdade, skills vivem em `~/.hermes/skills/*/SKILL.md` (markdown + frontmatter YAML documentado), `hermes sessions list/stats/export` são reais, e o Hermes **injeta automaticamente** arquivos de contexto do projeto (`SOUL.md`, `.hermes.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`) no system prompt, sem nenhuma flag.

### Skills — só leitura, sem YAML novo

```
HermesClient.listSkillFiles(vpsId)
  → for f in $HOME/.hermes/skills/*/*/SKILL.md $HOME/.hermes/skills/*/SKILL.md; do
      [ -f "$f" ] && echo "@@@FILE:$f" && cat "$f" && echo
    done
  → texto concatenado, um SKILL.md por bloco marcado com @@@FILE:<path>

HermesService.getSkills(vpsId)
  → parseSkillFiles(raw): separa por @@@FILE:, extrai o bloco --- ... --- (frontmatter)
    de cada um, regex `^chave:\s*(.+)$` sobre name/description/version (campos flat,
    documentados — não precisa de biblioteca YAML)
  → HermesSkillInfo[] { name, description, version, path }
```

Nunca cria, edita ou apaga skills — só `cat`. Nenhuma tentativa de forçar as 3 categorias do brief original (Global/Project/System Skills); a UI mostra a categoria real (nome da pasta) do Hermes. Promoção de skill de projeto→global não é orquestrada pelo NEX — o próprio Hermes já faz gerenciamento procedural de skills sozinho via `skill_manage` após tarefas complexas (a ETAPA 20 do brief já é satisfeita pelo comportamento nativo do Hermes).

### Sessões — texto bruto (formato não confirmado)

```
HermesService.getSessionsSummary(vpsId)
  → client.execCommand(vpsId, 'sessions stats')  (reaproveita execCommand da FASE 1)
  → client.execCommand(vpsId, 'sessions list')
  → concatenados num único HermesCommandResult — sem parsing, já que o formato de
    saída de `hermes sessions list` não é confirmado pela documentação
```

### Adapter de contexto — `.hermes.md`

```
HermesService.syncProjectContext(projectId)
  → KnowledgeService.buildContext()                    — KB Global (já existe)
  → ProjectMemoryService.buildBlock(vpsId, projectId)   — memória do projeto (já existe)
  → concatena os dois (se ambos vazios, não escreve nada)
  → SftpSession.writeFile("<remotePath>/.hermes.md", conteúdo)
```

**Por que `.hermes.md` e não `AGENTS.md`:** `AGENTS.md` é uma convenção usada por várias ferramentas (este próprio repo tem um `CLAUDE.md` no mesmo espírito) — o usuário pode já manter um `AGENTS.md` próprio no projeto alvo, e sobrescrevê-lo seria destrutivo. `.hermes.md` está explicitamente na lista de arquivos que o Hermes injeta e fica sob controle exclusivo do NEX (gerado com um comentário HTML avisando que é automático).

Chamado manualmente (botão "Sincronizar contexto" em `HermesAgentPanel.tsx`) e automaticamente (best-effort, uma vez por objetivo novo em `startAutonomousObjective`) — não a cada mensagem, para não gerar um SFTP write a cada turno do loop.

### IPC novo

```
hermes:skills:list       ({vpsId})     → requireAuth  → HermesSkillInfo[]
hermes:sessions:summary  ({vpsId})     → requireAuth  → HermesCommandResult
hermes:agent:syncContext ({projectId}) → requireAdmin → { written, path }
```

### UI

`HermesPage.tsx` ganha 3 abas no painel direito (Console, já existente, inalterado; Skills — cards nome/versão/descrição/caminho; Sessões — texto bruto). `HermesAgentPanel.tsx` ganha o botão "Sincronizar contexto".

### O que NÃO foi feito nesta fase (propositalmente)

- Editar/criar/apagar skills do Hermes — só leitura (ETAPA 19 do brief: usar a API/mecanismo próprio do Hermes, nunca mexer direto nos arquivos internos).
- Orquestrar promoção de skill projeto→global — o Hermes já faz isso sozinho.
- Forçar as 3 categorias do brief (Global/Project/System Skills) — não existem como conceito externo do Hermes.
- Parsing estruturado de `hermes sessions list` — formato de saída não confirmado.

## Hermes Automação (v3.57.0+) — FASE 6

Sexta e última fase planejada da integração Hermes: cron (agendar um objetivo Hermes sem abrir o AI Hub), execução não-assistida (o objetivo roda até o fim sem uma janela do renderer consumindo o stream) e recovery de sessão interrompida (o NEX detecta e oferece retomar sessões órfãs deixadas por um fechamento abrupto do app). As três reaproveitam mecanismos já existentes — nenhuma peça de infraestrutura nova.

### Cron — `scheduled_jobs` ganha `projectId`

O Ponto 7 (v3.42.0) já tinha `scheduled_jobs` + `JobExecutor` para automações do Squad. Em vez de uma tabela dedicada ao Hermes, a mesma tabela ganhou uma coluna opcional:

```sql
-- scheduled_jobs ganha (ALTER TABLE, retrocompatível):
projectId TEXT   -- obrigatório quando agentName = 'hermes'; ignorado para os demais agentes
```

Uma automação com `agentName: 'hermes'` + `projectId` roda um objetivo Hermes no projeto indicado; qualquer outro `agentName` continua indo para `AiService.chatAgent()` com um agente do Squad, como antes. O mesmo formulário "Nova automação" em `AutomationsPage.tsx` cobre os dois casos — quando o usuário escolhe "Hermes" na lista de agentes, um seletor de projeto aparece e passa a ser obrigatório para salvar.

### Execução não-assistida — `HermesService.runObjectiveUnattended()`

```
JobExecutor.executeJob(job)
  job.agentName === 'hermes' → executeHermesJob(job)
    → HermesService.runObjectiveUnattended(job.projectId, job.instruction)
        → streamObjective() (mesma marcação de status/--resume da FASE 2)
        → bufferiza toda a saída do ExecStream no próprio HermesService
            (sem hermes:agent:chunk, sem BrowserWindow — não há UI aberta num cron)
        → watchdog de inatividade 300s (igual ao wireHermesStream() do handlers.ts)
          + teto duro 20min (sem usuário para cancelar manualmente um cron travado)
    → Notification desktop com o resultado (mesmo padrão do JobExecutor original)
```

`JobExecutor` passa a receber `HermesService` no construtor — `handlers.ts` cria `hermesSvc` antes de `jobExecutor` agora (ordem invertida em relação às fases anteriores, onde `jobExecutor` não dependia de nada do Hermes).

### Recovery de sessão interrompida — `HermesService.recoverInterruptedSessions()`

```
setupIpcHandlers() (boot do main process)
  → hermesSvc.recoverInterruptedSessions()
      → SELECT hermes_project_agents WHERE status = 'running'
      → todo resultado é órfão por definição: ExecStream é um objeto em memória do processo
        Electron anterior — não sobrevive a um restart, então nenhum status 'running' pode
        estar realmente em execução no momento em que este método roda
      → UPDATE status='error', lastError='...interrompida...' (string reconhecível pela UI)
      → sessionStarted NÃO é tocado → o próximo streamObjective() já decide --resume sozinho
        (mesma lógica de resume da FASE 2, nenhum código novo de retomada)
      → UPDATE agent_tasks SET status='TODO' WHERE ownerAgent='hermes' AND status='IN_PROGRESS'
        AND projectId = <cada projeto órfão> — destrava o loop autônomo da FASE 3 para tarefas
        que ficaram presas em IN_PROGRESS no meio da interrupção
```

`HermesAgentPanel.tsx` mostra um banner âmbar quando `agentInfo.status === 'error' && lastError.includes('interrompida')`, com botão "Retomar sessão" que chama `resumeInterrupted()` — reenvia pelo mesmo fluxo de mensagem livre (`ipc.hermes.agent.send`) usado desde a FASE 2, sem endpoint novo.

### IPC — sem canais novos

Nenhum handler `hermes:*` novo nesta fase — `runObjectiveUnattended` é chamado internamente pelo `JobExecutor` (processo main), e `recoverInterruptedSessions` roda automaticamente no boot. A única superfície nova é a coluna `projectId` já aceita pelos handlers `jobs:create`/`jobs:update` existentes (o tipo `ScheduledJobInput` só ganhou um campo opcional).

### O que NÃO foi feito nesta fase (propositalmente)

- Sistema de cron dedicado ao Hermes — reaproveita `scheduled_jobs`/`JobExecutor` do Ponto 7 em vez de duplicar agendamento.
- Diagnóstico de causa da interrupção (crash vs. fechamento normal vs. `kill -9`) — não é possível distinguir de dentro do processo que acabou de subir; todo `status:'running'` sobrevivente ao boot é tratado como interrompido, o que é sempre uma suposição segura (o pior caso é reenviar um "continue de onde parou" para uma sessão que na verdade tinha terminado corretamente, mas o `HermesProjectAgent` não foi atualizado a tempo — cenário raro e inofensivo).
- Recuperação automática de Decision Requests pendentes no momento da interrupção — o usuário precisa reabrir o objetivo/tarefa manualmente após "Retomar sessão" (mesma limitação de escopo já registrada para execução paralela na FASE 4).
