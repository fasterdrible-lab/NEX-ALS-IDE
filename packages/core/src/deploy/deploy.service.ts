import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { getPrismaClient } from '@cwm/db'
import { GitCloneUrlSchema } from '@cwm/config'
import type { TerminalService } from '../terminal/terminal.service.js'
import { EnvironmentsService, type DeployRecord, type DeployStatus, type ProjectEnvironment } from './environments.service.js'

/**
 * Deploy por git, commit exato (Project First, Fase 4b). Na VPS do ambiente:
 *   pasta vazia → git clone do repositório do projeto
 *   alteração feita direto na VPS (arquivo rastreado) → para, não passa por cima
 *   git fetch → checkout --detach do commit → comandos do ambiente (um por linha) → smoke test (GET do PC)
 *
 * Gate da produção (conferido aqui, não na tela):
 *   - o nome do projeto digitado;
 *   - com staging cadastrado: só o MESMO commit do último deploy de staging, e só se ele terminou ok
 *     (e passou no smoke test, se staging tem URL);
 *   - sem staging: o último commit do branch;
 *   - falhou depois do checkout (comando ou smoke test) → volta sozinho para o commit anterior.
 */

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
const SHA = /^[0-9a-f]{40}$/
const LOG_MAX = 200_000
const CMD_TIMEOUT = 15 * 60_000
/** Saída do git quando a VPS não tem acesso ao repositório (privado sem chave, login pedido). */
const NO_ACCESS = /Permission denied \(publickey\)|Repository not found|could not read Username|Authentication failed|terminal prompts disabled/i
export const NO_ACCESS_HINT = 'A VPS não tem acesso ao repositório — use "Dar acesso ao GitHub" no ambiente'

const GH = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/
/** Repositório do GitHub em qualquer formato → `dono/nome` e o endereço SSH (usado com a chave de deploy). */
export function githubRepoOf(url: string): { fullName: string; sshUrl: string } | null {
  const m = GH.exec(url.trim())
  return m ? { fullName: `${m[1]}/${m[2]}`, sshUrl: `git@github.com:${m[1]}/${m[2]}.git` } : null
}

/** Chave de deploy do ambiente na VPS (só letras/números no nome — vai sem aspas no comando). */
const keyFile = (envId: string) => `~/.ssh/zeus_deploy_${envId.replace(/[^A-Za-z0-9]/g, '').slice(0, 32)}`
const gitSsh = (envId: string) => `GIT_SSH_COMMAND="ssh -i ${keyFile(envId)} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"`

export interface DeployOptions {
  confirm?: string
  onLog?: (line: string) => void
}

/** O que dar acesso precisa do GitHub (login do PC): conferir o repositório e cadastrar a chave só de leitura. */
export interface GithubAccess {
  ensureRepo: (url: string) => Promise<{ fullName: string }>
  addKey: (fullName: string, title: string, publicKey: string) => Promise<void>
}

export class DeployService {
  private get db() { return getPrismaClient() }
  private readonly running = new Set<string>()

  constructor(private readonly terminal: TerminalService, private readonly envs = new EnvironmentsService()) {}

  isRunning(envId: string): boolean { return this.running.has(envId) }

  async deploy(envId: string, opts: DeployOptions = {}): Promise<DeployRecord> {
    if (this.running.has(envId)) throw new Error('Já tem um deploy rodando neste ambiente')
    const env = await this.envs.get(envId)
    if (!env) throw new Error('Ambiente não encontrado')
    if (!env.vpsServerId) throw new Error('O ambiente está sem VPS (a VPS foi apagada) — escolha outra')
    const project = await this.db.project.findUnique({ where: { id: env.projectId } })
    if (!project) throw new Error('Projeto não encontrado')

    // ── Gate da produção ──
    let pinned: string | null = null
    if (env.kind === 'production') {
      if ((opts.confirm ?? '').trim() !== project.name.trim()) {
        throw new Error(`Para publicar em produção, digite o nome do projeto ("${project.name}")`)
      }
      const staging = await this.envs.byKind(project.id, 'staging')
      if (staging) {
        const last = staging.lastDeploy
        if (!last || last.status !== 'ok' || !SHA.test(last.commitSha)) {
          throw new Error('Produção só recebe o que passou em staging — faça o deploy em staging primeiro (o último não terminou bem)')
        }
        if (staging.url && last.smoke !== 'ok') throw new Error('O último deploy de staging não passou no smoke test')
        pinned = last.commitSha
      }
    }

    this.running.add(envId)
    const id = randomUUID()
    const startedAt = new Date().toISOString()
    await this.db.$executeRawUnsafe(
      `INSERT INTO project_deploys (id, envId, projectId, kind, status, startedAt) VALUES (?, ?, ?, ?, 'running', ?)`,
      id, env.id, env.projectId, env.kind, startedAt,
    )
    let log = ''
    const say = (line: string) => {
      log = (log + line + '\n').slice(-LOG_MAX)
      opts.onLog?.(line)
    }
    let commit = '', previous = '', status: DeployStatus = 'failed', smoke = ''
    try {
      const r = await this.run(env, await this.resolveGitRepo(project, say), pinned, say)
      commit = r.commit; previous = r.previous; smoke = r.smoke; status = r.status
    } catch (e) {
      say(`✗ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      this.running.delete(envId)
      await this.db.$executeRawUnsafe(
        `UPDATE project_deploys SET commitSha = ?, previousCommit = ?, status = ?, smoke = ?, log = ?, finishedAt = ? WHERE id = ?`,
        commit, previous, status, smoke, log, new Date().toISOString(), id,
      ).catch(() => {})
    }
    return { id, envId: env.id, projectId: env.projectId, kind: env.kind, commitSha: commit, previousCommit: previous, status, smoke, log, startedAt, finishedAt: new Date().toISOString() }
  }

  private async run(env: ProjectEnvironment, gitRepo: string, pinned: string | null, say: (l: string) => void):
    Promise<{ commit: string; previous: string; status: DeployStatus; smoke: string }> {
    const vps = env.vpsServerId!
    const P = q(env.remotePath)
    const where = env.kind === 'production' ? 'PRODUÇÃO' : 'staging'
    say(`▶ Deploy em ${where} — ${env.vpsName}:${env.remotePath} (branch ${env.branch})`)

    // Com chave de deploy ("Dar acesso ao GitHub"): clone/fetch pelo SSH com ela
    const gh = githubRepoOf(gitRepo)
    const hasKey = !!gh && (await this.sh(vps, `test -f ${keyFile(env.id)} && echo HAS_KEY || true`, 30_000)).out.trim().endsWith('HAS_KEY')
    const gitEnv = hasKey ? `${gitSsh(env.id)} ` : 'GIT_TERMINAL_PROMPT=0 '
    const noAccess = (what: string, out: string) =>
      new Error(NO_ACCESS.test(out) ? `${NO_ACCESS_HINT}.\n(${what}: ${out.trim().split('\n').pop()})` : `${what} falhou: ${out.slice(-600)}`)

    // 1. Pasta: repositório, vazia (clona) ou com outra coisa (para)
    const probe = (await this.sh(vps, `if [ -d ${P}/.git ]; then echo HAS_GIT; elif [ -e ${P} ] && [ -n "$(ls -A ${P} 2>/dev/null)" ]; then echo NOT_EMPTY; else echo EMPTY; fi`, 30_000)).out.trim()
    if (probe.endsWith('NOT_EMPTY')) throw new Error(`A pasta ${env.remotePath} já tem arquivos e não é um repositório git — o Zeus não mistura. Use uma pasta vazia ou um clone do projeto.`)
    if (probe.endsWith('EMPTY')) {
      const url = GitCloneUrlSchema.safeParse(hasKey ? gh!.sshUrl : gitRepo)
      if (!url.success) throw new Error('A pasta está vazia e o Zeus não achou o endereço do repositório (nem no cadastro, nem no origin da pasta do PC ou do agente) — informe em Projetos → editar')
      say(`• Clonando ${url.data}…`)
      const c = await this.sh(vps, `mkdir -p "$(dirname ${P})" && ${gitEnv}git clone --quiet -- ${q(url.data)} ${P}`, 10 * 60_000)
      if (c.code !== 0) throw noAccess('git clone', c.out)
    } else if (hasKey) {
      // Clone antigo por https: passa a buscar pelo SSH da chave
      await this.sh(vps, `cd ${P} && git remote set-url origin ${q(gh!.sshUrl)}`, 30_000)
    }

    // 2. Commit de agora (para voltar) e alteração feita direto na VPS
    const previous = (await this.sh(vps, `cd ${P} && git rev-parse HEAD 2>/dev/null || true`, 30_000)).out.trim().split('\n').pop() ?? ''
    const dirty = await this.sh(vps, `cd ${P} && git status --porcelain --untracked-files=no`, 30_000)
    if (dirty.code !== 0) throw new Error(`git status falhou: ${dirty.out.slice(-400)}`)
    if (dirty.out.trim()) throw new Error(`A pasta tem alteração feita direto na VPS — o Zeus não passa por cima:\n${dirty.out.trim().slice(0, 1500)}`)

    // 3. Busca e escolhe o commit
    say('• git fetch…')
    const f = await this.sh(vps, `cd ${P} && ${gitEnv}git fetch --quiet origin`, 5 * 60_000)
    if (f.code !== 0) throw noAccess('git fetch', f.out)
    let commit: string
    if (pinned) {
      const has = await this.sh(vps, `cd ${P} && git cat-file -e ${pinned}^{commit}`, 30_000)
      if (has.code !== 0) throw new Error(`O commit de staging (${pinned.slice(0, 8)}) não existe no repositório desta VPS — ele foi enviado ao GitHub?`)
      commit = pinned
      say(`• Commit de staging: ${commit.slice(0, 8)}`)
    } else {
      const rev = await this.sh(vps, `cd ${P} && git rev-parse --verify --quiet ${q(`origin/${env.branch}^{commit}`)}`, 30_000)
      commit = rev.out.trim().split('\n').pop() ?? ''
      if (rev.code !== 0 || !SHA.test(commit)) throw new Error(`Branch "${env.branch}" não encontrado no GitHub`)
      say(`• Último commit de ${env.branch}: ${commit.slice(0, 8)}`)
    }
    if (previous === commit) say('• A pasta já está neste commit — roda os comandos de novo')

    // 4. Checkout + comandos + smoke test; produção que falha volta para o commit anterior
    const failed = async (why: string): Promise<{ commit: string; previous: string; status: DeployStatus; smoke: string }> => {
      say(`✗ ${why}`)
      if (env.kind === 'production' && SHA.test(previous) && previous !== commit) {
        say(`↩ Voltando produção para ${previous.slice(0, 8)}…`)
        const back = await this.sh(vps, `cd ${P} && git checkout --quiet --detach ${previous}`, 60_000)
        if (back.code !== 0) { say(`✗ Não consegui voltar: ${back.out.slice(-400)} — confira a VPS`); return { commit, previous, status: 'failed', smoke: why } }
        const again = await this.commands(env, say)
        say(again ? '✓ Produção de volta no commit anterior' : '⚠ Voltou o código, mas um comando falhou — confira a VPS')
        return { commit, previous, status: 'rolled_back', smoke: why }
      }
      return { commit, previous, status: 'failed', smoke: why }
    }
    const co = await this.sh(vps, `cd ${P} && git checkout --quiet --detach ${commit}`, 60_000)
    if (co.code !== 0) throw new Error(`git checkout falhou: ${co.out.slice(-600)}`)
    if (!(await this.commands(env, say))) return failed('Um comando do deploy falhou')
    if (!env.url) { say('✓ Deploy concluído (sem smoke test — o ambiente não tem URL)'); return { commit, previous, status: 'ok', smoke: '' } }
    const smoke = await this.smokeTest(env.url, say)
    if (smoke !== 'ok') return failed(`Smoke test: ${smoke}`)
    say('✓ Deploy concluído')
    return { commit, previous, status: 'ok', smoke: 'ok' }
  }

  /**
   * Endereço do repositório: o do cadastro; sem ele, o `origin` da pasta do PC (com .git próprio) ou da
   * pasta do agente na VPS — e grava no projeto. '' = não achou.
   */
  async resolveGitRepo(project: { id: string; gitRepo: string; localPath: string; remotePath: string; vpsServerId: string | null }, say?: (l: string) => void): Promise<string> {
    if (GitCloneUrlSchema.safeParse(project.gitRepo).success) return project.gitRepo.trim()
    const candidates: string[] = []
    if (project.localPath && existsSync(path.join(project.localPath, '.git'))) {
      candidates.push(await new Promise<string>(res => {
        execFile('git', ['-C', project.localPath, 'remote', 'get-url', 'origin'], { timeout: 10_000, windowsHide: true }, (err, out) => res(err ? '' : String(out).trim()))
      }))
    }
    if (project.vpsServerId && project.remotePath) {
      const r = await this.sh(project.vpsServerId, `cd ${q(project.remotePath)} && git remote get-url origin`, 30_000).catch(() => ({ code: 1, out: '' }))
      if (r.code === 0) candidates.push(r.out.trim().split('\n').pop() ?? '')
    }
    const found = candidates.find(u => GitCloneUrlSchema.safeParse(u).success)
    if (!found) return ''
    await this.db.project.update({ where: { id: project.id }, data: { gitRepo: found } })
    say?.(`• Repositório do projeto: ${found} (lido do origin e gravado no cadastro)`)
    return found
  }

  /**
   * "Dar acesso ao GitHub": cria (uma vez) a chave do ambiente na VPS dele e cadastra a pública no
   * repositório como deploy key SÓ DE LEITURA, pelo login do GitHub do PC. A chave privada não sai da VPS.
   */
  async grantGithubAccess(envId: string, gh: GithubAccess): Promise<{ fullName: string; message: string }> {
    const env = await this.envs.get(envId)
    if (!env?.vpsServerId) throw new Error('Ambiente sem VPS')
    const project = await this.db.project.findUnique({ where: { id: env.projectId } })
    if (!project) throw new Error('Projeto não encontrado')
    const repo = githubRepoOf(await this.resolveGitRepo(project))
    if (!repo) throw new Error('O projeto precisa do endereço de um repositório do GitHub (Projetos → editar)')
    const { fullName } = await gh.ensureRepo(`https://github.com/${repo.fullName}`)
    const K = keyFile(env.id)
    const k = await this.sh(env.vpsServerId,
      `mkdir -p ~/.ssh && chmod 700 ~/.ssh && { [ -f ${K} ] || ssh-keygen -q -t ed25519 -N '' -C ${q(`zeus-deploy-${env.kind}`)} -f ${K}; } && cat ${K}.pub`, 60_000)
    const pub = k.out.trim().split('\n').pop() ?? ''
    if (k.code !== 0 || !pub.startsWith('ssh-ed25519 ')) throw new Error(`Não consegui criar a chave na VPS: ${k.out.slice(-300)}`)
    const label = env.kind === 'production' ? 'produção' : 'staging'
    await gh.addKey(fullName, `Zeus deploy — ${label} (${env.vpsName}:${env.remotePath})`.slice(0, 100), pub)
    // O GitHub pode levar alguns segundos para aceitar a chave nova
    for (let i = 0; i < 4; i++) {
      const t = await this.sh(env.vpsServerId, `${gitSsh(env.id)} git ls-remote ${q(`git@github.com:${fullName}.git`)} HEAD`, 60_000)
      if (t.code === 0) return { fullName, message: `${env.vpsName} já lê ${fullName} (chave só de leitura).` }
      await new Promise(r => setTimeout(r, 3000))
    }
    throw new Error('A chave foi cadastrada no GitHub, mas a VPS ainda não conseguiu ler o repositório — tente o deploy em alguns segundos')
  }

  /** Comandos do ambiente, um por linha (# = comentário), na pasta dele. false no primeiro que falhar. */
  private async commands(env: ProjectEnvironment, say: (l: string) => void): Promise<boolean> {
    const lines = env.deployCommands.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    for (const line of lines) {
      say(`$ ${line}`)
      try {
        const r = await this.sh(env.vpsServerId!, `cd ${q(env.remotePath)} && ${line}`, CMD_TIMEOUT)
        if (r.out.trim()) say(r.out.trim().slice(-4000))
        if (r.code !== 0) { say(`(saiu com código ${r.code})`); return false }
      } catch (e) {
        say(`(${e instanceof Error ? e.message : String(e)})`)
        return false
      }
    }
    return true
  }

  /** GET do PC na URL do ambiente: até 4 tentativas (o app pode estar reiniciando). 'ok' ou o motivo. */
  private async smokeTest(url: string, say: (l: string) => void): Promise<string> {
    let last = ''
    for (let i = 1; i <= 4; i++) {
      try {
        const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
        if (res.status < 400) { say(`• Smoke test ${url} → ${res.status}`); return 'ok' }
        last = `respondeu ${res.status}`
      } catch (e) { last = e instanceof Error ? e.message : String(e) }
      say(`• Smoke test tentativa ${i}: ${last}`)
      if (i < 4) await new Promise(r => setTimeout(r, 5000))
    }
    return last
  }

  /** Comando na VPS com shell de login (PATH do node/pm2) e o código de saída marcado no fim. */
  private async sh(vpsId: string, script: string, timeoutMs: number): Promise<{ code: number; out: string }> {
    const out = await this.terminal.exec(vpsId, `bash -lc ${q(script)} 2>&1; echo "__ZEUS_EXIT:$?"`, timeoutMs)
    const m = out.match(/__ZEUS_EXIT:(\d+)\s*$/)
    return { code: m ? Number(m[1]) : -1, out: out.replace(/__ZEUS_EXIT:\d+\s*$/, '').trimEnd() }
  }
}
