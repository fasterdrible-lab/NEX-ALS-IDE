import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Envio ao GitHub do trabalho do Hermes (serviço zeus-hermes, na própria VPS).
 * - Uma deploy key por projeto (<ssh>/deploy-<projectId>): vale só para aquele repositório; o Zeus do PC
 *   cadastra a parte pública no GitHub com escrita.
 * - Remoto próprio `github` (não mexe num `origin` que o projeto já tenha); branch `hermes` — o `main`
 *   fica para o usuário juntar por Pull Request. Nunca `--force`.
 * - Quem envia é o serviço, depois de a tarefa ser conferida; o Hermes segue proibido de dar push.
 */

export const GITHUB_BRANCH = 'hermes'
const REMOTE = 'github'
const FULL_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/

export function isRepoFullName(s: string): boolean { return FULL_NAME.test(s) && !s.endsWith('.git') }

export class GithubPush {
  /** Um envio por vez por projeto (tarefas paralelas terminam juntas). */
  private readonly chains = new Map<string, Promise<unknown>>()

  constructor(private readonly sshDir: string) {}

  private keyPath(projectId: string): string {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(projectId)) throw new Error('Projeto inválido')
    return path.join(this.sshDir, `deploy-${projectId}`)
  }

  private run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}): Promise<{ ok: boolean; out: string }> {
    return new Promise(resolve => {
      execFile(cmd, args, { cwd: opts.cwd, env: opts.env, timeout: opts.timeout ?? 120_000, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() || (err ? err.message : '') }))
    })
  }

  private gitEnv(projectId: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_SSH_COMMAND: `ssh -i ${this.keyPath(projectId)} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes`,
    }
  }

  /** Chave pública do projeto (gera na primeira vez). */
  async publicKey(projectId: string): Promise<string> {
    const key = this.keyPath(projectId)
    if (!fs.existsSync(key)) {
      fs.mkdirSync(this.sshDir, { recursive: true, mode: 0o700 })
      const r = await this.run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', `zeus-hermes-${projectId}`, '-f', key])
      if (!r.ok) throw new Error(`Não consegui gerar a chave: ${r.out}`)
    }
    return fs.readFileSync(`${key}.pub`, 'utf8').trim()
  }

  /** Liga o projeto ao repositório e faz o primeiro envio. */
  async link(projectId: string, workspace: string, fullName: string): Promise<{ pushed: boolean; output: string }> {
    if (!isRepoFullName(fullName)) throw new Error('Repositório inválido (use dono/nome).')
    if (!fs.existsSync(`${this.keyPath(projectId)}.pub`)) throw new Error('Gere a chave do projeto antes (github/key).')
    const url = `git@github.com:${fullName}.git`
    const has = await this.run('git', ['remote', 'get-url', REMOTE], { cwd: workspace })
    const set = await this.run('git', ['remote', has.ok ? 'set-url' : 'add', REMOTE, url], { cwd: workspace })
    if (!set.ok) throw new Error(`git remote: ${set.out}`)
    return this.push(projectId, workspace)
  }

  /** Envia o HEAD da pasta do projeto para o branch `hermes` do GitHub. */
  push(projectId: string, workspace: string): Promise<{ pushed: boolean; output: string }> {
    const prev = this.chains.get(projectId) ?? Promise.resolve()
    const next = prev.catch(() => {}).then(async () => {
      const r = await this.run('git', ['push', REMOTE, `HEAD:refs/heads/${GITHUB_BRANCH}`], { cwd: workspace, env: this.gitEnv(projectId), timeout: 300_000 })
      return { pushed: r.ok, output: r.out.slice(-1500) }
    })
    this.chains.set(projectId, next)
    return next
  }
}
