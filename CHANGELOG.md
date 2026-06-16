# CHANGELOG — NEX-ALS IDE

## [3.50.0] — 2026-06-16

### Adicionado — SQUAD-03: Expansão do SQUAD com 12 Agentes Especializados (ECC)

Baseado na análise do repositório [affaan-m/ECC](https://github.com/affaan-m/ECC) (Agent Harness Operating System), 12 novos agentes especializados foram adicionados ao SQUAD, cobrindo gaps de segurança, arquitetura, performance, diagnóstico SSH e qualidade de código.

**`packages/core/src/squad/agents.ts`:**

**Agentes de revisão e segurança:**
- `natasha` 🛡️ — Segurança / Vulnerabilidades: OWASP Top 10, secrets hardcoded, configuração Electron (nodeIntegration, sandbox, contextIsolation), IPC sem validação Zod. Emite [CRÍTICO]/[ALTO]/[MÉDIO]/[BAIXO]/[INFO], termina com [APROVADO] ou [BLOQUEADO]
- `reviewer` já existia; Natasha foca exclusivamente em segurança
- `riri` 🧠 — TypeScript Estrito: floating promises, async forEach, any sem justificativa, non-null assertions sem guard, module-level mutable state
- `hope` ⚛️ — React / Hooks: dependências de useEffect, cleanup de effects, dangerouslySetInnerHTML, prop drilling. Pair com Riri para audits .tsx completos
- `wanda` 🔮 — Cobertura de Testes em PRs: detecta funções modificadas sem teste atualizado, edge cases ausentes, assertions sem valor comportamental real

**Agentes de arquitetura e design:**
- `hank` 🏛️ — Arquitetura de Software: read-only, produz ADRs (Architecture Decision Records), detecta Big Ball of Mud, God Object, acoplamento entre camadas Electron
- `bruce` 🔬 — Análise de Tipos TypeScript: avalia encapsulamento, invariantes, estados impossíveis; detecta branded types ausentes, union types com estados impossíveis, as any sem justificativa
- `ghost` 👻 — Falhas Silenciosas: caça empty catch blocks, fallbacks perigosos (.catch(() => [])), I/O SSH/SFTP sem timeout, propagação quebrada de erros. Emite [FANTASMA] por ocorrência, termina com [LIMPO] ou [FANTASMAS: N]

**Agentes de performance e diagnóstico:**
- `rhodey` ⚡ — Performance & Otimização: React re-renders, bundle size, startup Electron, vazamentos de memória, conexões SSH/SFTP não reutilizadas. Métricas alvo: FCP <1.8s, LCP <2.5s, Bundle <200KB
- `sam` 🌐 — SSH / VPS / Diagnóstico de Rede: diagnóstico OSI-layer de SSH/SFTP/tunnel, read-only, checklist por camada (L1-L4, DNS, autenticação, port-forward)
- `scott` 🔧 — Erros de Build / Compilação TS: faz APENAS o build passar com mínima mudança de código; proibido refatorar, renomear ou mudar arquitetura

**Agentes de supervisão e qualidade:**
- `thor` 🌩️ — Supervisor de Loops Autônomos: monitora modo autônomo do SQUAD, detecta stalls, escalona ao @jarvis quando mesmo erro repete 2x, previne loops infinitos
- `carol` ⭐ — Avaliadora de Qualidade do SQUAD: scorecard em 5 eixos (Acurácia, Completude, Clareza, Acionabilidade, Concisão) com veredicto estruturado [APROVADO/CORRIGIR/REEXECUTAR]

**SQUAD antes:** 10 agentes | **SQUAD depois:** 22 agentes

### Infraestrutura
- Remote git migrado de `HEXAGON-WORKSPACE-MANAGER` para `NEX-ALS-IDE` (`https://github.com/fasterdrible-lab/NEX-ALS-IDE.git`)
- CLAUDE.md atualizado com novo repositório

---

## [3.49.0] — 2026-06-14

### Adicionado — SQUAD-02: Fury com Busca Web em Tempo Real

**`packages/core/src/squad/agents.ts`:**
- `FURY_ACTION_INSTRUCTIONS` — novo bloco de instrução exclusivo para Fury com regras de uso da ACTION SEARCH
- `ACTION_INSTRUCTIONS` — adicionada ACTION SEARCH a todos os agentes com ACTION tags (`[ACTION:SEARCH query="..."][/ACTION]`)
- System prompt de Fury atualizado: nunca inventa dados, sempre executa buscas reais antes de afirmar qualquer coisa, cita URL da fonte

**`apps/desktop/src/ipc/handlers.ts`:**
- DDL `ALTER TABLE settings ADD COLUMN braveApiKey TEXT NOT NULL DEFAULT ''` (silencioso se coluna já existir)
- Handler `settings:brave:get()` — retorna `{ braveApiKey }` da tabela settings
- Handler `settings:brave:set(key)` — upsert do `braveApiKey` na tabela settings
- Handler `search:web({ query, count? })` — lê `braveApiKey` do banco, chama `GET https://api.search.brave.com/res/v1/web/search` com header `X-Subscription-Token`, retorna `{ output }` formatado como markdown (título, URL, descrição)
- Timeout de 15s; retorna erro amigável se chave não configurada

**`apps/desktop/src/preload.ts`:** canais `search:web`, `settings:brave:get`, `settings:brave:set`

**`apps/web/src/lib/ipc.ts`:**
- `ipc.search.web({ query, count? })` → `{ output: string }`
- `ipc.settings.brave.get()` → `{ braveApiKey: string }`
- `ipc.settings.brave.set(key)` → `{ saved: boolean }`

**`apps/web/src/pages/SquadPage.tsx`:**
- `ActionType` expandido com `'search'`
- `executeActionsAuto`: branch para `action.type === 'search'` — executa `ipc.search.web` diretamente (sem VPS), registra no activity log com ícone 🌐
- Display de ACTION tag: badge **WEB** laranja para SEARCH
- Activity log: ícone `🌐` para entradas de busca

**`apps/web/src/pages/SettingsPage.tsx`:**
- Seção **Busca Web (Brave Search)**: campo de API key com toggle show/hide, botão Salvar, link para registro, mensagem de feedback

**Comportamento resultante (SQUAD-02 fechado):**
- Fury pesquisa a internet automaticamente antes de emitir qualquer dado de mercado ✅
- Qualquer agente pode usar `[ACTION:SEARCH query="..."]` para buscar docs, pacotes, soluções ✅
- Badge **WEB** laranja no chat + ícone 🌐 no Activity log ✅
- Chave configurada uma vez em Configurações → Busca Web ✅
- Plano gratuito Brave: 2.000 buscas/mês ✅

---

## [3.48.0] — 2026-06-14

### Adicionado — SQUAD-01: Memória Persistente entre Sessões

**`packages/db/prisma/schema.prisma`:**
- Novo modelo `SquadMemory`: campos `id`, `projectKey` (localPath ou `__global__`), `content`, `category` (decisão/arquitetura/padrão/correção/outro), `sessionId?`, `agentName`, `createdAt`; index em `projectKey`

**`apps/desktop/src/ipc/handlers.ts`:**
- DDL `CREATE TABLE IF NOT EXISTS squad_memories` executado na inicialização (auto-migração para instâncias sem db:push)
- Handler `squad:memory:list(projectKey)` — lista memórias do projeto em ordem cronológica
- Handler `squad:memory:save({ projectKey, content, category, sessionId?, agentName? })` — salva uma memória manualmente
- Handler `squad:memory:delete(id)` — remove memória por id
- Handler `squad:memory:extract({ sessionId, projectKey })` — lê até 40 mensagens da sessão, monta contexto de conversa, chama Friday via `chatAgent` pedindo 1-6 memórias em JSON, salva e retorna lista

**`apps/desktop/src/preload.ts`:** canais `squad:memory:list`, `squad:memory:save`, `squad:memory:delete`, `squad:memory:extract`

**`apps/web/src/lib/ipc.ts`:**
- Tipo `SquadMemory` exportado
- `ipc.squad.memory.list(projectKey)`, `.save(data)`, `.delete(id)`, `.extract({ sessionId, projectKey })`

**`apps/web/src/pages/SquadPage.tsx`:**
- `MEM_CAT_STYLE` — mapa de estilos por categoria (azul/roxo/verde/vermelho/cinza)
- Estado `memories: SquadMemory[]` + `extracting: boolean`
- `projectContext` (useMemo) injeta as 20 memórias mais recentes como `## MEMÓRIAS DO PROJETO` antes do KB manual
- `useEffect([localPath])` carrega memórias do projeto via `ipc.squad.memory.list`
- `extractMemories()` — chama `squad:memory:extract`, adiciona resultado ao estado, navega para aba Memórias
- `deleteMemory(id)` — remove do backend e atualiza estado
- Aba **Memórias** (4ª, ícone `Brain`, badge roxo com contagem) no painel direito:
  - Header com projeto atual + botão "Extrair da sessão" (habilitado quando há sessão + ≥3 mensagens)
  - Cards por memória: badge de categoria colorido, conteúdo, data, botão excluir (hover)
  - Empty state com ícone Brain e instrução

**Comportamento resultante (SQUAD-01 fechado):**
- Agentes têm acesso automático às decisões de sessões anteriores ✅
- Extração com 1 clique: Friday analisa a conversa e gera 1-6 memórias estruturadas ✅
- Memórias injetadas no `projectContext` → todos os agentes recebem como contexto ✅
- Escopo por projeto (localPath) — projetos diferentes têm memórias separadas ✅
- Sem nova coluna de dados sensíveis — apenas fatos técnicos extraídos pela IA ✅

---

## [3.47.0] — 2026-06-14

### Adicionado — Phase C: Planning Mode

**`apps/web/src/pages/PlanningPage.tsx`** (NOVO — fullscreen):
- **Coluna esquerda — Fila de tarefas**: lista de tarefas com agente-dono, prioridade (critical/high/medium/low), status (pending/running/done/blocked), filtro por agente + status, ordenação por urgência; clicar no status avança o ciclo; botão ▶ executa a tarefa navegando para `/squad` com `autoMessage` e `agent` no `location.state`
- **Coluna direita — Automações**: espelha automações do `AutomationsPage` (toggle ativo/inativo, próximo disparo calculado, botão "Executar agora")
- **Faixa inferior — Contexto por agente**: aba por agente (`jarvis`, `friday`, `fury`, `shuri`, `pepper`, `vision`, `requis`, `tester`, `reviewer`, `devops`), textarea de instruções específicas, persistido em `localStorage` (`planning_agent_contexts`)
- Botão "+ Nova Tarefa" com modal completo (título, agente, prioridade, descrição)

**`apps/web/src/pages/SquadPage.tsx`:**
- `useLocation` adicionado ao import de `react-router-dom`
- `useEffect` on mount lê `location.state as { autoMessage?, agent? }` → pré-preenche input e seleciona agente automaticamente; limpa state com `window.history.replaceState` para evitar re-trigger no back
- Injeção de contexto por agente: lê `planning_agent_contexts` do `localStorage` e mescla com `projectContext` antes de `stream.start`

**`apps/web/src/components/Layout.tsx`:**
- Botão **PLANEJAR** (amber, ícone `CalendarClock`, acima de WORKSPACE) → `/planning`
- Versão → `v3.47.0`

**`apps/web/src/App.tsx`:** rota `/planning` → `PlanningPage` (fullscreen, fora do Layout)

**Comportamento resultante (Phase C fechada):**
- Sidebar → PLANEJAR → fila visual de tarefas + automações + contextos por agente ✅
- Clicar ▶ numa tarefa → SquadPage com agente certo + mensagem pré-preenchida ✅
- Contexto específico por agente é injetado automaticamente em cada sessão Squad ✅
- Automações visíveis e executáveis sem sair do Planning ✅

---

## [3.46.0] — 2026-06-14

### Adicionado — Phase 2: LSP Auto-start Local

**`apps/desktop/src/lsp/local-lsp.ts`** (NOVO):
- Classe `LocalLspBridge`: detecta `typescript-language-server` (spawn com `--version`), spawna o servidor com `--stdio`, faz bridge Content-Length ↔ WebSocket em porta dinâmica (OS-assigned via `listen(0)`)
- Parsing de protocolo LSP: loop de `Content-Length: N\r\n\r\n{body}` no buffer stdout → mensagem JSON enviada via WebSocket; sentido inverso: JSON do WS → `Content-Length: N\r\n\r\n` no stdin
- Múltiplos clientes WS suportados via `Set<{ readyState, send, close }>`
- Erro amigável se servidor não instalado: "Instale com: npm install -g typescript-language-server typescript"

**`apps/desktop/src/ipc/handlers.ts`:**
- Handlers `local:lsp:start(workspacePath)`, `local:lsp:stop()`, `local:lsp:status()` → instância única de `LocalLspBridge`

**`apps/desktop/src/preload.ts`:** canais `local:lsp:start`, `local:lsp:stop`, `local:lsp:status`

**`apps/desktop/package.json`:** dep `ws@^8.18.0`, devDep `@types/ws@^8.5.12`

**`apps/web/src/lib/ipc.ts`:** `ipc.lsp.start(workspacePath)`, `ipc.lsp.stop()`, `ipc.lsp.status()`

**`apps/web/src/lib/lsp.ts`:** `connectLSP(monaco, langKey, portOverride?)` — aceita porta dinâmica local

**`apps/web/src/pages/IDEPage.tsx`:**
- `toggleLSP` detecta modo local (`isLocal`) → chama `ipc.lsp.start(localRootRef.current)` e passa porta retornada para `connectLSP` via `portOverride`
- Toast diferenciado: "TS LSP conectado (local)" vs "(remoto via túnel)"

**Comportamento resultante (Phase 2 fechada):**
- IDE local: clicar "TS LSP" na status bar → conecta TypeScript LSP sem abrir túnel SSH ✅
- IDE remoto: comportamento original preservado (túnel porta 6009) ✅
- Sem conflito de porta: local usa porta aleatória do OS ✅

---

## [3.45.0] — 2026-06-14

### Adicionado — Ponto 11: Workspace Intelligence

**`apps/desktop/src/ipc/handlers.ts`:**
- Handler `workspace:analyze({ vpsId, projectPath })` — coleta dados do projeto via SSH (`find`, `cat` de manifests, `head` de arquivos-fonte), valida `projectPath` contra regex de segurança (`/^[/~]?[a-zA-Z0-9_./-]+$/`), monta contexto de até 7.000 chars e chama Friday via `chatAgent` para retornar `WorkspaceReport` JSON estruturado
- Execução em paralelo (`Promise.allSettled`) para todos os manifests; depois lê até 6 arquivos-fonte (700 chars cada)
- Sanitização de saída: verifica campos `summary`, `stack`, `architecture.layers`, `architecture.patterns`, `modules`, `flows`, `risks` antes de retornar

**`apps/desktop/src/preload.ts`:** adicionado canal `workspace:analyze`

**`apps/web/src/lib/ipc.ts`:**
- Tipos: `WsArchLayer`, `WsModule`, `WsFlow`, `WsRisk`, `WorkspaceReport`
- `ipc.workspace.analyze({ vpsId, projectPath })` → `WorkspaceReport`

**`apps/web/src/pages/WorkspacePage.tsx`** (NOVO — fullscreen):
- **Modo seletor** (sem query params): VPS dropdown + path input + botão "Analisar Projeto"
- **Modo análise** (com `?vpsId=X&path=Y`): auto-analisa ao montar
- **Top bar**: back, VPS/projeto breadcrumb, badges de risco (crítico/alto), botão Reanalisar
- **Left rail** (visível com relatório): tabs de navegação + mini painel de contagem de riscos por severidade
- **Tabs de conteúdo:**
  - *Resumo*: parágrafo de summary + stack badges + patterns checklist
  - *Arquitetura*: layer cards com nome, descrição e arquivos
  - *Módulos*: cards com nome, path, role badge (controller/service/model/utility/config), imports count, risks count
  - *Fluxos*: accordion expandível com etapas numeradas
  - *Riscos*: cards coloridos por severidade (critical/high/medium/low), ordenados do mais grave
- Risco zero → card verde "Projeto em boas condições"

**`apps/web/src/components/Layout.tsx`:**
- Botão **WORKSPACE** (azul, acima de OPERADOR) na sidebar → `/workspace`
- Versão → `v3.45.0`

**`apps/web/src/App.tsx`:** rota `/workspace` → `WorkspacePage` (fullscreen, fora do Layout)

**`apps/web/src/pages/IDEPage.tsx`:**
- Botão **Workspace** na status bar (ao lado de Aprender, somente VPS remota) → abre `/workspace?vpsId=X&path={activeDir}&name={vpsName}`

**Comportamento resultante (Ponto 11 fechado):**
- Clicar "WORKSPACE" na sidebar → selector de VPS + path ✅
- Clicar "Workspace" na status bar do IDE → análise imediata do diretório aberto ✅
- IA mapeia camadas, módulos, fluxos e riscos em ~30s ✅
- Reanalisar a qualquer momento para atualizar o mapa ✅
- Segurança: path validado com regex; sem injeção de shell possível ✅

---

## [3.44.0] — 2026-06-14

### Adicionado — Ponto 10: Aprendizado Contínuo

**`apps/desktop/src/ipc/handlers.ts`:**
- Handler `learning:analyzeFile({ name, content, language })` — usa Friday (claude-opus) para extrair título, conteúdo resumido, categoria e tags de qualquer arquivo de código; responde em JSON puro (máx 512 tokens); sanitiza categoria contra lista allowlist

**`apps/desktop/src/preload.ts`:** adicionado canal `learning:analyzeFile`

**`apps/web/src/lib/ipc.ts`:** adicionado `ipc.learning.analyzeFile(data)`

**`apps/web/src/pages/IDEPage.tsx`:**
- Função `analyzeManifest(name, content)` (módulo-nível, sem IA): parseia heuristicamente `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `docker-compose.yml` e retorna `KbSuggestion` ou `null`
- Estado: `kbSuggestion`, `aiLearning`, `aiLearnResult`
- Hook em `openFile()`: após carregar conteúdo, chama `analyzeManifest` → se retornar sugestão → `setKbSuggestion()` (sem IA, sem latência)
- **Banner KB** (entre tabs e breadcrumbs): aparece dourado quando `kbSuggestion` ativo — ícone BookMarked + título truncado + botão "Salvar na KB" + dismiss
- **Botão "💡 Aprender"** na status bar (rightmost): chama `ipc.learning.analyzeFile()` com arquivo ativo → abre modal de resultado
- **Modal de aprendizado IA**: exibe título/conteúdo/categoria/tags extraídos pela IA com botões "Ignorar" e "Salvar na KB"
- `handleSaveToKb(s)`: chama `ipc.knowledge.create()` + toast de confirmação + fecha banner/modal

**Comportamento resultante (Ponto 10 fechado):**
- Abrir `package.json` → banner dourado aparece instantaneamente com stack detectada ✅
- Botão Aprender na status bar analisa qualquer arquivo via IA → propõe entrada KB ✅
- Um clique para salvar padrão detectado na Knowledge Base ✅
- Zero latência para manifests (heurística local); IA sob demanda para código ✅

---

## [3.43.0] — 2026-06-14

### Adicionado — Ponto 9: Operador de Infraestrutura

**`apps/desktop/src/ipc/handlers.ts`:**
- Handler `infra:analyze(report: string)` — chama `AiService.chatAgent()` com AGENTS.devops + prompt de análise de infraestrutura; retorna análise textual

**`OperatorPage` (`apps/web/src/pages/OperatorPage.tsx`) — fullscreen, sem sidebar:**
- Top bar: breadcrumb "← Operador de Infraestrutura" + badges (N críticos / N atenção / N ok) + botão "Analisar com DevOps" + botão "Verificar Tudo"
- Auto-load: busca VPS list ao montar; reseta status para 'checking' e chama `ipc.monitor.getStats(vpsId)` para TODOS em paralelo (Promise.all)
- Auto-refresh: `setInterval` de 5 minutos
- **Thresholds:** CPU ≥80% warn / ≥95% critical; RAM ≥85% warn / ≥95% critical; Disco ≥80% warn / ≥90% critical
- **VPS grid** (auto-fill minmax 280px): cards coloridos por status (verde/amarelo/vermelho/cinza), mini progress bars para CPU/RAM/Disco, uptime, lista de alertas por card
- **Alert feed** (painel direito): acumula alertas por nível (critical/warn) com timestamp e nome da VPS — até 50 entradas
- **AI panel**: botão "Analisar com DevOps" formata relatório completo (todas VPS + métricas + alertas) e chama `infra:analyze` → exibe análise no painel direito acima do feed
- `StatusDot` component: dot colorido com glow + label texto (Online/Atenção/Crítico/Offline)
- `MiniBar`: progress bar compacta com cor dinâmica baseada nos thresholds

**`Layout.tsx`:** botão "OPERADOR" destacado em vermelho na sidebar (acima de SQUAD), estilo idêntico aos outros botões de acesso rápido

**Rota:** `/operator` fullscreen (fora do bloco Layout, como `/ai-hub` e `/squad`)

**Comportamento resultante (Ponto 9 fechado):**
- Visão unificada de TODAS as VPS em um único painel ✅
- Health checks automáticos na abertura e a cada 5 minutos ✅
- Alertas proativos com threshold configurado (CPU/RAM/Disco) ✅
- Análise IA com @devops para interpretar o estado da infraestrutura ✅
- Sem nova tabela no DB — alertas em memória, métricas via SSH existente ✅

---

## [3.42.0] — 2026-06-14

### Adicionado — Ponto 7: Automações naturais

**DB (`packages/db/src/index.ts`):**
- Tabela `scheduled_jobs`: id, title, instruction, agentName, schedule (JSON), isActive, lastRunAt, lastResult, nextRunAt, vpsId, createdAt, updatedAt

**`packages/core/src/jobs/jobs.service.ts`** (novo):
- `JobSchedule` — union type: `interval | hourly | daily | weekly`
- `parseSchedule(text)` — parser NL em PT/EN: detecta "todo dia às 8h", "toda segunda", "a cada 30 min", "de manhã", "à noite", extrai hora com regex flexível
- `describeSchedule(schedule)` — "Diariamente às 08:00", "Toda Seg às 09:00", "A cada 30 min"
- `computeNextRunAt(schedule, from?)` — calcula próxima execução para cada tipo de schedule
- `ScheduledJobsService`: `list()`, `get()`, `getDue()`, `create()`, `update()`, `delete()`, `markRan()` — raw SQL em `scheduled_jobs`
- `create()` detecta schedule automaticamente da instruction; `update()` re-parseia se instruction mudar

**`apps/desktop/src/jobs/job-executor.ts`** (novo):
- `JobExecutor` — executa no main process (Electron)
- `start()` — `setInterval(60s)` + execução imediata
- `checkDueJobs()` — consulta `getDue()`, usa Set interno para evitar execuções duplicadas
- `executeJob(job)` — chama `AiService.chatAgent()` com system prompt do agente + contexto do ContextBuilder; retorna resposta textual
- Após execução: `Notification.show()` com título do job e primeiros 150 chars da resposta
- `markRan()` chamado antes da execução para avançar nextRunAt (evita re-execução em reinícios lentos)
- `runNow(id)` — execução imediata sob demanda via IPC

**IPC (6 handlers):** `jobs:list`, `jobs:create`, `jobs:update`, `jobs:delete`, `jobs:toggle`, `jobs:runNow` — todos com `requireAuth()`

**`AutomationsPage` (`apps/web/src/pages/AutomationsPage.tsx`):**
- Header com contador: "N jobs · N ativos"
- Cards com: emoji do agente, título, badge ativo/pausado, schedule description, próxima execução (relativa), último run
- Expandir card: exibe instruction completa + último resultado
- Ações por card: ▶ Executar agora · ToggleRight ativar/pausar · Trash excluir
- Modal "Nova automação": textarea com instrução NL + preview live do schedule detectado + select do agente
- Auto-refresh a cada 30s (atualiza nextRunAt / lastRunAt sem reload completo)
- Rota `/automations` + nav item "Automações" com ícone `Timer`

**Comportamento resultante (Ponto 7 fechado):**
- Usuário escreve "Verifique esta VPS todo dia às 8h" → schedule detectado automaticamente ✅
- Executor roda em background no main process mesmo sem interação do usuário ✅
- Resultado aparece como notificação desktop + salvo em lastResult ✅
- Cada agente pode ter suas próprias automações com KB context relevante ✅

---

## [3.41.0] — 2026-06-14

### Adicionado — Ponto 5: Delegação estruturada (hierarquia de sub-agentes)

**`packages/core/src/squad/agents.ts` — Jarvis system prompt:**
- Jarvis agora conhece o formato `[DELEGAÇÃO]...[/DELEGAÇÃO]` para criar planos multi-agente
- Instrução: cada linha `agentName: <objetivo autocontido>` — sub-agente receberá APENAS essa linha como contexto
- Mantém delegação simples `@agente task` para casos de agente único

**`apps/web/src/pages/SquadPage.tsx`:**
- `DelegationItem { agent, objective }` + `DelegationPlan { items }` — interfaces locais
- `parseDelegationPlan(text)` — parser do bloco `[DELEGAÇÃO]...[/DELEGAÇÃO]`; valida agent names; retorna `null` se bloco ausente
- `streamAgent` — novo parâmetro `isolatedHistory?`: quando fornecido, substitui `bubblesRef.current` como histórico enviado ao backend → sub-agentes recebem `history: []` (contexto zerado)
- Delegação estruturada (prioridade alta):
  - Sistema exibe: `"🎯 @jarvis criou um plano com N sub-tarefas"`
  - Por sub-tarefa: `"⚙ Delegando para @agent: objetivo truncado…"` → `streamAgent(agent, objective, sid, 'jarvis', 1, undefined, [])`
  - Após todas: `"✓ Delegações concluídas — sintetizando resultados…"` → Jarvis recebe síntese com histórico completo (vê resultados de todos os sub-agentes)
- Delegação simples `@mention` — mantida como fallback quando não há bloco estruturado

**Comportamento resultante (Ponto 5 fechado):**
- Jarvis decompõe tarefas complexas em sub-objetivos isolados ✅
- Sub-agentes trabalham sem "ruído" da conversa completa — apenas seu objetivo específico ✅
- Jarvis sintetiza os resultados automaticamente após todas as delegações ✅
- Backward compatible: delegação por `@mention` continua funcionando ✅

---

## [3.40.0] — 2026-06-14

### Adicionado — Ponto 4: Busca semântica em conversas

**DB (`packages/db/src/index.ts`):**
- `squad_messages_fts` — FTS5 virtual table indexando `content` e `agentName` de `squad_messages`
- 4 triggers de sincronização: `smsg_ai` (INSERT), `smsg_ad` (DELETE), `smsg_au_del` / `smsg_au_ins` (UPDATE)
- Migration idempotente: `INSERT INTO squad_messages_fts(squad_messages_fts) VALUES ('rebuild')`

**`search:global` IPC handler:**
- Agora retorna `{ knowledge, skills, conversations }` — terceiro campo com resultados de squad_messages
- Query FTS5 com `snippet(squad_messages_fts, 0, '[[', ']]', '…', 24)` para highlight de trechos relevantes
- Filtra mensagens `role != 'system'`, ordena por relevância FTS5 (`rank`), limite 15 resultados

**`apps/web/src/lib/ipc.ts`:**
- Interface `ConversationResult { id, sessionId, agentName, role, snippet, createdAt }` exportada
- `ipc.search.global()` atualizado com tipo `conversations: ConversationResult[]`

**`SearchPage` (`apps/web/src/pages/SearchPage.tsx`) — nova página:**
- Input com debounce 350ms chamando `ipc.search.global()`
- Resultados agrupados por categoria: Conversas (roxo) · Conhecimento (dourado) · Skills (verde)
- Highlight automático dos termos encontrados — delimitadores `[[...]]` renderizados como `<mark>` estilizado
- Cards de conversa mostram: emoji do agente, @nome, role, data, prefixo do sessionId
- Empty state com ícones por categoria; estado "nenhum resultado" com sugestão
- Rota `/search` adicionada ao Layout com ícone `Search`

**Comportamento resultante (Ponto 4 fechado):**
- Usuário pesquisa "erro nginx", "refactor", "deploy" e encontra mensagens antigas do Squad ✅
- Resultados de KB e Skills aparecem na mesma tela ✅
- Índice FTS5 mantido sincronizado automaticamente via triggers ✅
- Conversas antigas indexadas via rebuild na inicialização ✅

---

## [3.39.0] — 2026-06-14

### Adicionado — Ponto 6: Planejamento Persistente

**TasksService (`packages/core/src/tasks/tasks.service.ts`):**
- `AgentTask` interface: `id, title, description, status (TODO|IN_PROGRESS|BLOCKED|DONE), ownerAgent, priority (low|medium|high), projectId, sessionId, createdAt, updatedAt`
- `list(filters?)`, `listActive()`, `get(id)`, `create(input)`, `update(id, input)`, `delete(id)` — queries raw SQLite em `agent_tasks` (tabela já existia desde v3.35.0)
- `buildContext(tasks)` — formata tarefas pendentes como bloco `## TAREFAS PENDENTES DO SQUAD` com prioridade e status por extenso

**IPC (5 handlers):** `tasks:list`, `tasks:get`, `tasks:create`, `tasks:update`, `tasks:delete` — todos com `requireAuth()`

**ContextBuilder P3:** `this.tasks.listActive()` adicionado como terceira camada de contexto — até 20 tarefas não-DONE são injetadas automaticamente em todo stream do Squad

**TasksPage (`apps/web/src/pages/TasksPage.tsx`):**
- Kanban com 4 colunas: A fazer (cinza) · Em andamento (azul) · Bloqueada (vermelho) · Concluída (verde)
- Cards com dot de prioridade colorido, emoji do agente dono, descrição truncada
- Hover: botão "Iniciar / Concluir / Resetar" (avança status) + botão delete
- Click no card: modal de edição com título, descrição, status, prioridade e agente
- Botão "+ Nova tarefa" no header abre modal de criação
- Counter no header: total de tarefas e quantas concluídas
- Rota `/tasks` adicionada ao Layout com ícone `ClipboardList`

**Comportamento resultante (Ponto 6 fechado):**
- O usuário gerencia tarefas via Kanban visual ✅
- Os agentes do Squad veem automaticamente as tarefas pendentes antes de responder ✅
- Jarvis (e outros) podem criar/mover tarefas via IPC no futuro ✅

---

## [3.38.0] — 2026-06-14

### Adicionado — Ponto 1: Memória Persistente (loop completo)

**ContextBuilder — busca por relevância (FTS5):**
- `KnowledgeService.buildContextFromEntries(entries, header?)` — novo método que formata um array de entradas como bloco de contexto; reutilizado por `buildContext()` e pelo novo fluxo FTS
- `ContextBuilder.build()` atualizado: quando `query` é fornecido, chama `knowledge.search(query, 8)` (FTS5) para obter APENAS as entradas relevantes para a tarefa atual; fallback para `buildContext()` (todas as ativas) se a busca retornar vazio; quando sem query, comportamento original (todas as ativas)
- `knowledgeCount` agora retorna o número real de entradas encontradas (antes era sempre 0 ou 1)

**Loop de aprendizado — banner "Salvar Memória":**
- Após pipeline completar: exibe banner dourado "Salvar esta solução na Memória do projeto?" junto ao banner de Skills
- Após modo autônomo completar: mesmo banner disparado com task + último conteúdo do agente (até 600 chars) como resolução
- Salva `knowledge_entry` com `category: 'geral'`, `tags: 'squad,auto'`, `isActive: true` via `ipc.knowledge.create()`
- O usuário pode dispensar (X) ou confirmar — a entrada fica imediatamente pesquisável via FTS5 e é injetada nos próximos streams como memória relevante

**Comportamento resultante (Ponto 1 fechado):**
- Agente consulta memória automaticamente (v3.37.0 — ContextBuilder no stream) ✅
- Memória consultada é filtrada por relevância à tarefa (FTS5) ✅
- Novas memórias podem ser salvas automaticamente após tarefas ✅
- Memória é pesquisável (FTS5 — v3.35.1) ✅

---

## [3.37.0] — 2026-06-14

### Adicionado — Ponto 8: Contexto Inteligente Automático no Squad

**ContextBuilder agora alimenta todos os streams do Squad:**
- `ctxBuilder.build({ query: data.message })` substituiu a chamada direta a `knowledgeSvc.buildContext()` no handler `squad:stream:start`
- O contexto injetado agora inclui dois níveis automáticos:
  - **P1 — Knowledge Base ativa:** todas as entradas `isActive=true` de `knowledge_entries`, montadas por `KnowledgeService.buildContext()`
  - **P2 — Skills matched:** `SkillsService.matchTriggers(message)` compara a mensagem do usuário contra os gatilhos de cada skill e inclui apenas as skills relevantes
- Budget de 12 000 chars com truncamento automático (`[...contexto truncado]`) — evita inflação de contexto
- Fallback gracioso: se o banco estiver indisponível ou FTS falhar, `ctxResult.text` fica vazio e o stream continua sem contexto (sem quebrar o fluxo)
- O `projectContext` manual (formulário KB da sidebar) continua sendo injetado depois do contexto automático — o usuário mantém controle total sobre o contexto do projeto

**Comportamento resultante:**
- Todo agente do Squad (Jarvis, Friday, Tester, etc.) recebe automaticamente o conhecimento acumulado na KB e as skills relevantes para a tarefa atual
- Não requer nenhuma ação do usuário — funciona em background a cada mensagem enviada

---

## [3.36.0] — 2026-06-14

### Adicionado — Phase B: Delegação Inteligente (Agent Operating System)

**Roteamento automático de tarefas no Squad:**
- `ROUTING_RULES` — 11 regras com regex e score por agente: `friday` (implementação/código), `tester` (QA/testes), `reviewer` (code review/segurança), `devops` (deploy/infra), `shuri` (UX/design), `pepper` (marketing/copy), `vision` (métricas/growth), `requis` (documentação), `fury` (pesquisa), `jarvis` (planejamento)
- `routeTask(text)` — score acumulativo por RegExp pattern, retorna `{ agent, confidence: 'high'|'medium', reason }` — confidence 'high' quando score ≥ 3
- **Badge "🎯 Sugestão"** no Squad — aparece acima do textarea quando o texto digitado corresponde a um agente diferente do ativo; clique no badge muda o agente ativo; badge oculto quando input começa com `@agente` ou isStreaming
- **Auto-route on send** — quando `confidence === 'high'` e não há `@mention` explícito, `handleSend` troca `targetAgent` e `activeAgent` automaticamente antes de enviar
- Routing limpo no `handleSend` — `setSuggestedRoute(null)` após o envio, evita re-exibição do badge
- Detecção debounced 500ms via `useEffect` — não bloqueia typing; reseta ao detectar `^@\w+`

---

## [3.35.1] — 2026-06-14

### Adicionado — FTS5 virtual tables: busca semântica real

**SQLite FTS5 para knowledge_entries e agent_skills:**
- `CREATE VIRTUAL TABLE knowledge_fts USING fts5(...)` com `content_rowid="rowid"` — índice FTS5 externo sincronizado com a tabela de conteúdo
- `CREATE VIRTUAL TABLE skills_fts USING fts5(...)` — mesmo padrão para skills
- 8 triggers SQLite (`*_ai`, `*_ad`, `*_au_del`, `*_au_ins`) criados com `CREATE TRIGGER IF NOT EXISTS` — UPDATE split em 2 triggers separados para evitar BEGIN...END multi-statement
- `INSERT INTO *_fts(*_fts) VALUES ('rebuild')` na seção de migrations — rebuild idempotente do índice ao inicializar (seguro para DBs existentes)
- `buildFtsQuery(raw)` — helper que sanitiza input, split em palavras, adiciona `*` para prefix matching e retorna query FTS5 segura
- `KnowledgeService.search(query, limit?)` — busca FTS5 com JOIN em `knowledge_entries` + `ORDER BY rank`; fallback LIKE automático se FTS indisponível
- `SkillsService.search(query, limit?)` — mesma abordagem para `agent_skills` / `skills_fts`
- `search:global` atualizado para usar `knowledgeSvc.search()` + `skillsSvc.search()` (FTS) ao invés de LIKE em memória
- `knowledge:search` — novo IPC handler expondo `knowledgeSvc.search()` diretamente
- `ipc.knowledge.search(query)` — novo método client-side em `ipc.ts`
- **KnowledgePage** — busca agora usa FTS via `ipc.knowledge.search()` com debounce 400ms; spinner durante busca; fallback LIKE no cliente se FTS falhar
- **SkillsPage** — busca agora usa FTS via `ipc.skills.search()` com debounce 400ms; spinner durante busca

---

## [3.35.0] — 2026-06-14

### Adicionado — Phase A: Skills + Context Builder (Agent Operating System)

**Sistema de Skills:**
- Nova tabela `agent_skills` no SQLite — skills com título, descrição, categoria, gatilhos, conteúdo e exemplos
- `SkillsService` em `packages/core/src/skills/` — CRUD completo, busca por LIKE, detecção por gatilhos (`matchTriggers`)
- IPC handlers: `skills:list`, `skills:get`, `skills:create`, `skills:update`, `skills:delete`, `skills:search`, `skills:match`, `skills:incrementUsage`
- **SkillsPage** (`/skills`) — lista, busca, criação, edição e exclusão de skills com UI dark

**Integração Squad:**
- Badge de skills pré-tarefa: quando o input do usuário dispara gatilhos de uma skill, exibe chips `⚡ NomeSkill` acima do textarea
- Banner pós-pipeline: após pipeline concluído, pergunta "Deseja salvar esta solução como uma Skill reutilizável?" com botão de salvar automático
- Detecção debounced (600ms) para não sobrecarregar

**Context Builder:**
- `ContextBuilder` em `packages/core/src/context/` — monta contexto priorizado: KB global → Skills por gatilho
- IPC `context:build` retorna `{ text, knowledgeCount, skillCount }` com budget de 12.000 chars
- IPC `search:global` retorna `{ knowledge, skills }` com busca unificada

**Banco de dados:**
- Novos campos em `knowledge_entries`: `source`, `projectId`, `relevanceScore`, `autoGenerated`, `usageCount`
- Nova tabela `agent_tasks` para rastreamento de tarefas por agente (futuro)
- Migrações incrementais aplicadas ao inicializar o banco

**Navegação:**
- Item "Skills" adicionado ao sidebar com ícone `BookOpenCheck`
- Rota `/skills` registrada no App.tsx

---

## [3.34.0] — 2026-06-13

### Corrigido — Pipeline completava prematuramente sem fazer nada

**Problema:** Pipeline percorria todas as fases (Planejar → Implementar → Revisar → Testar → PR) em segundos sem que nenhum agente executasse trabalho real no projeto.

**Causa raiz 1 — `runAgentUntilDone` saía quando agente respondia com texto:**
- Quando Friday recebia os resultados de um READ_DIR e respondia com um plano em texto (sem ACTION tags), a função quebrava o loop com `if (!lastBubble.actions?.length) break`
- O pipeline imediatamente avançava para Reviewer mesmo com nenhum arquivo criado
- **Fix:** Ao invés de sair, envia um prompt de push `⚠️ EXECUTE AGORA — nenhuma ACTION foi emitida` com formato explícito, idêntico ao mecanismo do `autonomousLoop`. Máximo de 3 pushes consecutivos sem ação antes de desistir. Tracker `lastSeenId` previne loop infinito se agente não responder.

**Causa raiz 2 — Jarvis e Reviewer chamados com `depth=0`:**
- `depth=0` ativa auto-delegação ao final da stream — se Jarvis ou Reviewer mencionassem outro agente no texto, a delegação automática disparava Friday/Tester paralelamente ao pipeline, criando conflito
- **Fix:** Ambos agora chamados com `depth=1` no pipeline (sem auto-delegação). Mensagem do Jarvis inclui instrução explícita "NÃO use ACTION tags" durante a fase de planejamento.

---

## [3.33.0] — 2026-06-13

### Adicionado — Pipeline de agentes autônomo + Reviewer + DevOps

**2 novos agentes:**
- **Reviewer** (`🔎`) — revisa código com `READ_FILE`, avalia bugs/segurança (OWASP), emite `[APROVADO]` ou `[BLOQUEADO]`
- **DevOps** (`🚀`) — cria commits (Conventional Commits), `git push`, abre PR com template Markdown

**Modo Pipeline:**
- Botão "Pipeline" no header — orquestra ciclo completo automaticamente ao receber uma tarefa
- Stepper visual de fases: `🎯 Planejar → 👩‍💻 Implementar → 🔎 Revisar → 🧪 Testar → 🚀 PR → ✅ Pronto`
- Se Reviewer emite `[BLOQUEADO]`, Friday corrige automaticamente antes de avançar para testes
- Indicador de fase ativa no header durante execução

---

## [3.32.0] — 2026-06-14

### Corrigido — Agentes não progrediam: 3 causas raiz resolvidas

**Diagnóstico:** logs do SQLite (`cwm.db`) analisados — 64 mensagens da sessão revelaram 3 bugs críticos

**Bug 1 (CRÍTICO) — Resultados das ações fora do histórico de conversa**
- `streamAgent` passava o resultado como `message` para a API (correto para a iteração atual), mas nunca adicionava ao `bubblesRef` como bubble
- Na próxima iteração, o `history` reconstruído do `bubblesRef` não incluía o resultado → histórico com mensagens consecutivas do assistente sem user turn entre elas → agentes sem contexto do que aconteceu
- **Fix:** antes de chamar `streamAgent(agent, result, ...)` em `autonomousLoop` e `autoExecRound`, o resultado é adicionado como bubble oculto (`type:'user', isActionResult:true`) e salvo no DB com `role:'result'`
- `streamAgent` recebe `excludeFromHistoryId` para evitar duplicação na API call atual, mas preserva o bubble para iterações futuras
- `handleSend` também passa o ID do bubble do usuário como `excludeFromHistoryId`
- `loadSession` mapeia `role:'result'` → `{ type:'user', isActionResult:true }` para restaurar contexto ao reabrir sessão
- Chat UI filtra `isActionResult:true` (invisível para o usuário, só existe para o histórico do LLM)

**Bug 2 (CRÍTICO) — `next dev` / `npm start` nunca terminavam**
- SHELL action com `npx next dev` nunca saía → watchdog de 90s matava → agente recebia "Timeout" e travava
- **Fix:** `handlers.ts` detecta comandos de servidor (`next dev`, `vite dev`, `npm run dev`, etc.) e usa lógica especial: captura os primeiros 8s de output, mata o processo, retorna output + mensagem "Servidor iniciado em background — acesse http://localhost:PORT"
- O servidor CONTINUA rodando em background até a app fechar

**Bug 3 — Agentes declaravam [PRONTO] sem evidência real**
- Shuri declarou "aplicação rodando em localhost" apenas após criar diretórios (nenhum servidor foi iniciado)
- **Fix:** `agents.ts` — adicionadas regras E9 (nunca [PRONTO] sem output REAL) e E10 (comportamento esperado de servidores em background)

- Versão: `3.31.0` → `3.32.0`

---

## [3.31.0] — 2026-06-13

### Corrigido — Travamentos + Agentes mais autônomos (soluções validadas pelo mercado)

**Investigação:** 4 causas raiz de travamento mapeadas além das já corrigidas

**Fix 1 — Watchdog para API provider no servidor (mesmo padrão do claude-code)**
- Streams de GPT/Anthropic/DeepSeek não tinham timeout — se a API parasse de responder, travava para sempre
- `handlers.ts`: watchdog de 90s por chunk adicionado ao path de API key (idêntico ao já existente para claude-code)

**Fix 2 — Watchdog no renderer (padrão Cursor: 60s por chunk no cliente)**
- Backup independente: se o evento `done` do IPC for perdido, o renderer auto-cancela após 90s sem chunks
- `lastChunkAtRef` atualizado a cada chunk recebido; `setInterval` de 15s verifica inatividade

**Fix 3 — Chunk batching (padrão VS Code Copilot: atualização de estado em batch)**
- Cada chunk do LLM causava um `setState` individual → centenas de re-renders por segundo em respostas grandes
- Buffer acumula deltas por `bubbleId` e aplica em batch a cada 80ms → UI significativamente mais fluida

**Fix 4 — Cancel signal em `executeActionsAuto` (padrão Devin: cancel por ferramenta)**
- Clicar ✕ não interrompia ações já em execução na fila (READ_FILE, WRITE_FILE, SHELL em sequência)
- Agora verifica `stopRequestedRef` antes de cada ação individual

**Fix 5 — Agentes mais proativos: recovery de erros explícito (padrão Aider)**
- `buildErrorHint()`: analisa o output de erro e injeta dica de correção específica para ENOENT, npm peers, robocopy, timeout, permissão negada
- Feedback reformatado: `❌ ERRO — LEIA E CORRIJA` com instrução obrigatória de não repetir o mesmo comando
- `EXECUTOR_RULES` em `agents.ts`: 8 regras de recovery (E1-E8) com correções concretas por tipo de erro

- Versão: `3.30.0` → `3.31.0`

---

## [3.30.0] — 2026-06-13

### Adicionado — Configurações: botão "Limpar histórico do Squad"

- Nova seção "Squad" na página de Configurações
- Botão **Limpar histórico do Squad** apaga todas as sessões e mensagens do Squad (`DELETE FROM squad_sessions` + `DELETE FROM squad_messages`) via confirmação
- Novo IPC handler `squad:session:clearAll` no main process
- Versão: `3.29.0` → `3.30.0`

---

## [3.29.0] — 2026-06-13

### Corrigido — Squad: tela travada na Friday e agentes usando provider errado

**Bug 1 (causa raiz do travamento na Friday): `ResponseStreamer.cancel()` nunca enviava `done`**
- Quando `squadSvc.cancelStream(streamId)` era chamado, o `AbortController` abortava o fetch mas **nunca enviava `{ type: 'done' }` para o renderer**
- O renderer esperava o evento `done` para chamar `resolve()` — sem ele, `await streamAgent(...)` ficava preso para sempre
- Fix em `response-streamer.ts`: salva o callback `sendDone` junto com o controller; `cancel()` agora chama `entry.sendDone()` após abortar

**Bug 2: agentes usando provider hardcoded, ignorando configuração do usuário**
- Friday usava `openai`, Fury usava `gemini`, Tester usava `openai` — mesmo que o usuário só tivesse `anthropic` configurado nas Settings
- Fix em `handlers.ts`: provider resolution agora prioriza o **isDefault** habilitado nas Settings; `preferredProvider` do agente é último recurso

- Versão: `3.28.0` → `3.29.0`

---

## [3.28.0] — 2026-06-12

### Corrigido — 3 bugs que causavam tela travada no modo autônomo

**Bug 1 (crítico): `autonomousLoop` resetava o flag de cancel**
- `autonomousLoop` chamava `stopRequestedRef.current = false` ao iniciar — apagava o cancel do usuário se clicasse ✕ durante o `streamAgent` inicial
- Fix: removido o reset interno; adicionado `if (stopRequestedRef.current) return` logo no início

**Bug 2: `activeStreamId` era React state com leitura stale**
- `cancelStream()` e `stopAutonomous()` liam `activeStreamId` via closure — se o usuário clicasse ✕ antes da re-render confirmar o novo stream ID, o cancel não ocorria
- Fix: adicionado `activeStreamIdRef` (useRef) atualizado sincronicamente; cancel usa `activeStreamIdRef.current ?? activeStreamId`

**Bug 3: loop de delegação ignorava cancel**
- Ao delegar entre agentes (depth=0), o loop não verificava `stopRequestedRef`
- Fix: adicionado `if (stopRequestedRef.current) break` antes de cada delegação

- Versão: `3.27.0` → `3.28.0`

---

## [3.27.0] — 2026-06-12

### Corrigido — Squad: botão ✕ agora para realmente o autoExecRound

**Raiz do problema:**
- `autoExecRound` tem um loop de até 20 rodadas mas nunca verificava `stopRequestedRef` — ao clicar ✕, o stream atual era cancelado mas o loop JS reiniciava um novo stream imediatamente, deixando a tela presa indefinidamente
- `cancelStream()` não setava `stopRequestedRef.current = true` (apenas `stopAutonomous()` fazia isso), então o flag que os loops usam para parar nunca era ativado ao clicar ✕ no modo Exec auto

**Fixes:**
- `cancelStream()` agora seta `stopRequestedRef.current = true` — unifica comportamento com `stopAutonomous()`
- `autoExecRound`: verifica `stopRequestedRef.current` **antes de cada rodada** e **após `executeActionsAuto`** — para imediatamente quando o usuário cancela, mesmo no meio de uma execução
- `handleSend`: reseta `stopRequestedRef.current = false` ao enviar nova mensagem — sem esse reset, clicar ✕ uma vez bloquearia todos os loops seguintes permanentemente
- Versão: `3.26.0` → `3.27.0`

---

## [3.26.0] — 2026-06-12

### Corrigido — Squad + AI Hub: stream congelado + cancelamento que não funcionava

**Watchdog de timeout (Squad e AI Hub):**
- Sem timeout, o processo `claude` CLI podia travar indefinidamente → UI congelada por 15+ minutos sem forma de sair
- Agora: verificação a cada 15s — se nenhum chunk chegar em **90 segundos**, o processo é morto e uma mensagem de erro é exibida no chat: `⏱ Timeout: claude CLI não respondeu em 90s`
- `lastChunkAt` resetado a cada chunk recebido (evita falsos positivos em respostas lentas mas contínuas)
- `clearInterval(watchdog)` chamado em `sendErr` e `sendDone` — sem timer órfão

**Cancelamento real do processo (Squad):**
- `squad:stream:cancel` chamava apenas `squadSvc.cancelStream(streamId)` que não tem efeito no subprocesso do Claude Code
- Fix: mesma lógica de `ai:stream:cancel` — verifica `claudeProcs.get(streamId)` primeiro; se encontrar, mata o processo (`proc.kill()`) e remove do mapa; senão cai para `squadSvc.cancelStream()`
- O botão ✕ no chat agora realmente encerra o CLI em vez de deixá-lo rodando em segundo plano
- Versão: `3.25.0` → `3.26.0`

---

## [3.25.0] — 2026-06-12

### Melhorado — IDE: tecnologia VS Code Phase 1 + Squad: robocopy robusto

**Semantic Highlighting (Monaco + TypeScript worker):**
- `monacoSetup.ts` reescrito: workers locais configurados (offline/Electron); TypeScript language service via type cast (`MonacoTsDefaults`/`MonacoTsLang`) — contorna `monaco.languages.typescript` tipado como `{ deprecated: true }` no Monaco 0.55 sem `@ts-ignore`
- Compiler options completos: ESNext, JSX ReactJSX, allowJs, esModuleInterop, strict: false
- **Inlay hints** — dicas de tipo inline idênticas ao VS Code: nomes de parâmetros, tipos de retorno, declarações de propriedade, valores de enum; via `setInlayHintsOptions` com optional chaining
- `'semanticHighlighting.enabled': true` nos editor options — Monaco usa o TypeScript worker para coloração semântica além da sintática

**Breadcrumbs bar (acima do Monaco Editor):**
- Barra fina `bg-[#161b22]` mostrando últimos 4 segmentos do caminho do arquivo ativo
- Símbolo atual (função/classe/variável sob o cursor) exibido em roxo `text-brand-500`; atualizado em tempo real via `editor.onDidChangeCursorPosition`
- `outlineRef = useRef<OutlineSymbol[]>([])` sincronizado via `useEffect` — evita closure stale no handler de cursor registrado uma vez no mount

**Outline View (painel esquerdo — aba "Outline"):**
- Nova aba "Outline" (`List` icon) no painel esquerdo, sempre visível (local e remoto)
- TypeScript/JS: `getTypeScriptWorker()` → `getNavigationBarItems(fileName)` → `NavigationBarItem[]` convertido para `OutlineSymbol[]` com hierarquia (classes → métodos) e kind-to-icon mapping
- Outras linguagens: regex fallback para classes, funções, variáveis em Python, Ruby, PHP etc.
- `OutlineTree` component: ícones coloridos por tipo (◆ classe, ⊕ método, ƒ função, ◎ variável…); entrada ativa realçada; clique navega com `revealLineInCenter`
- Auto-refresh: `useEffect` com debounce 450ms ao trocar arquivo; botão manual de refresh

**Squad: robocopy `/XD node_modules` (fix freeze crítico):**
- Robocopy copiando `node_modules` travava o app por 10+ minutos (30k+ arquivos)
- `handlers.ts` e `agents.ts` EXECUTOR_RULES regra 9 atualizados: `/XD node_modules .next` obrigatório; `npm install --prefix "<destino>"` após robocopy; timeout de `robocopy` adicionado ao regex de 600s
- Regra explícita: "NUNCA copie node_modules com robocopy"
- Versão: `3.24.0` → `3.25.0`

---

## [3.22.0] — 2026-06-12

### Adicionado — IDE: badges git na SFTP tree + Squad: painel arquivos modificados

**IDEPage: badges git estilo VS Code na SFTP tree:**
- `gitFileMap` (Map<path, {letter, color}>) e `dirtyDirSet` (Set de prefixos de pastas sujas) via `useMemo`
- Nome do arquivo colorido com `gitInfo.color`; badge letra (M/A/D/?) à direita; ponto âmbar para pastas com filhos sujos
- Auto-load git status quando tree carrega pela primeira vez

**SquadPage: painel "Arquivos modificados" estilo VS Code Explorer:**
- Ícone `FileCheck2` colorido por extensão (ts/tsx/js/py/json/css…), nome em negrito, path pai em `text-slate-600`, badge 'W' verde
- Paleta `extColor` com 12 extensões mapeadas
- Versão: `3.21.0` → `3.22.0`

---

## [3.21.0] — 2026-06-12

### Adicionado — Squad: parser 2-pass + staging seguro + monitoramento de atividade

**Parser de ACTION 2 passes:**
- Pass 1: regex `\[\/ACTION\]?` — aceita fechamento sem `]` final
- Pass 2: lookahead `(?=\[ACTION:|$)` captura blocos truncados antes de `[/ACTION`
- `Set<number>` evita duplicatas; `makeBlock`/`extractParams` extraídos como funções auxiliares
- `stripActions` atualizado para limpar ambas as formas

**Staging seguro:**
- `EXECUTOR_RULES` regra 9: usa `C:\Temp\squad-scaffold` como staging fixo (sem variáveis de ambiente); OneDrive bloqueia scaffolds em pastas sincronizadas

**Painel de monitoramento de atividade:**
- Interfaces `ActivityEntry` e `SessionStats`; refs para evitar closures stale
- `pushActivity`/`updateActivity`/`clearActivity` instrumentados em `executeAction` e `executeActionsAuto`
- Painel direito: tab Atividade com stats bar (R/W/⚡/✗), arquivos modificados, log com status e duração
- Versão: `3.20.0` → `3.21.0`

---

## [3.20.0] — 2026-06-12

### Adicionado — Squad: regras npm corretas para Friday

- `EXECUTOR_RULES` regra 8: nomes npm sempre lowercase; `--ts` em vez de `--typescript`; aspas em `--import-alias "@/*"`; `npx --yes` para evitar prompt interativo
- Versão: `3.19.0` → `3.20.0`

---

## [3.19.0] — 2026-06-12

### Corrigido — Squad: parser robusto + Exec auto com feedback + fluxo de leitura Jarvis

**Parser de ACTION tolerante a tags malformadas:**
- `parseActions`: regex primário aceita `[/ACTION` sem `]` final; segundo passo captura tags sem nenhum fechamento (truncamento do modelo)
- `stripActions`: remove ambas as formas malformadas do texto exibido

**Exec auto com feedback real (autoExecRound):**
- Antes: executava as ações mas não enviava os resultados ao agente → agente repetia a mesma ação em loop
- Agora: `autoExecRound()` — executa actions → envia `[RESULTADO DAS AÇÕES]` ao root agent → recebe nova resposta → se houver novas actions, repete (até 6 rodadas por mensagem)
- `handleSend`: chama `autoExecRound(sid)` quando Exec auto está ON e modo autônomo está OFF

**Fluxo de leitura obrigatório para Jarvis:**
- `JARVIS_ACTION_INSTRUCTIONS` reescrito com fluxo a/b/c: READ_DIR → READ_FILE (um por resposta) → delegação
- Regra explícita: nunca misturar ação + texto de delegação na mesma resposta
- Regra explícita: nunca repetir ação já executada
- Versão: `3.18.0` → `3.19.0`

---

## [3.18.0] — 2026-06-12

### Corrigido — Jarvis somente leitura + Exec auto no Squad

**Jarvis restrito a leitura (fix comportamento incorreto):**
- `JARVIS_ACTION_INSTRUCTIONS` separado em `packages/core/src/squad/agents.ts` — Jarvis só pode usar `READ_DIR` e `READ_FILE`
- SHELL e WRITE_FILE **removidos** do arsenal do Jarvis; essas ações pertencem exclusivamente a `@friday`, `@tester` e agentes executores
- System prompt reforçado: "VOCÊ NÃO ESCREVE CÓDIGO, NÃO EXECUTA COMANDOS, NÃO CRIA ARQUIVOS. Esse trabalho pertence a @friday."
- Jarvis agora lê contexto (README, CURRENT_STATE) e delega imediatamente — não implementa nada diretamente

**Toggle "Exec auto" — execução automática de actions:**
- Novo botão **"Exec auto"** (ícone Zap, cor âmbar) no cabeçalho do chat ao lado do botão "Auto"
- **Padrão ON** — ativo por padrão em todas as sessões novas
- Persistência via `localStorage['squad_auto_execute']`
- Quando ON (sem modo autônomo): após cada resposta do agente, as actions geradas são executadas automaticamente via `executeActionsAuto` — sem precisar clicar em "Executar" por bloco
- Quando ON + modo autônomo: comportamento do loop autônomo original (sem mudança)
- Quando OFF: comportamento anterior — clicar "Executar" manualmente em cada action
- Versão: `3.17.0` → `3.18.0`

---

## [3.17.0] — 2026-06-11

### Adicionado — KB Global do Desenvolvedor + Rebrand NEX-ALS Dark Luxury

**Base de Conhecimento Global (KB Global) — SQLite + IPC:**
- Novo modelo `KnowledgeEntry` no schema Prisma (`knowledge_entries`): `id`, `title`, `content`, `category` (8 categorias), `tags`, `isActive`, `createdAt`, `updatedAt`
- `KnowledgeService` em `packages/core/src/knowledge/knowledge.service.ts` com `list()`, `listActive()`, `create()`, `update()`, `delete()` e `buildContext()` (formata por categoria em markdown)
- 5 IPC handlers em `handlers.ts`: `knowledge:list`, `knowledge:create`, `knowledge:update`, `knowledge:delete`, `knowledge:context`
- Preload e `ipc.ts` atualizados com namespace `knowledge.*`
- **Injeção automática em Squad e AI HUB**: `buildContext()` chamado antes de cada stream start — KB injetada no topo do system prompt de todos os agentes e do AI HUB sem necessidade de modificar cada agente individualmente
- `KNOWLEDGE_CATEGORIES`, `KnowledgeEntrySchema`, `KnowledgeEntry`, `KnowledgeEntryInput` exportados de `@cwm/config`

**Página Conhecimento (KnowledgePage.tsx):**
- CRUD completo: busca full-text, filtro por categoria (8 cores distintas), toggle ativo/inativo, edição inline, formulário lateral para novos itens
- Suporte a tags separadas por vírgula
- Rota `/knowledge` adicionada ao App.tsx e sidebar

**Rebrand NEX-ALS Dark Luxury:**
- Paleta oficial: `#080612` (fundo), `#0D0A24` (card), `#D9A441`/`#F2C879` (dourado), `#B78DFF` (roxo)
- `tailwind.config.ts` reescrito: override do `slate` com cores NEX-ALS, namespace `brand` (dourado), namespace `nex` (purple/gold/bg/card/border), sombras e gradientes customizados
- `index.css` reescrito: Inter via Google Fonts, CSS custom properties `--nex-*`, scrollbar dourada, componentes `.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.input`, `.glass`, `.badge-gold`, utilitários `text-gold`, `glow-gold`, `glow-purple`
- `Layout.tsx` redesenhado: sidebar gradiente escuro, faixa dourada à esquerda, logo `logo-nexals.png` com fallback `⬡`, nome "NEX-ALS IDE" dourado, tagline "Intelligence", botões AI HUB (roxo) e SQUAD (dourado) com glow no hover, nav items com borda dourada ativa, footer com versão dourada
- Versão: `3.16.1` → `3.17.0`

---

## [3.16.1] — 2026-06-11

### Adicionado — Squad: Sincronizar KB, iterações configuráveis, relatório final

**Sincronizar KB do projeto (Task 1):**
- Botão "Sincronizar" na Base de Conhecimento (aparece quando há pasta local selecionada)
- Lê automaticamente: `README.md` → seção Projeto; `docs/CURRENT_STATE.md` ou `CURRENT_STATE.md` → Status atual; `docs/TASKS.md` → appenda no Status; `docs/ARCHITECTURE.md` ou `ARCHITECTURE.md` → Estrutura de arquivos
- Ícone giratório durante carregamento; ignora arquivos ausentes silenciosamente
- Trunca conteúdo em 3000 chars por seção

**Iterações configuráveis (Task 3):**
- Input numérico (5–200) aparece ao lado do botão "Auto" quando modo autônomo está ativo
- Valor padrão: 30; persiste no estado da sessão
- `maxAutoIterRef` garante que o valor correto é usado mesmo dentro de loops async

**Relatório final do ciclo (Task 2):**
- Bubble de sistema ao fim de cada ciclo autônomo: N iterações · arquivos criados · leituras · comandos · erros
- Exibido para qualquer razão de parada (concluído, limite atingido, sem ações)
- Versão: `3.16.0` → `3.16.1`

---

## [3.16.0] — 2026-06-11

### Melhorado — Squad: KB por projeto + delegação autônoma corrigida

**Base de Conhecimento por projeto:**
- KB agora é isolada por projeto: cada `localPath` tem seu próprio slot no localStorage (`squad_knowledge_bases`)
- Ao trocar de pasta (localPath), a KB carrega automaticamente o contexto daquele projeto
- Badge com nome da pasta ativa exibido no cabeçalho da KB
- Sem localPath selecionado → usa slot global `__global__`

**Delegação autônoma corrigida:**
- `rootAgentRef` agora armazena o agente que iniciou a sessão (ex: Jarvis)
- Após qualquer ação executada (mesmo de agente delegado), o resultado SEMPRE retorna ao agente raiz
- Quando agente delegado finaliza sem ações → mensagem de síntese enviada ao agente raiz ao invés de parar o loop
- O orquestrador (Jarvis) permanece no controle durante todo o ciclo autônomo
- Versão: `3.15.9` → `3.16.0`

---

## [3.15.9] — 2026-06-11

### Adicionado — Squad: Base de Conhecimento estruturada

- **"Contexto do Projeto" substituído por "Base de Conhecimento"** — painel com 8 seções estruturadas em accordion:
  - Projeto, Stack, Estrutura de arquivos, Status atual, Convenções, Regras do squad, Habilidades dos agentes, Notas técnicas
- **Templates prontos** — 3 templates pré-preenchidos com um clique: Next.js SaaS, Node.js API, React + Vite
- **Persistência em localStorage** — base de conhecimento salva entre sessões (sem banco, sem sync)
- **Indicador visual por seção** — ponto violeta se a seção tem conteúdo; badge "ativo" verde no cabeçalho
- **Anti-loop por design** — seção "Status atual" e "Estrutura de arquivos" eliminam a necessidade dos agentes explorarem o projeto do zero a cada iteração
- **Seção "Habilidades dos agentes"** — instruções por agente (ex: "Jarvis: lê CURRENT_STATE.md primeiro") injetadas no system prompt
- Versão: `3.15.8` → `3.15.9`

---

## [3.15.8] — 2026-06-11

### Corrigido — Squad modo autônomo: READ_DIR + anti-loop

- **`read_dir` como action type** — agentes agora podem usar `[ACTION:READ_DIR path="..."][/ACTION]` para listar o conteúdo de uma pasta antes de tentar ler arquivos específicos
- **Auto-detecção de diretório em `read_file`** — se o agente chamar `READ_FILE` em um caminho que é uma pasta, o sistema detecta automaticamente via `fs.stat` e lista o conteúdo ao invés de retornar erro
- **Instruções do modo autônomo melhoradas** — adicionadas regras anti-loop: PROIBIDO reler arquivos já no histórico; cada iteração deve produzir progresso concreto; SHELL só aceita comandos reais
- **`READ_DIR` no system prompt** — instruções de execução local e modo autônomo agora ensinam o agente a usar `READ_DIR` para explorar a estrutura antes de READ_FILE
- **`ACTION_INSTRUCTIONS` adicionadas a Jarvis e Shuri** — esses agentes também podem executar ações de leitura/escrita agora
- Versão: `3.15.7` → `3.15.8`

---

## [3.15.7] — 2026-06-11

### Adicionado — Squad: botão "Conta Claude" com modal de uso

- Novo botão 👤 no cabeçalho do painel "Histórico" (lado direito do Squad)
- Abre modal **Conta Claude** com:
  - Email e plano lidos do `.credentials.json` da conta ativa
  - Botão "Atualizar" para recarregar os dados
  - Botão "Abrir claude.ai" que abre `claude.ai/settings` no navegador padrão (via `shell.openExternal`)
- Handler IPC `claude:usage` no main process: lê conta ativa do banco → lê credentials → tenta buscar dados adicionais via `claude.ai/api/bootstrap` com o token OAuth
- Handler IPC `shell:openExternal` com allowlist de domínios permitidos (`claude.ai`, `anthropic.com`)
- Versão: `3.15.6` → `3.15.7`

---

## [3.15.2] — 2026-06-11

### Corrigido — Squad/AI HUB: "Erro ao processar resposta" com Claude Code

- **Causa raiz**: a regex `/authentication/i` no handler de stderr do claude CLI correspondia a mensagens de progresso legítimas (ex: "Initializing authentication context…"), fazendo o processo ser morto antes de produzir qualquer resposta
- **Fix em `ai:stream:start` e `squad:stream:start`** — stderr é agora acumulado em buffer; o erro só é enviado ao renderer **após** o processo fechar com código != 0 **e sem nenhum output em stdout
- Se houve stdout (resposta parcial), envia `done` normalmente
- Mensagem de erro exibe o conteúdo real do stderr (até 200 chars) para facilitar diagnóstico
- Regex de auth refinada: `/not logged in|session expired|please log in|unauthorized/i` (sem `authentication` isolado)

### Adicionado — Squad: botão excluir conversa

- Botão 🗑 aparece ao passar o mouse sobre qualquer sessão no painel "Histórico" (lado direito)
- Clique exclui a sessão do banco e remove da lista; se era a sessão ativa, limpa o chat
- Não interfere com o clique principal (carregar sessão) graças a `stopPropagation`
- Desabilitado durante streaming para evitar conflitos

---

## [3.15.1] — 2026-06-11

### Adicionado — Testes E2E Playwright para página Squad

- Novo arquivo `e2e/tests/05-squad.spec.ts` com **14 testes** cobrindo a SquadPage fullscreen
- **Navegação** — botão SQUAD na sidebar navega para a página Squad (sem Layout)
- **Painel de agentes** — verifica presença dos 8 agentes (Jarvis, Friday, Fury, Shuri, Pepper, Vision, Requis, Tester)
- **Agente ativo** — header mostra Jarvis por padrão; troca de agente atualiza o `h2` do header
- **Chat vazio** — mensagem placeholder "Selecione um agente e envie sua mensagem" visível
- **Input e botão enviar** — textarea visível com placeholder correto; botão Send desabilitado quando vazio e habilitado ao digitar
- **Nova sessão** — botão visível e funcional; reinicia o chat
- **Toggle Execução** — botões VPS e Local visíveis; modo Local exibe campo de pasta
- **Contexto do Projeto** — painel collapsível; textarea aparece ao abrir; indicador verde "Contexto ativo" ao preencher
- **Histórico** — mensagem "Nenhuma sessão ainda." em DB limpo
- **Botão Voltar** — navega de volta ao Dashboard (Layout com `<main>`)

---

## [3.15.0] — 2026-06-10

### Corrigido — Claude Code: continuidade de conversa restaurada

- **`ai:stream:start` e `squad:stream:start`** — prompt com histórico da conversa agora é passado via **stdin** ao processo `claude -p` em vez de argumento CLI
- Antes: `spawn('claude', ['-p', prompt, ...], { shell: true })` — qualquer caractere especial no histórico (aspas, backticks, barras, newlines de blocos de código) era corrompido pelo shell do Windows, fazendo o Claude receber um prompt mutilado e responder sem contexto
- Após o fix: `spawn('claude', ['-p', ...], { shell: false })` + `proc.stdin.write(prompt)` — o conteúdo chega intacto independente de qualquer caractere especial
- DeepSeek e outros providers via API não eram afetados (histórico trafegava em JSON HTTP)

---

## [3.14.0] — 2026-06-10

### Adicionado — Squad: Contexto de Projeto + Execução Local

#### Contexto do Projeto
- Novo campo "Contexto do Projeto" (collapsível) no painel direito do Squad
- Cole README, arquitetura, stack técnica ou qualquer descrição do projeto
- Todos os agentes da sessão recebem esse contexto automaticamente no system prompt
- Indicador verde mostra quando o contexto está ativo (com contagem de caracteres)

#### Execução Local (sem VPS)
- Toggle **VPS / Local** no painel direito do Squad (seção "Execução")
- Modo Local: ações SHELL, READ_FILE e WRITE_FILE rodam no PC local via `child_process` / `node:fs` — sem precisar de VPS
- Botão "Selecionar pasta" abre dialog nativo para escolher a pasta de trabalho (ex: OneDrive/projeto)
- O `cwd` padrão das ações SHELL é a pasta selecionada; `path` em READ/WRITE usa o caminho absoluto do ACTION tag
- `vpsId: '__local__'` como sentinel — detectado no handler `squad:action:execute` para rotear para execução local

---

## [3.13.0] — 2026-06-10

### Corrigido — Autenticação real de contas Claude Code + comando PowerShell

- `claude:accounts:check` agora verifica existência de `.credentials.json` / `credentials.json` no `configDir` em vez de usar `--version` (que sempre retornava OK independente do login)
- Contas não autenticadas mostram status âmbar e o comando correto para PowerShell: `$env:CLAUDE_CONFIG_DIR="..."; claude`
- Botão 📋 de cópia ao lado do comando — evita copiar texto extra acidentalmente
- Versão bumped para 3.13.0

---

## [3.12.0] — 2026-06-10

### Adicionado — Múltiplas contas Claude Code com alternância rápida

Suporte a N contas Claude Pro na mesma máquina. Cada conta tem seu próprio diretório de configuração isolado (`CLAUDE_CONFIG_DIR`). Trocar de conta é um clique — sem logout/login manual.

#### Como funciona
- Cada conta fica em `~/.claude-<nome>-<id>/` — completamente isolada
- O spawn do CLI recebe `CLAUDE_CONFIG_DIR=<dir>` no ambiente, apontando para a conta ativa
- `getActiveClaudeEnv()` — helper centralizado que resolve configDir da conta ativa e monta PATH correto; usado por `claude:check`, `ai:stream:start` e `squad:stream:start`
- Tabela `claude_code_accounts` no SQLite: `id`, `name`, `configDir`, `isActive`, `createdAt`

#### Fluxo para adicionar segunda conta
1. Configurações → Claude Code → **Adicionar conta** → digitar nome (ex: "Conta 2")
2. A IDE gera o `configDir` automaticamente e mostra o comando de autenticação
3. No terminal: `CLAUDE_CONFIG_DIR="<dir>" claude` → fazer login com a segunda conta
4. Clicar **Usar esta** para alternar — todos os streams (AI Hub, IDE chat, Squad) passam a usar a conta selecionada

#### Arquivos modificados
- `packages/db/src/index.ts` — tabela `claude_code_accounts`
- `apps/desktop/src/ipc/handlers.ts` — `getActiveClaudeEnv()`, handlers `claude:accounts:*`, spawns atualizados
- `apps/desktop/src/preload.ts` — novos canais autorizados
- `apps/web/src/lib/ipc.ts` — `ipc.claude.accounts.*`
- `apps/web/src/pages/SettingsPage.tsx` — `ClaudeCodeCard` redesenhado com lista de contas

---

## [3.11.0] — 2026-06-10

### Adicionado — Claude Code como provedor de conta (sem API Key)

Integração do Claude Code CLI instalado localmente como provedor de IA. Usa a conta Claude Pro do usuário via autenticação OAuth já existente no CLI — sem cobrar por token, sem precisar de API Key separada.

#### Como funciona
- O `ai:stream:start` detecta quando o provider é `claude-code` e roteia para um subprocess local em vez de chamar a API diretamente
- O subprocess executa `claude -p "<prompt>" --output-format text --no-color` e transmite stdout como chunks de streaming para o renderer
- O PATH do Electron é enriquecido com o diretório global do npm (`%APPDATA%\npm` no Windows) para garantir que o CLI seja encontrado
- Todo o AI Hub, IDE chat e Squad funcionam transparentemente com a conta Pro

#### Arquivos modificados
- `apps/desktop/src/ipc/handlers.ts`
  - `claudeProcs: Map` para rastrear subprocessos ativos
  - `ai:stream:start` — rota para subprocess quando `effectiveProvider === 'claude-code'`; detecta provider padrão no banco se não informado
  - `ai:stream:cancel` — cancela subprocess (`.kill()`) ou stream normal conforme o tipo
  - `claude:check` — detecta se `claude` CLI está instalado e autenticado; usa `spawn` com `shell: true` e PATH enriquecido
- `apps/desktop/src/preload.ts` — `claude:check` adicionado ao `ALLOWED_CHANNELS`
- `apps/web/src/lib/ipc.ts` — `ipc.claude.check()` adicionado
- `apps/web/src/pages/SettingsPage.tsx` — `ClaudeCodeCard`: detecta CLI, exibe versão e status, botão "Usar como padrão"

#### Instalação (uma vez)
```bash
npm install -g @anthropic-ai/claude-code
claude   # abre browser para login com conta Claude Pro
```

---

## [3.10.0] — 2026-06-10

### Adicionado — Squad: equipe de 8 agentes de IA com execução na VPS e Pipeline

#### Página Squad (`apps/web/src/pages/SquadPage.tsx`)
- 8 agentes especializados: Jarvis (PM/Claude), Friday (Dev/GPT), Fury (Pesquisa/Gemini), Shuri (UX/Claude), Pepper (Marketing/GPT), Vision (Growth/Gemini), Requis (Docs/Claude), Tester (QA/GPT)
- Chat com streaming em tempo real por agente; histórico de sessões persistido em SQLite
- Delegação automática: quando um agente menciona `@outro` na resposta, o segundo agente é invocado automaticamente (profundidade máxima 1, evita loops)
- Menção direta no input: `@friday implementa X` redireciona para Friday sem trocar o agente ativo manualmente
- Layout 3 painéis: lista de agentes (esquerda), chat central, configurações + histórico (direita)

#### Blocos de ação ACTION tags
- Friday e Tester podem gerar blocos executáveis: `SHELL`, `WRITE_FILE`, `READ_FILE`
- Botão "Executar" por bloco — executa via SSH/SFTP na VPS selecionada
- Resultado do comando aparece inline embaixo do bloco (verde = ok, vermelho = erro)
- Conteúdo ACTION é removido do texto da mensagem antes de exibir (fica só o bloco visual)

#### Modo Pipeline (homolog → confirmação → produção)
- Toggle "PIPELINE" no painel direito — ao ativar, exibe seletor de VPS de Produção
- Fluxo: Executar no Homolog → se OK, gate âmbar com botões Aprovar / Rejeitar → Aprovar executa em Prod
- Estados visuais do gate: âmbar (pendente), azul (executando), verde (concluído), vermelho (falha), cinza (rejeitado)
- Proteção: se o campo VPS Prod estiver vazio ("— VPS Prod —"), o Aprovar não executa nada

#### Infraestrutura
- `packages/core/src/squad/agents.ts` — personalidades, prompts e ACTION_INSTRUCTIONS dos 8 agentes
- `packages/core/src/squad/actions.ts` — `parseActions()` e `stripActions()` para processar ACTION tags
- `packages/core/src/squad/squad.service.ts` — serviço de streaming usando AiService existente
- `packages/db/src/index.ts` — tabelas `squad_sessions` e `squad_messages` criadas via DDL no `initializeDatabase()`
- `apps/desktop/src/ipc/handlers.ts` — handlers: `squad:session:*`, `squad:stream:*`, `squad:action:execute`
- `apps/desktop/src/preload.ts` — canais Squad adicionados ao `ALLOWED_CHANNELS`
- `apps/web/src/lib/ipc.ts` — namespace `ipc.squad.*` no renderer; guard null para `window.electron`
- `apps/desktop/src/main.ts` — `setupCSP()` movida para `if (app.isPackaged)` (dev mode sem bloqueio de scripts Vite)
- `apps/web/src/App.tsx` — `ErrorBoundary` adicionado para capturar erros de render sem crashar o app

#### Documentação
- `docs/GUIA_INICIANTE.md` — seção Squad adicionada: agentes, blocos de ação, Pipeline, glossário expandido

---

## [3.9.0] — 2026-06-04

### Adicionado — Melhorias incrementais no IDE

- **Rename inline com F2** — clicar em qualquer entrada no explorador a seleciona (highlight azul); pressionar `F2` abre o input de renomeação inline diretamente, sem precisar do menu de contexto. `Enter` confirma, `Esc` cancela. `selectedEntryRef` + `selectedPath` state; atualiza `onContextMenu` também.
- **Ctrl+Shift+T — Reabrir aba fechada** — `closeTab` empurra o arquivo removido para `closedTabsRef` (stack, máx 15 entradas, preserva conteúdo e estado `savedContent`). `Ctrl+Shift+T` no teclado faz pop do topo e reabre a aba; não reabre se o mesmo caminho já está aberto.
- **Busca em arquivos no Modo Local** — `handleSearch` agora funciona sem VPS: usa `ipc.local.exec('rg ... || findstr ...')` no diretório raiz da pasta aberta; ripgrep prioritário (mais rápido), findstr como fallback Windows; resultados normalizados para caminhos absolutos; display no painel mostra caminho relativo à raiz local. Guard `!vpsId` removido.
- **Diffview no Modo Local** — `handleLocalDiff` roda `git diff -- "<filePath>"` via `ipc.local.exec`; exibe no diff viewer Monaco (mesmo componente do modo VPS) com label relativo à raiz; toast quando sem alterações; botão **Diff** (ícone `GitCommit`) aparece no top bar do IDE quando em modo local e um arquivo está aberto.

---

## [3.8.0] — 2026-06-04

### Adicionado — Autenticação interna multi-usuário

- **`bcryptjs`** adicionado como dependência de `@cwm/core` (hash/verify de senha, puro JS, sem binários nativos)
- **Tabela `app_users`** no SQLite — `id`, `username` (UNIQUE), `passwordHash`, `role` (`admin`|`viewer`), `createdAt`, `updatedAt`; criada por DDL no `initializeDatabase()` existente (não quebra instalações sem usuários)
- **`AuthService`** em `packages/core/src/auth/auth.service.ts` — `createUser`, `validatePassword` (bcrypt compare), `listUsers`, `deleteUser`, `changePassword`, `countUsers`
- **IPC `auth:*`** (8 canais) — `auth:status`, `auth:setup`, `auth:login`, `auth:logout`, `auth:currentUser`, `auth:users:list`, `auth:users:create`, `auth:users:delete`, `auth:users:changePassword`
- **Sessão em memória** no main process (`handlers.ts`) — `session: AppUser | null`; `sessionRequired` inicializado assincronamente a partir do `countUsers()`
- **Modo backward-compat** — instalações sem usuários continuam funcionando sem login; auth é exigido apenas quando `sessionRequired = true` (ao menos 1 usuário no banco)
- **Guards de permissão** — `requireAdmin()` + `requireAuth()` nas operações mutantes: `vps:create/update/delete`, `projects:create/update/delete`, `accounts:create/update/delete`, `settings:update`, `config:export/import`, `notifications:setEnabled`
- **`AuthContext`** — `AuthProvider` + `useAuth()` hook; `auth:status` no mount; `login`, `logout`, `setup`, `refresh`
- **`SetupPage`** — wizard de primeiro uso; cria a conta admin; mostrada quando `needsSetup=true`
- **`LoginPage`** — formulário username + senha; botão show/hide; mostrada quando `sessionRequired && !user`
- **`App.tsx`** refatorado — `AuthProvider` envolve tudo; `AppRoutes` decide entre Setup/Login/app normal baseado no estado do `AuthContext`; spinner durante loading
- **Sidebar (`Layout.tsx`)** — card com avatar, username, role (`Administrador`/`Visualizador`), botão logout (LogOut icon); só visível quando `sessionRequired`
- **Seção "Usuários" em Configurações** — visível apenas para admins; lista usuários com role badge (`ShieldCheck`/`Shield`); botão excluir (bloqueia excluir a si mesmo); formulário criar novo usuário (username + senha + role)

---

## [3.7.0] — 2026-06-04

### Adicionado — LSP multi-linguagem (IDE-22)

- **`apps/web/src/lib/lsp.ts` refatorado** — suporta 4 language servers simultaneamente via WebSocket tunnel:
  - **TypeScript/JavaScript** — porta 6009 (`typescript-language-server`) — existente, sem alteração funcional
  - **Python** — porta 6010 (`pylsp` — `pip install python-lsp-server`)
  - **Rust** — porta 6011 (`rust-analyzer` — `rustup component add rust-analyzer`)
  - **Go** — porta 6012 (`gopls` — `go install golang.org/x/tools/gopls@latest`)
- **`LSP_CONFIGS`** — mapa exportado com `port`, `label`, `name`, `documentSelector` por linguagem
- **`monacoLangToLspKey(monacoLang)`** — helper que converte ID Monaco (`typescript`, `python`, `rust`, `go`) para chave LSP
- **`disconnectAllLSP()`** — desconecta todos os clientes ativos; chamado no unmount do IDEPage
- **Botão LSP dinâmico na status bar** — label muda conforme a linguagem do arquivo aberto: `TS LSP`, `PY LSP`, `RS LSP`, `GO LSP`; oculto para linguagens não suportadas; tooltip inclui porta do túnel necessário
- **Wrapper WebSocket** — mesmo padrão Node.js para todos os language servers (1 liner `node -e "..."` na VPS); documentado nos comentários de `lsp.ts`

---

## [3.6.0] — 2026-06-04

### Adicionado — Testes E2E com Playwright

- **`@playwright/test` + `electron`** adicionados como devDependencies no root `package.json`
- **Scripts** `test:e2e` (requer build prévio) e `test:e2e:ci` (`pnpm build &&` playwright) na raiz
- **`e2e/playwright.config.ts`** — timeout 40s, workers=1 (Electron serial), HTML report, screenshot on failure, trace on retry
- **`e2e/global-setup.ts`** — limpa `e2e/.test-db/` antes de cada run para garantir banco isolado
- **`e2e/helpers/app.ts`** — `launchApp()` inicia Electron com DB SQLite isolado por PID+timestamp + `ELECTRON_RENDERER_URL` apontando para `apps/web/dist/`; `closeApp()` encerra sem deixar processo zumbi
- **`e2e/tests/01-launch.spec.ts`** — 5 testes: título da janela, janela visível, sidebar brand, links de navegação presentes, botão AI HUB
- **`e2e/tests/02-navigation.spec.ts`** — 8 testes: navega para VPS, Projetos, Lançador, Monitor, Configurações, Manual, Diagnóstico; volta ao Dashboard
- **`e2e/tests/03-vps.spec.ts`** — 8 testes: estado vazio, abrir modal (2 formas), fechar, Salvar desabilitado sem campos, criar VPS (aparece na lista), botão Testar, editar VPS
- **`e2e/tests/04-settings.spec.ts`** — 8 testes: seção Notificações, toggle visível, toggle inicia ativado, toggle on/off, seção Provedores IA, Anthropic presente, seção Backup, botões Exportar/Importar

---

## [3.5.2] — 2026-06-04

### Alterado

- **Configurações simplificadas** — removidas as seções "VS Code" (vscodePath, vscodeInsidersPath) e "SSH" (sshKeyPath) da página de Configurações; os campos permanecem no banco com os valores padrão (`code`, `~/.ssh/id_rsa`); a página agora exibe apenas Notificações, Provedores de IA e Backup/Restauração
- **Subtítulo de Configurações** atualizado de "Caminhos, preferências e provedores de IA" para "Preferências e provedores de IA"
- **Manual de Uso atualizado** — versão corrigida para v3.5.1 em todo o Help.tsx; seção Modo Local atualizada com agente autônomo; seção Modo Agente reescrita com novos limites (500 ações, botão Parar, modo local); nova seção Notificações de Sistema adicionada

---

## [3.5.1] — 2026-06-04

### Corrigido

- **`local:writeFile` e `local:touch` criam pastas pai automaticamente** — ao salvar `api/controllers/user.js` em modo local, as pastas `api/` e `api/controllers/` são criadas com `fs.mkdir({ recursive: true })` antes de escrever o arquivo. Antes disso, o agente falhava silenciosamente ao tentar criar arquivos em subpastas inexistentes.

---

## [3.5.0] — 2026-06-04

### Adicionado — Agente Autônomo Local

- **IPC `local:exec`** — novo handler em `handlers.ts` que executa qualquer comando via `child_process.exec` no diretório do projeto local; timeout 120s; retorna `{ success, output }` com stdout+stderr combinados; adicionado ao preload e ao helper `ipc.local.exec(cmd, cwd?)`
- **`execute_command` no modo local** — a ferramenta do agente que antes retornava erro em modo local agora executa via `local:exec`; sem necessidade de VPS; suporta `npm install`, `node`, `build`, criação de pastas, qualquer comando Windows/PowerShell
- **`search_files` no modo local** — usa ripgrep (`rg`) se disponível no PATH, senão `findstr` nativo do Windows; busca em todos os arquivos do projeto sem VPS
- **Agente autônomo sem pausa** — o loop do agente passou de MAX=50 com pausa manual para MAX=500 com auto-continuar; a cada 50 ações uma mensagem de progresso é exibida automaticamente; o agente só para quando a IA retorna texto sem tool calls (conclusão natural) ou o usuário clica **Parar**
- **Botão Parar** — substitui o banner "Continuar"; visível durante execução do agente; interrompe o loop na próxima iteração sem perder o histórico; label "⏹ Parar"
- **Descrição das ferramentas atualizada** — `execute_command` não diz mais "apenas modo remoto"; deixa claro que funciona em ambos os modos

---

## [3.4.0] — 2026-06-04

### Adicionado — Notificações de Sistema

- **`NotificationMonitor`** em `packages/core/src/notifications/notification-monitor.ts` — serviço de background que roda no main process; polling a cada 60s para todas as VPS cadastradas; lê CPU/RAM/Disco via SSH; dispara callback com `NotificationAlert` quando limites ultrapassados; cooldown de 30 min por VPS × tipo para evitar spam; tolerante a VPS offline (falha silenciosa)
- **Limites de alerta** — Disco ≥ 85%, CPU ≥ 90%, RAM ≥ 90%
- **Notificação nativa de erro no AI Hub** — quando o streaming é interrompido por erro e a janela não está focada, exibe notificação nativa do SO com a mensagem do erro
- **IPC `notifications:getEnabled` / `notifications:setEnabled`** — lê e persiste preferência na coluna `notificationsEnabled` da tabela `settings` (SQLite)
- **Toggle em Configurações** — nova seção "Notificações" na página de Settings com switch liga/desliga; estado lido do banco ao carregar; persiste imediatamente ao alternar
- **Migração DDL incremental** — `ALTER TABLE "settings" ADD COLUMN "notificationsEnabled" INTEGER NOT NULL DEFAULT 1` (não quebra instalações existentes)

---

## [3.3.1] — 2026-06-02

### Melhorado

- **Manual de Uso (Help.tsx) — redesign completo** — Mapa do App refeito como grade de cards agrupados por objetivo (Gerenciamento · Desenvolvimento · IA · Deploy · Incidentes); copy orientado a benefício (máx. 1 linha por item, ~62% menos texto); hierarquia visual com dot colorido por grupo e cards destacados para AI Hub, Deploy Assistant e Incident Mode; nova seção "Dois modos de operação" com cards comparativos Remoto vs Local; novo subtítulo do cabeçalho descrevendo o app de forma completa
- **Layout.tsx** — versão na sidebar corrigida de `v3.0.0` para `v3.3.1`

### Adicionado

- **`docs/GUIA_INICIANTE.md`** — guia completo em linguagem acessível para desenvolvedores iniciantes: explica VPS, SSH, SFTP e API Key em termos simples; descreve cada tela do app; mostra o IDE, AI Hub, Modo Agente, Incident Mode e Deploy Assistant com diagramas ASCII; passo a passo do zero para configurar o app; FAQ e glossário de 13 termos técnicos

---

## [3.3.0] — 2026-06-01

### Adicionado

- **Project Memory UI** — `ProjectMemoryService` em `packages/core`; tabela `project_memory` (por VPS ou global); IPC `memory:list/save/delete/build`; aba **Memória** no painel lateral do AI Hub com CRUD inline (criar, editar, excluir blocos de contexto); filtro por VPS
- **Context Selector UI** — aba **Contexto** no painel lateral do AI Hub; seletor de VPS opcional; checkboxes: Logs, Docker, PM2, Métricas da VPS, Memória do projeto; ao enviar uma mensagem, os itens marcados são buscados em tempo real e injetados no `systemPrompt` da chamada de streaming; itens VPS-dependentes desabilitados quando nenhuma VPS está selecionada
- **Painel lateral direito** do AI Hub — colapsável (`PanelRightClose/PanelRightOpen`), duas abas: Contexto + Memória
- **ToolExecutor confirmação** no agente IDE — `execute_command` com padrões destrutivos (`docker rm/stop/restart`, `pm2 delete/stop/restart`, `git reset --hard`, `rm -rf`, `DROP TABLE`, `truncate`) exibe modal de confirmação; usuário precisa digitar **CONFIRMO** para autorizar; cancelar retorna aviso ao agente; funciona em modo VPS (não local)

---

## [3.2.0] — 2026-06-01

### Adicionado — Deploy Assistant

- **`createDeployWindow(vpsId, vpsName)`** em `main.ts` — janela 1200×800; IPC `window:openDeploy`; rota `#/deploy/:vpsId/:vpsName`
- **`DeployAssistantPage`** — layout 2 colunas:
  - **Esquerda:** formulário de descrição do deploy + campo de diretório do projeto; geração de plano via IA (streaming); lista de passos com status inline; botões "Executar Tudo" e "Executar" por passo; plano de rollback gerado automaticamente se um passo falhar
  - **Direita:** log de execução em tempo real (terminal-style); smoke test HTTP (`curl -s -o /dev/null -w "%{http_code}"`) com resultado de status code e latência
- **Parser de plano** — aceita resposta da IA em JSON (bloco ```json) ou formato markdown com `### Passo N` + `**Comando:**` + `**Risco:**`; fallback progressivo
- **Tiers de risco** — `low` executa direto; `medium` executa direto; `high` abre modal de confirmação antes de cada passo (ex: `docker stop`, `git reset --hard`, `rm -rf`)
- **Rollback automático** — ao falhar, envia os passos já executados à IA e pede plano de rollback; exibe e executa com botão "Executar Rollback"
- **Botão Rocket** no Launcher (por VPS) e na top bar do IDEPage (modo VPS)

---

## [3.1.0] — 2026-06-01

### Adicionado — Incident Mode

- **`createIncidentWindow(vpsId, vpsName)`** em `main.ts` — abre uma janela Electron dedicada (1440×900) em modo de emergência, título `🚨 INCIDENT MODE — {nome}`; IPC `window:openIncident`
- **`IncidentModePage`** (`/incident/:vpsId/:vpsName`) — layout 2×2 com 4 painéis:
  - **Diagnóstico IA** (top-left) — chat com streaming; ao montar, aguarda 1.5s para dados carregarem e dispara diagnóstico automático com contexto completo (CPU/RAM/Disco, Docker, PM2, logs recentes); continua como chat livre após o diagnóstico inicial
  - **Logs** (top-right) — campo de comando editável (default: `journalctl -n 100`); botão de refresh; auto-scroll para o final
  - **Docker + PM2** (bottom-left) — tabelas com estado de containers e processos; CPU%, RAM, restarts; cores: verde=ok, vermelho=problema
  - **Terminal de emergência** (bottom-right) — input de comando livre via `terminal:exec`; output acumulado com scroll
- **Top bar vermelha** — badge `🚨 INCIDENT MODE` pulsante; mini monitor inline (CPU/RAM/Disco/Uptime); botão Atualizar tudo; botão fechar
- **Botão `Siren`** no Launcher (por VPS) e na top bar do IDEPage (modo VPS) para abrir o Incident Mode
- **Auto-refresh 30s** para stats, docker e pm2

---

## [3.0.0] — 2026-06-01

### Adicionado — NEX-ALS AI HUB

- **Arquitetura multi-provider desacoplada** — `BaseProvider` abstrata com `sendMessage()`, `streamMessage()`, `validateKey()`, `listModels()`; providers isolados em `packages/core/src/ai/providers/`: `AnthropicProvider`, `OpenAICompatProvider` (OpenAI/DeepSeek/Groq/Mistral/xAI), `GeminiProvider`, `OpenRouterProvider`, `OllamaProvider`
- **KeyStore** (`key-store.ts`) — interface injetável para troca da implementação de armazenamento de chaves; implementação padrão em AES-256 SQLite; interface compatível com keytar para migração futura
- **ProviderManager** (`hub/provider-manager.ts`) — resolve o provider correto (padrão ou por nome), instancia a classe certa, consulta `KeyStore`
- **ModelRegistry** (`hub/model-registry.ts`) — catálogo de modelos por provider; cache 24h; `listModels()` dinâmico para OpenAI, OpenRouter e Ollama; estático para demais
- **ResponseStreamer** (`hub/response-streamer.ts`) — executa `streamMessage()` de forma assíncrona; emite chunks via callback; suporta cancelamento via `AbortController`; retorna `streamId`
- **ContextManager** (`hub/context-manager.ts`) — monta `context_block` a partir de `ContextSelection` (arquivo, seleção, árvore, código-fonte, logs, terminal, docker, pm2, vps, git diff, memória); prioridade de corte configurável quando estoura `maxChars` (80K default)
- **PromptBuilder** (`hub/prompt-builder.ts`) — templates de system prompt por modo: `chat`, `agent`, `sysadmin`, `deploy`, `incident`; injeta memória e contexto automaticamente
- **ConversationManager** (`hub/conversation-manager.ts`) — CRUD de sessões de chat persistidas em SQLite (`ai_conversations`, `ai_messages`); suporte a pin, título editável, paginação
- **ToolExecutor** (`hub/tool-executor.ts`) — tiers de autorização: `read` / `write` / `exec_safe` / `exec_dangerous`; `exec_dangerous` em PROD requer confirmação; log em `tool_execution_log`
- **AiService refatorado** — usa `ProviderManager.build()` em `chat()`, `chatAgent()`, `testProvider()`; novos métodos: `chatWithContext()`, `startStream()`, `cancelStream()`, `getModels()`; `conversations` getter para acesso ao `ConversationManager`
- **4 novas tabelas** em `initializeDatabase()`: `ai_conversations`, `ai_messages`, `project_memory`, `tool_execution_log`
- **Novos canais IPC**: `ai:models`, `ai:chatCtx`, `ai:stream:start`, `ai:stream:cancel`, `ai:stream:chunk` (push), `ai:conv:*` (8 handlers de conversa)
- **AIHubPage** (`/ai-hub`) — sidebar com histórico de conversas (pin, delete, edição de título), seletor de provider + modelo dinâmico, streaming token a token, cancelamento, cópia de mensagens
- **Botão AI HUB** na sidebar principal com destaque roxo (`Sparkles`)

---

## [2.8.0] — 2026-06-01

### Adicionado

- **Multi-monitor** — qualquer VPS pode ser aberta em uma janela Electron independente; `createIdeWindow(vpsId, vpsName)` em `main.ts` cria um `BrowserWindow` com a rota `#/ide/:vpsId/:vpsName` via HashRouter — dev: `loadURL` com hash; prod: `loadFile + { hash }`;  botão `ExternalLink` (⎋) no Lançador ao lado de cada botão IDE e na top bar do IDE (modo VPS); cada janela tem sessões SSH, SFTP, terminais e estado React completamente independentes; título da janela mostra o nome da VPS; IPC `window:openIde` registrado em `main.ts` (não em `handlers.ts` — não é serviço de negócio)

---

## [2.7.0] — 2026-06-01

### Adicionado

- **Snapshot/Rollback do Agente** — antes de cada `write_file`, o agente lê e salva o conteúdo original do arquivo em `agentSnapshotsRef` (apenas na primeira escrita por arquivo por sessão); painel laranja **📦 Snapshots** aparece no chat listando todos os arquivos modificados com botão **↩ Restaurar** por arquivo; clicar restaura o conteúdo original via SFTP ou `node:fs` e reabre o arquivo no editor; botão **✕ descartar** remove todos os snapshots da sessão; snapshots são limpos automaticamente ao iniciar nova conversa com o agente (preservados ao clicar em "Continuar"); arquivos **novos** criados pelo agente (sem conteúdo original) não geram snapshot

---

## [2.6.0] — 2026-06-01

### Adicionado

- **Modo Agente — 50 iterações + botão Continuar** — limite aumentado de 15 para 50 iterações; quando atingido, o histórico completo da conversa API (`apiMessages`) é preservado em `agentResumeRef`; um banner âmbar aparece no chat com o botão **▶ Continuar** que retoma o loop sem perder contexto; `handleAgentContinue` reabre a sessão SFTP e chama `runAgentLoop` com as mensagens salvas; o agente é marcado como não-pausado assim que termina naturalmente

---

## [2.5.0] — 2026-06-01

### Adicionado

- **Verificação de fingerprint SSH** — na primeira conexão com uma VPS, o fingerprint do host (SHA-256 da chave pública) é armazenado automaticamente no SQLite; nas conexões seguintes, o fingerprint é comparado e a conexão é **rejeitada** se mudar (possível ataque MITM); mensagem de erro clara com instrução para limpar via interface; aplica-se a todos os serviços SSH: VpsService, TerminalService, SftpService, GitService, TunnelService
- **Badge "Host verificado"** na listagem de VPS — ícone `ShieldCheck` verde quando fingerprint está armazenado; `ShieldOff` cinza quando não há fingerprint; tooltip exibe o fingerprint completo no formato `SHA256:...`
- **Botão "Limpar fingerprint"** (ícone âmbar `ShieldOff`) em cada card de VPS — abre confirmação e limpa o fingerprint armazenado; na próxima conexão, o novo fingerprint é aceito e armazenado automaticamente
- **`buildHostVerifier` helper** em `packages/core/src/ssh/ssh-connect.ts` — função centralizada que fabrica o `hostVerifier` para ssh2; usa `SHA256(rawKey).base64` para compatibilidade com ssh-keyscan
- **`VpsService.clearFingerprint(id)`** — método público para limpar o fingerprint via IPC `vps:clearFingerprint`
- **Campo `sshHostFingerprint TEXT`** na tabela `vps_servers` — adicionado via migração incremental em `initializeDatabase()`

---

## [2.4.0] — 2026-06-01

### Adicionado

- **Analisador de Disco por VPS** — botão "Analisar disco" em cada card do Monitor; abre modal com 4 seções: maiores diretórios (`du -sh /* | sort -rh | head -20`), uso Docker (`docker system df`), logs PM2 (`~/.pm2/logs/`) e logs do sistema (`/var/log/*`); cores por tamanho (verde < 1GB · amarelo 1-5GB · vermelho > 5GB); botão fica vermelho com ⚠ quando uso do disco ≥ 85%; IPC `monitor:diskUsage`; reutiliza `TerminalService.exec`

---

## [2.3.0] — 2026-05-31

### Adicionado

- **Modo Agente (AI Agent para VPS)** — ativa tool use no chat do IDE via botão 🤖; Claude pode chamar `read_file`, `write_file`, `list_directory`, `execute_command`, `search_files` por conta própria; agentic loop com até 15 iterações; display inline de cada tool call com input/output; suporte a Anthropic (tool use nativo) e todos os provedores OpenAI-compatible; Gemini não suportado; sessão SFTP aberta automaticamente durante o loop e fechada ao final
- **`AiService.chatAgent`** — novo método em `packages/core/src/ai/ai.service.ts`; normaliza formatos Anthropic e OpenAI-compatible em interface única; IPC `ai:chatAgent`; `ai:chatAgent` adicionado ao preload

### Corrigido

- **Chat idioma** — system prompt agora instrui Claude a responder sempre em português brasileiro
- **Botão "Aplicar todas as alterações"** — `root` nulo causava paths inválidos; agora valida o diretório raiz antes de salvar; mostra erro claro se não houver pasta aberta
- **Detecção de nomes de arquivos** — `extractFilenameHint` com 6 padrões (listas numeradas, bullet, hash, backtick, negrito)
- **Contexto do chat local** — incluía apenas árvore e docs; agora lê código-fonte (até 80KB, arquivos até 6KB cada)
- **"Aplicar" sobrescrevia todos os arquivos** — botões agora são "▶ arquivo.ts" + "Salvar como…" sempre visíveis e independentes

---

## [2.2.0] — 2026-05-31

### Adicionado

- **Histórico de Lançamentos** — página `/history` na sidebar; tabela com filtros por VPS, projeto e status (sucesso/erro); exibe timeAgo, data/hora, VPS, projeto e mensagem de erro; taxa de sucesso no header; IPC `history:list` com filtros via Prisma

---

## [2.1.0] — 2026-05-31

### Adicionado

- **Logs Viewer** — aba "Logs" no painel inferior do IDE; campo de comando livre; presets rápidos (syslog, nginx error, nginx access, PM2 all, journald); modo Watch com auto-refresh a cada 3 segundos; scroll automático para o final; reutiliza `terminal:exec` sem novo IPC

---

## [2.0.0] — 2026-05-31

### Adicionado

- **PM2 / Process Manager** — aba "PM2" no painel esquerdo do IDE; lista processos com nome, status, CPU%, RAM e número de reinicializações; ações: Restart, Stop, Start, Logs (overlay inline), Excluir; badge mostra N processos online; IPC `pm2:list/restart/stop/logs/delete` via `pm2 jlist` SSH exec; strip ANSI automático

---

## [1.9.0] — 2026-05-31

### Adicionado

- **Docker Explorer** — aba "Docker" no painel esquerdo do IDE; lista containers (nome, imagem, status, ports); ações: Start, Stop, Logs (overlay inline), Remover (confirmação); badge mostra N containers rodando; IPC `docker:list/start/stop/logs/remove` via SSH exec com formato JSON

---

## [1.8.0] — 2026-05-31

### Adicionado

- **Chat IA — API direta** — IDEPage detecta automaticamente se há provedor de IA configurado nas Settings; se sim, usa `ai:chat` (chamada HTTP direta, 2-5s) em vez de `claude -p` via SSH (15-30s); o histórico completo da conversa é enviado ao provedor; o cabeçalho do chat exibe o modo ativo ("Anthropic", "DeepSeek", "claude -p (SSH)", etc.); fallback transparente: sem provedor configurado, comportamento anterior é mantido; funciona sem VPS quando há provedor

### Alterado

- Tooltip do botão "Claude" na top bar passa a indicar o modo ativo
- Mensagem do estado vazio do chat diferencia API direta de SSH
- Guard `handleChatSend` permite enviar sem VPS quando há provedor IA

---

## [1.7.0] — 2026-05-31

### Adicionado

- **Provedores de IA multi-provider** — suporte a 7 provedores configuráveis: Anthropic (Claude), DeepSeek, OpenAI, Gemini, Groq, Mistral/Codestral, xAI Grok
- **AiService** — `packages/core/src/ai/ai.service.ts`; CRUD de providers + chat; usa `fetch` nativo (Node.js 22); cada provedor tem implementação separada: Anthropic (API própria), Gemini (API própria), todos os demais via formato OpenAI-compatible
- **Tabela `ai_providers`** — SQLite via DDL incremental em `initializeDatabase()`; campos: `provider` (PK), `apiKey` (AES-256), `model`, `enabled`, `isDefault`, `updatedAt`; sem migrations automáticas, sem quebrar instalações existentes
- **IPC** — `ai:list`, `ai:save`, `ai:delete`, `ai:test`, `ai:chat`; adicionados ao preload e ao `ipc.ts`
- **Settings — Provedores de IA** — nova seção na página de Configurações com cards expansíveis por provedor; cada card: toggle habilitado/padrão, seletor de modelo, input de API Key (com show/hide), botão Testar conexão, botão Remover; indicadores de status ("Configurado", "Padrão"); dica sobre custo (Groq grátis, DeepSeek o mais barato)
- **Tipos em `@cwm/config`** — `AiProviderConfig`, `AiChatMessage`, `AiChatInput`

### Segurança

- API Keys armazenadas criptografadas AES-256-CBC (mesmo sistema das senhas SSH)
- Chave mascarada na listagem (`••••••••1234`); chave plain usada apenas no momento da chamada HTTP
- Salvar sem alterar a key (campo vazio ou com mask) mantém a key existente — sem risco de apagar acidentalmente

---

## [1.6.0] — 2026-05-31

### Adicionado

- **Monitor de VPS** — nova página `/monitor` acessível pela sidebar; exibe cards por VPS com métricas coletadas via SSH exec: CPU (load average 1/5/15min + % calculado sobre núcleos), RAM (usado/total em MB), Disco (`/` — usado/total/disponível/%), Uptime; auto-refresh a cada 30s; refresh manual por card ou global; cores adaptativas: verde < 60%, amarelo 60-84%, vermelho ≥ 85%; loading skeleton durante primeira carga; estado de erro ao VPS offline
- **IPC `monitor:getStats`** — executa comando SSH único que retorna LOAD/CORES/MEM/DISK/UPTIME; parseia saída com fallbacks para comandos ausentes; reutiliza `TerminalService.exec` sem duplicar lógica SSH
- **Nav "Monitor"** com ícone `BarChart3` na sidebar

---

## [1.5.0] — 2026-05-31

### Adicionado

- **IDE-15 · Split editor** — botão `⊟` na top bar divide o editor em dois painéis horizontais (50/50); cada painel tem sua própria barra de abas; Ctrl+S salva no painel focado; clicar num painel muda o foco; abrir arquivo vai para o painel ativo; fechar split com o mesmo botão
- **IDE-16 · TypeScript LSP** — `monaco-languageclient` v10 conecta via WebSocket ao `typescript-language-server` da VPS; botão `TS LSP` na status bar (verde quando ativo); requer túnel SSH na porta 6009 e `typescript-language-server` instalado na VPS; `apps/web/src/lib/lsp.ts`
- **IDE-17 · Remote Port Forwarding** — nova aba "Portas" no painel esquerdo; cria túneis `localhost:X → VPS:Y` via `ssh2.forwardOut`; lista túneis ativos; botão "Abrir no navegador"; fechar túnel; `TunnelService` em `packages/core/src/tunnel/`; IPC `tunnel:open`, `tunnel:close`, `tunnel:list`
- **IDE-18 · Depuração remota DAP** — botão `⬡ DAP` na status bar; abre janela Electron com Chrome DevTools Protocol apontado para `ws://localhost:9229`; requer túnel 9229→9229 e `node --inspect` na VPS; `apps/web/src/lib/dap.ts`; IPC `debug:openDevTools`

### Fluxo de uso IDE-16 (LSP):
```
VPS: npm i -g typescript-language-server typescript ws websocat
     websocat --text -E tcp-l:0.0.0.0:6009 exec:typescript-language-server\ --stdio
IDE: Painel Portas → túnel 6009→6009 → status bar "TS LSP" → clique
```

### Fluxo de uso IDE-18 (DAP):
```
VPS: node --inspect=0.0.0.0:9229 server.js
IDE: Painel Portas → túnel 9229→9229 → status bar "⬡ DAP" → clique
```

---

## [1.4.0] — 2026-05-31

### Adicionado

- **Packaging Windows** — `pnpm package:win` gera instalador NSIS (`.exe`) + versão portátil (`.exe` standalone) com wizard de instalação (diretório configurável, atalho no Desktop e Start Menu, licença); config `publish` aponta para GitHub Releases (fasterdrible-lab/HEXAGON-IDE); pasta `apps/desktop/build/` com `LICENSE.txt` e instrução de ícone
- **Import/Export de configurações** — botões "Exportar backup (.json)" e "Importar backup" na página de Configurações; exporta todas as VPS, projetos e contas cadastradas em JSON com timestamp; importa de forma não-destrutiva (não sobrescreve registros existentes); senhas SSH não exportadas; IPC `config:export` e `config:import` com dialog nativo de salvar/abrir arquivo
- **SSH passphrase** — chave SSH com passphrase agora funciona: quando há chave privada configurada, o campo "Senha SSH" vira a passphrase da chave (em vez de senha do servidor); suporte ao SSH agent do Windows via named pipe `\\.\pipe\openssh-ssh-agent` (além de `SSH_AUTH_SOCK` no Unix)
- **Auto-update** — `electron-updater` instalado; em produção verifica atualizações silenciosamente ao iniciar via `autoUpdater.checkForUpdatesAndNotify()`; publicação via GitHub Releases configurada
- **Testes automatizados** — Vitest adicionado aos pacotes `@cwm/config` e `@cwm/core`; 18 testes passando: encryptPassword/decryptPassword, Zod schemas (VPS, Project, ClaudeAccount, Settings), parsing de status Git (staged/unstaged/untracked, ahead/behind)

### Alterado

- Descrição do `@cwm/desktop` atualizada para "NEX-ALS IDE — gerenciador de ambientes VPS com IDE integrado"
- Scripts `package:win` e `package:dir` adicionados ao `apps/desktop/package.json` e `pnpm package:win` na raiz
- `pnpm test` roda os testes dos pacotes

---

## [1.3.2] — 2026-05-31

### Adicionado

- **Chat · Botões Copiar e Aplicar** — mensagens do Claude com blocos de código ganham botão "Copiar" (clipboard) e "▶ Aplicar em arquivo.tsx" (substitui conteúdo do arquivo ativo no Monaco, marca como dirty para revisão com Ctrl+S)
- **Chat · Salvar como** — quando não há arquivo aberto, botão vira "▶ Salvar como…" com input inline para digitar caminho relativo; cria o arquivo no projeto, abre no editor e atualiza a tree
- **Chat · Colar print (Ctrl+V)** — textarea aceita paste de imagem; badge "📷 Print anexado" confirma recebimento; imagem enviada inline no prompt para o Claude
- **Chat · Contexto automático do projeto local** — ao usar o chat em modo local, envia automaticamente: árvore de pastas (2 níveis, ignorando `node_modules`/`.git`/etc.), arquivos-chave (`CLAUDE.md`, `README.md`, `docs/TASKS.md`, `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`) e conteúdo do arquivo aberto no editor
- **Chat · Instrução offline** — prompt inclui aviso explícito para Claude não tentar ler arquivos do disco e usar apenas o conteúdo fornecido inline
- **Chat · Timer de espera** — exibe "Claude pensando… Xs" com contagem durante o processamento
- **IPC `clipboard:readImage`** — main process usa `nativeImage` do Electron para ler imagem do clipboard; retorna path do arquivo temp PNG

### Corrigido

- **Chat · `stdin` warning** — adicionado `< /dev/null` no comando `claude -p` para suprimir aviso de stdin
- **Chat · Prompt via arquivo SFTP** — prompt escrito em `/tmp/hexagon_chat_<ts>.txt` via SFTP antes de executar, evitando escaping de shell e limite de tamanho de linha de comando
- **Chat · `--image` não suportado** — flag `--image` removida (não existe no `claude -p`); imagem enviada como bloco base64 inline no prompt
- **Chat · Contexto do projeto local** — adicionada instrução explícita para Claude usar conteúdo inline e não tentar acessar o filesystem da VPS
- **Botão Aplicar** — mostra nome do arquivo alvo ("Aplicar em arquivo.tsx") em vez de label genérico; exibe erro claro quando nenhum arquivo está aberto
- Timeout `terminal:exec` aumentado para 120s para respostas longas do Claude

### Limitações conhecidas

- `claude -p` não processa imagens como visão real (multimodal); para análise de imagem, prefer colar o **texto** do erro no chat
- Para suporte multimodal completo e respostas mais rápidas, seria necessário API Key da Anthropic

---

## [1.3.1] — 2026-05-30

### Corrigido / Melhorado

- **Chat Claude em modo local** — chat agora disponível ao editar pastas locais (OneDrive); seletor de VPS no header do painel permite escolher onde `claude -p` executa sem abrir a VPS no IDE
- **Botão Claude mais visível** — substituído ícone invisível por botão com label "Claude" + cor roxa na top bar de ambos os modos
- `chatVpsId` centraliza qual VPS é usada em `handleChatSend`; no modo remoto usa a VPS atual; no modo local carrega lista de VPS via `ipc.vps.list()`

---

## [1.3.0] — 2026-05-30

### Adicionado

- **IDE-19 · Badge PRODUÇÃO** — indicador vermelho pulsante na top bar sempre que o IDE estiver conectado a uma VPS remota; badge verde "Local" no modo local
- **IDE-20 · Modo Local** — nova rota `/ide/local`; botão "Abrir pasta local" no Lançador; dialog nativo do SO para escolha de pasta; IPC `local:*` completo (readdir, readFile, readFileBase64, writeFile, mkdir, delete, rename, touch); filesystem abstraction (`fsReaddir`, `fsReadFile`, etc.) que alterna entre SFTP e `node:fs/promises`; terminal e painel Git ocultos no modo local; badge verde "Local" na top bar
- **IDE-21 · Chat Claude via SSH** — painel lateral direito redimensionável (botão `Bot` na top bar, só modo remoto); contexto do arquivo ativo enviado automaticamente (até 3000 chars); executa `claude -p '...'` na VPS via `terminal:exec` com timeout de 60s; histórico de mensagens com bolhas visuais; Enter = enviar, Shift+Enter = nova linha; botão limpar histórico

### Alterado

- `terminal:exec` IPC aceita `timeout?` opcional (usado pelo chat para aguardar Claude)
- `ipc.terminal.exec()` atualizado para repassar `timeout`
- `setupIpcHandlers()` agora recebe `win?: BrowserWindow` para o dialog de pasta nativa
- `createWindow()` chamado antes de `setupIpcHandlers()` no main process

---

## [1.2.0] — 2026-05-30

### Alterado

- **Repositório renomeado** — `Claude-Workspace-Manager` → `HEXAGON-IDE` no GitHub (`https://github.com/fasterdrible-lab/HEXAGON-IDE.git`)
- Remote local atualizado (`git remote set-url origin`)
- `CLAUDE.md` e `AGENTE.md` reescritos para refletir o nome oficial **NEX-ALS IDE** e incluir a URL do repositório
- Versão bumped `1.1.1 → 1.2.0` (marco: IDE completo + rename oficial)

---

## [1.1.1] — 2026-05-30

### Adicionado

- **IDE-08 · Find/Replace (Ctrl+H)** — `addCommand` em `handleEditorMount` registra explicitamente `editor.action.startFindReplaceAction`, garantindo que o Electron não intercepte o atalho antes do Monaco
- **IDE-09 · Go to Line (Ctrl+G)** — `addCommand` em `handleEditorMount` registra explicitamente `editor.action.gotoLine`, garantindo que o atalho funcione mesmo com foco fora do editor
- **IDE-12 · Painel de Problemas** — aba "Problemas" no painel inferior (ao lado de "Terminal"); lista erros/avisos do Monaco via `onDidChangeMarkers`; badge com contagem colorido (vermelho/âmbar); clique em item navega para a linha (`jumpToLine`); ícone `Check` quando não há problemas

### Corrigido

- Import `WifiOff` não utilizado removido (TS6133)
- Parâmetro anônimo do `markers.map` tipado como `import('monaco-editor').editor.IMarker` (TS7006)

### Observação técnica

- **IDE-10 (Breadcrumbs)** — `breadcrumbs` não existe em `IStandaloneEditorConstructionOptions`; é propriedade exclusiva do VS Code completo. Tarefa marcada como N/A.

---

## [1.1.0] — 2026-05-30

### Adicionado

- **IDE-11 · Preview de imagem** — PNG, JPG, JPEG, GIF, WebP, ICO abrem no editor como `<img>` (background escuro, centralizado, max-height 75%); leitura via `sftp:readFileBase64`; MIME detectado por extensão; tab integrada ao sistema de tabs existente
- **IDE-13 · Copiar/Duplicar arquivos** — context menu expandido com "Duplicar" (`cp -rp` via SSH, nome `_copia`), "Copiar caminho" (clipboard) e separadores visuais; funciona para arquivos e diretórios
- **IDE-14 · Auto-refresh da tree** — refresh da pasta pai ao salvar (`Ctrl+S`); polling de 30s atualiza `/root` e todos os diretórios expandidos sem bloquear UI (usa `expandedFoldersRef` para evitar re-criação de interval)
- `SftpSession.readFileBase64(path)` — lê arquivo remoto como Buffer e retorna string base64
- IPC `sftp:readFileBase64` + preload whitelist + helper `ipc.sftp.readFileBase64`

### Alterado

- `BIN_EXT` removeu `png,jpg,jpeg,gif,webp,ico` (agora preview); adicionado `IMG_PREVIEW` set separado
- Context menu: 2 itens → 4 itens com separadores

---

## [1.0.9] — 2026-05-30

### Adicionado

- **IDE-02 · Tree view hierárquica** — explorer expandível inline por pasta (lazy load por pasta); chevron rotaciona ao expandir; indentação por profundidade; `activeDir` rastreia a pasta ativa para criação de arquivos/pastas; `flattenTree()` produz lista plana a partir do estado de expansão
- **IDE-03 · Find in Files (Ctrl+Shift+F)** — painel "Busca" no switcher esquerdo; input de query + filtro glob (ex: `*.ts,*.tsx`) + toggle case-sensitive; executa `grep -rn` via SSH (`terminal:exec`); resultados agrupados por arquivo com número de linha; click abre o arquivo e revela a linha no Monaco
- **IDE-05 · Múltiplas abas de terminal** — tab bar com título, indicador de status colorido (verde/vermelho/piscando), botão `+` para novo terminal, `×` para fechar; cada aba é uma sessão SSH independente (`ipc.terminal.open`); containers xterm montados via callback ref, visibilidade via `display: block/none` (preserva histórico); `switchTermTab` re-fits ao trocar
- `TerminalService.exec(vpsId, cmd, timeout)` — SSH exec one-shot para comandos não-interativos
- IPC `terminal:exec` + whitelist preload + helper `ipc.terminal.exec`

### Alterado

- IDEPage: `curPath`+`entries` substituídos por `rootEntries`+`expandedFolders`+`folderChildren`+`loadingFolders`+`activeDir` (estado de árvore hierárquica)
- IDEPage: terminal único → array `termTabs` + `termInstancesRef` Map (multi-tab)
- IDEPage: painel esquerdo tem 3 tabs (Files, Search, Git) em vez de 2
- `TerminalService.openShell` refatorado para usar `sshConnect()` privado (DRY)

---

## [1.0.8] — 2026-05-30

### Adicionado

- **IDE-07 · Paleta de comandos** — `Ctrl+Shift+P` abre a paleta nativa do Monaco; botão `⌘` na top bar; `Escape` fecha diff
- **IDE-01 · Criar arquivo** — botão `FilePlus` no explorer; input inline com `Enter`/`Escape`; arquivo aberto automaticamente após criação; IPC `sftp:touch` + `SftpSession.touch()`
- **IDE-04 · Git integrado** — painel Source Control completo no NEX-ALS IDE:
  - Tab "Git" na esquerda com badge de contagem de alterações
  - Status: branch atual, commits ahead/behind (↑↓)
  - Seções: Staged, Alterações, Não rastreados — com ícones de status (M/A/D/U)
  - Stage/Unstage por arquivo ou "Stage all" / "Unstage all"
  - Diff viewer: clique no arquivo → diff colorido no Monaco (linguagem `diff`)
  - Commit: textarea de mensagem + botão com contagem de arquivos staged
  - Push / Pull com feedback de resultado
  - Branch e contagem de alterações na **status bar** inferior
- **Status bar melhorada**: branch git (clicável → abre painel git), `Ln X, Col Y` ao editar, hint `Ctrl+Shift+P`
- **Cursor position tracking**: `editor.onDidChangeCursorPosition` atualiza status bar em tempo real
- `GitService` em `packages/core/src/git/git.service.ts` com: `status`, `diff`, `add`, `restore`, `commit`, `push`, `pull`, `log`
- IPC channels: `git:status`, `git:diff`, `git:add`, `git:restore`, `git:commit`, `git:push`, `git:pull`, `git:log`
- Tipos `GitStatus`, `GitFileStatus`, `GitCommit` adicionados ao `@cwm/config`

### Alterado

- `IDEPage.tsx`: painel esquerdo vira switcher Files/Git; adicionado `GitFileRow` sub-component
- Painel de arquivos: botão `FilePlus` ao lado do `FolderPlus`

---

## [1.0.7] — 2026-05-30

### Corrigido

- **Bloqueador crítico: `require('electron')` retornava npm stub no Windows + pnpm**
  - `app.isPackaged` acessado no nível do módulo causava crash antes de `app.whenReady()`
  - Corrigido: removida declaração `isDev` de nível de módulo; usa `ELECTRON_RENDERER_URL` env var (setada pelo electron-vite) ou fallback para `http://localhost:5173` quando `!app.isPackaged`
- **`ELECTRON_RUN_AS_NODE=1` no ambiente de execução quebrava Electron**
  - Electron verifica a EXISTÊNCIA da var (qualquer valor, inclusive `"0"`) para rodar como Node.js puro sem API Electron
  - Corrigido: `scripts/dev.js` deleta `ELECTRON_RUN_AS_NODE` do `process.env` antes de invocar o `concurrently`, eliminando a herança nos processos filhos
- `pnpm dev` substituído por `node scripts/dev.js` no package.json raiz

### Adicionado

- `cross-env ^7.0.3` como devDependency (auxílio a outras abordagens cross-platform)
- `scripts/dev.js` — launcher Node.js que limpa `ELECTRON_RUN_AS_NODE` e inicia o concurrently
- Script `dev:inner` no package.json raiz para separar lógica do launcher

---

## [1.0.6] — 2026-05-30

### Adicionado

- **NEX-ALS IDE** — layout IDE completo com três painéis integrados e redimensionáveis:
  - Explorer SFTP (esquerda) — navega, cria pastas, renomeia e exclui arquivos na VPS via SFTP
  - Monaco Editor (centro) — edição com syntax highlighting, IntelliSense, tabs múltiplas e Ctrl+S
  - Terminal SSH xterm.js (baixo, togglável com Ctrl+\`) — shell interativo full-color diretamente na VPS
- Rota `/ide/:vpsId/:vpsName` registrada no React Router
- Botão **IDE** (primário) no card de cada VPS no Lançador
- Rotas `/terminal`, `/explorer` e `/ide` movidas para fora do Layout → fullscreen sem sidebar
- `TerminalService` — sessão SSH interativa bidirecional (ssh2 shell)
- `SftpService` — sessão SFTP com readdir, readFile, writeFile, mkdir, delete, rename
- IPC channels: `terminal:*` e `sftp:*` (handler + preload whitelist)
- Monaco workers locais configurados (`monacoSetup.ts`) — funciona offline no Electron
- `@monaco-editor/react`, `monaco-editor`, `@xterm/xterm`, `@xterm/addon-fit` adicionados ao `@cwm/web`

### Alterado

- `App.tsx` reestruturado: páginas de gerenciamento com sidebar; ferramentas (terminal, explorer, IDE) fullscreen
- `Launcher.tsx`: estado `terminalStates` não usado removido

---

## [1.0.5] — 2026-05-30

### Adicionado

- Branding: **NEX-ALS** — copyright, versão e marca em toda a UI
- Página **Manual de Uso** (`/help`) com 9 seções expansíveis: início rápido, VPS, projetos, contas Claude, lançador, autenticação Claude Code, configurações, chave SSH, solução de problemas, sobre
- Botão **"Criar pasta na VPS"** / **"Clonar repositório na VPS"** no formulário de projetos — executa `mkdir -p` ou `git clone` via SSH diretamente da UI
- Modal de autenticação Claude Code reescrito com instrução de janela anônima (resolve conflito de conta já logada no browser)
- Terminal SSH corrigido para abrir janela independente via `cmd /c start` (funcionava apenas em dev, agora funciona no app empacotado)

### Alterado

- Versão global: `0.1.x` → `1.0.5`
- Sidebar mostra versão e marca NEX-ALS
- Seção "Sobre" do Manual com informações completas e copyright

---

## [0.1.2] — 2026-05-30

### Adicionado

- `ClaudeCheckResult` type em `@cwm/config`: `{ installed, version, loggedIn, message }`
- `VpsService.checkClaudeCode(vpsId)` — conecta via SSH, roda `bash -c 'command -v claude && claude --version && claude auth status'` e retorna status estruturado
- Método privado `_sshExec(vpsId, cmd)` extraído de `testConnection` para reusar a lógica SSH
- IPC channel `launcher:checkClaude` — handler no main, canal autorizado no preload
- `ipc.launcher.checkClaude(vpsId)` no helper frontend
- Launcher page: verificação automática ao montar (não-bloqueante, em paralelo para cada VPS); badge por VPS e por card de projeto exibindo: `Claude vX.X.X • Logado` | `Não logado` | `Não instalado` | spinner durante verificação

### Alterado

- `VpsService.testConnection` simplificado para delegar ao `_sshExec`
- `Launcher.tsx` reimplementado com estado `claudeStatuses` por VPS

---

## [0.1.1] — 2026-05-30

### Adicionado

- `ssh2` como dependência de `@cwm/core` com bindings nativos para Windows (crypto acelerado por hardware)

### Alterado

- `VpsService.testConnection` reescrito para usar `ssh2` em vez de `child_process.exec` — não depende mais do cliente SSH no PATH do sistema
- Timeout e erros tratados nativamente: `ECONNREFUSED`, `ETIMEDOUT`, falha de autenticação
- Verificação de host key desativada para teste de conexão (equivalente a `StrictHostKeyChecking=no`)
- `packages/core/tsconfig.json` atualizado de `moduleResolution: Node` para `Node16` para suporte ao prefixo `node:` nos imports
- `pnpm-workspace.yaml` atualizado para aprovar builds nativos de `ssh2` e `cpu-features`

### Corrigido

- Bloqueador crítico resolvido: `require("electron")` funciona corretamente via `electron-vite` (main bundado com Rollup, `electron` como external)

---

## [0.1.0] — 2026-05-29

### Adicionado

- Scaffold completo do monorepo pnpm com workspaces
- `packages/config` — Zod schemas e tipos compartilhados para VPS, Project, ClaudeAccount, Settings, LaunchHistory
- `packages/db` — Prisma schema SQLite com tabelas: vps_servers, projects, claude_accounts, settings, launch_history
- `packages/core` — Serviços de negócio: VpsService, ProjectsService, AccountsService, LauncherService, SettingsService, DiagnosticsService
- `apps/desktop` — Electron main process com BrowserWindow + contextBridge + IPC handlers completos
- `apps/web` — React + Vite + Tailwind CSS com 7 páginas: Dashboard, VPS, Projetos, Contas, Launcher, Settings, Diagnóstico
- Layout com sidebar de navegação e status bar
- Dashboard com cards de VPS, projetos recentes e ações rápidas
- CRUD completo de VPS com formulário modal e botão de teste de conexão
- CRUD completo de Projetos com associação a VPS e conta Claude
- CRUD completo de Contas Claude (sem armazenamento de credenciais)
- Launcher com grid de projetos e botão "Abrir no VS Code"
- Página de Settings (caminhos VS Code, SSH key path)
- Página de Diagnósticos (verifica VS Code, SSH, Git, Node.js, VPS)
- Todos os arquivos de documentação: CLAUDE.md, AGENTE.md, docs/, memory/
- `.gitignore` com exclusões para node_modules, dist, .env, banco SQLite local

### Decisões técnicas

- Stack: Electron + React + Vite + TypeScript + Tailwind CSS + Prisma + SQLite
- IPC via `contextBridge` com `contextIsolation: true` (segurança)
- DATABASE_URL configurado dinamicamente no main process via `app.getPath('userData')`
- Monorepo gerenciado via pnpm workspaces
- Validação de entrada via Zod em todos os handlers IPC
