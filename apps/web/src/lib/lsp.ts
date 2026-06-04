/**
 * IDE-16 / IDE-22: LSP via WebSocket tunnel (monaco-languageclient v10)
 *
 * Padrão comum: instale o language server + inicie o wrapper WebSocket na VPS,
 * abra o túnel SSH (aba Portas) e clique o botão LSP na status bar.
 *
 * ── TypeScript / JavaScript — porta 6009 ─────────────────────────────────────
 *   npm install -g typescript-language-server typescript ws
 *   node -e "const W=require('ws'),{spawn}=require('child_process');
 *     new W.Server({port:6009}).on('connection',ws=>{
 *       const p=spawn('typescript-language-server',['--stdio']);
 *       ws.on('message',d=>p.stdin.write(d));p.stdout.on('data',d=>ws.send(d));
 *       p.on('exit',()=>ws.close())});"
 *
 * ── Python (pylsp) — porta 6010 ──────────────────────────────────────────────
 *   pip install python-lsp-server  &&  npm install -g ws
 *   node -e "const W=require('ws'),{spawn}=require('child_process');
 *     new W.Server({port:6010}).on('connection',ws=>{
 *       const p=spawn('pylsp');
 *       ws.on('message',d=>p.stdin.write(d));p.stdout.on('data',d=>ws.send(d));
 *       p.on('exit',()=>ws.close())});"
 *
 * ── Rust (rust-analyzer) — porta 6011 ────────────────────────────────────────
 *   rustup component add rust-analyzer
 *   node -e "const W=require('ws'),{spawn}=require('child_process');
 *     new W.Server({port:6011}).on('connection',ws=>{
 *       const p=spawn('rust-analyzer');
 *       ws.on('message',d=>p.stdin.write(d));p.stdout.on('data',d=>ws.send(d));
 *       p.on('exit',()=>ws.close())});"
 *
 * ── Go (gopls) — porta 6012 ──────────────────────────────────────────────────
 *   go install golang.org/x/tools/gopls@latest
 *   node -e "const W=require('ws'),{spawn}=require('child_process');
 *     new W.Server({port:6012}).on('connection',ws=>{
 *       const p=spawn('gopls');
 *       ws.on('message',d=>p.stdin.write(d));p.stdout.on('data',d=>ws.send(d));
 *       p.on('exit',()=>ws.close())});"
 */

import type { Monaco } from '@monaco-editor/react'

export interface LspConfig {
  port: number
  label: string
  name: string
  documentSelector: string[]
}

export const LSP_CONFIGS: Record<string, LspConfig> = {
  typescript: {
    port: 6009,
    label: 'TS',
    name: 'TypeScript LSP',
    documentSelector: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
  },
  python: {
    port: 6010,
    label: 'PY',
    name: 'Python LSP',
    documentSelector: ['python'],
  },
  rust: {
    port: 6011,
    label: 'RS',
    name: 'Rust LSP',
    documentSelector: ['rust'],
  },
  go: {
    port: 6012,
    label: 'GO',
    name: 'Go LSP',
    documentSelector: ['go'],
  },
}

/** Returns the LSP key for a given Monaco language ID, or null if unsupported. */
export function monacoLangToLspKey(monacoLang: string): string | null {
  if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(monacoLang)) return 'typescript'
  if (monacoLang === 'python') return 'python'
  if (monacoLang === 'rust') return 'rust'
  if (monacoLang === 'go') return 'go'
  return null
}

// Active LSP client instances keyed by language key
const activeClients = new Map<string, { dispose(): void }>()

export async function connectLSP(monaco: Monaco, langKey: string): Promise<void> {
  if (activeClients.has(langKey)) return

  const config = LSP_CONFIGS[langKey]
  if (!config) throw new Error(`LSP: linguagem '${langKey}' não suportada`)

  const wsUrl = `ws://localhost:${config.port}`

  const { MonacoLanguageClient } = await import('monaco-languageclient')
  const { WebSocketMessageReader, WebSocketMessageWriter, toSocket } = await import('vscode-ws-jsonrpc')
  const { CloseAction, ErrorAction } = await import('vscode-languageclient')

  const ws = new WebSocket(wsUrl)

  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve())
    ws.addEventListener('error', () => reject(new Error(`LSP: não conectou em ${wsUrl}`)))
    setTimeout(() => reject(new Error('LSP: timeout de conexão')), 5000)
  })

  const socket = toSocket(ws as unknown as WebSocket)
  const reader = new WebSocketMessageReader(socket)
  const writer = new WebSocketMessageWriter(socket)

  const client = new MonacoLanguageClient({
    name: `HEXAGON ${config.name}`,
    clientOptions: {
      documentSelector: config.documentSelector,
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart }),
      },
    },
    messageTransports: { reader, writer },
  })

  await client.start()
  activeClients.set(langKey, { dispose: () => { client.stop(); ws.close() } })
}

export function disconnectLSP(langKey: string): void {
  activeClients.get(langKey)?.dispose()
  activeClients.delete(langKey)
}

export function disconnectAllLSP(): void {
  for (const key of Array.from(activeClients.keys())) disconnectLSP(key)
}

export function isLSPConnected(langKey: string): boolean {
  return activeClients.has(langKey)
}
