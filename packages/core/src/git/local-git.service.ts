import { execFile, spawn } from 'node:child_process'
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

/** Nome de repositório aceito pelo GitHub. */
export function validateGitHubRepoName(name: string): string | null {
  if (!name) return 'Dê um nome ao repositório.'
  if (name.length > 100) return 'Nome longo demais (máx. 100).'
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return 'Use só letras sem acento, números, ponto, hífen e sublinhado.'
  if (name === '.' || name === '..' || name.endsWith('.git')) return 'Esse nome não é aceito pelo GitHub.'
  return null
}

/** Sugestão de nome a partir da pasta: sem acentos, espaços viram hífen. */
export function suggestRepoName(folderName: string): string {
  return folderName.normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'projeto'
}

export function isGitHubRemoteUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+?(\.git)?\/?$/.test(url) || /^git@github\.com:[A-Za-z0-9-]+\/[A-Za-z0-9._-]+?(\.git)?$/.test(url)
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
    const remote = (await this.run(cwd, ['remote', 'get-url', 'origin'])).stdout.trim()
    const hasCommits = (await this.run(cwd, ['rev-parse', '--verify', '-q', 'HEAD'])).ok
    return { branch, ahead, behind, ...parsePorcelain(porcelain, prefix), isRepo: true, remote, hasCommits }
  }

  /**
   * Publicar no GitHub: liga `origin` e faz o primeiro push (`push -u origin HEAD`).
   * Sem `url`: cria o repositório na conta do usuário pela API do GitHub, com o login que o Git Credential
   * Manager já guarda no PC (`git credential fill`). O token só é usado nesta chamada, no main — nunca vai
   * para o renderer, para log nem para o banco.
   */
  async publishToGitHub(cwd: string, opts: { name?: string; isPrivate?: boolean; url?: string }): Promise<{ url: string; created: boolean; output: string }> {
    await this.assertOwnRepo(cwd)
    if ((await this.run(cwd, ['remote', 'get-url', 'origin'])).ok) throw new Error('Este projeto já está ligado a um repositório (origin). Use Push.')
    if (!(await this.run(cwd, ['rev-parse', '--verify', '-q', 'HEAD'])).ok) throw new Error('Faça o primeiro commit antes de publicar.')

    let url = opts.url?.trim() ?? ''
    let created = false
    if (url) {
      if (!isGitHubRemoteUrl(url)) throw new Error('Endereço inválido. Use https://github.com/<dono>/<repositorio>.git')
    } else {
      const name = (opts.name ?? '').trim()
      const nameErr = validateGitHubRepoName(name)
      if (nameErr) throw new Error(nameErr)
      const token = await this.githubToken(cwd)
      const res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Zeus-IDE', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, private: opts.isPrivate !== false, auto_init: false }),
      })
      const body = await res.json().catch(() => ({})) as { clone_url?: string; message?: string; errors?: { message?: string }[] }
      if (res.status === 422) throw new Error(`Já existe um repositório "${name}" na sua conta do GitHub. Escolha outro nome ou use "Já tenho o repositório".`)
      if (res.status === 401) throw new Error('O login do GitHub guardado no PC expirou. Faça login de novo (um git push no terminal abre a janela de login) e tente outra vez.')
      if (!res.ok || !body.clone_url) throw new Error(`GitHub recusou criar o repositório (${res.status}): ${body.message ?? 'sem detalhe'}`)
      url = body.clone_url
      created = true
    }
    await this.must(cwd, ['remote', 'add', 'origin', url])
    const r = await this.run(cwd, ['push', '-u', 'origin', 'HEAD'], 300_000)
    if (!r.ok) {
      // Push falhou: desfaz a ligação para o usuário poder tentar de novo (o repositório criado no GitHub fica, vazio)
      await this.run(cwd, ['remote', 'remove', 'origin'])
      throw new Error(explainGitError(r.stderr) + (created ? ` (O repositório ${url} foi criado no GitHub e ficou vazio.)` : ''))
    }
    return { url: url.replace(/\.git$/, ''), created, output: (r.stdout + r.stderr).trim() }
  }

  private async githubApi<T>(method: string, apiPath: string, body?: unknown): Promise<{ status: number; data: T }> {
    const token = await this.githubToken(os.tmpdir())
    const res = await fetch(`https://api.github.com${apiPath}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Zeus-IDE', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 401) throw new Error('O login do GitHub guardado no PC expirou. Faça login de novo (um git push no terminal abre a janela de login) e tente outra vez.')
    return { status: res.status, data: await res.json().catch(() => ({})) as T }
  }

  /**
   * Repositório do GitHub para um projeto que o Hermes trabalha na VPS: cria (privado) na conta do
   * usuário ou confere um existente. Devolve `dono/nome`.
   */
  async githubEnsureRepo(opts: { name?: string; url?: string; isPrivate?: boolean }): Promise<{ fullName: string; created: boolean }> {
    if (opts.url) {
      const m = /github\.com[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(opts.url.trim())
      if (!m) throw new Error('Endereço inválido. Use https://github.com/<dono>/<repositorio>')
      const r = await this.githubApi<{ full_name?: string; permissions?: { push?: boolean } }>('GET', `/repos/${m[1]}/${m[2]}`)
      if (r.status === 404) throw new Error(`Repositório ${m[1]}/${m[2]} não encontrado (ou sua conta não tem acesso).`)
      if (!r.data.full_name || r.data.permissions?.push === false) throw new Error('Sua conta não pode gravar nesse repositório.')
      return { fullName: r.data.full_name, created: false }
    }
    const name = (opts.name ?? '').trim()
    const nameErr = validateGitHubRepoName(name)
    if (nameErr) throw new Error(nameErr)
    const r = await this.githubApi<{ full_name?: string; message?: string }>('POST', '/user/repos', { name, private: opts.isPrivate !== false, auto_init: false })
    if (r.status === 422) throw new Error(`Já existe um repositório "${name}" na sua conta do GitHub. Escolha outro nome ou informe o endereço dele.`)
    if (r.status >= 300 || !r.data.full_name) throw new Error(`GitHub recusou criar o repositório (${r.status}): ${r.data.message ?? 'sem detalhe'}`)
    return { fullName: r.data.full_name, created: true }
  }

  /** Cadastra a chave pública da VPS como deploy key — vale só para este repositório. `readOnly`: ambientes de deploy só leem. */
  async githubAddDeployKey(fullName: string, title: string, publicKey: string, readOnly = false): Promise<void> {
    if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(fullName)) throw new Error('Repositório inválido.')
    if (!/^ssh-ed25519 [A-Za-z0-9+/=]+( \S+)?$/.test(publicKey.trim())) throw new Error('Chave pública inválida.')
    const r = await this.githubApi<{ message?: string; errors?: { message?: string }[] }>('POST', `/repos/${fullName}/keys`, { title, key: publicKey.trim(), read_only: readOnly })
    // 422 "key is already in use" = já cadastrada neste repositório (ligar de novo) — segue.
    if (r.status === 422 && /already in use/i.test(JSON.stringify(r.data))) return
    if (r.status >= 300) throw new Error(`GitHub recusou a chave (${r.status}): ${r.data.message ?? 'sem detalhe'}`)
  }

  /** Senha/token do GitHub guardado pelo Git Credential Manager. Pode abrir a janela de login do GCM se não houver. */
  private githubToken(cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const p = spawn('git', ['credential', 'fill'], { cwd, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
      let out = ''
      const timer = setTimeout(() => { p.kill(); reject(new Error('O login do GitHub não respondeu a tempo.')) }, 120_000)
      p.stdout.on('data', (d: Buffer) => { out += d.toString('utf8') })
      p.on('error', () => { clearTimeout(timer); reject(new Error('Git não encontrado no PC.')) })
      p.on('close', () => {
        clearTimeout(timer)
        const token = /^password=(.+)$/m.exec(out)?.[1]?.trim()
        if (token) resolve(token)
        else reject(new Error('Não há login do GitHub no PC. Faça um git push qualquer no terminal (abre a janela de login) ou use "Já tenho o repositório".'))
      })
      p.stdin.end('protocol=https\nhost=github.com\n\n')
    })
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
