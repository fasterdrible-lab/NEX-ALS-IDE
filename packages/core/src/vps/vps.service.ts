import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client as SshClient, type ConnectConfig } from 'ssh2'
import { getPrismaClient } from '@cwm/db'
import { VpsServerSchema, type VpsServerInput, type TestConnectionResult, type ClaudeCheckResult, encryptPassword, decryptPassword } from '@cwm/config'

export class VpsService {
  private get db() {
    return getPrismaClient()
  }

  async list() {
    return this.db.vpsServer.findMany({ orderBy: { createdAt: 'asc' } })
  }

  async findById(id: string) {
    const vps = await this.db.vpsServer.findUnique({ where: { id } })
    if (!vps) throw new Error(`VPS não encontrada: ${id}`)
    return vps
  }

  async create(input: VpsServerInput) {
    const data = VpsServerSchema.parse(input)
    if (data.sshPassword) data.sshPassword = encryptPassword(data.sshPassword)
    return this.db.vpsServer.create({ data })
  }

  async update(id: string, input: Partial<VpsServerInput>) {
    await this.findById(id)
    const data = VpsServerSchema.partial().parse(input)
    if (data.sshPassword) data.sshPassword = encryptPassword(data.sshPassword)
    else if (data.sshPassword === '') data.sshPassword = null
    return this.db.vpsServer.update({ where: { id }, data })
  }

  async delete(id: string) {
    await this.findById(id)
    return this.db.vpsServer.delete({ where: { id } })
  }

  /** Abre uma conexão SSH, executa um comando e retorna stdout. Lança erro em falha de conexão. */
  private async _sshExec(vpsId: string, command: string, timeoutMs = 15000): Promise<string> {
    const vps = await this.findById(vpsId)
    const settings = await this.db.settings.findUnique({ where: { id: 'default' } })
    const keyPath = settings?.sshKeyPath || join(homedir(), '.ssh', 'id_rsa')

    let privateKey: Buffer | undefined
    try { privateKey = readFileSync(keyPath) } catch { /* sem chave explícita */ }

    const plainPassword = vps.sshPassword ? decryptPassword(vps.sshPassword) : undefined

    return new Promise<string>((resolve, reject) => {
      const conn = new SshClient()
      let settled = false

      const fail = (msg: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try { conn.destroy() } catch { /* ignorar */ }
        reject(new Error(msg))
      }

      const timer = setTimeout(() => fail(`Timeout após ${timeoutMs / 1000}s`), timeoutMs)

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) { fail(err.message); return }

          let stdout = ''
          stream.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
          stream.stderr.on('data', () => { /* ignorar stderr */ })
          stream.on('close', () => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            try { conn.end() } catch { /* ignorar */ }
            resolve(stdout)
          })
        })
      })

      conn.on('error', (err) => {
        const msg = err.message || ''
        fail(
          msg.includes('ECONNREFUSED') ? 'Conexão recusada — verifique a porta SSH'
          : msg.includes('ETIMEDOUT') ? 'Timeout de conexão'
          : msg.toLowerCase().includes('auth') ? 'Autenticação falhou — verifique usuário/chave/senha SSH'
          : msg.split('\n')[0]
        )
      })

      const config: ConnectConfig = {
        host: vps.host,
        port: vps.port,
        username: vps.username,
        readyTimeout: timeoutMs,
        hostVerifier: () => true,
      }

      if (privateKey) {
        config.privateKey = privateKey
        // sshPassword funciona como passphrase quando chave privada está configurada
        if (plainPassword) config.passphrase = plainPassword
      } else if (plainPassword) {
        config.password = plainPassword
      } else {
        // SSH agent: Unix (SSH_AUTH_SOCK) ou Windows OpenSSH (named pipe)
        const agentSock = process.env['SSH_AUTH_SOCK']
          ?? (process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined)
        if (agentSock) config.agent = agentSock
      }

      conn.connect(config)
    })
  }

  async setupRemoteProject(id: string, remotePath: string, gitRepo?: string): Promise<{ success: boolean; message: string }> {
    const safePath = remotePath.replace(/[^a-zA-Z0-9/.\-_ ]/g, '')
    if (!safePath) return { success: false, message: 'Caminho remoto inválido' }

    let cmd: string
    if (gitRepo && gitRepo.startsWith('http')) {
      const safeRepo = gitRepo.replace(/[^a-zA-Z0-9/:.\-_@]/g, '')
      cmd = `if [ -d "${safePath}/.git" ]; then echo "ALREADY_CLONED"; elif [ -d "${safePath}" ] && [ "$(ls -A ${safePath})" ]; then echo "DIR_NOT_EMPTY"; else git clone "${safeRepo}" "${safePath}" 2>&1 && echo "GIT_DONE" || echo "GIT_FAILED"; fi`
    } else {
      cmd = `mkdir -p "${safePath}" && echo "MKDIR_DONE"`
    }

    let stdout: string
    try {
      stdout = await this._sshExec(id, cmd, 60000)
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) }
    }

    if (stdout.includes('ALREADY_CLONED')) return { success: true, message: `Repositório já existe em ${safePath}` }
    if (stdout.includes('DIR_NOT_EMPTY')) return { success: false, message: `Pasta ${safePath} já existe e não está vazia` }
    if (stdout.includes('GIT_FAILED')) return { success: false, message: `Falha ao clonar: ${stdout.split('\n').find(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('fatal')) ?? 'verifique o repositório e a conexão'}` }
    if (stdout.includes('GIT_DONE')) return { success: true, message: `Repositório clonado em ${safePath}` }
    if (stdout.includes('MKDIR_DONE')) return { success: true, message: `Pasta criada: ${safePath}` }
    return { success: false, message: `Resposta inesperada da VPS: ${stdout.slice(0, 100)}` }
  }

  async testConnection(id: string): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      const stdout = await this._sshExec(id, 'echo cwm-ok', 10000)
      const ok = stdout.trim() === 'cwm-ok'
      return {
        success: ok,
        message: ok ? 'Conexão estabelecida com sucesso' : 'Resposta inesperada do servidor',
        latencyMs: Date.now() - start,
      }
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  async checkClaudeCode(id: string): Promise<ClaudeCheckResult> {
    // bash -lc carrega o PATH completo (nvm, npm global, etc.)
    // timeout kill + file-based auth check — sem abrir TUI interativa
    const cmd = [
      `source ~/.bashrc 2>/dev/null; source ~/.profile 2>/dev/null;`,
      `export PATH="$PATH:/usr/local/bin:/usr/bin:$HOME/.local/bin:$HOME/.npm/bin:$(npm bin -g 2>/dev/null || true)";`,
      `CLAUDE=$(command -v claude 2>/dev/null || which claude 2>/dev/null || ls /usr/local/bin/claude $HOME/.local/bin/claude 2>/dev/null | head -1);`,
      `if [ -n "$CLAUDE" ]; then`,
      `  echo CWM_INSTALLED;`,
      `  timeout 3 "$CLAUDE" --version 2>/dev/null | grep -oE "[0-9]+\\.[0-9]+\\.[0-9]+" | head -1 || echo "";`,
      `  echo CWM_AUTH;`,
      `  EMAIL=$(grep -rh "email" ~/.claude/ 2>/dev/null | grep -oE "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]+" | head -1);`,
      `  if [ -n "$EMAIL" ]; then echo "logged_in $EMAIL"; else echo "not_logged_in"; fi;`,
      `else`,
      `  echo CWM_NOT_INSTALLED;`,
      `fi`,
    ].join(' ')

    let stdout: string
    try {
      stdout = await this._sshExec(id, `bash -c '${cmd}'`, 15000)
    } catch (err: unknown) {
      return {
        installed: false,
        loggedIn: 'unknown',
        message: `Não foi possível conectar: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)

    if (!lines.includes('CWM_INSTALLED')) {
      return { installed: false, loggedIn: 'unknown', message: 'Claude Code não está instalado nesta VPS' }
    }

    const versionIdx = lines.indexOf('CWM_INSTALLED') + 1
    const version = lines[versionIdx] !== 'CWM_AUTH' ? lines[versionIdx] : undefined

    const authIdx = lines.indexOf('CWM_AUTH')
    const authLines = authIdx >= 0 ? lines.slice(authIdx + 1) : []
    const authText = authLines.join(' ').toLowerCase()

    let loggedIn: 'yes' | 'no' | 'unknown' = 'unknown'
    let emailFound: string | undefined
    for (const l of authLines) {
      if (l.startsWith('logged_in ')) { loggedIn = 'yes'; emailFound = l.slice(10).trim(); break }
      if (l === 'not_logged_in') { loggedIn = 'no'; break }
    }
    if (loggedIn === 'unknown') {
      if (authText.includes('@')) loggedIn = 'yes'
      else if (authText.includes('not')) loggedIn = 'no'
    }

    const versionLabel = version ? ` v${version}` : ''
    const accountLabel = emailFound ? ` (${emailFound})` : ''
    const message =
      loggedIn === 'yes' ? `Claude Code${versionLabel} • Logado${accountLabel}`
      : loggedIn === 'no' ? `Claude Code${versionLabel} instalado • Não logado`
      : `Claude Code${versionLabel} instalado`

    return { installed: true, version, loggedIn, message }
  }
}
