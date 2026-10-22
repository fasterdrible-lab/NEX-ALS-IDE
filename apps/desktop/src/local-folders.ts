import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'

/**
 * Pastas locais abertas como projeto, à moda do VS Code: cada uma na sua janela, lista de recentes
 * e reabertura ao iniciar das que estavam abertas quando o app fechou. Guardado em JSON no userData
 * (não é dado sensível nem relacional — não precisa do SQLite).
 */
export interface RecentFolder { path: string; lastOpened: number }
interface State { recent: RecentFolder[]; open: string[] }

const MAX_RECENT = 20

export function folderKey(p: string): string {
  const r = path.resolve(p).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? r.toLowerCase() : r
}

export class LocalFolderStore {
  constructor(private readonly file: string) {}

  private read(): State {
    try {
      // BOM: o arquivo pode ter sido editado à mão (PowerShell 5.1 grava UTF-8 com BOM, que o JSON.parse recusa)
      const s = JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^﻿/, '')) as Partial<State>
      return {
        recent: Array.isArray(s.recent) ? s.recent.filter(r => r && typeof r.path === 'string') : [],
        open: Array.isArray(s.open) ? s.open.filter(p => typeof p === 'string') : [],
      }
    } catch { return { recent: [], open: [] } }
  }

  private write(s: State): void {
    try { fs.writeFileSync(this.file, JSON.stringify(s, null, 2), 'utf8') } catch (e) { console.error('[local-folders] falha ao gravar:', e) }
  }

  recent(): RecentFolder[] { return this.read().recent }

  touch(folder: string): void {
    const s = this.read()
    const k = folderKey(folder)
    s.recent = [{ path: path.resolve(folder), lastOpened: Date.now() }, ...s.recent.filter(r => folderKey(r.path) !== k)].slice(0, MAX_RECENT)
    this.write(s)
  }

  remove(folder: string): void {
    const s = this.read()
    const k = folderKey(folder)
    s.recent = s.recent.filter(r => folderKey(r.path) !== k)
    this.write(s)
  }

  /** Pastas com janela aberta — reabertas no próximo início. */
  setOpen(folders: string[]): void {
    const s = this.read()
    s.open = folders
    this.write(s)
  }

  openOnLastExit(): string[] {
    return this.read().open.filter(p => fs.statSync(p, { throwIfNoEntry: false })?.isDirectory())
  }
}

// ── Novo projeto local: cria a pasta (no OneDrive por padrão) e, se pedido, um repositório git ──

const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** Nome de pasta válido no Windows (é também o nome do projeto). */
export function validateProjectFolderName(name: string): string | null {
  const n = name.trim()
  if (!n) return 'Dê um nome ao projeto.'
  if (n.length > 100) return 'Nome longo demais (máx. 100 caracteres).'
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(n)) return 'O nome não pode ter < > : " / \\ | ? *'
  if (/[. ]$/.test(n) || WIN_RESERVED.test(n)) return 'Esse nome não é aceito pelo Windows como pasta.'
  return null
}

/** Pasta sugerida para novos projetos: o OneDrive do usuário (variável que o próprio OneDrive define) ou a pasta pessoal. */
export function defaultProjectsParent(): string {
  const od = process.env['OneDrive'] || process.env['OneDriveConsumer']
  return od && fs.statSync(od, { throwIfNoEntry: false })?.isDirectory() ? od : os.homedir()
}

const GITIGNORE = ['node_modules/', '.next/', 'dist/', '.turbo/', 'coverage/', '.env', '.env.local', '.env.*.local', ''].join('\n')

/** `<parent>/<name>` validado: nome aceito pelo Windows, parent existente e destino ainda livre. */
function newFolderTarget(parent: string, name: string): string {
  const nameErr = validateProjectFolderName(name)
  if (nameErr) throw new Error(nameErr)
  if (!path.isAbsolute(parent) || !fs.statSync(parent, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Pasta onde criar não encontrada: ${parent}`)
  }
  const folder = path.join(parent, name.trim())
  if (fs.existsSync(folder)) throw new Error(`Já existe ${folder} — escolha outro nome ou use "Pasta que já existe".`)
  return folder
}

function runGit(args: string[], cwd: string, timeout: number): Promise<{ ok: boolean; out: string; missing: boolean }> {
  return new Promise(resolve => {
    execFile('git', args, { cwd, windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const missing = (err as NodeJS.ErrnoException | null)?.code === 'ENOENT'
      resolve({ ok: !err, out: `${stdout}${stderr}`.trim(), missing })
    })
  })
}

export async function createLocalProject(input: { parent: string; name: string; git: boolean }): Promise<{ folder: string; git: 'ok' | 'off' | 'missing' }> {
  const folder = newFolderTarget(input.parent, input.name)
  fs.mkdirSync(folder)
  fs.writeFileSync(path.join(folder, 'README.md'), `# ${input.name.trim()}\n`, 'utf8')
  if (!input.git) return { folder, git: 'off' }
  fs.writeFileSync(path.join(folder, '.gitignore'), GITIGNORE, 'utf8')
  const { ok } = await runGit(['init', '-q'], folder, 20_000)
  return { folder, git: ok ? 'ok' : 'missing' }
}

/** Nome da pasta sugerido pelo endereço do repositório: `…/meu-app.git` → `meu-app`. */
export function repoFolderName(url: string): string {
  return url.replace(/[\\/]+$/, '').split(/[/:]/).pop()?.replace(/\.git$/i, '') ?? ''
}

/**
 * `git clone` para `<parent>/<name>`. Credenciais de repositório privado ficam com o Git do Windows
 * (Git Credential Manager) — o Zeus não vê nem guarda. Sem shell: a URL vai como argumento depois de `--`.
 */
export async function cloneLocalProject(input: { parent: string; url: string; name?: string }): Promise<{ folder: string }> {
  const folder = newFolderTarget(input.parent, input.name?.trim() || repoFolderName(input.url))
  const r = await runGit(['clone', '--', input.url, folder], input.parent, 10 * 60_000)
  if (r.missing) throw new Error('O git não foi encontrado no PC — instale o Git for Windows para clonar.')
  if (!r.ok) {
    fs.rmSync(folder, { recursive: true, force: true })
    throw new Error(`O git não conseguiu clonar: ${r.out.split('\n').filter(Boolean).pop() ?? 'sem detalhe'}`)
  }
  return { folder }
}

/** Pasta que já existe no PC: confere e lê o `origin` do git (se houver) para o campo Repositório. */
export async function inspectExistingFolder(folder: string): Promise<{ folder: string; name: string; gitRepo: string }> {
  if (!path.isAbsolute(folder) || !fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Pasta não encontrada: ${folder}`)
  }
  const resolved = path.resolve(folder)
  const origin = fs.existsSync(path.join(resolved, '.git'))
    ? await runGit(['remote', 'get-url', 'origin'], resolved, 10_000)
    : null
  return { folder: resolved, name: path.basename(resolved), gitRepo: origin?.ok ? origin.out.split('\n')[0] ?? '' : '' }
}
