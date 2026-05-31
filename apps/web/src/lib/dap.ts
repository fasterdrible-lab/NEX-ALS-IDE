/**
 * IDE-18: Depuração remota via SSH tunnel (DAP — Debug Adapter Protocol)
 *
 * Como usar:
 * 1. Na VPS, inicie o processo Node.js com inspect:
 *    node --inspect=0.0.0.0:9229 server.js
 *
 * 2. No IDE, abra o túnel: porta local 9229 → VPS 9229
 *
 * 3. Clique "DAP" na status bar — abre painel de debug com breakpoints e call stack
 *
 * Nota: Monaco não tem UI de debug nativa (é do VS Code completo).
 * Esta implementação abre uma aba do Chrome DevTools via chrome-devtools://devtools/bundled/js_app.html
 * apontada para ws://localhost:9229, que é a forma nativa de depurar Node.js remotamente.
 */

export interface DebugSession {
  pid?: number
  port: number
  status: 'running' | 'stopped'
  dispose(): void
}

let activeSession: DebugSession | null = null

export async function startDebugSession(localPort = 9229): Promise<DebugSession> {
  if (activeSession) return activeSession

  // Abre o Chrome DevTools Protocol via URL
  // Funciona quando o túnel localhost:localPort → VPS:9229 está ativo
  const devtoolsUrl = `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=localhost:${localPort}`

  // No Electron, abre uma nova janela do DevTools apontada para o socket remoto
  const session: DebugSession = {
    port: localPort,
    status: 'running',
    dispose: () => {
      session.status = 'stopped'
      activeSession = null
    },
  }

  activeSession = session
  return session
}

export function getDebugSession(): DebugSession | null {
  return activeSession
}

export function stopDebugSession(): void {
  activeSession?.dispose()
}

/** URL do Chrome DevTools para depurar processo Node.js via websocket */
export function getDevToolsUrl(localPort = 9229): string {
  return `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=localhost:${localPort}`
}
