# CURRENT_STATE.md — NEX-ALS IDE

**Data:** 2026-06-12
**Versão:** 3.20.0
**Repositório:** https://github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER.git

## Estado atual

**NEX-ALS IDE 3.19.0** — IDE completo com **NEX-ALS AI HUB** (6 provedores + Claude Code conta Pro, streaming SSE, conversas persistidas, Context Selector, Project Memory, ToolExecutor), **Squad** (8 agentes especializados com chat, ACTION tags SSH/local, KB por projeto, rootAgentRef, Pipeline homolog→prod, Execução Local, painéis redimensionáveis, histórico com exclusão, painel Conta Claude), **KB Global do Desenvolvedor** (SQLite `knowledge_entries`, KnowledgeService, CRUD completo, injeção automática em Squad + AI HUB), Incident Mode, Deploy Assistant, **Agente Autônomo Local** (executa comandos, cria arquivos, instala dependências no PC sem VPS, loop até 500 ações com botão Parar), **Notificações de Sistema** (alertas disco/CPU/RAM + erro IA), Snapshot/Rollback, multi-monitor, fingerprint SSH e toda a infraestrutura IDE. **Visual NEX-ALS Dark Luxury** (paleta `#080612`/`#D9A441`/`#B78DFF`, logo, Inter font, glassmorphism). `pnpm dev` inicia sem erros. Build TypeScript zero erros em todos os pacotes.

### Dois modos de operação

- **Modo Remoto (VPS)** — explorer SFTP hierárquico, Monaco Editor com split, terminal SSH multi-tab, Git integrado, painel de Problemas, port forwarding SSH, TypeScript LSP, depuração remota DAP, chat IA (API direta ou claude -p); badge vermelho "Produção" na top bar.
- **Modo Local (OneDrive/PC)** — mesmo editor usando `node:fs`; badge verde "Local"; sem terminal/Git; chat IA com provedor configurado (sem VPS necessária) ou fallback para seletor de VPS.

## Bugs conhecidos — Squad execução local em OneDrive (identificados v3.20.0)

- **OneDrive bloqueia `create-next-app`** — `child_process.exec` em `handlers.ts:1062` executa de verdade, mas `create-next-app` chama `fs.access(root, W_OK)` antes de scaffoldar; OneDrive intercepta esse check e retorna "sem permissão" mesmo com a pasta gravável. Workaround: staging em `C:\Users\phpos\AppData\Local\Temp` + `xcopy` ao destino final. Pendente: adicionar isso em `EXECUTOR_RULES`.
- **`parseActions` segundo passo ausente** — CHANGELOG v3.19.0 documenta parser de dois passes, mas `actions.ts:12` tem apenas um regex. ACTIONs truncadas antes de `[/ACTION]` são descartadas silenciosamente.

## Squad — Friday regra npm lowercase (v3.20.0)

- [x] **EXECUTOR_RULES regra 8** — nomes npm sempre lowercase; diretório com maiúsculas → criar em subpasta lowercase; `--ts` em vez de `--typescript`; aspas em `--import-alias "@/*"`

## Squad — parser robusto + autoExecRound + fluxo Jarvis (v3.19.0)

- [x] **Parser tolerante** — `parseActions` com dois passes: regex primário aceita `[/ACTION` sem `]`; segundo passo captura tags completamente sem fechamento; `stripActions` limpa ambas as formas
- [x] **`autoExecRound()`** — executa actions → envia `[RESULTADO DAS AÇÕES]` ao root agent → recebe resposta → repete até sem actions ou `[PRONTO]` (máx 6 rodadas); elimina loop de repetição de READ_DIR
- [x] **Jarvis fluxo obrigatório** — instrução explícita: READ_DIR → READ_FILE (um por resposta) → delegação; proibido misturar ação com delegação; proibido repetir ação já executada

## Squad — Jarvis somente leitura + Exec auto (v3.18.0)

- [x] **Jarvis restrito a READ_DIR + READ_FILE** — `JARVIS_ACTION_INSTRUCTIONS` separado em `agents.ts`; SHELL e WRITE_FILE removidos do arsenal do Jarvis; system prompt reforça delegação obrigatória a `@friday`/`@tester` para qualquer execução
- [x] **Toggle "Exec auto"** — botão Zap âmbar no cabeçalho do chat; padrão ON; persiste em `localStorage['squad_auto_execute']`; quando ON, actions são executadas automaticamente após cada resposta sem clicar "Executar"; compatível com modo autônomo (auto-exec + loop)

## KB Global do Desenvolvedor (v3.17.0)

- [x] **Modelo `KnowledgeEntry`** — SQLite via Prisma (`knowledge_entries`): id, title, content, category (8 tipos), tags, isActive, timestamps
- [x] **`KnowledgeService`** — `list()`, `listActive()`, `create()`, `update()`, `delete()`, `buildContext()` (markdown por categoria); padrão `get db()` = `getPrismaClient()`
- [x] **IPC handlers** — `knowledge:list/create/update/delete/context`; preload e `ipc.ts` com namespace `knowledge.*`
- [x] **Injeção Squad** — `buildContext()` chamado antes de `squad:stream:start`; injetado no topo do system prompt
- [x] **Injeção AI HUB** — `buildContext()` chamado antes de `ai:stream:start`; mesclado via `dataWithKB`
- [x] **KnowledgePage** — rota `/knowledge`; busca, filtro por categoria, toggle ativo, edição inline, formulário lateral; 8 categorias com cores: geral, arquitetura, padrões, bibliotecas, convenções, snippets, regras, stack
- [x] **Sidebar** — item "Conhecimento" (`BookMarked`) adicionado ao nav

## Visual NEX-ALS Dark Luxury (v3.17.0)

- [x] **Paleta oficial**: fundo `#080612`, card `#0D0A24`, surface `#151038`, dourado `#D9A441`/`#F2C879`, roxo `#B78DFF`
- [x] **`tailwind.config.ts`** — override `slate` completo; namespace `brand` (dourado); namespace `nex` (purple/gold/bg/card/border); sombras `nex-glow`, `gold-glow`, `purple-glow`; gradientes `nex-gradient`, `gold-gradient`
- [x] **`index.css`** — Inter via Google Fonts; CSS vars `--nex-*`; scrollbar dourada; `.card`, `.card-gold`, `.btn-primary` (gradiente dourado), `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.input` (focus dourado), `.glass`; badges; utilitários `text-gold`, `glow-gold`, `glow-purple`
- [x] **`Layout.tsx`** — sidebar gradient escuro; faixa dourada esquerda; logo `logo-nexals.png` + fallback `⬡`; "NEX-ALS IDE" dourado; botões AI HUB (roxo glow) e SQUAD (dourado glow); nav com borda dourada ativa; footer versão dourada + tagline

## Squad (v3.10.0 → v3.15.7)

- [x] **Squad** — página fullscreen com 8 agentes: Jarvis (PM/Claude), Friday (Dev/GPT), Fury (Pesquisa/Gemini), Shuri (UX/Claude), Pepper (Marketing/GPT), Vision (Growth/Gemini), Requis (Docs/Claude), Tester (QA/GPT)
- [x] **Chat por agente** — streaming em tempo real; menção direta `@agente` no input redireciona para o agente mencionado
- [x] **Persistência de sessões** — `squad_sessions` + `squad_messages` no SQLite via Prisma; sessões listadas no histórico (painel direito); clicar recarrega mensagens; `updatedAt` atualizado a cada mensagem
- [x] **Delegação automática** — após stream concluído (depth=0), `detectDelegations()` escaneia `@agente` na resposta; `extractTask()` extrai a tarefa; novo `streamAgent()` disparado automaticamente; profundidade máxima 1 (evita loops); badge "delegado por @X" visível no chat
- [x] **ACTION tags** — `SHELL`, `WRITE_FILE`, `READ_FILE` geradas pelo agente; botão Executar por bloco; executa via SSH/SFTP (modo VPS) ou `child_process`/`node:fs` (modo Local); resultado inline (verde/vermelho)
- [x] **Contexto do Projeto** — campo collapsível no painel direito; cola README/arquitetura/stack; todos os agentes da sessão recebem o contexto automaticamente no system prompt; indicador verde ativo (v3.14.0)
- [x] **Execução Local** — toggle VPS/Local no painel direito; modo Local executa ações no PC sem VPS via `vpsId: '__local__'`; dialog para selecionar pasta de trabalho; ações SHELL usam `cwd` da pasta selecionada (v3.14.0)
- [x] **Pipeline homolog → prod** — toggle no painel direito (modo VPS apenas); gate âmbar pós-execução com Aprovar/Rejeitar; Aprovar executa na VPS Prod selecionada; estados visuais (âmbar/azul/verde/vermelho/cinza)
- [x] **Claude Code como provedor** — `ai:stream:start` roteia para subprocess `claude` CLI quando provider = `claude-code`; PATH enriquecido com npm global bin; zero API Key / zero cobrança por token; `claude:check` detecta versão e status; `ClaudeCodeCard` em Configurações
- [x] **Múltiplas contas Claude Code** — tabela `claude_code_accounts` (SQLite); N contas isoladas via `CLAUDE_CONFIG_DIR`; alternância com um clique; conta já autenticada (`~/.claude`) ou nova com dir gerado automaticamente; verificação real via `.credentials.json`; comando PowerShell com botão copiar (v3.12.0–v3.13.0)
- [x] **Correções de estabilidade Squad** (v3.15.2–v3.15.4) — stderr acumulado em buffer (sem falso-positivo de autenticação); `shell: true` para execução de `.cmd` no Windows; removido `--no-color` (não suportado em claude 2.1.170); `cwd: localPath || homedir()` + flag `--add-dir` para sandbox de segurança do CLI
- [x] **READ_DIR + anti-loop autônomo** (v3.15.8) — nova action `READ_DIR` para listar pastas; auto-detecção de diretório em `READ_FILE` (lista conteúdo ao invés de erro); instruções anti-loop no modo autônomo; `ACTION_INSTRUCTIONS` adicionadas a Jarvis e Shuri
- [x] **Base de Conhecimento** (v3.15.9) — substitui campo livre "Contexto do Projeto" por 8 seções estruturadas (projeto, stack, estrutura, status, convenções, regras, habilidades, notas); 3 templates prontos (Next.js SaaS, Node.js API, React+Vite); persistência localStorage; indicador visual por seção
- [x] **KB por projeto + delegação autônoma** (v3.16.0) — KB isolada por localPath; rootAgentRef garante orquestrador no controle
- [x] **Sincronizar KB + iterações configuráveis + relatório final** (v3.16.1) — botão Sincronizar lê README/CURRENT_STATE/ARCHITECTURE; input 5–200 iterações; bubble de relatório ao fim do ciclo — KB isolada por `localPath` no localStorage; badge com nome da pasta; troca de projeto recarrega KB; `rootAgentRef` garante que resultados sempre retornam ao orquestrador (Jarvis); delegado sem ações dispara síntese com root ao invés de parar
- [x] **Painéis redimensionáveis** (v3.15.5) — drag handles entre painéis esquerdo/centro/direito; `leftWidth` e `rightWidth` via `useRef` + `mousemove`/`mouseup` globais; min/max por painel
- [x] **Botão Limpar chat** (v3.15.5) — limpa bubbles + sessionId; desabilitado durante streaming
- [x] **Botão Acompanhar** (v3.15.5) — auto-scroll com `onScroll` handler; botão sticky aparece quando usuário rola para cima
- [x] **Botão excluir conversa** (v3.15.2) — ícone 🗑 no hover de cada sessão no histórico; `stopPropagation` para não disparar load
- [x] **Conta Claude — modal de uso** (v3.15.7) — botão "Uso" azul no header Histórico; modal lê email+plano de `.credentials.json` da conta ativa; botão "Abrir claude.ai" via `shell:openExternal`; IPC `claude:usage` + `shell:openExternal` com allowlist de domínios

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
- [x] **Testes** — Vitest: 18 testes unitários (`@cwm/config` + `@cwm/core`) + Playwright E2E: **43 testes** (launch, navigation, VPS CRUD, settings, Squad)

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

1. **Squad — contexto do projeto via campo manual** — campo "Contexto do Projeto" resolvido (v3.14.0): cole README/arquitetura no painel direito e todos os agentes passam a receber esse contexto; não há leitura automática dos arquivos do projeto (isso é feito via ações READ_FILE)
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

- Suporte a WebSocket LSP para mais linguagens (Python, Rust, Go)
