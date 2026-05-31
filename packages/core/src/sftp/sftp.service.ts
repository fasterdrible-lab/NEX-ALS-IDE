import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client as SshClient, type SFTPWrapper, type ConnectConfig } from 'ssh2'
import { getPrismaClient } from '@cwm/db'
import { decryptPassword } from '@cwm/config'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
  permissions: string
}

export class SftpSession {
  readonly sessionId: string
  private sftp: SFTPWrapper
  private conn: SshClient

  constructor(conn: SshClient, sftp: SFTPWrapper, sessionId: string) {
    this.conn = conn
    this.sftp = sftp
    this.sessionId = sessionId
  }

  readdir(dirPath: string): Promise<FileEntry[]> {
    return new Promise((resolve, reject) => {
      this.sftp.readdir(dirPath, (err, list) => {
        if (err) { reject(new Error(`Erro ao listar ${dirPath}: ${err.message}`)); return }
        const entries: FileEntry[] = list
          .filter(e => e.filename !== '.' && e.filename !== '..')
          .map(e => {
            const isDir = e.longname.startsWith('d')
            const fullPath = dirPath.replace(/\/$/, '') + '/' + e.filename
            return {
              name: e.filename,
              path: fullPath,
              isDirectory: isDir,
              size: e.attrs.size ?? 0,
              modifiedAt: (e.attrs.mtime ?? 0) * 1000,
              permissions: e.longname.slice(0, 10),
            }
          })
          .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
            return a.name.localeCompare(b.name)
          })
        resolve(entries)
      })
    })
  }

  readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = this.sftp.createReadStream(filePath)
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      stream.on('error', (err: Error) => reject(new Error(`Erro ao ler ${filePath}: ${err.message}`)))
    })
  }

  writeFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = this.sftp.createWriteStream(filePath)
      stream.on('close', resolve)
      stream.on('error', (err: Error) => reject(new Error(`Erro ao salvar ${filePath}: ${err.message}`)))
      stream.end(content, 'utf8')
    })
  }

  mkdir(dirPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sftp.mkdir(dirPath, (err) => {
        if (err) reject(new Error(`Erro ao criar pasta ${dirPath}: ${err.message}`))
        else resolve()
      })
    })
  }

  delete(targetPath: string, isDirectory: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const cb = (err: Error | null | undefined) => {
        if (err) reject(new Error(`Erro ao excluir: ${err.message}`))
        else resolve()
      }
      if (isDirectory) this.sftp.rmdir(targetPath, cb)
      else this.sftp.unlink(targetPath, cb)
    })
  }

  rename(oldPath: string, newPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sftp.rename(oldPath, newPath, (err: Error | null | undefined) => {
        if (err) reject(new Error(`Erro ao renomear: ${err.message}`))
        else resolve()
      })
    })
  }

  readFileBase64(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = this.sftp.createReadStream(filePath)
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
      stream.on('error', (err: Error) => reject(new Error(`Erro ao ler ${filePath}: ${err.message}`)))
    })
  }

  touch(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sftp.open(filePath, 'w', (err, handle) => {
        if (err) { reject(new Error(`Erro ao criar ${filePath}: ${err.message}`)); return }
        this.sftp.close(handle, (err2) => {
          if (err2) reject(new Error(`Erro ao criar ${filePath}: ${err2.message}`))
          else resolve()
        })
      })
    })
  }

  destroy(): void {
    try { this.conn.end() } catch { /* ignorar */ }
  }
}

export class SftpService {
  private get db() { return getPrismaClient() }

  async openSession(vpsId: string): Promise<SftpSession> {
    const vps = await this.db.vpsServer.findUnique({ where: { id: vpsId } })
    if (!vps) throw new Error(`VPS não encontrada: ${vpsId}`)

    const settings = await this.db.settings.findUnique({ where: { id: 'default' } })
    const keyPath = settings?.sshKeyPath || join(homedir(), '.ssh', 'id_rsa')

    let privateKey: Buffer | undefined
    try { privateKey = readFileSync(keyPath) } catch { /* sem chave */ }

    const plainPassword = vps.sshPassword ? decryptPassword(vps.sshPassword) : undefined
    const sessionId = `sftp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    return new Promise<SftpSession>((resolve, reject) => {
      const conn = new SshClient()

      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) { conn.end(); reject(err); return }
          resolve(new SftpSession(conn, sftp, sessionId))
        })
      })

      conn.on('error', (err) => {
        const msg = err.message || ''
        reject(new Error(
          msg.includes('ECONNREFUSED') ? 'Conexão recusada — verifique a porta SSH'
          : msg.includes('ETIMEDOUT') ? 'Timeout — VPS não respondeu'
          : msg.toLowerCase().includes('auth') ? 'Autenticação falhou — verifique usuário/chave/senha'
          : msg
        ))
      })

      const config: ConnectConfig = {
        host: vps.host,
        port: vps.port,
        username: vps.username,
        readyTimeout: 15000,
        hostVerifier: () => true,
      }

      if (privateKey) {
        config.privateKey = privateKey
        if (plainPassword) config.passphrase = plainPassword
      } else if (plainPassword) {
        config.password = plainPassword
      } else {
        const agentSock = process.env['SSH_AUTH_SOCK']
          ?? (process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined)
        if (agentSock) config.agent = agentSock
      }

      conn.connect(config)
    })
  }
}
