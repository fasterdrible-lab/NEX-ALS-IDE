# ARCHITECTURE.md — HEXAGON IDE v3.3.1

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
id, vscodePath, vscodeInsidersPath, sshKeyPath, updatedAt

-- launch_history
id, projectId(FK), launchedAt, success, errorMsg?
```

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

## HEXAGON AI HUB (v3.0.0+)

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
