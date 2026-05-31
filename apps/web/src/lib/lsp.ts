/**
 * IDE-16: LSP via WebSocket tunnel (monaco-languageclient v10)
 *
 * Requisitos na VPS (porta 6009):
 *   npm install -g typescript-language-server typescript ws
 *   node -e "
 *     const WebSocket = require('ws');
 *     const { spawn } = require('child_process');
 *     const wss = new WebSocket.Server({ port: 6009 });
 *     wss.on('connection', ws => {
 *       const proc = spawn('typescript-language-server', ['--stdio']);
 *       ws.on('message', d => proc.stdin.write(d));
 *       proc.stdout.on('data', d => ws.send(d));
 *       proc.on('exit', () => ws.close());
 *     });
 *   "
 *
 * No IDE: abra o túnel porta local 6009 → VPS 6009, depois clique "TS LSP" na status bar.
 */

import type { Monaco } from '@monaco-editor/react'

let lspClient: { dispose(): void } | null = null

export async function connectLSP(_monaco: Monaco, wsUrl = 'ws://localhost:6009'): Promise<void> {
  if (lspClient) return

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
    name: 'HEXAGON TypeScript LSP',
    clientOptions: {
      documentSelector: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart }),
      },
    },
    messageTransports: { reader, writer },
  })

  await client.start()
  lspClient = { dispose: () => { client.stop(); ws.close() } }
}

export function disconnectLSP(): void {
  lspClient?.dispose()
  lspClient = null
}

export function isLSPConnected(): boolean {
  return lspClient !== null
}
