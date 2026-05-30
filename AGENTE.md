# AGENTE.md — Claude Workspace Manager

## O que o projeto faz

Interface desktop local (Electron) para gerenciar múltiplos ambientes de desenvolvimento com Claude Code. O problema central é que o Claude Code pode compartilhar autenticação entre diferentes instâncias do VS Code. A solução é isolar as contas em VPS separadas e fornecer uma interface visual simples para abrir o ambiente correto (VS Code Remote SSH) com a conta Claude certa.

## Domínio de produção

Gerenciamento de ambientes de desenvolvimento com IA e múltiplas contas Claude Code.

## Stack completa com versões

| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 22 LTS | Runtime |
| TypeScript | 5.7 | Linguagem |
| Electron | 33+ | Desktop shell |
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

## Estrutura do monorepo

```
/
├── apps/
│   ├── desktop/          ← Electron main process + preload
│   └── web/              ← React + Vite (renderer)
├── packages/
│   ├── config/           ← Zod schemas + tipos compartilhados
│   ├── core/             ← Serviços de negócio (VPS, projetos, etc.)
│   └── db/               ← Prisma client + schema SQLite
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   └── TASKS.md
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
- Teste de conexão SSH via `child_process`

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

## Rotas do frontend

| Rota | Tela |
|---|---|
| `/` | Dashboard — cards de VPS e projetos recentes |
| `/vps` | Lista de VPS — CRUD + teste de conexão |
| `/projects` | Lista de projetos — CRUD + associação |
| `/accounts` | Contas Claude — CRUD + instruções de login |
| `/launcher` | Lançador — botão "Abrir Projeto" por ambiente |
| `/settings` | Configurações — caminhos VS Code, SSH |
| `/diagnostics` | Diagnóstico — status de todas as ferramentas |

## Roles e autenticação

**V.0.1.0:** Aplicação local single-user, sem login interno.

**Role prevista: admin**
- Cadastrar VPS, projetos, contas Claude
- Editar configurações
- Executar diagnósticos
- Abrir ambientes remotos

**Regras:**
- App não armazena senha Claude
- App não armazena token Claude
- App armazena apenas nomes amigáveis de contas (ex: "Claude Conta A")
- Autenticação real do Claude Code ocorre dentro de cada VPS

## Estado atual

`V.0.1.0` — Scaffold completo com UI funcional. Ver `docs/CURRENT_STATE.md`.

## Próxima tarefa

Implementar teste de conexão SSH real. Ver `docs/TASKS.md`.

## Regras obrigatórias

1. Nunca armazenar senha ou token Claude
2. Nunca armazenar chave privada SSH no banco
3. Usar `contextIsolation: true` e `nodeIntegration: false`
4. Validar toda entrada com Zod no main process
5. Atualizar CHANGELOG a cada implementação relevante
6. Atualizar TASKS.md ao concluir ou iniciar tarefas
7. Atualizar CURRENT_STATE.md ao mudar estado do projeto
8. Atualizar ARCHITECTURE.md ao mudar decisões técnicas

## Tabela de arquivos de risco

| Arquivo | Risco | Motivo | Cuidado |
|---|---|---|---|
| `packages/db/prisma/schema.prisma` | Médio | Define toda a estrutura do banco | Mudanças exigem migração |
| `apps/desktop/src/main.ts` | Alto | Processo principal Electron, acesso total ao sistema | Nunca expor no renderer |
| `apps/desktop/src/preload.ts` | Alto | Bridge entre main e renderer | Validar channels IPC |
| `apps/desktop/src/ipc/handlers.ts` | Alto | Executa comandos do sistema | Sanitizar todo input |
| `packages/core/src/launcher/launcher.service.ts` | Alto | Executa `exec()` com parâmetros externos | Validar paths e comandos |
| `.env` / `.env.local` | Crítico | Pode conter DATABASE_URL | Nunca commitar |
| `cwm.db` (userData) | Alto | Banco local com dados de infra | Não versionar, fazer backup |
| `~/.ssh/id_rsa` | Crítico | Chave SSH privada do usuário | Nunca copiar ou expor |
| `packages/core/src/vps/vps.service.ts` | Médio | Faz SSH com dados da VPS | Sanitizar host/user antes de exec |

## Comandos úteis

```bash
# Instalação
pnpm install

# Desenvolvimento
pnpm dev

# Build completo
pnpm build

# Lint
pnpm lint

# Type check
pnpm typecheck

# Testes
pnpm test

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

## Links de referência

- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [VS Code Remote SSH](https://code.visualstudio.com/docs/remote/ssh)
- [Electron Docs](https://www.electronjs.org/docs/latest)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [Prisma Docs](https://www.prisma.io/docs)
- [SQLite Docs](https://www.sqlite.org/docs.html)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zod Docs](https://zod.dev)
