import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client as SshClient, type ConnectConfig } from 'ssh2'
import { getPrismaClient } from '@cwm/db'
import { decryptPassword, type GitStatus, type GitFileStatus, type GitCommit } from '@cwm/config'
import { buildHostVerifier, FINGERPRINT_MISMATCH_MSG } from '../ssh/ssh-connect.js'

export class GitService {
  private get db() { return getPrismaClient() }

  private async sshExec(vpsId: string, cwd: string, cmd: string): Promise<string> {
    const vps = await this.db.vpsServer.findUnique({ where: { id: vpsId } })
    if (!vps) throw new Error(`VPS não encontrada: ${vpsId}`)

    const settings = await this.db.settings.findUnique({ where: { id: 'default' } })
    const keyPath = settings?.sshKeyPath || join(homedir(), '.ssh', 'id_rsa')
    let privateKey: Buffer | undefined
    try { privateKey = readFileSync(keyPath) } catch { }
    const password = vps.sshPassword ? decryptPassword(vps.sshPassword) : undefined

    return new Promise<string>((resolve, reject) => {
      const conn = new SshClient()

      conn.on('ready', () => {
        const safe = JSON.stringify(cwd)
        const fullCmd = `cd ${safe} 2>/dev/null && ${cmd}`
        conn.exec(fullCmd, (err, stream) => {
          if (err) { conn.end(); reject(err); return }
          let stdout = '', stderr = ''
          stream.on('data', (d: Buffer) => { stdout += d.toString('utf8') })
          stream.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8') })
          stream.on('close', (code: number) => {
            conn.end()
            if (code !== 0 && !stdout) {
              reject(new Error(stderr.trim() || `git exited with code ${code}`))
            } else {
              resolve(stdout)
            }
          })
        })
      })

      const { hostVerifier, wasMismatch } = buildHostVerifier(vps.id, vps.sshHostFingerprint ?? null)
      conn.on('error', (err) => {
        const m = err.message || ''
        reject(new Error(
          wasMismatch() ? FINGERPRINT_MISMATCH_MSG
          : m.includes('ECONNREFUSED') ? 'Conexão recusada — verifique a porta SSH'
          : m.includes('ETIMEDOUT') ? 'Timeout — VPS não respondeu'
          : m.toLowerCase().includes('auth') ? 'Autenticação falhou'
          : m
        ))
      })

      const config: ConnectConfig = {
        host: vps.host, port: vps.port, username: vps.username,
        readyTimeout: 10000, hostVerifier,
      }
      if (privateKey) config.privateKey = privateKey
      else if (password) config.password = password
      else if (process.env['SSH_AUTH_SOCK']) config.agent = process.env['SSH_AUTH_SOCK']
      conn.connect(config)
    })
  }

  async status(vpsId: string, cwd: string): Promise<GitStatus> {
    const empty: GitStatus = { branch: '', ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], isRepo: false }
    try {
      const branchOut = await this.sshExec(vpsId, cwd, 'git rev-parse --abbrev-ref HEAD 2>&1')
      const branch = branchOut.trim()
      if (!branch || branch.includes('fatal') || branch.includes('not a git')) return empty

      let ahead = 0, behind = 0
      try {
        const ab = await this.sshExec(vpsId, cwd, 'git rev-list --left-right --count @{u}...HEAD 2>/dev/null; echo "0 0"')
        const parts = ab.trim().split('\n')[0]?.split(/\s+/) ?? []
        if (parts.length >= 2) { behind = parseInt(parts[0]) || 0; ahead = parseInt(parts[1]) || 0 }
      } catch { }

      const porcelain = await this.sshExec(vpsId, cwd, 'git status --porcelain=v1 -uall 2>&1')
      const staged: GitFileStatus[] = []
      const unstaged: GitFileStatus[] = []
      const untracked: GitFileStatus[] = []

      for (const line of porcelain.split('\n')) {
        if (line.length < 2) continue
        const x = line[0]
        const y = line[1]
        const path = line.slice(3).trim()
        if (!path) continue
        if (x === '?' && y === '?') {
          untracked.push({ path, status: '?', type: 'untracked' })
        } else {
          if (x !== ' ' && x !== '?') staged.push({ path, status: x, type: 'staged' })
          if (y !== ' ' && y !== '?') unstaged.push({ path, status: y, type: 'unstaged' })
        }
      }

      return { branch, ahead, behind, staged, unstaged, untracked, isRepo: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('not a git') || msg.includes('fatal')) return empty
      throw e
    }
  }

  async diff(vpsId: string, cwd: string, filePath: string, staged: boolean): Promise<string> {
    const flag = staged ? '--cached ' : ''
    try {
      return await this.sshExec(vpsId, cwd, `git diff ${flag}-- ${JSON.stringify(filePath)} 2>&1`)
    } catch {
      return ''
    }
  }

  async add(vpsId: string, cwd: string, files: string[]): Promise<void> {
    const paths = files.map(f => JSON.stringify(f)).join(' ')
    await this.sshExec(vpsId, cwd, `git add -- ${paths}`)
  }

  async restore(vpsId: string, cwd: string, files: string[], staged: boolean): Promise<void> {
    const flag = staged ? '--staged ' : ''
    const paths = files.map(f => JSON.stringify(f)).join(' ')
    await this.sshExec(vpsId, cwd, `git restore ${flag}-- ${paths}`)
  }

  async commit(vpsId: string, cwd: string, message: string): Promise<void> {
    await this.sshExec(vpsId, cwd, `git commit -m ${JSON.stringify(message)}`)
  }

  async push(vpsId: string, cwd: string): Promise<string> {
    return this.sshExec(vpsId, cwd, 'git push 2>&1')
  }

  async pull(vpsId: string, cwd: string): Promise<string> {
    return this.sshExec(vpsId, cwd, 'git pull 2>&1')
  }

  /** Cria um git worktree isolado (mkdir -p do diretório pai + git worktree add -b). */
  async worktreeAdd(vpsId: string, cwd: string, worktreePath: string, branch: string): Promise<string> {
    const parent = worktreePath.slice(0, worktreePath.lastIndexOf('/')) || '.'
    await this.sshExec(vpsId, cwd, `mkdir -p ${JSON.stringify(parent)}`)
    return this.sshExec(vpsId, cwd, `git worktree add ${JSON.stringify(worktreePath)} -b ${JSON.stringify(branch)} 2>&1`)
  }

  /** Remove um worktree — só deve ser chamado após merge bem-sucedido (nada a perder). */
  async worktreeRemove(vpsId: string, cwd: string, worktreePath: string): Promise<string> {
    return this.sshExec(vpsId, cwd, `git worktree remove ${JSON.stringify(worktreePath)} --force 2>&1`)
  }

  /** Merge cauteloso: nunca força, aborta e preserva o branch em caso de conflito. */
  async merge(vpsId: string, cwd: string, branch: string): Promise<{ success: boolean; output: string }> {
    try {
      const output = await this.sshExec(vpsId, cwd, `git merge --no-ff ${JSON.stringify(branch)} -m ${JSON.stringify(`merge: ${branch}`)} 2>&1`)
      return { success: true, output }
    } catch (e) {
      await this.sshExec(vpsId, cwd, 'git merge --abort 2>/dev/null || true').catch(() => {})
      return { success: false, output: e instanceof Error ? e.message : String(e) }
    }
  }

  async log(vpsId: string, cwd: string, n = 20): Promise<GitCommit[]> {
    try {
      const out = await this.sshExec(vpsId, cwd, `git log --oneline -${n} --format="%H|%s|%an|%ar" 2>&1`)
      return out.split('\n').filter(l => l.includes('|')).map(line => {
        const [hash, message, author, date] = line.split('|')
        return {
          hash: (hash ?? '').trim(),
          message: (message ?? '').trim(),
          author: (author ?? '').trim(),
          date: (date ?? '').trim(),
        }
      })
    } catch {
      return []
    }
  }
}
