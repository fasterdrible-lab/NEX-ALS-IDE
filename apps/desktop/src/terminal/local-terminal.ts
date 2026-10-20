import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
// node-pty com binário pronto (N-API) para Windows — o mesmo motor de terminal do VS Code, sem compilar
import * as pty from '@lydell/node-pty'

/**
 * Terminal da IDE local: PowerShell num pseudo-terminal (ConPTY), na pasta do projeto.
 * Mesma interface do TerminalSession remoto (data / close, write, resize, destroy) para o IPC
 * e as abas xterm do renderer servirem aos dois modos.
 */
export class LocalTerminalSession extends EventEmitter {
  readonly sessionId = `lterm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  private proc: pty.IPty
  private closed = false

  constructor(cwd: string) {
    super()
    if (!path.isAbsolute(cwd) || !fs.statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`Pasta não encontrada: ${cwd}`)
    }
    const env = { ...process.env } as Record<string, string>
    // Herdado de ferramentas que rodam o Electron como Node: quebraria qualquer app Electron iniciado no terminal
    delete env['ELECTRON_RUN_AS_NODE']
    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env['SHELL'] || 'bash')
    this.proc = pty.spawn(shell, process.platform === 'win32' ? ['-NoLogo'] : [], {
      name: 'xterm-256color', cols: 120, rows: 30, cwd, env,
    })
    this.proc.onData(d => this.emit('data', d))
    this.proc.onExit(() => { this.closed = true; this.emit('close') })
  }

  write(data: string): void { if (!this.closed) this.proc.write(data) }

  resize(cols: number, rows: number): void {
    if (this.closed || !(cols > 0 && rows > 0)) return
    try { this.proc.resize(Math.floor(cols), Math.floor(rows)) } catch { /* processo saindo */ }
  }

  destroy(): void {
    if (this.closed) return
    this.closed = true
    try { this.proc.kill() } catch { /* já saiu */ }
  }
}
