# AGENTE.md — NEX-ALS IDE

**Repositório:** https://github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER.git
**Remote local:** `git remote set-url origin https://github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER.git`

## O que o projeto faz

**NEX-ALS IDE** é uma aplicação desktop local (Electron) com duas camadas:

1. **Gerenciador de ambientes** — resolve o problema de autenticação compartilhada do Claude Code entre instâncias do VS Code. Isola as contas em VPS separadas e abre o ambiente correto (VS Code Remote SSH) com a conta Claude certa.

2. **IDE integrado** — editor de código completo que conecta ao servidor remoto via SSH/SFTP, com Monaco Editor, terminal xterm.js, Git integrado e painel de problemas. Dispensa o VS Code para edição rápida de arquivos e execução de comandos diretamente na VPS.

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
│   │       ├── git/       ← GitService (status/diff/add/commit/push/pull)
│   │       ├── sftp/      ← SftpService + SftpSession
│   │       ├── terminal/  ← TerminalService (shell + exec)
│   │       └── knowledge/ ← KnowledgeService (KB Global SQLite)
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

### `packages/core/src/knowledge/` ← adicionado em 3.17.0
- `KnowledgeService.list()` — lista todas as entradas
- `KnowledgeService.listActive()` — lista apenas ativas (para injeção)
- `KnowledgeService.create(input)` — cria entrada validada com Zod
- `KnowledgeService.update(id, input)` — atualiza parcialmente
- `KnowledgeService.delete(id)` — remove
- `KnowledgeService.buildContext()` — formata KB como markdown agrupado por categoria para injeção nos system prompts de Squad e AI HUB

### `packages/core/src/tunnel/` ← adicionado em 1.5.0
- `TunnelService.open(vpsId, localPort, remotePort, remoteHost?)` — cria túnel SSH local via `ssh2.forwardOut`
- `TunnelService.close(tunnelId)` — encerra o túnel e o servidor TCP local
- `TunnelService.list()` — lista túneis ativos
- `TunnelService.closeAll()` — encerra todos os túneis

## Rotas do frontend

| Rota | Tela |
|---|---|
| `/` | Dashboard — cards de VPS e projetos recentes |
| `/vps` | Lista de VPS — CRUD + teste de conexão |
| `/projects` | Lista de projetos — CRUD + associação |
| `/accounts` | Contas Claude — CRUD + instruções de login |
| `/launcher` | Lançador — botão "Abrir Projeto" + botão "IDE" por VPS + "Abrir pasta local" |
| `/settings` | Configurações — VS Code/SSH + Backup/Restore JSON + **Brave API Key** |
| `/diagnostics` | Diagnóstico — status de todas as ferramentas |
| `/help` | Manual de Uso — 9 seções expansíveis |
| `/knowledge` | KB Global do Desenvolvedor — CRUD de entradas (title, content, category, tags) |
| `/skills` | Skills — CRUD de habilidades por agente; detecção por gatilho no Squad |
| `/tasks` | Tarefas — `agent_tasks` SQLite; status TODO/IN_PROGRESS/BLOCKED/DONE |
| `/search` | Busca Global — pesquisa em conhecimento + skills + sessões |
| `/automations` | Automações — gatilhos periódicos para Squad |
| `/planning` | **Planning Mode** — fila de tarefas + automações + contexto por agente |
| `/workspace` | **Workspace Intelligence** — análise automática do projeto (5 abas) |
| `/operator` | **Operador** — telemetria VPS + alertas |
| `/monitor` | Monitor de VPS — CPU/RAM/Disco/Uptime; auto-refresh 30s |
| `/history` | Histórico de lançamentos |
| `/terminal/:vpsId/:vpsName` | Terminal SSH fullscreen |
| `/explorer/:vpsId/:vpsName` | Explorer SFTP fullscreen |
| `/ide/:vpsId/:vpsName` | **NEX-ALS IDE** modo remoto (VPS) |
| `/ide/local` | **NEX-ALS IDE** modo local (OneDrive/PC) |

## NEX-ALS IDE — features implementadas

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
| **Badge PRODUÇÃO** — vermelho pulsante no modo remoto; verde "Local" no modo local | ✅ | 1.3.0 |
| **Modo Local** — rota `/ide/local`, dialog nativo, IPC `local:*`, filesystem abstraction | ✅ | 1.3.0 |
| **Chat Claude** — `claude -p` via SSH, contexto automático (árvore+docs+arquivo), seletor de VPS, ambos os modos, Copiar/Aplicar/Salvar como, paste de print | ✅ | 1.3.2 |
| **Split editor** — botão Columns2, dois painéis 50/50, abas independentes por painel | ✅ | 1.5.0 |
| **TypeScript LSP** — `monaco-languageclient` v10 via WebSocket tunnel porta 6009 | ✅ | 1.5.0 |
| **Port Forwarding** — aba Portas; `TunnelService`; localhost:X → VPS:Y via ssh2 | ✅ | 1.5.0 |
| **DAP debug remoto** — Chrome DevTools via `ws://localhost:9229`; botão DAP na status bar | ✅ | 1.5.0 |

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

`v3.49.0` — **NEX-ALS IDE completo + Squad com Pipeline autônomo + Memória Persistente + Busca Web + Planning Mode**. IDE com Monaco/xterm/SFTP/Git + Semantic Highlighting + Breadcrumbs + Outline View + LSP auto-start local. NEX-ALS AI HUB com 6 providers + Claude Code. Squad com **10 agentes** (+ Reviewer + DevOps), ACTION tags (SHELL/READ_FILE/READ_DIR/WRITE_FILE/**SEARCH**), **Modo Pipeline autônomo** (Jarvis→Friday→Reviewer→Tester→DevOps), Exec auto, modo autônomo, KB por projeto, KB Global, robocopy `/XD node_modules`, **Memória Persistente** (tabela `squad_memories`, extração por IA, injeção automática), **Busca Web** (Brave Search API, ACTION SEARCH, Fury reformulado). **Skills + ContextBuilder** (detecção por gatilho, banner pós-pipeline). **Planning Mode** (PlanningPage, fila de tarefas, automações, contexto por agente). **Workspace Intelligence** (WorkspacePage 5 abas). **Visual NEX-ALS Dark Luxury** (paleta `#080612`/dourado/roxo). Ver `docs/CURRENT_STATE.md`.

## Squad — visão geral

10 agentes especializados com streaming em tempo real, delegação automática, execução de ações e **Pipeline autônomo**:

| Agente | Papel | Provider |
|---|---|---|
| Jarvis | PM / Orquestrador | Claude |
| Friday | Engenheira de Software Sênior | GPT |
| Fury | Pesquisa de Mercado | Gemini |
| Shuri | UX / Design | Claude |
| Pepper | Marketing / Brand | GPT |
| Vision | Growth / Métricas | Gemini |
| Requis | Documentação | Claude |
| Tester | QA / Testes | GPT |
| Reviewer | Code Review (OWASP) | Claude |
| DevOps | CI/CD & Entrega | Claude |

### Modo Pipeline autônomo

Botão **Pipeline** (índigo) no header do Squad. Orquestra o ciclo completo sem interação manual:

```
🎯 Fase 1 — Jarvis planeja (lista de arquivos, stack, ordem)
👩‍💻 Fase 2 — Friday implementa (arquivo por arquivo, ACTION por resposta)
🔎 Fase 3 — Reviewer lê código com READ_FILE, emite [APROVADO] ou [BLOQUEADO]
       └── [BLOQUEADO] → Fase 3b: Friday corrige issues críticos
🧪 Fase 4 — Tester escreve e executa testes
🚀 Fase 5 — DevOps: git add -A → commit → verifica remote → push → PR
✅ Concluído
```

**Funções internas:**
- `runPipeline(task, sid)` — orquestra as fases
- `runAgentUntilDone(agent, sid, delegatedBy, maxIter)` — loop de execução por agente:
  - Executa actions do agente → envia resultado → agente responde → repete
  - Se agente responde com texto-only (sem ACTION): envia push `⚠️ EXECUTE AGORA` (max 3 pushes)
  - Se agente não responde (mesmo bubble): encerra
  - Encerra em `[PRONTO]`/`[APROVADO]`/`[DONE]` ou maxIter

### ACTION tags suportadas

```
[ACTION:SHELL cwd="C:\pasta"]comando[/ACTION]
[ACTION:READ_FILE path="C:\pasta\arquivo.ts"][/ACTION]
[ACTION:READ_DIR path="C:\pasta"][/ACTION]
[ACTION:WRITE_FILE path="C:\pasta\arquivo.ts"]conteúdo[/ACTION]
[ACTION:SEARCH query="termo de busca"][/ACTION]
```

- Execução local (`vpsId: '__local__'`) — `child_process.exec` / `fs.*`
- Execução remota (VPS) — SSH terminal.exec / SFTP
- `read_file` em diretório → auto-redireciona para listagem
- `search` — interceptado antes do IPC; chama Brave Search API via main process; não requer VPS; badge WEB laranja

### Modo autônomo

- Toggle "Auto" na barra do agente ativo
- Limite configurável (5–200 iterações, padrão 30)
- `rootAgentRef` sempre devolve resultados ao orquestrador raiz (Jarvis)
- Agente delegado sem ações → síntese com root ao invés de parar
- Stop conditions: tag `[PRONTO]` / `[DONE]` / `[CONCLUÍDO]`, sem ações do root, limite atingido
- Relatório final ao término: iterações, arquivos escritos, leituras, comandos, erros

### Base de Conhecimento

- Persistida por projeto em `localStorage` (chave = `localPath` ou `__global__`)
- 8 seções estruturadas: Projeto, Stack, Estrutura de arquivos, Status atual, Convenções, Regras do squad, Habilidades dos agentes, Notas técnicas
- 3 templates prontos: Next.js SaaS, Node.js API, React+Vite
- Botão "Sincronizar": lê `README.md` / `CURRENT_STATE.md` / `TASKS.md` / `ARCHITECTURE.md` do projeto e preenche as seções automaticamente
- Injetada como `projectContext` no system prompt de todos os agentes da sessão

## Próxima tarefa

Ver `docs/TASKS.md` — seção "Em andamento".

## Regras obrigatórias

1. Nunca armazenar senha ou token Claude
2. Nunca armazenar chave privada SSH no banco
3. Usar `contextIsolation: true` e `nodeIntegration: false`
4. Validar toda entrada com Zod no main process
5. Atualizar CHANGELOG a cada implementação relevante
6. Atualizar TASKS.md ao concluir ou iniciar tarefas
7. Atualizar CURRENT_STATE.md ao mudar estado do projeto
8. Atualizar ARCHITECTURE.md ao mudar decisões técnicas
9. Sincronizar versão nos 3 `package.json` (raiz, desktop, web) + `Layout.tsx` badge
10. Remote git aponta para `https://github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER.git`

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

### tunnel:* (IDE-17)
- `tunnel:open` — abre túnel SSH local (ssh2.forwardOut)
- `tunnel:close` — encerra túnel
- `tunnel:list` — lista túneis ativos

### debug:* (IDE-18)
- `debug:openDevTools` — abre janela Electron com Chrome DevTools (DAP via WebSocket)

### squad:*
- `squad:stream:start` — inicia stream de agente (provider, agente, mensagem, histórico, contexto, localPath, autonomous)
- `squad:stream:cancel` — cancela stream ativo
- `squad:session:create` — cria sessão no SQLite
- `squad:session:list` — lista sessões
- `squad:session:delete` — exclui sessão + mensagens
- `squad:session:loadMsgs` — carrega mensagens de uma sessão
- `squad:session:addMsg` — persiste mensagem
- `squad:action:execute` — executa ACTION tag (shell/read_file/read_dir/write_file) local ou VPS

### claude:*
- `claude:check` — verifica versão e status do CLI claude
- `claude:accounts:list` — lista contas Claude Code cadastradas
- `claude:accounts:create` — cadastra nova conta (gera configDir isolado)
- `claude:accounts:setActive` — ativa conta (define CLAUDE_CONFIG_DIR)
- `claude:accounts:check` — verifica credenciais (.credentials.json)
- `claude:accounts:delete` — remove conta
- `claude:usage` — lê email + plano da conta ativa

### knowledge:*
- `knowledge:list` — lista todas as entradas da KB Global
- `knowledge:create` — cria entrada (title, content, category, tags, isActive)
- `knowledge:update` — atualiza entrada por id
- `knowledge:delete` — remove entrada por id
- `knowledge:context` — retorna KB formatada como markdown (para injeção em prompts)

### squad:memory:*
- `squad:memory:list` — lista memórias por projectKey
- `squad:memory:save` — salva nova memória (content, category, projectKey, agentName)
- `squad:memory:delete` — remove memória por id
- `squad:memory:extract` — extrai memórias da sessão atual via Friday; retorna count de memórias salvas

### search:*
- `search:web` — busca na internet via Brave Search API; parâmetros: `{ query, count? }`; retorna `{ output: string }` formatado em markdown

### settings:brave:*
- `settings:brave:get` — retorna braveApiKey do banco
- `settings:brave:set` — salva braveApiKey no banco

### lsp:*
- `lsp:start` — spawna `typescript-language-server --stdio` localmente; retorna `{ port }` do WebSocket bridge; para modo local sem VPS

### workspace:*
- `workspace:analyze` — SSH: lê manifests + fonte do projeto; chama Friday para gerar WorkspaceReport JSON (stack, modules, flows, risks)

### shell:*
- `shell:openExternal` — abre URL no navegador padrão (allowlist: claude.ai, anthropic.com)

### config:*
- `config:export` — salva backup JSON com VPS/projetos/contas (dialog de salvar)
- `config:import` — importa backup JSON (dialog de abrir)

### clipboard:*
- `clipboard:readImage` — lê imagem do clipboard via `nativeImage`, salva em temp e retorna path

### local:* (IDE-20)
- `local:openFolder` — dialog nativo para escolher pasta
- `local:readdir` / `local:readFile` / `local:readFileBase64` / `local:writeFile` / `local:mkdir` / `local:delete` / `local:rename` / `local:touch`

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
