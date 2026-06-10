# CURRENT_STATE.md — NEX-ALS IDE

**Data:** 2026-06-10
**Versão:** 3.13.0
**Repositório:** https://github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER.git

## Estado atual

**NEX-ALS IDE 3.13.0** — IDE completo com **NEX-ALS AI HUB** (6 provedores + Claude Code conta Pro, streaming SSE, conversas persistidas, Context Selector, Project Memory, ToolExecutor), **Squad** (8 agentes especializados com chat, ACTION tags SSH, Pipeline homolog→prod), Incident Mode, Deploy Assistant, **Agente Autônomo Local** (executa comandos, cria arquivos, instala dependências no PC sem VPS, loop até 500 ações com botão Parar), **Notificações de Sistema** (alertas disco/CPU/RAM + erro IA), Snapshot/Rollback, multi-monitor, fingerprint SSH e toda a infraestrutura IDE. `pnpm dev` inicia sem erros. Build TypeScript zero erros em todos os pacotes.

### Dois modos de operação

- **Modo Remoto (VPS)** — explorer SFTP hierárquico, Monaco Editor com split, terminal SSH multi-tab, Git integrado, painel de Problemas, port forwarding SSH, TypeScript LSP, depuração remota DAP, chat IA (API direta ou claude -p); badge vermelho "Produção" na top bar.
- **Modo Local (OneDrive/PC)** — mesmo editor usando `node:fs`; badge verde "Local"; sem terminal/Git; chat IA com provedor configurado (sem VPS necessária) ou fallback para seletor de VPS.

## Squad (v3.10.0 + v3.11.0)

- [x] **Squad** — página fullscreen com 8 agentes: Jarvis (PM/Claude), Friday (Dev/GPT), Fury (Pesquisa/Gemini), Shuri (UX/Claude), Pepper (Marketing/GPT), Vision (Growth/Gemini), Requis (Docs/Claude), Tester (QA/GPT)
- [x] **Chat por agente** — streaming em tempo real; menção direta `@agente` no input redireciona para o agente mencionado
- [x] **Persistência de sessões** — `squad_sessions` + `squad_messages` no SQLite via Prisma; sessões listadas no histórico (painel direito); clicar recarrega mensagens; `updatedAt` atualizado a cada mensagem
- [x] **Delegação automática** — após stream concluído (depth=0), `detectDelegations()` escaneia `@agente` na resposta; `extractTask()` extrai a tarefa; novo `streamAgent()` disparado automaticamente; profundidade máxima 1 (evita loops); badge "delegado por @X" visível no chat
- [x] **ACTION tags** — `SHELL`, `WRITE_FILE`, `READ_FILE` geradas pelo agente; botão Executar por bloco via SSH/SFTP na VPS selecionada; resultado inline (verde/vermelho)
- [x] **Pipeline homolog → prod** — toggle no painel direito; gate âmbar pós-execução com Aprovar/Rejeitar; Aprovar executa na VPS Prod selecionada; estados visuais (âmbar/azul/verde/vermelho/cinza)
- [x] **Claude Code como provedor** — `ai:stream:start` roteia para subprocess `claude` CLI quando provider = `claude-code`; PATH enriquecido com npm global bin; zero API Key / zero cobrança por token; `claude:check` detecta versão e status; `ClaudeCodeCard` em Configurações
- [x] **Múltiplas contas Claude Code** — tabela `claude_code_accounts` (SQLite); N contas isoladas via `CLAUDE_CONFIG_DIR`; alternância com um clique; conta já autenticada (`~/.claude`) ou nova com dir gerado automaticamente; verificação real via `.credentials.json`; comando PowerShell com botão copiar (v3.12.0–v3.13.0)

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
- [x] **Testes** — Vitest: 18 testes unitários (`@cwm/config` + `@cwm/core`) + Playwright E2E: 29 testes (launch, navigation, VPS CRUD, settings)

## Funcionalidades do NEX-ALS IDE — todas concluídas

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
- [x] **IDE-16/22** — LSP multi-linguagem — TypeScript (6009), Python/pylsp (6010), Rust/rust-analyzer (6011), Go/gopls (6012) via WebSocket tunnel; botão dinâmico na status bar
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

## Funcionalidades completas (v1.6.0 → v3.3.0)

### App base e IDE
- [x] Histórico de Lançamentos, Logs Viewer, PM2 Manager, Analisador de Disco, Docker Explorer
- [x] Monitor de VPS — CPU/RAM/Disco/Uptime; auto-refresh 30s
- [x] Agente IA — 50 iter, Snapshot/Rollback, botão Continuar, ferramentas: read/write/exec/search/list
- [x] Fingerprint SSH — SHA-256, rejeita se mudar, badge + botão Limpar
- [x] Multi-monitor — múltiplas janelas Electron independentes por VPS

### NEX-ALS AI HUB (v3.0.0)
- [x] 6 provedores: Anthropic, OpenAI-compat (OpenAI/DeepSeek/Groq/Mistral/xAI), Gemini, OpenRouter, Ollama
- [x] BaseProvider + streaming SSE + AbortController
- [x] ProviderManager, ModelRegistry (cache 24h, listModels dinâmico)
- [x] ConversationManager — conversas persistidas no SQLite
- [x] ContextManager — 11 tipos de contexto, prioridade de corte
- [x] PromptBuilder — 4 modos: chat, agent, sysadmin, deploy, incident
- [x] ToolExecutor — tiers: read/write/exec_safe/exec_dangerous; log em SQLite
- [x] AIHubPage — streaming, histórico, seletor provider+modelo, painel Contexto+Memória
- [x] ProjectMemory — CRUD de blocos de contexto por VPS/projeto
- [x] Context Selector — checkboxes: logs, docker, pm2, vps stats, memória
- [x] ToolExecutor confirmação — modal "CONFIRMO" para comandos destrutivos

### Ferramentas avançadas
- [x] Incident Mode (v3.1.0) — 4 painéis (IA+Logs+Docker/PM2+Terminal); diagnóstico automático
- [x] Deploy Assistant (v3.2.0) — plano IA, aprovação, execução passo a passo, rollback automático, smoke test

## Limitações conhecidas

1. **Squad sem contexto automático de projeto** — Jarvis e demais agentes respondem de forma genérica quando não há contexto do projeto fornecido; é necessário descrever o projeto no input ou selecionar VPS/projeto no painel direito
2. **Squad lentidão na primeira mensagem** — CLI `claude` tem overhead de inicialização/OAuth (~3–5s); respostas seguintes são mais rápidas
3. **Autenticação interna opt-in** — sem usuários cadastrados = single-user (backward compat); com usuários = login obrigatório, roles `admin`/`viewer`; sessão in-memory (requer login a cada restart)
2. **SSH key privada** — usuário configura no sistema; app não armazena
3. **LSP** — requer `typescript-language-server` + WebSocket wrapper na VPS; configuração manual
4. **DAP** — requer `node --inspect` na VPS + túnel 9229; sem breakpoints no Monaco
5. **Chat multimodal** — Anthropic e Gemini suportam; outros providers recebem base64 no texto
6. **Fingerprint SSH** — SHA-256 da chave bruta; não usa CA/known_hooks do sistema
7. **LSP** — requer `typescript-language-server` + WebSocket wrapper na VPS; configuração manual
8. **DAP** — requer `node --inspect` na VPS + túnel 9229; sem breakpoints no Monaco

## Próximos passos

- Testes E2E Playwright para página Squad
- Suporte a WebSocket LSP para mais linguagens (Python, Rust, Go)
