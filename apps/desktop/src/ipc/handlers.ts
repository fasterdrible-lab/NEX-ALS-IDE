import type { IpcMain } from 'electron'
import {
  VpsService,
  ProjectsService,
  AccountsService,
  LauncherService,
  SettingsService,
  DiagnosticsService,
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
  const settings = new SettingsService()
  const diagnostics = new DiagnosticsService()

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
}
