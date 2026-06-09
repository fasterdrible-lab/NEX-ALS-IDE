# NEX-ALS IDE — CLAUDE.md

**Sempre leia estes arquivos ao iniciar uma conversa sobre este projeto:**

1. `AGENTE.md`
2. `CHANGELOG.md`
3. `docs/CURRENT_STATE.md`
4. `docs/TASKS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/IDE_ROADMAP.md` ← roadmap detalhado das features IDE pendentes

---

## Resumo do projeto

**NEX-ALS IDE** é uma aplicação desktop Electron para gerenciar múltiplas VPS, múltiplos projetos remotos e múltiplas contas Claude Code. Substitui scripts .bat manuais por uma interface visual completa.

Duas camadas de uso:
- **Gerenciador de ambientes** — abre VS Code Remote SSH na conta e VPS correta, evitando conflitos de autenticação entre contas Claude.
- **IDE integrado (NEX-ALS IDE)** — editor de código com Monaco Editor, explorer SFTP hierárquico, terminal SSH xterm.js, Git integrado, busca em arquivos, painel de problemas e múltiplas abas de terminal, tudo rodando diretamente na VPS via SSH/SFTP.

**Repositório:** [github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER](https://github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER)

## Stack

- **Runtime:** Node.js 22 LTS
- **Desktop:** Electron (latest stable) + electron-vite + electron-builder
- **Frontend:** React 18 + Vite 6 + TypeScript 5.7
- **Estilo:** Tailwind CSS 3 + Lucide React
- **DB:** SQLite via Prisma ORM + better-sqlite3
- **Validação:** Zod 3
- **Package manager:** pnpm 9
- **IDE — Editor:** Monaco Editor (`@monaco-editor/react`)
- **IDE — Terminal:** xterm.js (`@xterm/xterm` + `@xterm/addon-fit`)
- **IDE — SSH/SFTP:** ssh2 (bindings nativos Windows)

## Versão atual

`3.3.1` — Manual de Uso redesenhado (Mapa do App em cards por objetivo, guia para iniciantes); versão sincronizada em todos os arquivos

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
11. Versão sincronizada nos 3 `package.json`: raiz, `apps/desktop`, `apps/web`.
12. Remote git aponta para `https://github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER.git`.

## Regras de segurança

- `contextIsolation: true` obrigatório em toda BrowserWindow
- `nodeIntegration: false` obrigatório
- `sandbox: true` no preload quando possível
- Não executar comandos SSH com input não sanitizado
- Não expor `ipcMain` diretamente no renderer
- Validar todos os dados recebidos via IPC no main process

## Atalhos do NEX-ALS IDE

| Atalho | Ação |
|---|---|
| `Ctrl+S` | Salvar arquivo |
| `` Ctrl+` `` | Abrir/fechar terminal |
| `Ctrl+Shift+P` | Paleta de comandos Monaco |
| `Ctrl+Shift+F` | Busca em arquivos (painel esquerdo) |
| `Ctrl+H` | Find & Replace no arquivo atual |
| `Ctrl+G` | Ir para linha |
| Botão **Claude** (roxo) | Abre painel de chat com Claude |
| Botão **⊟** (Columns2) | Ativa/desativa split editor |
| **TS LSP** na status bar | Conecta TypeScript LSP via túnel 6009 |
| **⬡ DAP** na status bar | Abre Chrome DevTools via túnel 9229 |
| Aba **Portas** (painel esq.) | Gerencia port forwarding SSH |
