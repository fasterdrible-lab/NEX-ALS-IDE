import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { GitStatus, GitFileStatus } from '@cwm/config'

/**
 * Git de uma pasta local (projeto do OneDrive), com o git do PC — mesmo contrato do GitService remoto,
 * para o painel Source Control da IDE funcionar igual nos dois modos.
 * Sempre `execFile` com argumentos em lista (nunca shell): caminhos e mensagem não precisam de escape.
 */

export interface LocalGitResult { ok: boolean; stdout: string; stderr: string }

/** Lê `git status --porcelain=v1` (com core.quotepath=off). `prefix` = pasta aberta relativa à raiz do repo ("" ou "sub/"). */
export function parsePorcelain(out: string, prefix = ''): Pick<GitStatus, 'staged' | 'unstaged' | 'untracked'> {
  const staged: GitFileStatus[] = [], unstaged: GitFileStatus[] = [], untracked: GitFileStatus[] = []
  for (const raw of out.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.length < 4) continue
    const x = line[0], y = line[1]
    let p = line.slice(3)
    if (p.includes(' -> ')) p = p.split(' -> ').pop()!            // renomeado: fica o nome novo
    if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1)   // nomes com espaço vêm entre aspas
    if (prefix) { if (!p.startsWith(prefix)) continue; p = p.slice(prefix.length) }
    if (!p) continue
    if (x === '?' && y === '?') untracked.push({ path: p, status: '?', type: 'untracked' })
    else {
      if (x !== ' ' && x !== '?') staged.push({ path: p, status: x, type: 'staged' })
      if (y !== ' ' && y !== '?') unstaged.push({ path: p, status: y, type: 'unstaged' })
    }
  }
  return { staged, unstaged, untracked }
}

/** Mensagens do git que pedem uma ação do usuário, traduzidas — o resto vai como o git escreveu. */
export function explainGitError(stderr: string): string {
  const s = stderr.trim()
  if (/Please tell me who you are|unable to auto-detect email/i.test(s)) {
    return 'O git não sabe seu nome/e-mail. No PowerShell: git config --global user.name "Seu Nome" e git config --global user.email "voce@exemplo.com".'
  }
  if (/has no upstream branch/i.test(s)) {
    const m = /git push --set-upstream (\S+) (\S+)/.exec(s)
    return m ? `O branch ainda não existe no remoto. Rode uma vez no terminal: git push -u ${m[1]} ${m[2]}` : s
  }
  if (/No configured push destination|does not appear to be a git repository|No remote repository specified/i.test(s)) {
    return 'Este repositório não tem remoto. Crie o repositório no GitHub e rode: git remote add origin <url>'
  }
  if (/nothing to commit/i.test(s)) return 'Nada para commitar — marque arquivos em "Preparar" (+) primeiro.'
  if (/terminal prompts disabled|could not read Username|Authentication failed/i.test(s)) {
    return 'O git pediu login. Faça o login do GitHub uma vez (Git Credential Manager) e tente de novo.'
  }
  return s || 'O git falhou sem mensagem.'
}

export class LocalGitService {
  private run(cwd: string, args: string[], timeoutMs = 60_000): Promise<LocalGitResult> {
    return new Promise(resolve => {
      execFile('git', ['-c', 'core.quotepath=off', ...args], {
        cwd, windowsHide: true, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024,
        // Sem prompt no terminal (não há terminal para responder); o Git Credential Manager do Windows usa janela própria
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      }, (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) || (err ? err.message : '') }))
    })
  }

  private async must(cwd: string, args: string[], timeoutMs?: number): Promise<string> {
    const r = await this.run(cwd, args, timeoutMs)
    if (!r.ok) throw new Error(explainGitError(r.stderr))
    return r.stdout
  }

  private checkCwd(cwd: string): void {
    if (!path.isAbsolute(cwd) || !fs.statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Pasta não encontrada: ${cwd}`)
  }

  /**
   * Repositório na pasta pessoal (C:\Users\<você>\.git) quase sempre foi criado sem querer, e faz toda pasta sem
   * git próprio parecer "dentro de um repo": o painel varreria a pasta pessoal inteira e um push mandaria arquivos
   * para o remoto desse repo. Pasta dentro dele (e que não é a própria pasta pessoal) = sem repositório.
   * Devolve o caminho desse repo quando é o caso.
   */
  private async homeRepoAbove(cwd: string): Promise<string | null> {
    const top = (await this.run(cwd, ['rev-parse', '--show-toplevel'])).stdout.trim()
    if (!top) return null
    const norm = (p: string) => { const r = path.resolve(p).replace(/[\\/]+$/, ''); return process.platform === 'win32' ? r.toLowerCase() : r }
    return norm(top) === norm(os.homedir()) && norm(cwd) !== norm(top) ? top : null
  }

  private async assertOwnRepo(cwd: string): Promise<void> {
    this.checkCwd(cwd)
    const home = await this.homeRepoAbove(cwd)
    if (home) throw new Error(`Esta pasta não tem git próprio (só o repositório da pasta pessoal, ${home}, que o Zeus ignora). Crie um com git init na pasta do projeto.`)
  }

  async status(cwd: string): Promise<GitStatus> {
    this.checkCwd(cwd)
    const empty: GitStatus = { branch: '', ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], isRepo: false }
    const inside = await this.run(cwd, ['rev-parse', '--is-inside-work-tree'])
    if (!inside.ok || inside.stdout.trim() !== 'true') return empty
    const home = await this.homeRepoAbove(cwd)
    if (home) return { ...empty, outerRepo: home }
    // `branch --show-current` funciona num repositório sem nenhum commit (rev-parse HEAD falharia)
    let branch = (await this.run(cwd, ['branch', '--show-current'])).stdout.trim()
    if (!branch) branch = (await this.run(cwd, ['rev-parse', '--short', 'HEAD'])).stdout.trim() || 'HEAD'
    let ahead = 0, behind = 0
    const ab = await this.run(cwd, ['rev-list', '--left-right', '--count', '@{u}...HEAD'])
    if (ab.ok) { const [b, a] = ab.stdout.trim().split(/\s+/); behind = Number(b) || 0; ahead = Number(a) || 0 }
    const prefix = (await this.run(cwd, ['rev-parse', '--show-prefix'])).stdout.trim()
    const porcelain = await this.must(cwd, ['status', '--porcelain=v1', '-uall'])
    return { branch, ahead, behind, ...parsePorcelain(porcelain, prefix), isRepo: true }
  }

  async diff(cwd: string, filePath: string, staged: boolean): Promise<string> {
    await this.assertOwnRepo(cwd)
    const r = await this.run(cwd, ['diff', ...(staged ? ['--cached'] : []), '--', filePath])
    return r.ok ? r.stdout : ''
  }

  async add(cwd: string, files: string[]): Promise<void> {
    await this.assertOwnRepo(cwd)
    await this.must(cwd, ['add', '--', ...files])
  }

  async restore(cwd: string, files: string[], staged: boolean): Promise<void> {
    await this.assertOwnRepo(cwd)
    if (!staged) { await this.must(cwd, ['restore', '--', ...files]); return }
    const r = await this.run(cwd, ['restore', '--staged', '--', ...files])
    // Repositório sem nenhum commit: não há HEAD para "restaurar" — tirar do índice é `rm --cached`
    if (!r.ok) await this.must(cwd, ['rm', '--cached', '-q', '--', ...files])
  }

  async commit(cwd: string, message: string): Promise<void> {
    await this.assertOwnRepo(cwd)
    await this.must(cwd, ['commit', '-m', message])
  }

  async push(cwd: string): Promise<string> {
    await this.assertOwnRepo(cwd)
    const r = await this.run(cwd, ['push'], 180_000)
    if (!r.ok) throw new Error(explainGitError(r.stderr))
    return (r.stdout + r.stderr).trim()   // o git escreve o resumo do push no stderr
  }

  async pull(cwd: string): Promise<string> {
    await this.assertOwnRepo(cwd)
    const r = await this.run(cwd, ['pull'], 180_000)
    if (!r.ok) throw new Error(explainGitError(r.stderr))
    return (r.stdout + r.stderr).trim()
  }
}
