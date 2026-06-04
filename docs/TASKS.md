# TASKS.md — HEXAGON IDE

## Em andamento

*(nenhuma)*

## Concluídas recentemente (v3.8.0)

- [x] **Autenticação interna multi-usuário** — `AuthService` (bcryptjs, SQLite `app_users`), sessão em memória no main, guards `requireAdmin/requireAuth` em todos os mutantes, `AuthContext`+`SetupPage`+`LoginPage`, sidebar com user card + logout, seção Usuários no Settings (admin CRUD) — 2026-06-04

## Concluídas recentemente (v3.7.0)

- [x] **LSP multi-linguagem (IDE-22)** — `lsp.ts` refatorado: `LSP_CONFIGS` (TS/PY/RS/GO), `monacoLangToLspKey`, `disconnectAllLSP`; botão LSP na status bar muda label/porta/tooltip conforme arquivo ativo; cleanup no unmount — 2026-06-04

## Concluídas recentemente (v3.6.0)

- [x] **Testes E2E com Playwright** — `@playwright/test` + `electron` na raiz; `e2e/playwright.config.ts` (workers=1, timeout 40s, HTML report); `global-setup.ts` limpa DB de teste; `helpers/app.ts` (launchApp/closeApp, DB isolado por run); 4 spec files: `01-launch` (5 testes), `02-navigation` (8), `03-vps` (8), `04-settings` (8) = **29 testes E2E**; scripts `test:e2e` e `test:e2e:ci` — 2026-06-04

## Concluídas recentemente (v3.5.3)

- [x] **ARCHITECTURE.md atualizado para v3.5.2** — adicionadas seções: NotificationMonitor (polling/thresholds/cooldown/IPC), Modo Local filesystem IPC (local:readdir/writeFile/exec/touch com criação de pastas pai), Agente Autônomo (loop 500 iterações, stop, snapshot/rollback, modo VPS vs local); schema settings com `notificationsEnabled`; módulo `notifications/` no diagrama de pacotes — 2026-06-04

## Concluídas recentemente (v3.5.2)

- [x] **Configurações simplificadas** — removidas seções VS Code e SSH da UI; campos mantidos no banco com padrões; Manual de Uso atualizado com todas as features v3.4–v3.5 — 2026-06-04

## Concluídas recentemente (v3.5.1)

- [x] **Bugfix local:writeFile/touch** — `fs.mkdir({ recursive: true })` antes de escrever; resolve "Falha ao salvar" ao criar arquivos em subpastas inexistentes — 2026-06-04

## Concluídas recentemente (v3.5.0)

- [x] **Agente autônomo local** — `local:exec` IPC; `execute_command` + `search_files` funcionando em modo local; loop auto-continua até 500 ações sem pausa; botão Parar substitui "Continuar" — 2026-06-04

## Concluídas recentemente (v3.4.0)

- [x] **Notificações de sistema** — `NotificationMonitor` (polling 60s, cooldown 30min); alertas Disco ≥ 85% / CPU ≥ 90% / RAM ≥ 90%; erro IA Hub; toggle em Configurações com persistência — 2026-06-04

## Concluídas recentemente (v3.3.1)

- [x] **Manual de Uso — redesign UX** — Mapa do App em cards por objetivo (Gerenciamento · Desenvolvimento · IA · Deploy · Incidentes); copy orientado a benefício; seção "Dois modos de operação"; versão corrigida na sidebar — 2026-06-02
- [x] **GUIA_INICIANTE.md** — documento em linguagem acessível: conceitos (VPS/SSH/SFTP/API Key), mapa de telas, IDE, AI Hub, Modo Agente, fluxo passo a passo, FAQ, glossário — 2026-06-02

## Concluídas recentemente (v1.6.0 → v3.3.0)

- [x] **AI Hub UI Completo v3.3.0** — Project Memory CRUD, Context Selector, ToolExecutor confirmação CONFIRMO — 2026-06-01
- [x] **Deploy Assistant v3.2.0** — plano IA em JSON/markdown; tiers risco; confirmação modal para high; rollback automático; smoke test HTTP — 2026-06-01
- [x] **Incident Mode v3.1.0** — janela 4-painéis (Diagnóstico IA + Logs + Docker/PM2 + Terminal); diagnóstico automático com streaming; botão Siren no Launcher e IDEPage — 2026-06-01
- [x] **HEXAGON AI HUB v3.0.0** — BaseProvider, 6 providers (Anthropic/OpenAI/Gemini/DeepSeek/OpenRouter/Ollama), KeyStore, ProviderManager, ModelRegistry, ResponseStreamer, ContextManager, PromptBuilder, ConversationManager, ToolExecutor, AIHubPage com streaming — 2026-06-01

- [x] **Multi-monitor** (v2.8.0) — createIdeWindow; HashRouter hash nav; botão ExternalLink no Launcher e IDEPage top bar; janelas totalmente independentes — 2026-06-01
- [x] **Snapshot/Rollback** (v2.7.0) — snapshot antes de write_file; painel 📦 Snapshots com ↩ Restaurar por arquivo; limpo em nova sessão; preservado no Continuar — 2026-06-01
- [x] **Limite agente 50 iter + botão Continuar** (v2.6.0) — MAX 15→50; agentResumeRef preserva histórico; banner âmbar + botão Continuar; SFTP reaberto automaticamente — 2026-06-01
- [x] **Verificação de fingerprint SSH** (v2.5.0) — armazena na 1ª conexão; rejeita se mudar; badge ShieldCheck/ShieldOff + botão Limpar; todos os serviços SSH — 2026-06-01
- [x] **Analisador de Disco** (v2.4.0) — botão por VPS no Monitor; modal com dirs / Docker / PM2 logs / /var/log; cores por tamanho — 2026-06-01
- [x] **Modo Agente IA** (v2.3.0) — tool use; agentic loop 15 iter; read/write/exec/search; display inline; Anthropic + OpenAI-compat — 2026-05-31
- [x] **Manual de Uso** (v2.3.0) — Help.tsx reescrito com todas as features v1.5→v2.4 — 2026-05-31
- [x] **Histórico de lançamentos** (v2.2.0) — página /history; filtros VPS/projeto/status; taxa de sucesso — 2026-05-31
- [x] **Logs Viewer** (v2.1.0) — aba Logs no IDE; presets; Watch 3s — 2026-05-31
- [x] **PM2 / Process Manager** (v2.0.0) — aba PM2; Restart/Stop/Logs; CPU%, RAM — 2026-05-31
- [x] **Docker Explorer** (v1.9.0) — aba Docker; Start/Stop/Logs/Remover; badge — 2026-05-31
- [x] **Chat IA direto** (v1.8.0) — ai:chat API direta; fallback SSH; histórico completo — 2026-05-31
- [x] **Provedores de IA** (v1.7.0) — 7 providers; AiService; Settings UI; AES-256 — 2026-05-31
- [x] **Monitor de VPS** (v1.6.0) — CPU/RAM/Disco/Uptime; auto-refresh 30s — 2026-05-31

## Próximas tarefas sugeridas — AI HUB v2

- [x] **Incident Mode** — entregue em v3.1.0
- [x] **Deploy Assistant** — entregue em v3.2.0
- [x] **Project Memory UI** — entregue em v3.3.0
- [x] **Context Selector UI** — entregue em v3.3.0
- [x] **ToolExecutor confirmação UI** — entregue em v3.3.0

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
- [x] **IDE-20 · Modo Local** — rota `/ide/local`; dialog de pasta nativa; IPC `local:*`; filesystem abstraction; badge verde "Local"; terminal e Git ocultos; botão "Abrir pasta local" no Launcher — 2026-05-30
- [x] **IDE-21 · Chat Claude** — painel lateral direito redimensionável; `claude -p` via SSH; prompt via arquivo SFTP (sem escaping); contexto completo (árvore 2 níveis + docs + arquivo ativo); seletor de VPS; timer de espera; botões Copiar/Aplicar/Salvar como nos blocos de código; paste de print Ctrl+V (badge "📷 Print anexado"); instrução offline para Claude usar conteúdo inline — 2026-05-31

## Backlog IDE — P3 BAIXA PRIORIDADE — todos concluídos

- [x] **IDE-15 · Split editor** — dois painéis 50/50, abas independentes, Ctrl+S no painel focado, botão Columns2 na top bar — 2026-05-31
- [x] **IDE-16 · LSP TypeScript** — `monaco-languageclient` v10 via WebSocket; botão TS LSP na status bar; requer túnel 6009 + `typescript-language-server` na VPS — 2026-05-31
- [x] **IDE-17 · Port Forwarding** — `TunnelService` (ssh2.forwardOut); aba Portas no painel esquerdo; IPC tunnel:open/close/list; link "Abrir no navegador" — 2026-05-31
- [x] **IDE-18 · DAP debug remoto** — `debug:openDevTools` abre janela Electron com Chrome DevTools conectado a `ws://localhost:9229`; requer túnel 9229 + `node --inspect` na VPS — 2026-05-31

---

## Backlog App (funcionalidades não-IDE)

- [x] **Testes automatizados** — Vitest: 13 testes em @cwm/config + 5 em @cwm/core (18 total) — 2026-05-31
- [x] **Import/export** — exportar/importar VPS+projetos+contas em JSON; botões na página de Configurações — 2026-05-31
- [x] **SSH passphrase** — campo "Senha SSH" vira passphrase quando chave privada está configurada; Windows OpenSSH agent via named pipe — 2026-05-31
- [x] **Auto-update** — electron-updater instalado; verifica GitHub Releases silenciosamente em produção — 2026-05-31
- [x] **Packaging** — NSIS installer + portable .exe; `pnpm package:win`; wizard com atalhos e licença — 2026-05-31

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
