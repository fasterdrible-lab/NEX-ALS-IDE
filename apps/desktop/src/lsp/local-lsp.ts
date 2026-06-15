import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:http'

/**
 * Spawns typescript-language-server --stdio locally and bridges it to a
 * WebSocket server so Monaco's LSP client can connect without an SSH tunnel.
 */
export class LocalLspBridge {
  private proc: ChildProcess | null = null
  private httpServer: Server | null = null
  private port = 0
  private running = false
  private clients = new Set<{ readyState: number; send(d: string): void; close(): void }>()
  private buf = ''

  async start(workspacePath: string): Promise<number> {
    if (this.running) return this.port

    // Verify the binary exists before trying to use it
    await new Promise<void>((resolve, reject) => {
      const chk = spawn('typescript-language-server', ['--version'], {
        shell: true, stdio: 'pipe',
      })
      chk.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(
          'typescript-language-server não encontrado. ' +
          'Instale com: npm install -g typescript-language-server typescript'
        ))
      })
      chk.on('error', () => reject(new Error(
        'typescript-language-server não encontrado. ' +
        'Instale com: npm install -g typescript-language-server typescript'
      )))
    })

    this.proc = spawn('typescript-language-server', ['--stdio'], {
      cwd: workspacePath || process.cwd(),
      env: { ...process.env },
      shell: true,
    })
    this.proc.on('error', err => console.error('[LocalLSP]', err.message))
    this.proc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[LocalLSP] ${d}`))

    // Parse Content-Length framing from stdout → broadcast JSON bodies to WS clients
    this.proc.stdout?.on('data', (chunk: Buffer) => {
      this.buf += chunk.toString('utf8')
      while (true) {
        const sep = this.buf.indexOf('\r\n\r\n')
        if (sep === -1) break
        const m = this.buf.slice(0, sep).match(/Content-Length:\s*(\d+)/i)
        if (!m) { this.buf = this.buf.slice(sep + 4); continue }
        const len = parseInt(m[1], 10)
        const bodyStart = sep + 4
        if (this.buf.length < bodyStart + len) break
        const body = this.buf.slice(bodyStart, bodyStart + len)
        this.buf = this.buf.slice(bodyStart + len)
        for (const ws of this.clients) {
          if (ws.readyState === 1) ws.send(body)
        }
      }
    })

    // Create WebSocket server (dynamic port to avoid conflicts)
    const { WebSocketServer } = await import('ws')
    const wss = new WebSocketServer({ noServer: true })
    this.httpServer = createServer()

    this.httpServer.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket as never, head, ws => wss.emit('connection', ws, req))
    })

    wss.on('connection', ws => {
      const client = {
        get readyState() { return ws.readyState },
        send: (d: string) => { try { ws.send(d) } catch {} },
        close: () => { try { ws.close() } catch {} },
      }
      this.clients.add(client)
      ws.on('message', (raw: Buffer | string) => {
        const msg = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)
        const enc = Buffer.from(msg, 'utf8')
        this.proc?.stdin?.write(`Content-Length: ${enc.length}\r\n\r\n${msg}`)
      })
      ws.on('close', () => this.clients.delete(client))
    })

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(0, '127.0.0.1', () => {
        const addr = this.httpServer!.address() as { port: number }
        this.port = addr.port
        resolve()
      })
      this.httpServer!.on('error', reject)
    })

    this.running = true
    console.log(`[LocalLSP] bridge listening on ws://127.0.0.1:${this.port}`)
    return this.port
  }

  stop(): void {
    for (const ws of this.clients) ws.close()
    this.clients.clear()
    try { this.proc?.kill() } catch {}
    try { this.httpServer?.close() } catch {}
    this.proc = null
    this.httpServer = null
    this.running = false
    this.buf = ''
    this.port = 0
  }

  isRunning(): boolean { return this.running }
  getPort(): number { return this.port }
}
