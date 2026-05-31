# CURRENT_STATE.md — HEXAGON IDE

**Data:** 2026-05-31
**Versão:** 1.5.0
**Repositório:** https://github.com/fasterdrible-lab/HEXAGON-IDE.git

## Estado atual

**HEXAGON IDE 1.5.0 — backlog zerado.** Todas as features P0, P1, P2, P3 e de app foram implementadas. `pnpm dev` inicia Vite + Electron sem erros. `pnpm package:win` gera instalador NSIS + portable.

### Dois modos de operação

- **Modo Remoto (VPS)** — explorer SFTP hierárquico, Monaco Editor com split, terminal SSH multi-tab, Git integrado, painel de Problemas, port forwarding SSH, TypeScript LSP, depuração remota DAP, chat Claude; badge vermelho "Produção" na top bar.
- **Modo Local (OneDrive/PC)** — mesmo editor usando `node:fs`; badge verde "Local"; sem terminal/Git; chat Claude com seletor de VPS e contexto automático do projeto.

## Funcionalidades do app base — todas concluídas

- [x] Monorepo pnpm — `@cwm/config`, `@cwm/db`, `@cwm/core`, `@cwm/desktop`, `@cwm/web`
- [x] Schema Prisma SQLite + Zod schemas + tipos TypeScript
- [x] Electron + contextBridge (contextIsolation, sem nodeIntegration)
- [x] React + React Router 6 — 10 rotas (7 gerenciamento + 3 fullscreen)
- [x] CRUD VPS, Projetos, Contas Claude
- [x] Launcher — botão IDE + "Abrir pasta local" + badges Claude Code
- [x] Settings — caminhos VS Code/SSH + **Backup/Restore JSON**
- [x] Diagnósticos, Manual de Uso (/help)
- [x] **Import/export** — `config:export` / `config:import` com dialog nativo
- [x] **SSH passphrase** — `sshPassword` vira passphrase quando há chave privada; Windows SSH agent via named pipe
- [x] **Auto-update** — `electron-updater`; verifica GitHub Releases em produção
- [x] **Packaging** — `pnpm package:win` → NSIS installer + portable .exe
- [x] **Testes** — Vitest: 18 testes passando (`@cwm/config` + `@cwm/core`)

## Funcionalidades do HEXAGON IDE — todas concluídas

### P0 — Bloqueadores
- [x] **IDE-01** — Criar arquivo inline (`FilePlus` + `touch()`)
- [x] **IDE-02** — Tree view hierárquica (expand/collapse lazy load)
- [x] **IDE-03** — Find in Files (Ctrl+Shift+F) — grep SSH + reveal de linha

### P1 — Alta prioridade
- [x] **IDE-04** — Git integrado — Source Control completo
- [x] **IDE-05** — Múltiplas abas de terminal SSH
- [x] **IDE-06** — Status bar — branch, Ln/Col, hints
- [x] **IDE-07** — Paleta de comandos (Ctrl+Shift+P)

### P2 — Média prioridade
- [x] **IDE-08** — Find/Replace (Ctrl+H) — `addCommand`
- [x] **IDE-09** — Go to Line (Ctrl+G) — `addCommand`
- [x] **IDE-10** — Breadcrumbs — N/A (não existe em `IStandaloneEditorConstructionOptions`)
- [x] **IDE-11** — Preview de imagem (base64 SFTP)
- [x] **IDE-12** — Painel de Problemas (`onDidChangeMarkers` + `jumpToLine`)
- [x] **IDE-13** — Copiar/Duplicar arquivos
- [x] **IDE-14** — Auto-refresh da tree (salvar + polling 30s)

### P2+ — Novas features
- [x] **IDE-19** — Badge PRODUÇÃO (vermelho) / LOCAL (verde)
- [x] **IDE-20** — Modo Local — `node:fs`, dialog nativo, filesystem abstraction
- [x] **IDE-21** — Chat Claude — `claude -p` via SSH, contexto automático, Copiar/Aplicar/Salvar como, paste de print

### P3 — Baixa prioridade — todas concluídas
- [x] **IDE-15** — Split editor — dois painéis lado a lado, abas independentes, Ctrl+S no painel focado
- [x] **IDE-16** — TypeScript LSP — `monaco-languageclient` v10 via WebSocket tunnel (porta 6009)
- [x] **IDE-17** — Port Forwarding — aba "Portas" no painel esquerdo; `TunnelService` (ssh2.forwardOut)
- [x] **IDE-18** — DAP debug remoto — janela Chrome DevTools via `ws://localhost:9229`

## Decisões técnicas

| Decisão | Escolha | Motivo |
|---|---|---|
| Framework desktop | Electron | Node.js-native, sem Rust toolchain |
| UI | React + Vite | HMR rápido, ecossistema familiar |
| Estilo | Tailwind CSS | Classes utilitárias, sem CSS separado |
| DB | SQLite + Prisma | Local-first, sem servidor |
| Validação | Zod | Type-safety em runtime |
| IPC | contextBridge | Máxima segurança |
| Monorepo | pnpm workspaces | Performance, deduplicação |
| Build | electron-vite | Main bundado com Rollup |
| SSH/SFTP | ssh2 nativo | Sem OpenSSH no PATH do Windows |
| Editor | Monaco Editor | Mesmo engine do VS Code, offline |
| Terminal | xterm.js | Full-color, multi-tab, resize |
| LSP | monaco-languageclient v10 | WebSocket ao language server na VPS |
| Tunnels | ssh2.forwardOut | Port forwarding sem ferramenta externa |
| DAP | Chrome DevTools Protocol | Depuração Node.js nativa |
| Testes | Vitest | Compatível com Node.js ESM |
| Packaging | electron-builder NSIS | Installer + portable Windows |
| Auto-update | electron-updater | GitHub Releases |

## Limitações conhecidas

1. **Sem autenticação interna** — app local, single-user
2. **SSH key privada** — usuário configura no sistema; app não armazena
3. **LSP** — requer `typescript-language-server` + WebSocket wrapper na VPS; configuração manual
4. **DAP** — requer `node --inspect` na VPS + túnel 9229; sem breakpoints no Monaco (UI é o Chrome DevTools)
5. **Chat · imagem** — `claude -p` não processa imagens como visão real; colar texto do erro é mais confiável
6. **Chat · velocidade** — `claude -p` via SSH tem overhead de startup (~15-30s); para respostas instantâneas precisaria de API Key Anthropic

## Próximo passo recomendado

Backlog zerado. Próximas iniciativas sugeridas:
- Suporte a múltiplas contas (workspace multi-VPS simultâneo)
- Integração com Anthropic API (chat mais rápido + multimodal real)
- Histórico de lançamentos com filtros
- Notificação visual ao abrir VS Code Remote
