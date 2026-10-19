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

export async function createLocalProject(input: { parent: string; name: string; git: boolean }): Promise<{ folder: string; git: 'ok' | 'off' | 'missing' }> {
  const nameErr = validateProjectFolderName(input.name)
  if (nameErr) throw new Error(nameErr)
  if (!path.isAbsolute(input.parent) || !fs.statSync(input.parent, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Pasta onde criar não encontrada: ${input.parent}`)
  }
  const folder = path.join(input.parent, input.name.trim())
  if (fs.existsSync(folder)) throw new Error(`Já existe ${folder} — escolha outro nome ou use "Abrir pasta…".`)
  fs.mkdirSync(folder)
  fs.writeFileSync(path.join(folder, 'README.md'), `# ${input.name.trim()}\n`, 'utf8')
  if (!input.git) return { folder, git: 'off' }
  fs.writeFileSync(path.join(folder, '.gitignore'), GITIGNORE, 'utf8')
  const ok = await new Promise<boolean>(resolve => {
    execFile('git', ['init', '-q'], { cwd: folder, windowsHide: true, timeout: 20_000 }, err => resolve(!err))
  })
  return { folder, git: ok ? 'ok' : 'missing' }
}
