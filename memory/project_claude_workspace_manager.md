---
name: project-claude-workspace-manager
description: Instruções persistentes para o Claude Code sobre o projeto Claude Workspace Manager — stack, localização, arquivos obrigatórios de leitura
metadata:
  type: project
---

Sempre que iniciar uma conversa sobre o projeto **Claude Workspace Manager** (localizado em `c:\Users\phpos\OneDrive\Claude Workspace Manager`), leia primeiro:

1. `CLAUDE.md`
2. `AGENTE.md`
3. `CHANGELOG.md`
4. `docs/CURRENT_STATE.md`
5. `docs/TASKS.md`
6. `docs/ARCHITECTURE.md`

**Why:** O projeto é um monorepo Electron + React + Prisma com várias camadas. Sem ler esses arquivos, decisões de implementação podem conflitar com a arquitetura definida.

**How to apply:** Em toda conversa sobre CWM, execute a leitura dos 6 arquivos acima antes de qualquer análise ou implementação.

---

Fatos chave:
- Stack: Electron + React + Vite + TypeScript + Tailwind + Prisma + SQLite + Zod
- Monorepo pnpm: `apps/desktop`, `apps/web`, `packages/config`, `packages/core`, `packages/db`
- VPS conhecidas: `204.168.180.25` (VPS 1) e `77.42.30.4` (VPS 2)
- Regra crítica: NUNCA armazenar senha Claude, token Claude ou chave SSH privada
- IPC: contextBridge com contextIsolation:true, nunca nodeIntegration
- DB local: SQLite em `app.getPath('userData')/cwm.db`
- Versão atual: 0.1.0 (scaffold)
