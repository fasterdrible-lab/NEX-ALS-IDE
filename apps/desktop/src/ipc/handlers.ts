import type { IpcMain } from 'electron'
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
} from '@cwm/core'

function wrapHandler<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  return fn().catch((err: unknown) => ({
    error: err instanceof Error ? err.message : String(err),
  }))
}

export function setupIpcHandlers(ipcMain: IpcMain): void {
  const vps = new VpsService()
  const projects = new ProjectsService()
  const accounts = new AccountsService()
  const launcher = new LauncherService()
  const git = new GitService()
  const settings = new SettingsService()
  const diagnostics = new DiagnosticsService()
  const terminal = new TerminalService()
  const terminalSessions = new Map<string, TerminalSession>()
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

  ipcMain.handle('terminal:exec', async (_, { vpsId, cmd }: { vpsId: string; cmd: string }) => {
    try {
      const out = await terminal.exec(vpsId, cmd)
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
}
