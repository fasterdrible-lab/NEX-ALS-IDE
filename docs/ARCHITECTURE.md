# ARCHITECTURE.md — Claude Workspace Manager

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

## Futuras melhorias arquiteturais

- Docker local para isolamento de contas sem VPS
- Plugin system para outros editores (JetBrains, Cursor)
- Suporte a chaves SSH com passphrase (ssh-agent integration)
- WebSocket para status em tempo real das VPS
- Electron IPC tipado com `@electron-toolkit/typed-ipc`
