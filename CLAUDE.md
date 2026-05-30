# Claude Workspace Manager — CLAUDE.md

**Sempre leia estes arquivos ao iniciar uma conversa sobre este projeto:**

1. `AGENTE.md`
2. `CHANGELOG.md`
3. `docs/CURRENT_STATE.md`
4. `docs/TASKS.md`
5. `docs/ARCHITECTURE.md`

---

## Resumo do projeto

Aplicação desktop Electron para gerenciar múltiplas VPS, múltiplos projetos remotos e múltiplas contas Claude Code. Substitui scripts .bat manuais por uma interface visual simples. Permite abrir VS Code remoto via Remote SSH na conta e VPS correta, evitando conflitos de autenticação entre contas Claude.

## Stack

- **Runtime:** Node.js 22 LTS
- **Desktop:** Electron (latest stable)
- **Frontend:** React 18 + Vite 6 + TypeScript 5.7
- **Estilo:** Tailwind CSS 3 + Lucide React
- **DB:** SQLite via Prisma ORM + better-sqlite3
- **Validação:** Zod 3
- **Package manager:** pnpm 9
- **Build:** electron-builder

## Versão atual

`0.1.0` — Setup + scaffold inicial

## Regras de desenvolvimento

1. **Nunca armazenar** senha de VPS em texto puro no banco.
2. **Nunca armazenar** token Claude, API Key Anthropic, ou credenciais de login.
3. A autenticação Claude acontece exclusivamente dentro de cada VPS/ambiente remoto.
4. Todo IPC usa `contextBridge` — nunca `nodeIntegration: true`.
5. Entrada do usuário sempre validada com Zod antes de persistir.
6. Logs de erros no console principal (main process), nunca expor stack trace no renderer.
7. `DATABASE_URL` sempre via `process.env`, nunca hardcoded.
8. Toda alteração importante atualiza `CHANGELOG.md`.
9. Toda mudança de arquitetura atualiza `docs/ARCHITECTURE.md`.
10. Próximas etapas registradas em `docs/TASKS.md`.

## Regras de segurança

- `contextIsolation: true` obrigatório em toda BrowserWindow
- `nodeIntegration: false` obrigatório
- `sandbox: true` no preload quando possível
- Não executar comandos SSH com input não sanitizado
- Não expor `ipcMain` diretamente no renderer
- Validar todos os dados recebidos via IPC no main process
