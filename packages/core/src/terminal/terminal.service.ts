import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client as SshClient, type ConnectConfig, type ClientChannel } from 'ssh2'
import { getPrismaClient } from '@cwm/db'
import { decryptPassword } from '@cwm/config'
import { buildHostVerifier, FINGERPRINT_MISMATCH_MSG } from '../ssh/ssh-connect.js'

export class TerminalSession extends EventEmitter {
  readonly sessionId: string
  private conn: SshClient
  private stream: ClientChannel | null = null

  constructor(conn: SshClient, sessionId: string) {
    super()
    this.conn = conn
    this.sessionId = sessionId
  }

  attach(stream: ClientChannel): void {
    this.stream = stream
    stream.on('data', (chunk: Buffer) => this.emit('data', chunk.toString('utf8')))
    stream.stderr?.on('data', (chunk: Buffer) => this.emit('data', chunk.toString('utf8')))
    stream.on('close', () => {
      try { this.conn.end() } catch { /* ignorar */ }
      this.emit('close')
    })
  }

  write(data: string): void {
    this.stream?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.stream?.setWindow(rows, cols, 0, 0)
  }

  destroy(): void {
    try { this.conn.end() } catch { /* ignorar */ }
  }
}

export class ExecStream extends EventEmitter {
  // eventos: 'data' (chunk: string), 'close' (code: number | null), 'error' (err: Error)
  constructor(private conn: SshClient, private stream: ClientChannel) {
    super()
    stream.on('data', (d: Buffer) => this.emit('data', d.toString('utf8')))
    stream.stderr?.on('data', (d: Buffer) => this.emit('data', d.toString('utf8')))
    stream.on('close', (code: number) => {
      this.emit('close', code)
      try { conn.end() } catch { /* ignorar */ }
    })
  }

  kill(): void {
    try { this.stream.close() } catch { /* ignorar */ }
    try { this.conn.end() } catch { /* ignorar */ }
  }
}

export class TerminalService {
  private get db() { return getPrismaClient() }

  private async sshConnect(vpsId: string) {
    const vps = await this.db.vpsServer.findUnique({ where: { id: vpsId } })
    if (!vps) throw new Error(`VPS não encontrada: ${vpsId}`)
    const settings = await this.db.settings.findUnique({ where: { id: 'default' } })
    const keyPath = settings?.sshKeyPath || join(homedir(), '.ssh', 'id_rsa')
    let privateKey: Buffer | undefined
    try { privateKey = readFileSync(keyPath) } catch { }
    const password = vps.sshPassword ? decryptPassword(vps.sshPassword) : undefined
    return { vps, privateKey, password }
  }

  async exec(vpsId: string, cmd: string, timeoutMs = 20000): Promise<string> {
    const { vps, privateKey, password } = await this.sshConnect(vpsId)
    return new Promise<string>((resolve, reject) => {
      const conn = new SshClient()
      const timer = setTimeout(() => { conn.end(); reject(new Error('Timeout')) }, timeoutMs)
      conn.on('ready', () => {
        conn.exec(cmd, (err, stream) => {
          if (err) { clearTimeout(timer); conn.end(); reject(err); return }
          let out = ''
          stream.on('data', (d: Buffer) => { out += d.toString('utf8') })
          stream.stderr?.on('data', (d: Buffer) => { out += d.toString('utf8') })
          stream.on('close', () => { clearTimeout(timer); conn.end(); resolve(out) })
        })
      })
      const { hostVerifier, wasMismatch } = buildHostVerifier(vps.id, vps.sshHostFingerprint ?? null)
      conn.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(wasMismatch() ? FINGERPRINT_MISMATCH_MSG : err.message))
      })
      const config: ConnectConfig = {
        host: vps.host, port: vps.port, username: vps.username,
        readyTimeout: 10000, hostVerifier,
      }
      if (privateKey) {
        config.privateKey = privateKey
        if (password) config.passphrase = password
      } else if (password) {
        config.password = password
      } else {
        const agentSock = process.env['SSH_AUTH_SOCK']
          ?? (process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined)
        if (agentSock) config.agent = agentSock
      }
      conn.connect(config)
    })
  }

  /** Exec one-shot com dados incrementais (não bufferiza até o fim, como `exec()`). */
  async execStream(vpsId: string, cmd: string): Promise<ExecStream> {
    const { vps, privateKey, password } = await this.sshConnect(vpsId)
    return new Promise<ExecStream>((resolve, reject) => {
      const conn = new SshClient()
      let execStream: ExecStream | null = null
      conn.on('ready', () => {
        conn.exec(cmd, (err, stream) => {
          if (err) { conn.end(); reject(err); return }
          execStream = new ExecStream(conn, stream)
          resolve(execStream)
        })
      })
      const { hostVerifier, wasMismatch } = buildHostVerifier(vps.id, vps.sshHostFingerprint ?? null)
      conn.on('error', (err) => {
        const msg = wasMismatch() ? FINGERPRINT_MISMATCH_MSG : err.message
        // Erro pré-conexão: rejeita a promise. Pós-conexão (stream já entregue): repassa via evento 'error'.
        if (execStream) execStream.emit('error', new Error(msg))
        else reject(new Error(msg))
      })
      const config: ConnectConfig = {
        host: vps.host, port: vps.port, username: vps.username,
        readyTimeout: 10000, hostVerifier,
      }
      if (privateKey) {
        config.privateKey = privateKey
        if (password) config.passphrase = password
      } else if (password) {
        config.password = password
      } else {
        const agentSock = process.env['SSH_AUTH_SOCK']
          ?? (process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined)
        if (agentSock) config.agent = agentSock
      }
      conn.connect(config)
    })
  }

  async openShell(vpsId: string): Promise<TerminalSession> {
    const { vps, privateKey, password } = await this.sshConnect(vpsId)
    const sessionId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    return new Promise<TerminalSession>((resolve, reject) => {
      const conn = new SshClient()
      const session = new TerminalSession(conn, sessionId)

      conn.on('ready', () => {
        conn.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
          if (err) { conn.end(); reject(err); return }
          session.attach(stream)
          resolve(session)
        })
      })

      const { hostVerifier, wasMismatch } = buildHostVerifier(vps.id, vps.sshHostFingerprint ?? null)
      conn.on('error', (err) => {
        const msg = err.message || ''
        reject(new Error(
          wasMismatch() ? FINGERPRINT_MISMATCH_MSG
          : msg.includes('ECONNREFUSED') ? 'Conexão recusada — verifique a porta SSH'
          : msg.includes('ETIMEDOUT') ? 'Timeout — VPS não respondeu'
          : msg.toLowerCase().includes('auth') ? 'Autenticação falhou — verifique usuário/chave/senha SSH'
          : msg
        ))
      })

      const config: ConnectConfig = {
        host: vps.host, port: vps.port, username: vps.username,
        readyTimeout: 15000, hostVerifier,
      }
      if (privateKey) {
        config.privateKey = privateKey
        if (password) config.passphrase = password
      } else if (password) {
        config.password = password
      } else {
        const agentSock = process.env['SSH_AUTH_SOCK']
          ?? (process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined)
        if (agentSock) config.agent = agentSock
      }
      conn.connect(config)
    })
  }
}
