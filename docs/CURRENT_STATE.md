# CURRENT_STATE.md — Claude Workspace Manager

**Data:** 2026-05-30
**Versão:** 1.1.1

## Estado atual

**HEXAGON IDE completo.** Todas as features P0, P1 e P2 do backlog IDE foram implementadas. `pnpm dev` inicia Vite (localhost:5173) + Electron sem erros. O IDE roda fullscreen com cinco painéis/modos: explorer SFTP hierárquico, Monaco Editor com múltiplas abas, terminal SSH multi-tab (xterm.js), painel Source Control (Git) e painel de Problemas.

## Funcionalidades do app base

- [x] Estrutura de monorepo pnpm com workspaces
- [x] Schema Prisma SQLite com todas as tabelas
- [x] Pacote `@cwm/config` com schemas Zod e tipos TypeScript
- [x] Pacote `@cwm/db` com Prisma client configurado
- [x] Pacote `@cwm/core` com serviços: VPS, Projetos, Contas, Launcher, Settings, Diagnósticos
- [x] Electron main process com BrowserWindow segura (contextIsolation)
- [x] Preload com contextBridge expondo IPC seguro
- [x] IPC handlers para todos os módulos
- [x] React app com React Router 6 (9 rotas — 7 gerenciamento + 3 fullscreen IDE/terminal/explorer)
- [x] Layout com sidebar responsiva
- [x] Dashboard com cards de status
- [x] CRUD de VPS (formulário modal + lista + teste de conexão SSH nativo via ssh2)
- [x] CRUD de Projetos (formulário modal + lista + criar pasta/clonar via SSH)
- [x] CRUD de Contas Claude (formulário modal + lista + instruções de autenticação)
- [x] Launcher com grid de projetos + botão IDE por VPS + badges Claude Code status
- [x] Página de Settings
- [x] Página de Diagnósticos
- [x] Página de Manual de Uso (/help — 9 seções expansíveis)
- [x] Branding HEXAGON TECNOLOGIA

## Funcionalidades do HEXAGON IDE

### P0 — Bloqueadores (todos concluídos)
- [x] **IDE-01** — Criar arquivo: botão `FilePlus`, input inline, `SftpSession.touch()`, abre automaticamente
- [x] **IDE-02** — Tree view hierárquica: expand/collapse por pasta, lazy load, indentação, `activeDir`
- [x] **IDE-03** — Find in Files (Ctrl+Shift+F): grep SSH, resultados por arquivo, clique revela linha no Monaco

### P1 — Alta prioridade (todos concluídos)
- [x] **IDE-04** — Git integrado: Source Control completo (status, stage, unstage, commit, push, pull, diff viewer)
- [x] **IDE-05** — Múltiplas abas de terminal: N sessões SSH independentes, tab bar, callback ref pattern
- [x] **IDE-06** — Status bar: branch git clicável, Ln/Col em tempo real, hint Ctrl+Shift+P
- [x] **IDE-07** — Paleta de comandos (Ctrl+Shift+P): Monaco nativo + botão ⌘ na top bar

### P2 — Média prioridade (todos concluídos)
- [x] **IDE-08** — Find/Replace (Ctrl+H): `addCommand` no mount, não interceptado pelo Electron
- [x] **IDE-09** — Go to Line (Ctrl+G): `addCommand` no mount, não interceptado pelo Electron
- [x] **IDE-10** — Breadcrumbs: N/A — opção não existe em `IStandaloneEditorConstructionOptions`
- [x] **IDE-11** — Preview de imagem: PNG/JPG/GIF/WebP/ICO como `<img>` base64 via SFTP
- [x] **IDE-12** — Painel de Problemas: tab no painel inferior, `onDidChangeMarkers`, badge, `jumpToLine`
- [x] **IDE-13** — Copiar/Duplicar: context menu com `cp -rp` + "Copiar caminho"
- [x] **IDE-14** — Auto-refresh da tree: ao salvar + polling 30s com `expandedFoldersRef`

### P3 — Baixa prioridade (pendente)
- [ ] **IDE-15** — Split editor (dois arquivos lado a lado)
- [ ] **IDE-16** — LSP/IntelliSense remoto (`monaco-languageclient` + language server na VPS)
- [ ] **IDE-17** — Remote port forwarding (túnel SSH para portas da VPS)
- [ ] **IDE-18** — Depuração remota (DAP via SSH)

## Funcionalidades de app pendentes

- [ ] Testes automatizados (Vitest para packages/core e packages/config)
- [ ] Import/export de configurações (backup JSON portátil)
- [ ] Suporte a chave SSH com passphrase (ssh-agent no Windows)
- [ ] Auto-update (electron-updater)
- [ ] Packaging/installer Windows (.exe + .msi via electron-builder)
- [ ] Notificação visual ao abrir VS Code Remote
- [ ] Histórico de lançamentos com filtros

## Decisões técnicas tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Framework desktop | Electron | Node.js-native, sem Rust toolchain, melhor integração Windows |
| UI | React + Vite | Ecossistema familiar, HMR rápido |
| Estilo | Tailwind CSS | Sem arquivo CSS separado, classes utilitárias |
| DB | SQLite + Prisma | Local-first, sem servidor, migrations fáceis |
| Validação | Zod | Type-safety em runtime + inferência TypeScript |
| IPC | contextBridge | Máxima segurança, sem nodeIntegration |
| Monorepo | pnpm workspaces | Performance, deduplicação, symlinks |
| Build Electron | electron-vite | Main bundado com Rollup, sem import issues |
| Dev launcher | scripts/dev.js | Limpa ELECTRON_RUN_AS_NODE antes do concurrently |
| SSH/SFTP | ssh2 (nativo) | Sem dependência de OpenSSH no PATH do Windows |
| Editor | Monaco Editor | Mesmo engine do VS Code, offline, workers locais |
| Terminal | xterm.js | Full-color, resize, preserva histórico entre abas |
| Markers IDE | onDidChangeMarkers | API Monaco para erros em tempo real |
| Keybindings IDE | addCommand em handleEditorMount | Garante que Electron não intercepte Ctrl+H/Ctrl+G |

## Limitações conhecidas

1. **Sem autenticação interna** — app local, single-user, sem login
2. **Sem armazenamento de chave SSH privada** — usuário precisa ter chave configurada no sistema
3. **VS Code Remote SSH** — usuário precisa ter extensão "Remote - SSH" instalada no VS Code
4. **Claude Code** — autenticação ocorre dentro de cada VPS, não dentro do app
5. **Monaco markers** — erros/warnings dependem de language workers habilitados; TypeScript e JSON são detectados nativamente, outras linguagens requerem LSP (IDE-16)
6. **Sem testes automatizados** — primeira versão sem cobertura de testes

## Próximo passo recomendado

Features P3 (IDE-15 split editor ou IDE-16 LSP), ou features de app (testes Vitest, packaging .exe).
