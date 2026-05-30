# TASKS.md — Claude Workspace Manager

## Em andamento

*(nenhuma)*

## Backlog — Crítico (bloqueador)

*(nenhum)*

## Backlog — Alta prioridade

- [ ] **Output stream** — exibir output do SSH em tempo real num terminal embutido (xterm.js)
- [ ] **Testes automatizados** — configurar Vitest para packages/core e packages/config

## Backlog — Média prioridade

- [ ] **Import/export** — exportar configurações para JSON (backup portátil)
- [ ] **Histórico** — tela de histórico de lançamentos com status (sucesso/falha)
- [ ] **SSH agent** — suporte a chave SSH com passphrase via `ssh-agent` no Windows
- [ ] **Multi-monitor** — abrir dois projetos/VPS em janelas VS Code diferentes simultaneamente
- [ ] **Notificação** — toast de confirmação ao abrir VS Code com sucesso

## Backlog — Baixa prioridade

- [ ] **Auto-update** — electron-updater para updates automáticos
- [ ] **Packaging** — gerar .exe e .msi para Windows via electron-builder
- [ ] **Docker** — documentar e implementar isolamento local de contas via Docker
- [ ] **Multi-user** — adicionar login interno para uso em equipe (futuro)
- [ ] **Tema escuro** — já suportado via Tailwind, mas sem toggle de UI
- [ ] **Atalhos de teclado** — navegar entre seções com teclado

## Concluídas

- [x] **V.0.1.0** — Scaffold completo: monorepo, docs, packages, Electron app, React UI — 2026-05-29
- [x] **Migrar build para electron-vite** — main process bundado via Rollup, `require("electron")` funcionando corretamente — 2026-05-30
- [x] **SSH real via ssh2** — `VpsService.testConnection` reescrito com `ssh2` (nativo, sem depender de SSH no PATH) — 2026-05-30
- [x] **Claude Code check** — `VpsService.checkClaudeCode` via SSH; badges de status no Launcher (instalado/logado/não logado) — 2026-05-30

## Próxima tarefa sugerida

1. Testar `pnpm dev` e validar o fluxo completo no Electron
2. Adicionar xterm.js para output SSH em tempo real
3. Configurar Vitest para testes automatizados
