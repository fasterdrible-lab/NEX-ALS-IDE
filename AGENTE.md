# AGENTE.md — Claude Workspace Manager

## O que o projeto faz

Interface desktop local (Electron) para gerenciar múltiplos ambientes de desenvolvimento com Claude Code. O problema central é que o Claude Code pode compartilhar autenticação entre diferentes instâncias do VS Code. A solução é isolar as contas em VPS separadas e fornecer uma interface visual simples para abrir o ambiente correto (VS Code Remote SSH) com a conta Claude certa.

Inclui também o **HEXAGON IDE** — editor de código integrado que conecta ao servidor remoto via SSH/SFTP, dispensando o VS Code para edição rápida de arquivos, execução de comandos e gestão de Git, tudo diretamente na VPS.

## Domínio de produção

Gerenciamento de ambientes de desenvolvimento com IA e múltiplas contas Claude Code.

## Stack completa com versões

| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 22 LTS | Runtime |
| TypeScript | 5.7 | Linguagem |
| Electron | 33+ | Desktop shell |
| electron-vite | latest | Build (main bundado com Rollup) |
| electron-builder | 25+ | Empacotamento |
| React | 18 | UI |
| Vite | 6 | Bundler |
| Tailwind CSS | 3 | Estilo |
| Lucide React | latest | Ícones |
| React Router | 6 | Roteamento |
| Prisma | 5 | ORM |
| better-sqlite3 | 9 | Driver SQLite |
| Zod | 3 | Validação |
| pnpm | 9 | Package manager |
| concurrently | 9 | Dev scripts |
| ssh2 | latest | SSH/SFTP nativo (sem PATH) |
| @monaco-editor/react | latest | Editor de código no IDE |
| monaco-editor | latest | Core Monaco |
| @xterm/xterm | latest | Terminal emulador |
| @xterm/addon-fit | latest | Resize automático xterm |

## Estrutura do monorepo

```
/
├── apps/
│   ├── desktop/          ← Electron main process + preload
│   └── web/              ← React + Vite (renderer)
├── packages/
│   ├── config/           ← Zod schemas + tipos compartilhados
│   ├── core/             ← Serviços de negócio (VPS, projetos, etc.)
│   │   └── src/
│   │       ├── vps/
│   │       ├── projects/
│   │       ├── accounts/
│   │       ├── launcher/
│   │       ├── settings/
│   │       ├── diagnostics/
│   │       ├── git/      ← GitService (status/diff/add/commit/push/pull)
│   │       ├── sftp/     ← SftpService + SftpSession
│   │       └── terminal/ ← TerminalService (shell + exec)
│   └── db/               ← Prisma client + schema SQLite
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── TASKS.md
│   └── IDE_ROADMAP.md
├── scripts/
│   └── dev.js            ← Launcher que limpa ELECTRON_RUN_AS_NODE
├── memory/
│   └── project_claude_workspace_manager.md
├── AGENTE.md
├── CLAUDE.md
├── CHANGELOG.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Módulos do backend/core

### `packages/core/src/vps/`
- Cadastro de VPS (IP, nome, usuário SSH, porta, caminho padrão)
- `testConnection()` — SSH via ssh2, sem dependência de OpenSSH no PATH
- `checkClaudeCode(vpsId)` — verifica se Claude Code está instalado e logado via SSH exec

### `packages/core/src/projects/`
- Cadastro de projetos (nome, caminho remoto, repositório Git, VPS associada)
- Associação a conta Claude

### `packages/core/src/accounts/`
- Cadastro lógico de contas Claude (nome amigável, e-mail opcional, VPS associada)
- Nunca armazena senha ou token

### `packages/core/src/launcher/`
- Abrir VS Code com Remote SSH (`code --folder-uri vscode-remote://ssh-remote+...`)
- Abrir terminal SSH no Windows Terminal / PowerShell
- Executar comandos seguros na VPS

### `packages/core/src/settings/`
- Caminho do VS Code e VS Code Insiders
- Caminho de chave SSH
- Preferências locais

### `packages/core/src/diagnostics/`
- Verificar: VS Code, SSH, Git, Node.js
- Verificar por VPS: ping, Claude Code instalado

### `packages/core/src/git/` ← adicionado em 1.0.8
- `GitService.status(vpsId, projectPath)` — arquivos staged, unstaged, untracked, branch, ahead/behind
- `GitService.diff(vpsId, projectPath, filePath, staged?)` — diff textual de arquivo
- `GitService.add(vpsId, projectPath, files[])` — stage seletivo
- `GitService.restore(vpsId, projectPath, files[])` — unstage / revert
- `GitService.commit(vpsId, projectPath, message)` — commit
- `GitService.push(vpsId, projectPath)` — push
- `GitService.pull(vpsId, projectPath)` — pull
- `GitService.log(vpsId, projectPath, n?)` — histórico de commits

### `packages/core/src/sftp/` ← adicionado em 1.0.6
- `SftpService.openSession(vpsId)` → `SftpSession`
- `SftpSession.readdir(path)` — lista arquivos/pastas
- `SftpSession.readFile(path)` — conteúdo texto
- `SftpSession.readFileBase64(path)` — conteúdo binário (imagens)
- `SftpSession.writeFile(path, content)` — salvar
- `SftpSession.mkdir(path)` — criar pasta
- `SftpSession.delete(path)` — excluir arquivo
- `SftpSession.rename(oldPath, newPath)` — renomear/mover
- `SftpSession.touch(path)` — criar arquivo vazio

### `packages/core/src/terminal/` ← adicionado em 1.0.6
- `TerminalService.openShell(vpsId, onData, onClose)` → `TerminalHandle`
- `TerminalService.exec(vpsId, cmd, timeout?)` — SSH exec one-shot (não-interativo)

## Rotas do frontend

| Rota | Tela |
|---|---|
| `/` | Dashboard — cards de VPS e projetos recentes |
| `/vps` | Lista de VPS — CRUD + teste de conexão |
| `/projects` | Lista de projetos — CRUD + associação |
| `/accounts` | Contas Claude — CRUD + instruções de login |
| `/launcher` | Lançador — botão "Abrir Projeto" + botão "IDE" por VPS |
| `/settings` | Configurações — caminhos VS Code, SSH |
| `/diagnostics` | Diagnóstico — status de todas as ferramentas |
| `/help` | Manual de Uso — 9 seções expansíveis |
| `/terminal/:vpsId/:vpsName` | Terminal SSH fullscreen |
| `/explorer/:vpsId/:vpsName` | Explorer SFTP fullscreen |
| `/ide/:vpsId/:vpsName` | **HEXAGON IDE** fullscreen |

## HEXAGON IDE — features implementadas

| Feature | Status | Versão |
|---|---|---|
| Explorer SFTP (esquerda) — navegar/criar/renomear/excluir | ✅ | 1.0.6 |
| Monaco Editor (centro) — syntax highlighting, tabs múltiplas, Ctrl+S | ✅ | 1.0.6 |
| Terminal SSH xterm.js (baixo, Ctrl+\`) | ✅ | 1.0.6 |
| Painéis redimensionáveis (drag handles) | ✅ | 1.0.6 |
| Paleta de comandos (Ctrl+Shift+P) | ✅ | 1.0.8 |
| Criar arquivo inline (FilePlus + Enter) | ✅ | 1.0.8 |
| Git integrado — Source Control completo | ✅ | 1.0.8 |
| Status bar — branch git, Ln/Col, hint paleta | ✅ | 1.0.8 |
| Tree view hierárquica — expand/collapse por pasta | ✅ | 1.0.9 |
| Find in Files (Ctrl+Shift+F) — grep SSH + resultado clicável | ✅ | 1.0.9 |
| Múltiplas abas de terminal — N sessões SSH independentes | ✅ | 1.0.9 |
| Preview de imagem — PNG/JPG/GIF/WebP como `<img>` | ✅ | 1.1.0 |
| Copiar/Duplicar arquivos — `cp -rp` + "Copiar caminho" | ✅ | 1.1.0 |
| Auto-refresh da tree — ao salvar + polling 30s | ✅ | 1.1.0 |
| Find/Replace (Ctrl+H) — addCommand garantido no Electron | ✅ | 1.1.1 |
| Go to Line (Ctrl+G) — addCommand garantido no Electron | ✅ | 1.1.1 |
| Painel de Problemas — erros/warnings Monaco, jumpToLine | ✅ | 1.1.1 |

## Roles e autenticação

**V.1.1.1:** Aplicação local single-user, sem login interno.

**Role: admin (único)**
- Cadastrar VPS, projetos, contas Claude
- Editar configurações
- Executar diagnósticos
- Abrir ambientes remotos (VS Code ou IDE integrado)

**Regras:**
- App não armazena senha Claude
- App não armazena token Claude
- App armazena apenas nomes amigáveis de contas (ex: "Claude Conta A")
- Autenticação real do Claude Code ocorre dentro de cada VPS

## Estado atual

`V.1.1.1` — HEXAGON IDE completo. Todas as features P0, P1 e P2 do backlog IDE implementadas. Ver `docs/CURRENT_STATE.md`.

## Próxima tarefa

Features P3 (split editor, LSP remoto, port forwarding) ou features de app (testes, packaging). Ver `docs/TASKS.md`.

## Regras obrigatórias

1. Nunca armazenar senha ou token Claude
2. Nunca armazenar chave privada SSH no banco
3. Usar `contextIsolation: true` e `nodeIntegration: false`
4. Validar toda entrada com Zod no main process
5. Atualizar CHANGELOG a cada implementação relevante
6. Atualizar TASKS.md ao concluir ou iniciar tarefas
7. Atualizar CURRENT_STATE.md ao mudar estado do projeto
8. Atualizar ARCHITECTURE.md ao mudar decisões técnicas
9. Sincronizar versão nos 3 `package.json` (raiz, desktop, web)

## Tabela de arquivos de risco

| Arquivo | Risco | Motivo | Cuidado |
|---|---|---|---|
| `packages/db/prisma/schema.prisma` | Médio | Define toda a estrutura do banco | Mudanças exigem migração |
| `apps/desktop/src/main.ts` | Alto | Processo principal Electron, acesso total ao sistema | Nunca expor no renderer |
| `apps/desktop/src/preload.ts` | Alto | Bridge entre main e renderer | Validar channels IPC |
| `apps/desktop/src/ipc/handlers.ts` | Alto | Executa comandos do sistema | Sanitizar todo input |
| `packages/core/src/launcher/launcher.service.ts` | Alto | Executa `exec()` com parâmetros externos | Validar paths e comandos |
| `apps/web/src/pages/IDEPage.tsx` | Médio | Componente principal do IDE — 1200+ linhas | Edits cirúrgicos apenas |
| `.env` / `.env.local` | Crítico | Pode conter DATABASE_URL | Nunca commitar |
| `cwm.db` (userData) | Alto | Banco local com dados de infra | Não versionar, fazer backup |
| `~/.ssh/id_rsa` | Crítico | Chave SSH privada do usuário | Nunca copiar ou expor |
| `packages/core/src/vps/vps.service.ts` | Médio | Faz SSH com dados da VPS | Sanitizar host/user antes de exec |

## Comandos úteis

```bash
# Instalação
pnpm install

# Desenvolvimento (limpa ELECTRON_RUN_AS_NODE antes de iniciar)
pnpm dev

# Build completo
pnpm build

# Lint
pnpm lint

# Type check
pnpm typecheck

# Gerar Prisma client
pnpm db:generate

# Sincronizar schema com banco
pnpm db:push

# SSH direto VPS 1
ssh root@204.168.180.25

# SSH direto VPS 2
ssh root@77.42.30.4

# Claude Code remoto
claude --version
claude
claude logout

# Git
git status
git add .
git commit -m "mensagem"
git push
git pull
```

## IPC channels registrados

### terminal:*
- `terminal:open` — abre shell SSH interativo
- `terminal:write` — envia dados para o terminal
- `terminal:resize` — resize do pty
- `terminal:close` — fecha sessão
- `terminal:exec` — executa comando one-shot (não-interativo)

### sftp:*
- `sftp:readdir` — lista diretório
- `sftp:readFile` — lê arquivo como texto
- `sftp:readFileBase64` — lê arquivo como base64 (imagens)
- `sftp:writeFile` — salva arquivo
- `sftp:mkdir` — cria diretório
- `sftp:delete` — exclui arquivo/pasta
- `sftp:rename` — renomeia/move
- `sftp:touch` — cria arquivo vazio

### git:*
- `git:status` — status do repositório
- `git:diff` — diff de arquivo
- `git:add` — stage de arquivos
- `git:restore` — unstage / revert
- `git:commit` — commit
- `git:push` — push
- `git:pull` — pull
- `git:log` — histórico

## Links de referência

- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [VS Code Remote SSH](https://code.visualstudio.com/docs/remote/ssh)
- [Electron Docs](https://www.electronjs.org/docs/latest)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [xterm.js](https://xtermjs.org/)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [Prisma Docs](https://www.prisma.io/docs)
- [SQLite Docs](https://www.sqlite.org/docs.html)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zod Docs](https://zod.dev)
