import fs from 'node:fs'
import path from 'node:path'

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
