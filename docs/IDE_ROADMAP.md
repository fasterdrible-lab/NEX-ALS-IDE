# IDE_ROADMAP.md — NEX-ALS IDE: Roadmap

**Data:** 2026-06-11
**Versão atual:** 3.16.1
**Objetivo:** registrar o estado real das features IDE e o backlog futuro

---

## Status geral

O NEX-ALS IDE está **completo** para o escopo original. Todas as features P0 → P3 foram entregues. O roadmap abaixo documenta o que foi feito e o que pode vir a seguir.

---

## Concluído — IDE Core (v1.0.6 → v3.9.0)

| ID | Feature | Versão |
|---|---|---|
| IDE-01 | Criar arquivo inline (FilePlus + touch) | 1.0.8 |
| IDE-02 | Tree view hierárquica — expand/collapse lazy load | 1.0.9 |
| IDE-03 | Find in Files (Ctrl+Shift+F) — grep SSH + reveal de linha | 1.0.9 |
| IDE-04 | Git integrado — Source Control completo (status/diff/add/commit/push/pull) | 1.0.8 |
| IDE-05 | Múltiplas abas de terminal SSH independentes | 1.0.9 |
| IDE-06 | Status bar — branch git, Ln/Col, hint paleta | 1.0.8 |
| IDE-07 | Paleta de comandos (Ctrl+Shift+P) | 1.0.8 |
| IDE-08 | Find/Replace no arquivo (Ctrl+H) | 1.1.1 |
| IDE-09 | Go to Line (Ctrl+G) | 1.1.1 |
| IDE-10 | Breadcrumbs | **N/A** — opção não existe em `IStandaloneEditorConstructionOptions` (exclusiva do VS Code completo) |
| IDE-11 | Preview de imagem — base64 SFTP | 1.1.0 |
| IDE-12 | Painel de Problemas — `onDidChangeMarkers` + jumpToLine | 1.1.1 |
| IDE-13 | Copiar/Duplicar arquivos — `cp -rp` + clipboard | 1.1.0 |
| IDE-14 | Auto-refresh da tree — ao salvar + polling 30s | 1.1.0 |
| IDE-15 | Split editor — dois painéis 50/50, abas independentes | 1.5.0 |
| IDE-16/22 | LSP multi-linguagem — TS/PY/RS/GO via WebSocket tunnel | 3.7.0 |
| IDE-17 | Port Forwarding — TunnelService (ssh2.forwardOut) | 1.5.0 |
| IDE-18 | DAP debug remoto — Chrome DevTools via ws://localhost:9229 | 1.5.0 |
| IDE-19 | Badge PRODUÇÃO (vermelho) / LOCAL (verde) | 1.3.0 |
| IDE-20 | Modo Local — `node:fs`, dialog nativo, filesystem abstraction | 1.3.0 |
| IDE-21 | Chat Claude — `claude -p` via SSH, contexto automático, Copiar/Aplicar/Salvar | 1.3.2 |

---

## Concluído — Squad (v3.10.0 → v3.16.1)

| Feature | Versão |
|---|---|
| 8 agentes com streaming em tempo real | 3.10.0 |
| ACTION tags — SHELL / WRITE_FILE / READ_FILE executadas via SSH ou local | 3.10.0 |
| Delegação automática @agente | 3.10.0 |
| Persistência de sessões SQLite | 3.10.0 |
| Pipeline homolog → prod com gate de aprovação | 3.10.0 |
| Claude Code como provedor (zero API Key) | 3.11.0 |
| Múltiplas contas Claude Code isoladas | 3.12.0 |
| Contexto do Projeto — injetado em todos os agentes | 3.14.0 |
| Execução Local — ações no PC sem VPS | 3.14.0 |
| Painéis redimensionáveis | 3.15.5 |
| Botão Limpar chat + Acompanhar (auto-scroll) | 3.15.5 |
| Modal Conta Claude — email, plano, abrir claude.ai | 3.15.7 |
| READ_DIR + auto-detecção de diretório em READ_FILE | 3.15.8 |
| Instruções anti-loop no modo autônomo | 3.15.8 |
| Base de Conhecimento estruturada (8 seções, 3 templates) | 3.15.9 |
| KB isolada por projeto (localStorage keyed por localPath) | 3.16.0 |
| rootAgentRef — delegação autônoma centralizada no orquestrador | 3.16.0 |
| Botão Sincronizar KB — lê README/CURRENT_STATE/ARCHITECTURE | 3.16.1 |
| Iterações autônomas configuráveis (5–200, padrão 30) | 3.16.1 |
| Relatório final do ciclo autônomo | 3.16.1 |

---

## Backlog futuro

### Alta prioridade

| ID | Feature | Esforço | Observação |
|---|---|---|---|
| SQUAD-01 | **Squad — memória persistente entre sessões** | Médio | KB atual é manual; integração com SQLite para histórico de decisões por projeto |
| SQUAD-02 | **Squad — agente com acesso à internet** | Médio | Fury (Pesquisa) faz buscas reais via tool use (Brave Search API ou similar) |
| LSP-01 | **LSP Python/Rust/Go ativo** | Baixo | Infraestrutura pronta (portas 6010–6012); falta documentar setup dos language servers nas VPS |

### Média prioridade

| ID | Feature | Esforço | Observação |
|---|---|---|---|
| IDE-23 | **Diff local — `git diff` no modo local** | Baixo | Já funciona via `local:exec`; falta expor na UI do modo local |
| IDE-24 | **Rename F2 no modo local** | Baixo | F2 já funciona no modo VPS; conectar ao `local:rename` |
| SQUAD-03 | **Agente Tester — geração automática de testes** | Alto | Integrar com runner de testes local (Vitest/Jest) e exibir resultado inline |
| SQUAD-04 | **Histórico de ações autônomas por projeto** | Médio | Log de iterações + arquivos modificados persistido no SQLite |

### Baixa prioridade / futuro distante

| ID | Feature | Esforço | Observação |
|---|---|---|---|
| IDE-25 | **LSP Go to Definition** | Alto | Requer LSP conectado; navegar entre arquivos via `textDocument/definition` |
| IDE-26 | **Extensões / plugins** | Muito alto | Fora do escopo atual |
| SQUAD-05 | **Squad multi-projeto** — agentes operando em 2+ repos simultâneos | Muito alto | Arquitetura nova |

---

## Comparativo atual com VS Code

| Feature | VS Code | NEX-ALS IDE |
|---|---|---|
| Editor Monaco | ✅ | ✅ |
| Terminal multi-tab | ✅ | ✅ |
| Explorer hierárquico | ✅ | ✅ |
| Find in Files | ✅ | ✅ |
| Command Palette | ✅ | ✅ |
| Git integrado | ✅ | ✅ |
| Split editor | ✅ | ✅ |
| LSP / IntelliSense | ✅ | ✅ TypeScript (6009) · ⚠️ PY/RS/GO infra pronta |
| Port Forwarding | ✅ | ✅ |
| Debug remoto (DAP) | ✅ | ✅ Chrome DevTools |
| Remote SSH | ✅ | ✅ |
| Modo Local | ✅ | ✅ |
| Agentes IA integrados | ❌ | ✅ Squad (8 agentes) |
| Múltiplas contas Claude | ❌ | ✅ |
| Execução autônoma | ❌ | ✅ loop configurável + rootAgentRef |
| Extensões | ✅ | ❌ fora de escopo |
| Breadcrumbs | ✅ | ❌ N/A no Monaco standalone |
