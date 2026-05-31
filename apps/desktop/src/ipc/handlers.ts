import type { IpcMain, BrowserWindow } from 'electron'
import { dialog, clipboard, nativeImage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  VpsService,
  ProjectsService,
  AccountsService,
  LauncherService,
  SettingsService,
  DiagnosticsService,
  TerminalService,
  TerminalSession,
  SftpService,
  SftpSession,
  GitService,
  TunnelService,
} from '@cwm/core'

function wrapHandler<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  return fn().catch((err: unknown) => ({
    error: err instanceof Error ? err.message : String(err),
  }))
}

export function setupIpcHandlers(ipcMain: IpcMain, win?: BrowserWindow): void {
  const vps = new VpsService()
  const projects = new ProjectsService()
  const accounts = new AccountsService()
  const launcher = new LauncherService()
  const git = new GitService()
  const settings = new SettingsService()
  const diagnostics = new DiagnosticsService()
  const terminal = new TerminalService()
  const terminalSessions = new Map<string, TerminalSession>()
  const tunnelSvc = new TunnelService()
  const sftpService = new SftpService()
  const sftpSessions = new Map<string, SftpSession>()

  // VPS
  ipcMain.handle('vps:list', () => wrapHandler(() => vps.list()))
  ipcMain.handle('vps:create', (_, data) => wrapHandler(() => vps.create(data)))
  ipcMain.handle('vps:update', (_, data) => wrapHandler(() => vps.update(data.id, data)))
  ipcMain.handle('vps:delete', (_, id: string) => wrapHandler(() => vps.delete(id)))
  ipcMain.handle('vps:test', (_, id: string) => wrapHandler(() => vps.testConnection(id)))
  ipcMain.handle('vps:setupRemoteProject', (_, data: { id: string; remotePath: string; gitRepo?: string }) =>
    wrapHandler(() => vps.setupRemoteProject(data.id, data.remotePath, data.gitRepo))
  )

  // Projects
  ipcMain.handle('projects:list', () => wrapHandler(() => projects.list()))
  ipcMain.handle('projects:create', (_, data) => wrapHandler(() => projects.create(data)))
  ipcMain.handle('projects:update', (_, data) => wrapHandler(() => projects.update(data.id, data)))
  ipcMain.handle('projects:delete', (_, id: string) => wrapHandler(() => projects.delete(id)))
  ipcMain.handle('projects:recent', () => wrapHandler(() => projects.getRecent(5)))

  // Accounts
  ipcMain.handle('accounts:list', () => wrapHandler(() => accounts.list()))
  ipcMain.handle('accounts:create', (_, data) => wrapHandler(() => accounts.create(data)))
  ipcMain.handle('accounts:update', (_, data) => wrapHandler(() => accounts.update(data.id, data)))
  ipcMain.handle('accounts:delete', (_, id: string) => wrapHandler(() => accounts.delete(id)))

  // Launcher
  ipcMain.handle('launcher:openProject', (_, projectId: string) =>
    wrapHandler(() => launcher.openProject(projectId))
  )
  ipcMain.handle('launcher:openTerminal', (_, vpsId: string) =>
    wrapHandler(() => launcher.openTerminal(vpsId))
  )
  ipcMain.handle('launcher:checkClaude', (_, vpsId: string) =>
    wrapHandler(() => vps.checkClaudeCode(vpsId))
  )

  // Settings
  ipcMain.handle('settings:get', () => wrapHandler(() => settings.get()))
  ipcMain.handle('settings:update', (_, data) => wrapHandler(() => settings.update(data)))

  // Diagnostics
  ipcMain.handle('diagnostics:run', () => wrapHandler(() => diagnostics.runAll()))

  // Terminal — sessão SSH interativa bidirecional
  ipcMain.handle('terminal:open', async (event, vpsId: string) => {
    try {
      const session = await terminal.openShell(vpsId)
      terminalSessions.set(session.sessionId, session)

      session.on('data', (data: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('terminal:data', { sessionId: session.sessionId, data })
        }
      })
      session.on('close', () => {
        terminalSessions.delete(session.sessionId)
        if (!event.sender.isDestroyed()) {
          event.sender.send('terminal:exit', { sessionId: session.sessionId })
        }
      })

      return { success: true, sessionId: session.sessionId }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.on('terminal:input', (_, { sessionId, data }: { sessionId: string; data: string }) => {
    terminalSessions.get(sessionId)?.write(data)
  })

  ipcMain.on('terminal:resize', (_, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    terminalSessions.get(sessionId)?.resize(cols, rows)
  })

  ipcMain.handle('terminal:close', (_, sessionId: string) => {
    const session = terminalSessions.get(sessionId)
    session?.destroy()
    terminalSessions.delete(sessionId)
    return { success: true }
  })

  ipcMain.handle('terminal:exec', async (_, { vpsId, cmd, timeout }: { vpsId: string; cmd: string; timeout?: number }) => {
    try {
      const out = await terminal.exec(vpsId, cmd, timeout)
      return { success: true, output: out }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err), output: '' }
    }
  })

  // SFTP — file explorer
  ipcMain.handle('sftp:open', async (_, vpsId: string) => {
    try {
      const session = await sftpService.openSession(vpsId)
      sftpSessions.set(session.sessionId, session)
      return { success: true, sessionId: session.sessionId }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sftp:readdir', async (_, { sessionId, path }: { sessionId: string; path: string }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada' }
    try {
      const entries = await s.readdir(path)
      return { success: true, entries }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sftp:readFile', async (_, { sessionId, path }: { sessionId: string; path: string }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada' }
    try {
      const content = await s.readFile(path)
      return { success: true, content }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sftp:writeFile', async (_, { sessionId, path, content }: { sessionId: string; path: string; content: string }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada' }
    try {
      await s.writeFile(path, content)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sftp:mkdir', async (_, { sessionId, path }: { sessionId: string; path: string }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada' }
    try {
      await s.mkdir(path)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sftp:delete', async (_, { sessionId, path, isDirectory }: { sessionId: string; path: string; isDirectory: boolean }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada' }
    try {
      await s.delete(path, isDirectory)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sftp:rename', async (_, { sessionId, oldPath, newPath }: { sessionId: string; oldPath: string; newPath: string }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada' }
    try {
      await s.rename(oldPath, newPath)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sftp:close', (_, sessionId: string) => {
    sftpSessions.get(sessionId)?.destroy()
    sftpSessions.delete(sessionId)
    return { success: true }
  })

  ipcMain.handle('sftp:readFileBase64', async (_, { sessionId, path }: { sessionId: string; path: string }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada', data: '' }
    try {
      const data = await s.readFileBase64(path)
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err), data: '' }
    }
  })

  ipcMain.handle('sftp:touch', async (_, { sessionId, path }: { sessionId: string; path: string }) => {
    const s = sftpSessions.get(sessionId)
    if (!s) return { success: false, error: 'Sessão SFTP não encontrada' }
    try {
      await s.touch(path)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Git
  ipcMain.handle('git:status', (_, { vpsId, cwd }: { vpsId: string; cwd: string }) =>
    wrapHandler(() => git.status(vpsId, cwd))
  )
  ipcMain.handle('git:diff', (_, { vpsId, cwd, filePath, staged }: { vpsId: string; cwd: string; filePath: string; staged: boolean }) =>
    wrapHandler(() => git.diff(vpsId, cwd, filePath, staged))
  )
  ipcMain.handle('git:add', (_, { vpsId, cwd, files }: { vpsId: string; cwd: string; files: string[] }) =>
    wrapHandler(() => git.add(vpsId, cwd, files))
  )
  ipcMain.handle('git:restore', (_, { vpsId, cwd, files, staged }: { vpsId: string; cwd: string; files: string[]; staged: boolean }) =>
    wrapHandler(() => git.restore(vpsId, cwd, files, staged))
  )
  ipcMain.handle('git:commit', (_, { vpsId, cwd, message }: { vpsId: string; cwd: string; message: string }) =>
    wrapHandler(() => git.commit(vpsId, cwd, message))
  )
  ipcMain.handle('git:push', (_, { vpsId, cwd }: { vpsId: string; cwd: string }) =>
    wrapHandler(() => git.push(vpsId, cwd))
  )
  ipcMain.handle('git:pull', (_, { vpsId, cwd }: { vpsId: string; cwd: string }) =>
    wrapHandler(() => git.pull(vpsId, cwd))
  )
  ipcMain.handle('git:log', (_, { vpsId, cwd, n }: { vpsId: string; cwd: string; n?: number }) =>
    wrapHandler(() => git.log(vpsId, cwd, n))
  )

  // ── IDE-18: DAP — abre DevTools externo para depuração remota ─────────
  ipcMain.handle('debug:openDevTools', (_, { wsUrl }: { wsUrl: string }) => {
    const devWin = new (require('electron').BrowserWindow)({
      width: 1200, height: 800,
      title: 'HEXAGON IDE — Debug',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    devWin.loadURL(wsUrl)
    return { success: true }
  })

  // ── IDE-20: Local filesystem ─────────────────────────────────────────
  ipcMain.handle('local:openFolder', async () => {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Abrir pasta local no HEXAGON IDE',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('local:readdir', async (_, dirPath: string) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name).replace(/\\/g, '/'),
      isDirectory: e.isDirectory(),
    })).sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  })

  ipcMain.handle('local:readFile', async (_, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle('local:readFileBase64', async (_, filePath: string) => {
    const buf = await fs.readFile(filePath)
    return buf.toString('base64')
  })

  ipcMain.handle('local:writeFile', async (_, { filePath, content }: { filePath: string; content: string }) => {
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  })

  ipcMain.handle('local:mkdir', async (_, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true })
    return { success: true }
  })

  ipcMain.handle('local:delete', async (_, filePath: string) => {
    await fs.rm(filePath, { recursive: true, force: true })
    return { success: true }
  })

  ipcMain.handle('local:rename', async (_, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
    await fs.rename(oldPath, newPath)
    return { success: true }
  })

  ipcMain.handle('local:touch', async (_, filePath: string) => {
    await fs.writeFile(filePath, '', { flag: 'wx' }).catch(() => {})
    return { success: true }
  })

  // ── IDE-17: Remote Port Forwarding (SSH tunnel) ───────────────────────────
  ipcMain.handle('tunnel:open', async (_, { vpsId, localPort, remotePort, remoteHost }:
    { vpsId: string; localPort: number; remotePort: number; remoteHost?: string }) => {
    try {
      const info = await tunnelSvc.open(vpsId, localPort, remotePort, remoteHost)
      return { success: true, tunnel: info }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle('tunnel:close', (_, tunnelId: string) => {
    tunnelSvc.close(tunnelId)
    return { success: true }
  })
  ipcMain.handle('tunnel:list', () => ({ tunnels: tunnelSvc.list() }))

  // ── Import/Export de configurações ─────────────────────────────────────────
  ipcMain.handle('config:export', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog(win!, {
      title: 'Exportar configurações HEXAGON IDE',
      defaultPath: `hexagon-ide-backup-${new Date().toISOString().slice(0,10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { success: false, canceled: true }
    try {
      const [vpsList, projectsList, accountsList, settingsData] = await Promise.all([
        vps.list(), projects.list(), accounts.list(), settings.get(),
      ])
      const backup = {
        version: '1.3.2',
        exportedAt: new Date().toISOString(),
        vps: vpsList,
        projects: projectsList,
        accounts: accountsList,
        settings: settingsData,
      }
      await fs.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf-8')
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('config:import', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(win!, {
      title: 'Importar configurações HEXAGON IDE',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { success: false, canceled: true }
    try {
      const raw = await fs.readFile(filePaths[0], 'utf-8')
      const backup = JSON.parse(raw)
      if (!backup.version || !Array.isArray(backup.vps)) {
        return { success: false, error: 'Arquivo inválido ou não é um backup do HEXAGON IDE.' }
      }
      let imported = { vps: 0, projects: 0, accounts: 0 }
      for (const v of (backup.vps ?? [])) {
        try { await vps.create(v); imported.vps++ } catch {}
      }
      for (const p of (backup.projects ?? [])) {
        try { await projects.create(p); imported.projects++ } catch {}
      }
      for (const a of (backup.accounts ?? [])) {
        try { await accounts.create(a); imported.accounts++ } catch {}
      }
      return { success: true, imported }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Clipboard — salva imagem do clipboard em arquivo temp e retorna o path ──
  ipcMain.handle('clipboard:readImage', async () => {
    const img = clipboard.readImage()
    if (img.isEmpty()) return null
    const png = img.toPNG()
    const tmpPath = path.join(require('os').tmpdir(), `hexagon_clip_${Date.now()}.png`)
    await fs.writeFile(tmpPath, png)
    return { filePath: tmpPath.replace(/\\/g, '/') }
  })
}
