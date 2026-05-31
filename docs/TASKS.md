# TASKS.md — HEXAGON IDE

## Em andamento

*(nenhuma)*

---

## Backlog IDE — P0 BLOQUEADORES

- [x] **IDE-01 · Criar arquivo** — `FilePlus` + input inline + `SftpSession.touch()` + IPC `sftp:touch` — 2026-05-30
- [x] **IDE-02 · Tree view aninhada** — `flattenTree()` + expand/collapse inline + lazy load + `activeDir` — 2026-05-30
- [x] **IDE-03 · Find in Files (Ctrl+Shift+F)** — painel Search + grep SSH + resultados clicáveis com reveal de linha — 2026-05-30

## Backlog IDE — P1 ALTA PRIORIDADE

- [x] **IDE-04 · Git integrado** — painel Source Control, diff viewer Monaco, stage/unstage/commit/push/pull, branch na status bar — 2026-05-30
- [x] **IDE-05 · Múltiplas abas de terminal** — tab bar + N sessões SSH independentes + callback ref pattern para xterm — 2026-05-30
- [x] **IDE-06 · Status bar completa** — branch git (clicável), Ln/Col ao editar, hint paleta — 2026-05-30
- [x] **IDE-07 · Paleta de comandos (Ctrl+Shift+P)** — mapeado + botão `⌘` na top bar — 2026-05-30

## Backlog IDE — P2 MÉDIA PRIORIDADE

- [x] **IDE-08 · Find/Replace no arquivo (Ctrl+H)** — `addCommand` no `handleEditorMount` garante que o atalho não seja interceptado pelo Electron — 2026-05-30
- [x] **IDE-09 · Go to Line (Ctrl+G)** — `addCommand` no `handleEditorMount` garante que o atalho não seja interceptado — 2026-05-30
- [ ] **IDE-10 · Breadcrumbs no editor** — N/A: opção não existe em `IStandaloneEditorConstructionOptions` (exclusiva do VS Code completo).
- [x] **IDE-11 · Preview de imagem** — base64 via SFTP + `<img>` no editor; tab integrada — 2026-05-30
- [x] **IDE-12 · Painel de Problemas** — erros/warnings do Monaco como tab no painel inferior; `onDidChangeMarkers`; `jumpToLine` — 2026-05-30
- [x] **IDE-13 · Copiar/mover arquivos** — "Duplicar" (`cp -rp`) + "Copiar caminho" (clipboard) no context menu — 2026-05-30
- [x] **IDE-14 · Auto-refresh da tree** — refresh ao salvar + polling 30s com `expandedFoldersRef` — 2026-05-30

## Concluídas recentemente

- [x] **IDE-19 · Badge PRODUÇÃO** — indicador vermelho pulsante na top bar do modo remoto VPS — 2026-05-30
- [x] **IDE-20 · Modo Local** — rota `/ide/local`; dialog de pasta nativa; IPC `local:*` (readdir/readFile/writeFile/mkdir/delete/rename/touch/readFileBase64); badge verde "Local"; terminal e Git ocultos no modo local; botão "Abrir pasta local" no Launcher — 2026-05-30
- [x] **IDE-21 · Chat Claude via SSH** — painel lateral direito redimensionável; envia `claude -p '...'` na VPS via `terminal:exec`; contexto do arquivo ativo incluído; histórico de mensagens; Enter para enviar; Shift+Enter nova linha — 2026-05-30

## Backlog IDE — P3 BAIXA PRIORIDADE (futuro)

- [ ] **IDE-15 · Split editor** — dois arquivos lado a lado.
- [ ] **IDE-16 · LSP/IntelliSense remoto** — `monaco-languageclient` + language server na VPS.
- [ ] **IDE-17 · Remote port forwarding** — túnel SSH para acessar portas da VPS localmente.
- [ ] **IDE-18 · Depuração remota** — DAP via SSH. Futuro distante.

---

## Backlog App (funcionalidades não-IDE)

- [ ] **Testes automatizados** — Vitest para packages/core e packages/config
- [ ] **Import/export** — exportar configurações para JSON (backup portátil)
- [ ] **SSH agent** — suporte a chave SSH com passphrase via `ssh-agent` no Windows
- [ ] **Auto-update** — electron-updater para updates automáticos
- [ ] **Packaging** — gerar .exe e .msi para Windows via electron-builder

---

## Concluídas

- [x] **V.0.1.0** — Scaffold completo: monorepo, docs, packages, Electron app, React UI — 2026-05-29
- [x] **Migrar build para electron-vite** — main process bundado via Rollup — 2026-05-30
- [x] **SSH real via ssh2** — `VpsService.testConnection` com `ssh2` nativo — 2026-05-30
- [x] **Claude Code check** — badges de status no Launcher — 2026-05-30
- [x] **HEXAGON IDE v1** — Explorer SFTP + Monaco Editor + Terminal xterm.js em painéis redimensionáveis; rotas fullscreen; botão IDE no Lançador — 2026-05-30
- [x] **Fix startup bloqueadores** — remover `app.isPackaged` de nível de módulo; `scripts/dev.js` deleta `ELECTRON_RUN_AS_NODE` antes de spawnar; `pnpm dev` funciona — 2026-05-30
- [x] **IDE-01 Criar arquivo** — FilePlus + touch() + abre automaticamente — 2026-05-30
- [x] **IDE-04 Git integrado** — GitService completo (status/diff/add/restore/commit/push/pull); painel Source Control no IDE; branch na status bar — 2026-05-30
- [x] **IDE-06 Status bar melhorada** — branch git, Ln/Col, hint paleta — 2026-05-30
- [x] **IDE-07 Paleta de comandos** — Ctrl+Shift+P mapeado + botão ⌘ na top bar — 2026-05-30
- [x] **IDE-08 Find/Replace (Ctrl+H)** — addCommand garante atalho no Electron — 2026-05-30
- [x] **IDE-09 Go to Line (Ctrl+G)** — addCommand garante atalho no Electron — 2026-05-30
- [x] **IDE-11 Preview de imagem** — base64 SFTP + img tag — 2026-05-30
- [x] **IDE-12 Painel de Problemas** — onDidChangeMarkers + jumpToLine + badge — 2026-05-30
- [x] **IDE-13 Copiar/Duplicar arquivos** — cp -rp + clipboard — 2026-05-30
- [x] **IDE-14 Auto-refresh tree** — save + polling 30s — 2026-05-30
