# NEX-ALS AI HUB — Arquitetura e Roadmap

**Versão:** 3.0.0 (início)
**Data:** 2026-06-01

## Visão geral

O AI HUB transforma o NEX-ALS IDE em: **Cursor + Docker + PM2 + SSH + Monitoramento + Gestão de VPS + Multi-IA**.

## Estrutura de módulos

```
packages/core/src/ai/
├── ai.service.ts                  ← orquestrador público (refatorado p/ usar hub/)
├── key-store.ts                   ← keytar wrapper — API keys no cofre do SO
├── providers/
│   ├── base.provider.ts           ← interface BaseProvider + abstract class
│   ├── anthropic.provider.ts
│   ├── openai.provider.ts         ← reutilizado por DeepSeek/Groq/Mistral/xAI
│   ├── gemini.provider.ts
│   ├── openrouter.provider.ts
│   └── ollama.provider.ts
└── hub/
    ├── provider-manager.ts        ← instancia provider correto em runtime
    ├── conversation-manager.ts    ← CRUD sessões de chat persistidas
    ├── context-manager.ts         ← monta context_block a partir de checkboxes
    ├── prompt-builder.ts          ← templates de system prompt por modo
    ├── model-registry.ts          ← catálogo de modelos + cache SQLite 24h
    ├── tool-executor.ts           ← executa ferramentas com tiers de autorização
    └── response-streamer.ts       ← SSE → fragmentos → IPC → renderer
```

## Responsabilidades dos módulos

| Módulo | Responsabilidade |
|---|---|
| **ProviderManager** | Carrega o provider correto, valida chave, delega send/stream |
| **ConversationManager** | Cria, salva, lista, pagina sessões no SQLite |
| **ContextManager** | Recebe checkboxes (arquivo, git diff, logs, docker...) e monta context_block com limite de tokens |
| **PromptBuilder** | Templates de system prompt: chat geral, agente, sysadmin, deploy |
| **ModelRegistry** | Catálogo estático + listModels() dinâmico por provider, cache 24h |
| **ToolExecutor** | Executa tool_calls com tiers: read / write / exec_safe / exec_dangerous (requer confirmação em PROD) |
| **ResponseStreamer** | ReadableStream SSE → ipcMain.emit('ai:stream:chunk') → renderer |

## Providers suportados

| Provider | Protocolo | Tool Use | Stream | listModels |
|---|---|---|---|---|
| Anthropic | API própria | ✅ | ✅ | Estático |
| OpenAI | OpenAI | ✅ | ✅ | /models |
| Gemini | API própria | ✅ | ✅ | Estático |
| DeepSeek | OpenAI-compat | ✅ | ✅ | Estático |
| OpenRouter | OpenAI-compat | Depende modelo | ✅ | /models (dinâmico) |
| Ollama | API própria | Depende modelo | ✅ | /api/tags |

## Segurança de API Keys (Keytar)

- **Nunca** salvar API Key em SQLite em texto puro ou criptografado no source
- Usar **keytar** (Windows Credential Manager / macOS Keychain / Linux Secret Service)
- Renderer só recebe `hasKey: boolean` e `keyPreview: '••••1234'`
- Migração automática: AES-256 SQLite → keytar na primeira inicialização após atualização

## Schema de banco de dados (novos)

```sql
CREATE TABLE "ai_conversations" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT 'Nova conversa',
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "vpsId" TEXT,
  "projectId" TEXT,
  "isPinned" INTEGER DEFAULT 0,
  "totalTokens" INTEGER DEFAULT 0,
  "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ai_messages" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "toolCallId" TEXT,
  "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "project_memory" (
  "id" TEXT PRIMARY KEY,
  "vpsId" TEXT,
  "projectId" TEXT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("vpsId", "projectId", "key")
);

CREATE TABLE "tool_execution_log" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT,
  "toolName" TEXT NOT NULL,
  "input" TEXT,
  "output" TEXT,
  "tier" TEXT,
  "confirmed" INTEGER DEFAULT 0,
  "executedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Tiers de ferramentas (ToolExecutor)

| Tier | Ferramentas | Comportamento |
|---|---|---|
| `read` | read_file, list_directory, search_files, read_logs, read_docker, read_pm2, read_vps_stats | Silencioso |
| `write` | write_file, create_file, run_git_add, run_git_commit | Snapshot automático |
| `exec_safe` | run_git_pull, run_git_push, pm2_restart (não-PROD) | Confirmação única por sessão |
| `exec_dangerous` | pm2_restart (PROD), docker_restart, docker_rm, git_reset, run_command | Confirmação explícita + badge 🔴 PRODUÇÃO |

## Canais IPC do Streaming

```
ai:stream:start   → renderer envia input, recebe streamId
ai:stream:chunk   ← main emite token parcial
ai:stream:done    ← main emite fim + usage stats
ai:stream:error   ← main emite erro
ai:stream:cancel  → renderer solicita abort
ai:tool:confirm   → renderer responde confirmação de ferramenta perigosa
```

## Sprints

| Sprint | Objetivo | Estimativa |
|---|---|---|
| S1 | keytar + key-store + BaseProvider + Anthropic + OpenAI + ProviderManager | 2 dias |
| S2 | Gemini + OpenRouter + Ollama + ModelRegistry | 1 dia |
| S3 | ResponseStreamer + IPC ai:stream + UI streaming | 2 dias |
| S4 | DB tables + ConversationManager + AIHubPage + rota /ai-hub | 3 dias |
| S5 | ContextManager + checkboxes + PromptBuilder | 1 dia |
| S6 | ProjectMemory DB + UI tab Memória | 1 dia |
| S7 | ToolExecutor tiers + confirmação PROD + tool_execution_log | 2 dias |
| S8 | Incident Mode window + diagnóstico automático | 1 dia |
| S9 | Deploy Assistant + smoke test + rollback sugerido | 1 dia |

## Riscos técnicos

| Risco | Mitigação |
|---|---|
| Keytar rebuild nativo no Windows | Fallback para AES-256 com aviso ao usuário |
| Ollama não instalado | Provider "offline" — cinza, sem erro |
| Context overflow (>80K tokens) | ContextManager com prioridade de corte configurável |
| Múltiplas janelas competindo no stream | StreamId único por janela |
| ToolExecutor exec_dangerous sem confirmação (bug) | Default confirmed=false, whitelist rígida |
