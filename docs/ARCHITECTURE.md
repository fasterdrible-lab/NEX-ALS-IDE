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
