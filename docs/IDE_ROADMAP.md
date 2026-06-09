# IDE_ROADMAP.md — NEX-ALS IDE: O que falta

**Data:** 2026-05-30  
**Versão atual:** 1.0.7  
**Objetivo:** transformar o layout de editor+terminal+explorer num ambiente de desenvolvimento integrado completo

---

## Diagnóstico atual

O `IDEPage` tem estrutura de IDE mas lhe faltam as funcionalidades que definem uma IDE:

| Camada | Tem? | Falta |
|---|---|---|
| Editor (Monaco) | ✅ tabs, syntax, Ctrl+S | Find in files, split editor, go-to-def |
| Terminal (xterm) | ✅ 1 sessão SSH | Múltiplas abas de terminal |
| Explorer (SFTP) | ✅ navega, abre, renomeia | Criar arquivo, tree aninhada, busca |
| Git | ❌ zero | Tudo: status, diff, commit, push, pull |
| Status bar | ⚠️ básica | Branch git, linha:coluna, erros |
| Busca global | ❌ zero | Find in files (Ctrl+Shift+F) |
| Paleta de comandos | ❌ | Ctrl+Shift+P (Monaco tem, não está mapeado) |

---

## Tarefas por prioridade

---

### P0 — BLOQUEADORES (coisas que uma IDE não pode não ter)

#### IDE-01 · Criar arquivo no explorer

**Problema:** existe botão "Nova pasta" mas nenhum botão "Novo arquivo". Não é possível criar arquivos pela interface.

**Implementação:**
- Frontend: adicionar botão `<FilePlus>` no header do explorer (ao lado de `<FolderPlus>`)
- Input inline para nome do arquivo (mesmo padrão do `newDirMode`)
- Backend: `SftpSession.touch(path)` — `sftp.open(path, 'w', {}, cb)` e fechar imediatamente
- IPC: `sftp:touch` → `ipc.sftp.touch(sessionId, path)`

**Arquivos:**
- `packages/core/src/sftp/sftp.service.ts` — adicionar `touch(path)`
- `apps/desktop/src/ipc/handlers.ts` — adicionar `sftp:touch`
- `apps/desktop/src/preload.ts` — whitelist `sftp:touch`
- `apps/web/src/lib/ipc.ts` — adicionar `ipc.sftp.touch`
- `apps/web/src/pages/IDEPage.tsx` — UI do new file

---

#### IDE-02 · Tree view aninhada (hierárquica)

**Problema:** o explorer atual navega uma pasta por vez (estilo gerenciador de arquivos dos anos 90). Uma IDE mostra a árvore completa com pastas expansíveis inline.

**Implementação:**
- Substituir o estado `entries: FileEntry[]` + `curPath: string` por um mapa de nós de árvore:
  ```ts
  interface TreeNode {
    entry: FileEntry
    children?: TreeNode[]   // undefined = não carregado ainda
    expanded: boolean
  }
  ```
- Carregamento lazy: clicar numa pasta chama `sftp.readdir(sessionId, path)` e popula `children`
- Renderização recursiva com indentação (`paddingLeft: depth * 12px`)
- Estado persistido por path (recolhe ao navegar para o pai)

**Arquivos:**
- `apps/web/src/pages/IDEPage.tsx` — refatorar todo o componente `FileTree`

---

#### IDE-03 · Busca global em arquivos (Find in Files)

**Problema:** não existe busca por conteúdo em múltiplos arquivos. É impossível trabalhar sem isso.

**Implementação:**
- Atalho: `Ctrl+Shift+F` abre painel de busca lateral (substitui o explorer ou fica em tab)
- Backend: `TerminalService` executa via SSH: `grep -rn --include="*.ts" "pattern" /path`
- Parse do output grep (`filename:line:content`) → lista de resultados
- Click no resultado → abre arquivo no Monaco na linha correta (`editor.revealLineInCenter(line)`)
- Novo IPC: `terminal:exec(vpsId, cmd)` → executa comando SSH único (não shell interativo)

**Arquivos:**
- `packages/core/src/terminal/terminal.service.ts` — adicionar `exec(vpsId, cmd): Promise<string>`
- `apps/desktop/src/ipc/handlers.ts` — `terminal:exec`
- `apps/desktop/src/preload.ts` — whitelist
- `apps/web/src/lib/ipc.ts` — `ipc.terminal.exec`
- `apps/web/src/pages/IDEPage.tsx` — painel de busca e resultados

---

### P1 — ALTA PRIORIDADE (diferenciam IDE de editor)

#### IDE-04 · Integração Git (painel Source Control)

**Problema:** sem git, não há como saber o que mudou, commitar ou sincronizar. O propósito central do app é gerenciar projetos em VPS — git é inseparável disso.

**Implementação:**

Backend — `packages/core/src/git/git.service.ts`:
```ts
class GitService {
  exec(vpsId: string, cwd: string, cmd: string): Promise<string>
  status(vpsId: string, cwd: string): Promise<GitStatus>
  diff(vpsId: string, cwd: string, file?: string): Promise<string>
  add(vpsId: string, cwd: string, files: string[]): Promise<void>
  commit(vpsId: string, cwd: string, message: string): Promise<void>
  push(vpsId: string, cwd: string): Promise<string>
  pull(vpsId: string, cwd: string): Promise<string>
  log(vpsId: string, cwd: string, n?: number): Promise<GitCommit[]>
  branches(vpsId: string, cwd: string): Promise<GitBranch[]>
  checkout(vpsId: string, cwd: string, branch: string): Promise<void>
}
```

Frontend — tab "Source Control" no painel esquerdo (ícone `GitBranch`):
- Seções: "Staged", "Unstaged", "Untracked"
- Click num arquivo → abre diff no Monaco (modo `diff`)
- Botão "Commit" com input de mensagem
- Botões "Push" / "Pull" / "Fetch"
- Branch atual na status bar (bottom)

IPC channels: `git:status`, `git:diff`, `git:add`, `git:commit`, `git:push`, `git:pull`, `git:log`, `git:branches`, `git:checkout`

**Arquivos:**
- `packages/core/src/git/git.service.ts` — novo
- `packages/core/src/index.ts` — exportar GitService
- `apps/desktop/src/ipc/handlers.ts` — handlers git:*
- `apps/desktop/src/preload.ts` — whitelist git:*
- `apps/web/src/lib/ipc.ts` — métodos git
- `apps/web/src/pages/IDEPage.tsx` — painel git, diff viewer

---

#### IDE-05 · Múltiplas abas de terminal

**Problema:** o IDE tem apenas uma sessão de terminal. Desenvolvimento real exige múltiplos: um para servidor, um para testes, um para git, etc.

**Implementação:**
- Substituir o terminal único por um array de sessões:
  ```ts
  interface TermTab { id: string; sessionId: string | null; title: string; status: TermStatus }
  const [termTabs, setTermTabs] = useState<TermTab[]>([])
  const [activeTermId, setActiveTermId] = useState<string | null>(null)
  ```
- Tab bar no header do terminal: `Terminal 1 × | Terminal 2 × | +`
- Cada aba: instância xterm.js separada (montar/desmontar ao trocar)
- Reutilizar a lógica atual de `ipc.terminal.open/close/input/resize`

**Arquivos:**
- `apps/web/src/pages/IDEPage.tsx` — refatorar seção do terminal

---

#### IDE-06 · Status bar completa

**Problema:** a status bar atual mostra apenas path e o dica de Ctrl+`. Falta informação crítica.

**Implementação:**
- **Esquerda:** branch git atual (se projeto git) com ícone `GitBranch`
- **Centro:** contador de erros/avisos Monaco (`errorCount`, `warningCount` via `monaco.editor.getModelMarkers`)
- **Direita:** `Ln X, Col Y` | `UTF-8` | `nome da linguagem` | `Espaços: 2`
- Update em tempo real: `editor.onDidChangeCursorPosition` → atualiza Ln/Col
- Update git: chamada periódica ou após operação git

**Arquivos:**
- `apps/web/src/pages/IDEPage.tsx` — expandir componente de status bar

---

#### IDE-07 · Paleta de comandos (Command Palette)

**Problema:** `Ctrl+Shift+P` é o atalho mais básico de qualquer IDE moderna. Monaco tem paleta nativa mas não está mapeada.

**Implementação:**
- Monaco já tem: `editor.trigger('keyboard', 'editor.action.quickCommand', null)`
- Mapear `Ctrl+Shift+P` no `useEffect` de keyboard shortcuts:
  ```ts
  if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key === 'P') {
    e.preventDefault()
    editorRef.current?.trigger('keyboard', 'editor.action.quickCommand', null)
  }
  ```
- Paleta inclui: Format Document, Find/Replace, Go to Line, etc.

**Arquivos:**
- `apps/web/src/pages/IDEPage.tsx` — uma linha no handler de teclado

---

### P2 — MÉDIA PRIORIDADE (qualidade de vida)

#### IDE-08 · Find/Replace no arquivo atual

Monaco já tem Ctrl+H nativo. Basta garantir que o atalho não está sendo interceptado.

---

#### IDE-09 · Go to Line (Ctrl+G)

Monaco nativo. Mesma garantia de atalho.

---

#### IDE-10 · Breadcrumbs no editor

Monaco suporta `editor.showFoldingControls` e a barra de breadcrumbs via `editor.breadcrumbs.enabled`. Ativar nas opções do Monaco:
```ts
breadcrumbs: { enabled: true }
```

---

#### IDE-11 · Preview de imagem

Quando um arquivo de imagem for selecionado (`.png`, `.jpg`, etc.):
- Em vez de "arquivo não suportado", mostrar `<img>` via data URL
- Backend: `sftp.readFileBase64(sessionId, path)` → retorna base64
- Frontend: `<img src={\`data:image/png;base64,${data}\`} />`

---

#### IDE-12 · Painel de Problemas (Problems)

Monaco diagnostics API:
- `monaco.editor.onDidChangeMarkers(() => { ... })`
- Lista de erros/warnings com arquivo, linha, mensagem
- Tab "Problems" no painel inferior (ao lado do Terminal)

---

#### IDE-13 · Copiar/mover arquivos

Context menu: adicionar "Copiar caminho", "Cortar", "Colar"  
Backend: `SftpSession.copy(from, to)` via SSH exec `cp -r src dst`  
Implementação simples: exec SSH `cp` / `mv` diretamente

---

#### IDE-14 · Refresh automático da tree

Problema: após salvar um arquivo que cria outros (ex: compile step), a tree não atualiza.  
Fix simples: botão de refresh manual com atalho (já existe).  
Fix completo: polling do `sftp.readdir` a cada 5s (se explorer visível).

---

### P3 — BAIXA PRIORIDADE (para versões futuras)

#### IDE-15 · Split editor (dois arquivos lado a lado)
Monaco suporta `createDiffEditor` e `addEditorTabsToGrid`. Complexo de implementar mas possível.

#### IDE-16 · LSP / IntelliSense remoto
Conectar a um language server rodando na VPS via WebSocket/SSH tunnel.  
Complexíssimo. Requer `monaco-languageclient` e servidor LSP na VPS (ex: `typescript-language-server`).

#### IDE-17 · Remote port forwarding
`ssh -L local:remote` para acessar `localhost:3000` da VPS no browser local.  
Backend: abrir túnel SSH; Frontend: botão "Forward Port".

#### IDE-18 · Depuração remota
DAP (Debug Adapter Protocol) via SSH. Extremamente complexo. Futuro distante.

---

## Sequência de implementação recomendada

```
Sprint 1 (esta semana):
  IDE-01 · Criar arquivo
  IDE-07 · Paleta de comandos (trivial)
  IDE-06 · Status bar completa
  
Sprint 2:
  IDE-02 · Tree view aninhada (maior refactor)
  IDE-05 · Múltiplas abas de terminal
  
Sprint 3:
  IDE-03 · Busca global (Find in Files)
  
Sprint 4:
  IDE-04 · Git integrado (maior feature, mais valor)

Sprint 5+:
  IDE-08 a IDE-14 (polish e QoL)
```

---

## Comparativo com VS Code

| Feature | VS Code | NEX-ALS IDE |
|---|---|---|
| Editor Monaco | ✅ | ✅ |
| Terminal integrado | ✅ multi-tab | ⚠️ 1 aba |
| Explorer hierárquico | ✅ | ❌ flat |
| Criar arquivo/pasta | ✅ | ⚠️ só pasta |
| Find in Files | ✅ | ❌ |
| Command Palette | ✅ | ❌ (trivial) |
| Git integrado | ✅ | ❌ |
| Status bar git | ✅ | ❌ |
| Remote SSH | ✅ | ✅ (via launcher) |
| LSP/IntelliSense | ✅ | ❌ (P3) |
| Extensões | ✅ | ❌ (fora de escopo) |

---

## Contexto de reinício de conversa

Se esta conversa precisar ser reiniciada, dizer ao Claude:
> "Leia AGENTE.md, CHANGELOG.md, docs/CURRENT_STATE.md, docs/TASKS.md, docs/ARCHITECTURE.md e docs/IDE_ROADMAP.md antes de começar."

O IDE básico está funcional em `pnpm dev` (via `node scripts/dev.js`).  
A rota do IDE é `/ide/:vpsId/:vpsName`.  
A próxima tarefa é **IDE-01 (criar arquivo)** seguida de **IDE-07 (paleta de comandos)**.
