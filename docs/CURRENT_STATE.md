# CURRENT_STATE.md — Claude Workspace Manager

**Data:** 2026-05-30
**Versão:** 0.1.2

## Estado atual

Projeto funcional. Build limpo com `electron-vite` e `pnpm build`. Banco gerado. `VpsService.testConnection` usa `ssh2` nativo (sem depender do SSH no PATH). Pronto para executar `pnpm dev`.

## Funcionalidades prontas

- [x] Estrutura de monorepo pnpm com workspaces
- [x] Schema Prisma SQLite com todas as tabelas
- [x] Pacote `@cwm/config` com schemas Zod e tipos TypeScript
- [x] Pacote `@cwm/db` com Prisma client configurado
- [x] Pacote `@cwm/core` com serviços: VPS, Projetos, Contas, Launcher, Settings, Diagnósticos
- [x] Electron main process com BrowserWindow segura (contextIsolation)
- [x] Preload com contextBridge expondo IPC seguro
- [x] IPC handlers para todos os módulos
- [x] React app com React Router 6 (7 rotas)
- [x] Layout com sidebar responsiva
- [x] Dashboard com cards de status
- [x] CRUD de VPS (formulário modal + lista)
- [x] CRUD de Projetos (formulário modal + lista)
- [x] CRUD de Contas Claude (formulário modal + lista)
- [x] Launcher com grid de projetos
- [x] Página de Settings
- [x] Página de Diagnósticos
- [x] Documentação completa (CLAUDE.md, AGENTE.md, ARCHITECTURE.md, TASKS.md)

## Funcionalidades pendentes

- [x] Teste de conexão SSH real via `ssh2` (nativo, sem dependência de SSH no PATH)
- [ ] Exibição de output em tempo real do SSH (stream)
- [ ] Notificação de status ao abrir VS Code (confirmação visual)
- [ ] Import/export de configurações (backup)
- [ ] Histórico de lançamentos com filtros
- [ ] Pré-check se Claude Code está instalado na VPS (via SSH)
- [ ] Suporte a chave SSH com passphrase (via `ssh-agent`)
- [ ] Modo multi-monitor (abrir VPS 1 e VPS 2 lado a lado)
- [ ] Auto-update do app (electron-updater)
- [ ] Testes automatizados (Jest/Vitest)
- [ ] Packaging/installer Windows (.exe/.msi)

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

## Limitações conhecidas

1. **Sem autenticação interna** — app local, single-user, sem login
2. **Sem armazenamento de chave SSH privada** — usuário precisa ter chave configurada no sistema
3. **Teste SSH depende do SSH no PATH** — no Windows requer OpenSSH instalado ou Git Bash
4. **VS Code Remote SSH** — usuário precisa ter extensão "Remote - SSH" instalada no VS Code
5. **Claude Code** — autenticação ocorre dentro de cada VPS, não dentro do app
6. **Sem Docker** — isolamento local via Docker documentado como melhoria futura
7. **Sem testes automatizados** — primeira versão sem cobertura de testes

## Próximo passo recomendado

Executar `pnpm dev` para validar o app no Electron, depois implementar Claude Code check via SSH no launcher.
