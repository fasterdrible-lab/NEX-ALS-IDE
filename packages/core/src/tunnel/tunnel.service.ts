import net from 'node:net'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client as SshClient, type ConnectConfig } from 'ssh2'
import { getPrismaClient } from '@cwm/db'
import { decryptPassword } from '@cwm/config'
import { buildHostVerifier, FINGERPRINT_MISMATCH_MSG } from '../ssh/ssh-connect.js'

export interface TunnelInfo {
  id: string
  vpsId: string
  localPort: number
  remoteHost: string
  remotePort: number
  status: 'active' | 'closed'
}

export class TunnelService {
  private db = getPrismaClient()
  private tunnels = new Map<string, { server: net.Server; conn: SshClient; info: TunnelInfo }>()

  private async buildConnectConfig(vpsId: string): Promise<{ config: ConnectConfig; wasMismatch: () => boolean }> {
    const vps = await this.db.vpsServer.findUniqueOrThrow({ where: { id: vpsId } })
    const settings = await this.db.settings.findUnique({ where: { id: 'default' } })
    const keyPath = settings?.sshKeyPath || join(homedir(), '.ssh', 'id_rsa')
    let privateKey: Buffer | undefined
    try { privateKey = readFileSync(keyPath) } catch { /* sem chave */ }
    const plainPassword = vps.sshPassword ? decryptPassword(vps.sshPassword) : undefined

    const { hostVerifier, wasMismatch } = buildHostVerifier(vps.id, vps.sshHostFingerprint ?? null)
    const config: ConnectConfig = {
      host: vps.host, port: vps.port, username: vps.username,
      readyTimeout: 15000, hostVerifier,
    }
    if (privateKey) {
      config.privateKey = privateKey
      if (plainPassword) config.passphrase = plainPassword
    } else if (plainPassword) {
      config.password = plainPassword
    } else {
      const sock = process.env['SSH_AUTH_SOCK']
        ?? (process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined)
      if (sock) config.agent = sock
    }
    return { config, wasMismatch }
  }

  async open(vpsId: string, localPort: number, remotePort: number, remoteHost = '127.0.0.1'): Promise<TunnelInfo> {
    const id = `${vpsId}:${localPort}:${remoteHost}:${remotePort}`
    if (this.tunnels.has(id)) return this.tunnels.get(id)!.info

    const { config, wasMismatch } = await this.buildConnectConfig(vpsId)
    const info: TunnelInfo = { id, vpsId, localPort, remoteHost, remotePort, status: 'active' }

    return new Promise((resolve, reject) => {
      const conn = new SshClient()
      conn.on('error', err => reject(new Error(wasMismatch() ? FINGERPRINT_MISMATCH_MSG : err.message)))
      conn.on('ready', () => {
        const server = net.createServer(socket => {
          conn.forwardOut('127.0.0.1', localPort, remoteHost, remotePort, (err, stream) => {
            if (err) { socket.destroy(); return }
            socket.pipe(stream).pipe(socket)
            stream.on('close', () => socket.destroy())
            socket.on('close', () => stream.destroy())
          })
        })
        server.listen(localPort, '127.0.0.1', () => {
          this.tunnels.set(id, { server, conn, info })
          resolve(info)
        })
        server.on('error', reject)
      })
      conn.connect(config)
    })
  }

  close(tunnelId: string): void {
    const t = this.tunnels.get(tunnelId)
    if (!t) return
    try { t.server.close() } catch { /* ignorar */ }
    try { t.conn.end() } catch { /* ignorar */ }
    t.info.status = 'closed'
    this.tunnels.delete(tunnelId)
  }

  list(): TunnelInfo[] {
    return Array.from(this.tunnels.values()).map(t => t.info)
  }

  closeAll(): void {
    for (const id of this.tunnels.keys()) this.close(id)
  }
}
