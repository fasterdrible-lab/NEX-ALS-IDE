import { getPrismaClient } from '@cwm/db'
import type { IpcMain } from 'electron'
import { BrowserWindow, dialog, clipboard, nativeImage, Notification, shell } from 'electron'
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
  AiService,
  ProjectMemoryService,
  NotificationMonitor,
  AuthService,
  SquadService,
  AGENTS,
  KnowledgeService,
  type AppUser,
  type AgentName,
} from '@cwm/core'

function wrapHandler<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  return fn().catch((err: unknown) => ({
    error: err instanceof Error ? err.message : String(err),
  }))
}

async function fetchClaudeUsage(accessToken: string, _orgId: string): Promise<Record<string, unknown> | null> {
  const https = await import('node:https')
  return new Promise(resolve => {
    const req = https.default.get({
      hostname: 'claude.ai',
      path: '/api/bootstrap',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'NEX-ALS-IDE/1.0',
      },
      timeout: 6000,
    }, res => {
      let buf = ''
      res.on('data', (c: Buffer) => { buf += c.toString() })
      res.on('end', () => {
        try { resolve(JSON.parse(buf)) } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

export function setupIpcHandlers(ipcMain: IpcMain, win?: BrowserWindow, notifMonitor?: NotificationMonitor): void {
  // ── Sessão de autenticação ────────────────────────────────────────────────────
  const authSvc = new AuthService()
  let session: AppUser | null = null
  // sessionRequired=true quando ao menos 1 usuário existe no banco
  // Inicializado assincronamente; qualquer auth:status antes disso retorna needsSetup=true
  let sessionRequired = false
  void authSvc.countUsers().then((n: number) => { sessionRequired = n > 0 }).catch(() => {})

  function requireAdmin(): void {
    if (!sessionRequired) return // modo single-user: sem usuários cadastrados
    if (!session) throw new Error('Não autenticado. Faça login primeiro.')
    if (session.role !== 'admin') throw new Error('Permissão negada. Apenas administradores podem realizar esta ação.')
  }

  function requireAuth(): void {
    if (!sessionRequired) return
    if (!session) throw new Error('Não autenticado. Faça login primeiro.')
  }

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
  const aiSvc = new AiService()
  const squadSvc = new SquadService(aiSvc)
  const knowledgeSvc = new KnowledgeService()
  const memorySvc = new ProjectMemoryService()
  const sftpService = new SftpService()
  const sftpSessions = new Map<string, SftpSession>()
  // Claude Code subprocess streams (account-based, sem API key)
  const claudeProcs = new Map<string, { kill: () => void }>()

  // ── Estado em memória das notificações ───────────────────────────────────────
  const db = getPrismaClient()
  let notificationsEnabled = true
  // Lê preferência salva no banco assincronamente
  void (db.$queryRawUnsafe(
    "SELECT notificationsEnabled FROM settings WHERE id = 'default'"
  ) as Promise<{ notificationsEnabled: number }[]>).then((rows: { notificationsEnabled: number }[]) => {
    notificationsEnabled = (rows[0]?.notificationsEnabled ?? 1) !== 0
    notifMonitor?.setEnabled(notificationsEnabled)
  }).catch(() => {})

  // VPS
  ipcMain.handle('vps:list', () => wrapHandler(() => { requireAuth(); return vps.list() }))
  ipcMain.handle('vps:create', (_, data) => wrapHandler(() => { requireAdmin(); return vps.create(data) }))
  ipcMain.handle('vps:update', (_, data) => wrapHandler(() => { requireAdmin(); return vps.update(data.id, data) }))
  ipcMain.handle('vps:delete', (_, id: string) => wrapHandler(() => { requireAdmin(); return vps.delete(id) }))
  ipcMain.handle('vps:test', (_, id: string) => wrapHandler(() => { requireAuth(); return vps.testConnection(id) }))
  ipcMain.handle('vps:clearFingerprint', (_, id: string) => wrapHandler(() => { requireAdmin(); return vps.clearFingerprint(id) }))
  ipcMain.handle('vps:setupRemoteProject', (_, data: { id: string; remotePath: string; gitRepo?: string }) =>
    wrapHandler(() => { requireAdmin(); return vps.setupRemoteProject(data.id, data.remotePath, data.gitRepo) })
  )

  // Projects
  ipcMain.handle('projects:list', () => wrapHandler(() => { requireAuth(); return projects.list() }))
  ipcMain.handle('projects:create', (_, data) => wrapHandler(() => { requireAdmin(); return projects.create(data) }))
  ipcMain.handle('projects:update', (_, data) => wrapHandler(() => { requireAdmin(); return projects.update(data.id, data) }))
  ipcMain.handle('projects:delete', (_, id: string) => wrapHandler(() => { requireAdmin(); return projects.delete(id) }))
  ipcMain.handle('projects:recent', () => wrapHandler(() => { requireAuth(); return projects.getRecent(5) }))

  // Accounts
  ipcMain.handle('accounts:list', () => wrapHandler(() => { requireAuth(); return accounts.list() }))
  ipcMain.handle('accounts:create', (_, data) => wrapHandler(() => { requireAdmin(); return accounts.create(data) }))
  ipcMain.handle('accounts:update', (_, data) => wrapHandler(() => { requireAdmin(); return accounts.update(data.id, data) }))
  ipcMain.handle('accounts:delete', (_, id: string) => wrapHandler(() => { requireAdmin(); return accounts.delete(id) }))

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
  ipcMain.handle('settings:update', (_, data) => wrapHandler(() => { requireAdmin(); return settings.update(data) }))

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
      title: 'NEX-ALS IDE — Debug',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    devWin.loadURL(wsUrl)
    return { success: true }
  })

  // ── IDE-20: Local filesystem ─────────────────────────────────────────
  ipcMain.handle('local:openFolder', async () => {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Abrir pasta local no NEX-ALS IDE',
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
    await fs.mkdir(path.dirname(filePath), { recursive: true })
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
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, '', { flag: 'wx' }).catch(() => {})
    return { success: true }
  })

  // ── Local file watcher (fs.watch) ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { watch: fsWatch } = require('node:fs') as typeof import('node:fs')
  const localWatchers = new Map<string, import('node:fs').FSWatcher>()

  ipcMain.handle('local:watch', (_, { watchId, folderPath }: { watchId: string; folderPath: string }) => {
    localWatchers.get(watchId)?.close()
    try {
      const watcher = fsWatch(folderPath, { recursive: true }, (eventType: string, filename: string | null) => {
        if (!filename) return
        const fullPath = path.join(folderPath, filename)
        win?.webContents.send('squad:fs:change', { watchId, eventType, filename, fullPath })
      })
      watcher.on('error', () => {})
      localWatchers.set(watchId, watcher)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('local:unwatch', (_, { watchId }: { watchId: string }) => {
    localWatchers.get(watchId)?.close()
    localWatchers.delete(watchId)
    return { success: true }
  })

  ipcMain.handle('local:exec', (_, { cmd, cwd }: { cmd: string; cwd?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { exec } = require('child_process') as typeof import('child_process')
    return new Promise<{ success: boolean; output: string }>(resolve => {
      exec(cmd, { cwd, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const output = [stdout, stderr].filter(Boolean).join('\n').trim()
          resolve({ success: !err, output: output || '(sem output)' })
        }
      )
    })
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
    try { requireAdmin() } catch (e) { return { error: (e as Error).message } }
    const { filePath, canceled } = await dialog.showSaveDialog(win!, {
      title: 'Exportar configurações NEX-ALS IDE',
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
    try { requireAdmin() } catch (e) { return { error: (e as Error).message } }
    const { filePaths, canceled } = await dialog.showOpenDialog(win!, {
      title: 'Importar configurações NEX-ALS IDE',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { success: false, canceled: true }
    try {
      const raw = await fs.readFile(filePaths[0], 'utf-8')
      const backup = JSON.parse(raw)
      if (!backup.version || !Array.isArray(backup.vps)) {
        return { success: false, error: 'Arquivo inválido ou não é um backup do NEX-ALS IDE.' }
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

  // ── Histórico de lançamentos ──────────────────────────────────────────────
  ipcMain.handle('history:list', async (_, filters?: { vpsId?: string; projectId?: string; success?: boolean; limit?: number }) => {
    try {
      const db = getPrismaClient()
      const where: Record<string, unknown> = {}
      if (filters?.projectId) where.projectId = filters.projectId
      if (filters?.success !== undefined) where.success = filters.success
      if (filters?.vpsId) where.project = { vpsServerId: filters.vpsId }
      const history = await db.launchHistory.findMany({
        where,
        include: { project: { include: { vpsServer: true } } },
        orderBy: { launchedAt: 'desc' },
        take: filters?.limit ?? 200,
      })
      return { success: true, history }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), history: [] }
    }
  })

  // ── PM2 Process Manager — via SSH exec ───────────────────────────────────
  ipcMain.handle('pm2:list', async (_, vpsId: string) => {
    try {
      const out = await terminal.exec(vpsId, `pm2 jlist 2>/dev/null || echo '[]'`, 15000)
      const json = out.trim().replace(/\x1B\[[0-9;]*m/g, '') // strip ANSI
      const raw = JSON.parse(json) as Array<Record<string, unknown>>
      const processes = raw.map(p => {
        const env = (p.pm2_env ?? {}) as Record<string, unknown>
        const monit = (p.monit ?? {}) as Record<string, unknown>
        return {
          id: p.pm_id ?? 0,
          name: p.name ?? '',
          status: env.status ?? 'unknown',
          cpu: typeof monit.cpu === 'number' ? monit.cpu : 0,
          memory: typeof monit.memory === 'number' ? monit.memory : 0,
          restarts: typeof env.restart_time === 'number' ? env.restart_time : 0,
          uptime: typeof env.pm_uptime === 'number' ? Date.now() - env.pm_uptime : 0,
        }
      })
      return { success: true, processes }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), processes: [] }
    }
  })
  ipcMain.handle('pm2:restart', async (_, { vpsId, name }: { vpsId: string; name: string }) => {
    try { const out = await terminal.exec(vpsId, `pm2 restart ${name} --no-color 2>&1`, 30000); return { success: true, output: out } }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })
  ipcMain.handle('pm2:stop', async (_, { vpsId, name }: { vpsId: string; name: string }) => {
    try { const out = await terminal.exec(vpsId, `pm2 stop ${name} --no-color 2>&1`, 15000); return { success: true, output: out } }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })
  ipcMain.handle('pm2:logs', async (_, { vpsId, name }: { vpsId: string; name: string }) => {
    try {
      const out = await terminal.exec(vpsId, `pm2 logs ${name} --lines 120 --nostream --no-color 2>&1`, 15000)
      return { success: true, logs: out.replace(/\x1B\[[0-9;]*m/g, '') }
    } catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err), logs: '' } }
  })
  ipcMain.handle('pm2:delete', async (_, { vpsId, name }: { vpsId: string; name: string }) => {
    try { await terminal.exec(vpsId, `pm2 delete ${name} --no-color 2>&1`, 15000); return { success: true } }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })

  // ── Docker Explorer — lista/start/stop/logs/remove via SSH exec ──────────
  const DOCKER_FMT = `'{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}","ports":"{{.Ports}}"}'`
  ipcMain.handle('docker:list', async (_, vpsId: string) => {
    try {
      const out = await terminal.exec(vpsId, `docker ps -a --format ${DOCKER_FMT} 2>&1`, 15000)
      const containers = out.split('\n')
        .filter(l => l.trim().startsWith('{'))
        .map(l => { try { return JSON.parse(l) } catch { return null } })
        .filter(Boolean)
      return { success: true, containers }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), containers: [] }
    }
  })
  ipcMain.handle('docker:start', async (_, { vpsId, id }: { vpsId: string; id: string }) => {
    try { await terminal.exec(vpsId, `docker start ${id}`, 15000); return { success: true } }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })
  ipcMain.handle('docker:stop', async (_, { vpsId, id }: { vpsId: string; id: string }) => {
    try { await terminal.exec(vpsId, `docker stop ${id}`, 30000); return { success: true } }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })
  ipcMain.handle('docker:logs', async (_, { vpsId, id }: { vpsId: string; id: string }) => {
    try {
      const out = await terminal.exec(vpsId, `docker logs --tail 150 --timestamps ${id} 2>&1`, 15000)
      return { success: true, logs: out }
    } catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err), logs: '' } }
  })
  ipcMain.handle('docker:remove', async (_, { vpsId, id }: { vpsId: string; id: string }) => {
    try { await terminal.exec(vpsId, `docker rm ${id}`, 15000); return { success: true } }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })

  // ── Provedores de IA — NEX-ALS AI HUB ────────────────────────────────────
  ipcMain.handle('ai:chatAgent',  (_, data) => wrapHandler(() => aiSvc.chatAgent(data)))
  ipcMain.handle('ai:list',       () => wrapHandler(() => aiSvc.listProviders()))
  ipcMain.handle('ai:save',       (_, data) => wrapHandler(() => aiSvc.saveProvider(data)))
  ipcMain.handle('ai:delete',     (_, provider: string) => wrapHandler(() => aiSvc.deleteProvider(provider)))
  ipcMain.handle('ai:test',       (_, provider: string) => wrapHandler(() => aiSvc.testProvider(provider)))
  ipcMain.handle('ai:chat',       (_, data) => wrapHandler(() => aiSvc.chat(data)))
  ipcMain.handle('ai:models',     (_, provider: string) => wrapHandler(() => aiSvc.getModels(provider)))
  ipcMain.handle('ai:chatCtx',    (_, data) => wrapHandler(() => aiSvc.chatWithContext(data)))

  // Streaming — ai:stream:start / ai:stream:cancel
  ipcMain.handle('ai:stream:start', (event, data: {
    provider?: string
    messages?: Array<{ role: string; content: unknown }>
    systemPrompt?: string
    [key: string]: unknown
  }) =>
    wrapHandler(async () => {
      requireAuth()
      const targetWin = BrowserWindow.fromWebContents(event.sender)

      // Descobre o provider efetivo (explícito ou padrão do banco)
      let effectiveProvider = data.provider
      if (!effectiveProvider) {
        try {
          const rows = await db.$queryRawUnsafe(
            `SELECT provider FROM ai_providers WHERE isDefault=1 AND enabled=1 LIMIT 1`
          ) as Array<{ provider: string }>
          effectiveProvider = rows[0]?.provider
        } catch { /* ignora */ }
      }

      // Injeta KB global no system prompt (quando não vazio)
      const kbCtx = await knowledgeSvc.buildContext().catch(() => '')
      const systemPromptWithKB = kbCtx && data.systemPrompt
        ? `${data.systemPrompt as string}\n\n${kbCtx}`
        : kbCtx
          ? kbCtx
          : (data.systemPrompt as string | undefined)
      const dataWithKB = systemPromptWithKB
        ? { ...data, systemPrompt: systemPromptWithKB }
        : data

      // ── Rota Claude Code (conta, sem API key) ──────────────────────────────
      if (effectiveProvider === 'claude-code') {
        const streamId = crypto.randomUUID()
        const msgs = (dataWithKB.messages ?? []) as Array<{ role: string; content: unknown }>
        const sys = dataWithKB.systemPrompt as string | undefined

        // Monta prompt para `claude -p` incluindo histórico
        const parts: string[] = []
        if (sys) parts.push(sys, '')
        for (const m of msgs.slice(0, -1)) {
          const label = m.role === 'user' ? 'Human' : 'Assistant'
          const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          parts.push(`${label}: ${text}`)
        }
        const last = msgs[msgs.length - 1]
        const lastText = last ? (typeof last.content === 'string' ? last.content : JSON.stringify(last.content)) : ''
        const prompt = msgs.length > 1
          ? parts.join('\n') + `\nHuman: ${lastText}`
          : lastText

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { spawn } = require('child_process') as typeof import('child_process')
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const osAi = require('os') as typeof import('os')
        const { spawnEnv } = await getActiveClaudeEnv()
        // cwd = home para evitar sandbox do Claude CLI bloquear acesso
        const proc = spawn('claude', ['-p', '--output-format', 'text'], {
          shell: true,
          env: spawnEnv,
          cwd: osAi.homedir(),
        })
        proc.stdin?.write(prompt, 'utf-8')
        proc.stdin?.end()
        claudeProcs.set(streamId, proc)

        let doneSent = false
        let hasStdout = false
        let stderrBuf = ''
        let lastChunkAt = Date.now()
        // eslint-disable-next-line prefer-const
        let watchdog: ReturnType<typeof setInterval>
        const sendErr = (msg: string) => {
          if (doneSent) return; doneSent = true
          clearInterval(watchdog)
          claudeProcs.delete(streamId)
          try { targetWin?.webContents.send('ai:stream:chunk', { streamId, type: 'error', error: msg }) } catch { /* janela fechada */ }
        }
        const sendDone = () => {
          if (doneSent) return; doneSent = true
          clearInterval(watchdog)
          claudeProcs.delete(streamId)
          try { targetWin?.webContents.send('ai:stream:chunk', { streamId, type: 'done' }) } catch { /* janela fechada */ }
        }
        proc.stdout?.on('data', (chunk: Buffer) => {
          hasStdout = true
          lastChunkAt = Date.now()
          try { targetWin?.webContents.send('ai:stream:chunk', { streamId, type: 'text_delta', delta: chunk.toString() }) } catch { /* janela fechada */ }
        })
        proc.stderr?.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString() })
        proc.on('close', (code: number) => {
          if (code !== 0 && !hasStdout) {
            const isAuth = /not logged in|session expired|please log in|unauthorized/i.test(stderrBuf)
            sendErr(isAuth
              ? 'Não autenticado. Execute "claude" no terminal e faça login.'
              : `claude CLI encerrou com erro (código ${code})${stderrBuf ? ': ' + stderrBuf.slice(0, 200) : ''}`
            )
          } else {
            sendDone()
          }
        })
        proc.on('error', (err: Error) => sendErr(`claude CLI não encontrado: ${err.message}`))
        watchdog = setInterval(() => {
          if (doneSent) { clearInterval(watchdog); return }
          if (Date.now() - lastChunkAt > 90_000) {
            clearInterval(watchdog)
            proc.kill()
            sendErr('⏱ Timeout: claude CLI não respondeu em 90s. O processo foi encerrado. Tente novamente.')
          }
        }, 15_000)

        return { streamId }
      }

      // ── Rota padrão (API Key) ──────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await aiSvc.startStream(dataWithKB as any, chunk => {
        try { targetWin?.webContents.send('ai:stream:chunk', chunk) } catch { /* janela fechada */ }
        if (chunk.type === 'error' && notificationsEnabled && Notification.isSupported()) {
          if (!targetWin?.isFocused()) {
            new Notification({
              title: 'Erro no AI Hub',
              body: (chunk as { error?: string }).error || 'O streaming foi interrompido por um erro',
            }).show()
          }
        }
      })
      return { streamId: session.streamId }
    })
  )
  ipcMain.handle('ai:stream:cancel', (_, streamId: string) => {
    const proc = claudeProcs.get(streamId)
    if (proc) { proc.kill(); claudeProcs.delete(streamId) }
    else { aiSvc.cancelStream(streamId) }
    return { success: true }
  })

  // Claude Code — detecção local (sem API key)
  ipcMain.handle('claude:check', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawn } = require('child_process') as typeof import('child_process')
    const { spawnEnv } = await getActiveClaudeEnv()
    return new Promise<{ installed: boolean; version: string }>(resolve => {
      const proc = spawn('claude', ['--version'], { shell: true, env: spawnEnv, timeout: 8000 })
      let output = ''; let errOutput = ''
      proc.stdout?.on('data', (d: Buffer) => { output += d.toString() })
      proc.stderr?.on('data', (d: Buffer) => { errOutput += d.toString() })
      proc.on('close', (code: number | null) => {
        const version = (output || errOutput).trim()
        if (code === 0 && version) resolve({ installed: true, version })
        else resolve({ installed: false, version: '' })
      })
      proc.on('error', () => resolve({ installed: false, version: '' }))
    })
  })

  // ── Claude Code — múltiplas contas ──────────────────────────────────────
  // Helper: retorna configDir e PATH da conta ativa (ou padrão ~/.claude)
  async function getActiveClaudeEnv(): Promise<{ configDir: string; spawnEnv: NodeJS.ProcessEnv }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const osModule = require('os') as typeof import('os')
    const npmBin = process.platform === 'win32'
      ? `${osModule.homedir()}\\AppData\\Roaming\\npm`
      : `${osModule.homedir()}/.npm-global/bin:/usr/local/bin`
    const sep = process.platform === 'win32' ? ';' : ':'
    let configDir = ''
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT configDir FROM claude_code_accounts WHERE isActive=1 LIMIT 1`
      ) as Array<{ configDir: string }>
      if (rows[0]) configDir = rows[0].configDir
    } catch { /* tabela ainda não existe numa sessão antiga */ }
    const spawnEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${npmBin}${sep}${process.env.PATH ?? ''}`,
      ...(configDir ? { CLAUDE_CONFIG_DIR: configDir } : {}),
    }
    return { configDir, spawnEnv }
  }

  ipcMain.handle('claude:accounts:list', () =>
    wrapHandler(async () => {
      const rows = await db.$queryRawUnsafe(
        `SELECT id, name, configDir, isActive, createdAt FROM claude_code_accounts ORDER BY createdAt ASC`
      ) as Array<{ id: string; name: string; configDir: string; isActive: number; createdAt: string }>
      return rows
    })
  )

  ipcMain.handle('claude:accounts:add', (_, data: { name: string; useDefault?: boolean }) =>
    wrapHandler(async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const osModule = require('os') as typeof import('os')
      const id = crypto.randomUUID()
      // useDefault=true → usa ~/.claude já autenticado; false → cria dir novo
      const configDir = data.useDefault
        ? (process.platform === 'win32'
            ? `${osModule.homedir()}\\.claude`
            : `${osModule.homedir()}/.claude`)
        : (process.platform === 'win32'
            ? `${osModule.homedir()}\\.claude-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}-${id.slice(0, 6)}`
            : `${osModule.homedir()}/.claude-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}-${id.slice(0, 6)}`)
      const count = await db.$queryRawUnsafe(
        `SELECT COUNT(*) as n FROM claude_code_accounts`
      ) as Array<{ n: number }>
      const isFirst = (count[0]?.n ?? 0) === 0
      await db.$executeRawUnsafe(
        `INSERT INTO claude_code_accounts (id, name, configDir, isActive) VALUES (?, ?, ?, ?)`,
        id, data.name, configDir, isFirst ? 1 : 0
      )
      return { id, name: data.name, configDir, isActive: isFirst ? 1 : 0 }
    })
  )

  ipcMain.handle('claude:accounts:setActive', (_, id: string) =>
    wrapHandler(async () => {
      await db.$executeRawUnsafe(`UPDATE claude_code_accounts SET isActive=0`)
      await db.$executeRawUnsafe(`UPDATE claude_code_accounts SET isActive=1 WHERE id=?`, id)
      return { success: true }
    })
  )

  ipcMain.handle('claude:accounts:delete', (_, id: string) =>
    wrapHandler(async () => {
      await db.$executeRawUnsafe(`DELETE FROM claude_code_accounts WHERE id=?`, id)
      // Se deletou a ativa, ativa a mais recente
      await db.$executeRawUnsafe(
        `UPDATE claude_code_accounts SET isActive=1 WHERE id=(SELECT id FROM claude_code_accounts ORDER BY createdAt DESC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM claude_code_accounts WHERE isActive=1)`
      )
      return { success: true }
    })
  )

  ipcMain.handle('claude:accounts:check', async (_, configDir: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawn } = require('child_process') as typeof import('child_process')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const osModule = require('os') as typeof import('os')
    const npmBin = process.platform === 'win32'
      ? `${osModule.homedir()}\\AppData\\Roaming\\npm`
      : `${osModule.homedir()}/.npm-global/bin:/usr/local/bin`
    const sep = process.platform === 'win32' ? ';' : ':'
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${npmBin}${sep}${process.env.PATH ?? ''}`,
      CLAUDE_CONFIG_DIR: configDir,
    }

    // Verifica se CLI está instalado
    const version = await new Promise<string>(res => {
      const p = spawn('claude', ['--version'], { shell: true, env, timeout: 8000 })
      let out = ''; let err = ''
      p.stdout?.on('data', (d: Buffer) => { out += d.toString() })
      p.stderr?.on('data', (d: Buffer) => { err += d.toString() })
      p.on('close', (code: number | null) => { res(code === 0 ? (out || err).trim() : '') })
      p.on('error', () => res(''))
    })
    if (!version) return { installed: false, version: '', authenticated: false }

    // Verifica autenticação: ~/.claude (ou configDir) deve ter .credentials.json
    const credFiles = [
      path.join(configDir, '.credentials.json'),
      path.join(configDir, 'credentials.json'),
    ]
    let authenticated = false
    for (const f of credFiles) {
      try { await fs.access(f); authenticated = true; break } catch { /* não existe */ }
    }

    return { installed: true, version, authenticated }
  })

  // Conversas persistidas
  ipcMain.handle('ai:conv:list',        ()             => wrapHandler(() => aiSvc.conversations.list()))
  ipcMain.handle('ai:conv:get',         (_, id)        => wrapHandler(() => aiSvc.conversations.get(id)))
  ipcMain.handle('ai:conv:create',      (_, data)      => wrapHandler(() => aiSvc.conversations.create(data)))
  ipcMain.handle('ai:conv:updateTitle', (_, data: {id:string;title:string}) => wrapHandler(() => aiSvc.conversations.updateTitle(data.id, data.title)))
  ipcMain.handle('ai:conv:pin',         (_, id)        => wrapHandler(() => aiSvc.conversations.togglePin(id)))
  ipcMain.handle('ai:conv:delete',      (_, id)        => wrapHandler(() => aiSvc.conversations.delete(id)))
  ipcMain.handle('ai:conv:messages',    (_, data: {id:string;limit?:number}) => wrapHandler(() => aiSvc.conversations.getMessages(data.id, data.limit)))
  ipcMain.handle('ai:conv:addMsg',      (_, data)      => wrapHandler(() => aiSvc.conversations.addMessage(data)))

  // Memória do projeto
  ipcMain.handle('memory:list',   (_, data: { vpsId?: string | null; projectId?: string | null }) =>
    wrapHandler(() => memorySvc.list(data?.vpsId, data?.projectId)))
  ipcMain.handle('memory:save',   (_, data) => wrapHandler(() => memorySvc.save(data)))
  ipcMain.handle('memory:delete', (_, id: string) => wrapHandler(() => memorySvc.delete(id)))
  ipcMain.handle('memory:build',  (_, data: { vpsId?: string | null; projectId?: string | null }) =>
    wrapHandler(() => memorySvc.buildBlock(data?.vpsId, data?.projectId)))

  // ── Squad — Fábrica de Agentes ───────────────────────────────────────────
  ipcMain.handle('squad:session:list', () =>
    wrapHandler(() => {
      requireAuth()
      return db.squadSession.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 })
    })
  )

  ipcMain.handle('squad:session:create', (_, data: { agentName: string; title: string }) =>
    wrapHandler(() => {
      requireAuth()
      return db.squadSession.create({ data: { agentName: data.agentName, title: data.title } })
    })
  )

  ipcMain.handle('squad:session:messages', (_, { id }: { id: string }) =>
    wrapHandler(() => {
      requireAuth()
      return db.squadMessage.findMany({ where: { sessionId: id }, orderBy: { createdAt: 'asc' } })
    })
  )

  ipcMain.handle('squad:session:addMsg', (_, data: {
    sessionId: string
    agentName: string
    role: string
    content: string
    delegatedBy: string | null
  }) =>
    wrapHandler(async () => {
      requireAuth()
      const msg = await db.squadMessage.create({ data })
      await db.squadSession.update({ where: { id: data.sessionId }, data: { updatedAt: new Date() } })
      return msg
    })
  )

  ipcMain.handle('squad:session:delete', (_, id: string) =>
    wrapHandler(() => { requireAuth(); return db.squadSession.delete({ where: { id } }) })
  )

  ipcMain.handle('squad:session:clearAll', () =>
    wrapHandler(async () => {
      requireAuth()
      await db.$executeRawUnsafe(`DELETE FROM squad_messages`)
      await db.$executeRawUnsafe(`DELETE FROM squad_sessions`)
      return { cleared: true }
    })
  )

  ipcMain.handle('squad:stream:start', (event, data: {
    agent: AgentName
    message: string
    history: Array<{ role: string; content: string }>
    projectContext?: string
    localPath?: string
    providerOverride?: string
    autonomous?: boolean
  }) =>
    wrapHandler(async () => {
      requireAuth()
      const targetWin = BrowserWindow.fromWebContents(event.sender)

      // Resolve provider efetivo: override explícito → default configurado nas settings → preferredProvider do agente
      const agentCfg = AGENTS[data.agent]
      let effectiveProvider: string = agentCfg.preferredProvider
      try {
        if (data.providerOverride) {
          effectiveProvider = data.providerOverride
        } else {
          // Sempre usa o provider padrão configurado pelo usuário nas Settings
          const def = await db.$queryRawUnsafe(
            `SELECT provider FROM ai_providers WHERE isDefault=1 AND enabled=1 AND apiKey!='' LIMIT 1`
          ) as Array<{ provider: string }>
          if (def[0]) {
            effectiveProvider = def[0].provider
          } else {
            // Fallback: qualquer provider habilitado com key
            const any = await db.$queryRawUnsafe(
              `SELECT provider FROM ai_providers WHERE enabled=1 AND apiKey!='' LIMIT 1`
            ) as Array<{ provider: string }>
            if (any[0]) effectiveProvider = any[0].provider
          }
        }
      } catch { /* ignora — usa preferredProvider do agente */ }

      // Carrega KB global uma vez por stream
      const globalKBContext = await knowledgeSvc.buildContext().catch(() => '')

      // Monta system prompt com contexto de projeto e/ou execução local
      function buildSystemPrompt(base: string): string {
        let sys = base
        if (globalKBContext) {
          sys += `\n\n${globalKBContext}`
        }
        if (data.localPath) {
          sys += `\n\nEXECUÇÃO LOCAL ATIVA (Windows PC):\n- Pasta base do projeto: ${data.localPath}\n- Use SEMPRE caminhos Windows em ACTION tags. Exemplos:\n  [ACTION:READ_DIR path="${data.localPath}"][/ACTION] — lista arquivos da raiz do projeto\n  [ACTION:READ_FILE path="${data.localPath}\\src\\index.ts"][/ACTION]\n  [ACTION:SHELL cwd="${data.localPath}"]npm install[/ACTION]\n- Use READ_DIR para explorar a estrutura antes de READ_FILE\n- NÃO use caminhos Linux (/home/...) — o código roda diretamente no PC do usuário.`
        }
        if (data.projectContext) {
          sys += `\n\nCONTEXTO DO PROJETO:\n${data.projectContext}`
        }
        if (data.autonomous) {
          const projPath = data.localPath || 'C:\\meu-projeto'
          sys += `\n\nMODO AUTÔNOMO ATIVO — regras ABSOLUTAS:\n1. SUA PRÓXIMA RESPOSTA DEVE CONTER UM [ACTION:...] TAG. Sem exceções. Sem texto introdutório.\n2. PROIBIDO escrever "vou fazer", "planejo", "primeiro preciso" — apenas emita o ACTION.\n3. Cada iteração produz UMA ação. Aguarde o resultado antes da próxima.\n4. PROIBIDO reler arquivos que já estão no histórico — use o conteúdo já retornado.\n5. Use READ_DIR para explorar pastas antes de READ_FILE — nunca READ_FILE em um caminho de pasta.\n6. ACTION:SHELL deve conter apenas comandos reais (npm, git, node, mkdir, dir, etc.) — nunca texto em português.\n7. Quando concluir 100% da tarefa, inclua [PRONTO] na resposta final.\n8. Não faça perguntas — decida com o contexto disponível e continue.\n\nEXEMPLOS CONCRETOS (substitua pelos caminhos reais):\n\n[ACTION:SHELL cwd="${projPath}"]\nmkdir "${projPath}\\src"\n[/ACTION]\n\n[ACTION:SHELL cwd="${projPath}"]\nnpm install\n[/ACTION]\n\n[ACTION:WRITE_FILE path="${projPath}\\src\\index.ts"]\nexport function main() {}\n[/ACTION]\n\n[ACTION:READ_DIR path="${projPath}"][/ACTION]\n\nSCAFFOLD — use C:\\\\Temp\\\\squad-scaffold como staging (sem %USERNAME%):\nPasso 1:\n[ACTION:SHELL cwd="C:\\\\Temp"]\nmkdir squad-scaffold 2>nul & npx --yes create-next-app@latest C:\\\\Temp\\\\squad-scaffold\\\\meu-app --ts --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm\n[/ACTION]\nPasso 2 (copiar EXCLUINDO node_modules — NÃO copie node_modules, leva 10min e trava):\n[ACTION:SHELL cwd="C:\\\\Temp"]\nrobocopy "C:\\\\Temp\\\\squad-scaffold\\\\meu-app" "${projPath}" /E /IS /IT /NFL /NDL /NJH /NJS /XD node_modules .next\n[/ACTION]\nPasso 3 (instalar dependências no destino):\n[ACTION:SHELL cwd="${projPath}"]\nnpm install\n[/ACTION]\nPasso 4:\n[ACTION:SHELL cwd="C:\\\\Temp"]\nrmdir /S /Q "C:\\\\Temp\\\\squad-scaffold"\n[/ACTION]\nNUNCA copie node_modules com robocopy — /XD node_modules obrigatório. npx leva 3-8 min.`
        }
        return sys
      }

      // Rota Claude Code (conta Pro, sem API key)
      if (effectiveProvider === 'claude-code') {
        const streamId = crypto.randomUUID()
        const sys = buildSystemPrompt(agentCfg.systemPrompt)
        const history = data.history ?? []
        const parts: string[] = [sys, '']
        for (const m of history) {
          parts.push(`${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
        }
        const prompt = parts.join('\n') + `\nHuman: ${data.message}`
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { spawn } = require('child_process') as typeof import('child_process')
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const osM = require('os') as typeof import('os')
        const { spawnEnv } = await getActiveClaudeEnv()
        // cwd = pasta do projeto (modo local) ou home — sandbox do Claude CLI permite acesso ao cwd
        // --add-dir garante acesso mesmo quando claude já foi iniciado em outro diretório
        const spawnCwd = data.localPath || osM.homedir()
        const args = ['-p', '--output-format', 'text']
        if (data.localPath) args.push('--add-dir', data.localPath)
        const proc = spawn('claude', args, { shell: true, env: spawnEnv, cwd: spawnCwd })
        proc.stdin?.write(prompt, 'utf-8')
        proc.stdin?.end()
        claudeProcs.set(streamId, proc)
        let doneSent = false
        let hasStdout = false
        let stderrBuf = ''
        let lastChunkAt = Date.now()
        // eslint-disable-next-line prefer-const
        let watchdog: ReturnType<typeof setInterval>
        const sendErr = (msg: string) => {
          if (doneSent) return; doneSent = true
          clearInterval(watchdog)
          claudeProcs.delete(streamId)
          try { targetWin?.webContents.send('squad:stream:chunk', { streamId, type: 'error', error: msg }) } catch { /* janela fechada */ }
        }
        const sendDone = () => {
          if (doneSent) return; doneSent = true
          clearInterval(watchdog)
          claudeProcs.delete(streamId)
          try { targetWin?.webContents.send('squad:stream:chunk', { streamId, type: 'done' }) } catch { /* janela fechada */ }
        }
        proc.stdout?.on('data', (chunk: Buffer) => {
          hasStdout = true
          lastChunkAt = Date.now()
          try { targetWin?.webContents.send('squad:stream:chunk', { streamId, type: 'text_delta', delta: chunk.toString() }) } catch { /* janela fechada */ }
        })
        proc.stderr?.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString() })
        proc.on('close', (code: number) => {
          if (code !== 0 && !hasStdout) {
            const isAuth = /not logged in|session expired|please log in|unauthorized/i.test(stderrBuf)
            sendErr(isAuth
              ? 'Não autenticado. Execute "claude" no terminal e faça login.'
              : `claude CLI encerrou com erro (código ${code})${stderrBuf ? ': ' + stderrBuf.slice(0, 200) : ''}`
            )
          } else {
            sendDone()
          }
        })
        proc.on('error', (err: Error) => sendErr(`claude CLI não encontrado: ${err.message}`))
        // Watchdog: mata o processo se nenhum chunk chegar em 90s (evita tela congelada)
        watchdog = setInterval(() => {
          if (doneSent) { clearInterval(watchdog); return }
          if (Date.now() - lastChunkAt > 90_000) {
            clearInterval(watchdog)
            proc.kill()
            sendErr('⏱ Timeout: claude CLI não respondeu em 90s. O processo foi encerrado. Tente novamente.')
          }
        }, 15_000)
        return { streamId }
      }

      // Rota padrão (API Key) — com watchdog de 90s (mesmo padrão do claude-code)
      let apiLastChunkAt = Date.now()
      let apiDoneSent = false
      // eslint-disable-next-line prefer-const
      let apiWatchdog: ReturnType<typeof setInterval>

      const session = await squadSvc.startAgentStream(
        data.agent,
        data.message,
        data.history ?? [],
        chunk => {
          apiLastChunkAt = Date.now()
          if (chunk.type === 'done' || chunk.type === 'error') {
            apiDoneSent = true
            clearInterval(apiWatchdog)
          }
          try { targetWin?.webContents.send('squad:stream:chunk', chunk) } catch { /* janela fechada */ }
        },
        { systemPromptOverride: buildSystemPrompt(agentCfg.systemPrompt), providerOverride: effectiveProvider }
      )

      apiWatchdog = setInterval(() => {
        if (apiDoneSent) { clearInterval(apiWatchdog); return }
        if (Date.now() - apiLastChunkAt > 90_000) {
          clearInterval(apiWatchdog)
          squadSvc.cancelStream(session.streamId)
          try { targetWin?.webContents.send('squad:stream:chunk', {
            streamId: session.streamId, type: 'error',
            error: '⏱ Timeout: provider não respondeu em 90s. Verifique sua API key e tente novamente.',
          }) } catch { /* janela fechada */ }
        }
      }, 15_000)

      return { streamId: session.streamId }
    })
  )

  ipcMain.handle('squad:stream:cancel', (_, streamId: string) => {
    // Mata subprocesso Claude Code se existir (mesma lógica de ai:stream:cancel)
    const proc = claudeProcs.get(streamId)
    if (proc) { proc.kill(); claudeProcs.delete(streamId) }
    else { squadSvc.cancelStream(streamId) }
    return { success: true }
  })

  ipcMain.handle('squad:action:execute', (_, data: {
    type: string; content: string; cwd?: string; path?: string; vpsId: string
  }) =>
    wrapHandler(async () => {
      requireAuth()

      // ── Execução local (sem VPS) ─────────────────────────────────────────
      if (data.vpsId === '__local__') {
        // Normaliza caminhos Unix gerados pelo agente para Windows
        function resolveLocalPath(filePath: string, cwd?: string): string {
          if (!filePath.startsWith('/')) return filePath // já é caminho Windows
          if (!cwd) return filePath
          const cwdBase = path.basename(cwd).toLowerCase()
          const parts = filePath.split('/').filter(Boolean)
          const idx = parts.findIndex(p => p.toLowerCase() === cwdBase)
          if (idx >= 0) return path.join(cwd, ...parts.slice(idx + 1))
          return path.join(cwd, ...parts) // fallback: relativo ao cwd
        }

        if (data.type === 'shell') {
          if (!data.content?.trim()) {
            return { output: '[ERRO] Comando SHELL vazio — o agente emitiu [ACTION:SHELL] sem nenhum comando dentro. Emita o comando na próxima resposta.' }
          }
          // Expand Windows %VAR% in cwd — Node.js spawn does NOT expand env vars in cwd
          function expandEnv(s: string): string {
            return s.replace(/%([^%]+)%/g, (_, k) => process.env[k] ?? `%${k}%`)
          }
          const resolvedCwd = data.cwd ? expandEnv(data.cwd) : undefined
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { spawn } = require('child_process') as typeof import('child_process')
          // Ensure cwd exists before spawning — ENOENT is misleading when cwd is missing
          if (resolvedCwd) {
            try { await fs.mkdir(resolvedCwd, { recursive: true }) } catch { /* already exists */ }
          }
          return new Promise<{ output: string }>(resolve => {
            const proc = spawn(data.content.trim(), [], { cwd: resolvedCwd, shell: true, windowsHide: true })
            const chunks: string[] = []
            const onData = (chunk: Buffer) => {
              const text = chunk.toString()
              chunks.push(text)
              win?.webContents.send('squad:shell:line', text)
            }
            proc.stdout?.on('data', onData)
            proc.stderr?.on('data', onData)
            // scaffold commands (npx create-*) can take 5+ min — use 10min timeout
            const timeoutMs = /npx|npm install|npm ci|yarn install|pnpm install|robocopy/i.test(data.content) ? 600_000 : 120_000
            const timer = setTimeout(() => {
              proc.kill()
              resolve({ output: (chunks.join('') || '(sem output)') + `\n[Timeout após ${timeoutMs / 1000}s]` })
            }, timeoutMs)
            proc.on('close', (code) => {
              clearTimeout(timer)
              const out = chunks.join('').trim() || '✓ Concluído'
              // xcopy/robocopy exit code 1 = "files copied" (success), not an error
              // Only flag exit code >= 4 as hard failure to avoid false positives
              const isHardFail = code !== null && code >= 4
              resolve({ output: isHardFail ? `[SHELL_ERROR código ${code}]\n${out}` : out })
            })
            proc.on('error', err => {
              clearTimeout(timer)
              resolve({ output: `[SHELL_ERROR] ${err.message}\nDica: verifique se o cwd existe e o comando está correto.` })
            })
          })
        }
        if (data.type === 'read_file') {
          if (!data.path) throw new Error('path é obrigatório para read_file')
          const resolved = resolveLocalPath(data.path, data.cwd)
          const stat = await fs.stat(resolved)
          if (stat.isDirectory()) {
            // agente tentou ler uma pasta — lista o conteúdo automaticamente
            const entries = await fs.readdir(resolved, { withFileTypes: true })
            const lines = entries.map(e => `${e.isDirectory() ? '[DIR] ' : '[ARQ]'} ${e.name}`)
            return { output: `[Pasta detectada — listando conteúdo]\n${resolved}\n${lines.join('\n')}` }
          }
          const content = await fs.readFile(resolved, 'utf-8')
          return { output: content }
        }
        if (data.type === 'read_dir') {
          if (!data.path) throw new Error('path é obrigatório para read_dir')
          const resolved = resolveLocalPath(data.path, data.cwd)
          const entries = await fs.readdir(resolved, { withFileTypes: true })
          const lines = entries.map(e => `${e.isDirectory() ? '[DIR] ' : '[ARQ]'} ${e.name}`)
          return { output: `${resolved}\n${lines.join('\n')}` }
        }
        if (data.type === 'write_file') {
          if (!data.path) throw new Error('path é obrigatório para write_file')
          const resolved = resolveLocalPath(data.path, data.cwd)
          await fs.mkdir(path.dirname(resolved), { recursive: true })
          await fs.writeFile(resolved, data.content, 'utf-8')
          return { output: `✓ Arquivo escrito: ${resolved}` }
        }
        throw new Error(`Tipo desconhecido para execução local: ${data.type}`)
      }

      // ── Execução remota (VPS via SSH/SFTP) ──────────────────────────────
      if (data.type === 'shell') {
        const cmd = data.cwd ? `cd ${JSON.stringify(data.cwd)} && ${data.content}` : data.content
        const output = await terminal.exec(data.vpsId, cmd, 30000)
        return { output }
      }
      if (data.type === 'write_file') {
        if (!data.path) throw new Error('path é obrigatório para write_file')
        const sess = await sftpService.openSession(data.vpsId)
        try {
          await sess.writeFile(data.path, data.content)
          return { output: `✓ Arquivo escrito: ${data.path}` }
        } finally { sess.destroy() }
      }
      if (data.type === 'read_file') {
        if (!data.path) throw new Error('path é obrigatório para read_file')
        const sess = await sftpService.openSession(data.vpsId)
        try {
          const content = await sess.readFile(data.path)
          return { output: content }
        } finally { sess.destroy() }
      }
      if (data.type === 'read_dir') {
        if (!data.path) throw new Error('path é obrigatório para read_dir')
        const output = await terminal.exec(data.vpsId, `ls -la ${JSON.stringify(data.path)}`, 10000)
        return { output }
      }
      throw new Error(`Tipo desconhecido: ${data.type}`)
    })
  )

  // ToolExecutor — confirmação de ação perigosa (main → renderer → main)
  ipcMain.handle('tool:confirmRequest', () => undefined) // placeholder; respondido via tool:confirmResponse
  ipcMain.handle('tool:confirmResponse', (_, data: { confirmed: boolean }) => {
    // O renderer responde para o main via este canal; o resultado é tratado no setupToolConfirm abaixo
    return data
  })

  // ── Monitor — Análise de uso de disco por diretório ──────────────────────
  ipcMain.handle('monitor:diskUsage', async (_, vpsId: string) => {
    const cmd = [
      'echo "=TOP="',
      'du -sh /* 2>/dev/null | sort -rh | head -20',
      'echo "=DOCKER="',
      'docker system df 2>/dev/null || echo "N/A"',
      'echo "=PM2LOGS="',
      'du -sh ~/.pm2/logs/ 2>/dev/null || echo "N/A"',
      'echo "=VARLOG="',
      'du -sh /var/log/* 2>/dev/null | sort -rh | head -10',
    ].join('; ')
    try {
      const out = await terminal.exec(vpsId, cmd, 30000)
      const sections: Record<string, string> = {}
      let current = 'raw'
      const lines: Record<string, string[]> = { raw: [] }
      for (const line of out.split('\n')) {
        const trimmed = line.trim()
        if (trimmed === '=TOP=')      { current = 'top';     lines.top     = [] }
        else if (trimmed === '=DOCKER=')   { current = 'docker';  lines.docker  = [] }
        else if (trimmed === '=PM2LOGS=')  { current = 'pm2logs'; lines.pm2logs = [] }
        else if (trimmed === '=VARLOG=')   { current = 'varlog';  lines.varlog  = [] }
        else if (trimmed && lines[current]) lines[current].push(trimmed)
      }
      return {
        success: true,
        top:     (lines.top     || []).join('\n'),
        docker:  (lines.docker  || []).join('\n'),
        pm2logs: (lines.pm2logs || []).join('\n'),
        varlog:  (lines.varlog  || []).join('\n'),
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Monitor — CPU / RAM / Disco / Uptime via SSH ──────────────────────────
  ipcMain.handle('monitor:getStats', async (_, vpsId: string) => {
    const cmd = [
      'echo "LOAD:$(cat /proc/loadavg 2>/dev/null || echo 0 0 0)"',
      'echo "CORES:$(nproc 2>/dev/null || grep -c processor /proc/cpuinfo 2>/dev/null || echo 1)"',
      'echo "MEM:$(free -m 2>/dev/null | awk \'NR==2{print $2,$3,$4}\' || echo 0 0 0)"',
      'echo "DISK:$(df -h / 2>/dev/null | awk \'NR==2{print $2,$3,$4,$5}\' || echo ? ? ? 0%)"',
      'echo "UPTIME:$(uptime 2>/dev/null | sed \'s/.*up //\' | sed \'s/, *[0-9]* user.*//\'|| echo -)"',
    ].join('; ')
    try {
      const output = await terminal.exec(vpsId, cmd, 15000)
      const lines: Record<string, string> = {}
      for (const line of output.split('\n')) {
        const idx = line.indexOf(':')
        if (idx !== -1) lines[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
      const loadParts = (lines['LOAD'] || '0 0 0').split(' ')
      const load1 = parseFloat(loadParts[0]) || 0
      const load5 = parseFloat(loadParts[1]) || 0
      const load15 = parseFloat(loadParts[2]) || 0
      const cores = Math.max(1, parseInt(lines['CORES'] || '1') || 1)
      const memParts = (lines['MEM'] || '0 0 0').split(' ')
      const totalMb = parseInt(memParts[0]) || 0
      const usedMb = parseInt(memParts[1]) || 0
      const diskParts = (lines['DISK'] || '? ? ? 0%').split(' ')
      return {
        success: true,
        stats: {
          vpsId,
          online: true,
          cpu: {
            loadAvg1: load1,
            loadAvg5: load5,
            loadAvg15: load15,
            cores,
            usagePercent: Math.min(100, Math.round((load1 / cores) * 100)),
          },
          ram: {
            totalMb,
            usedMb,
            freeMb: parseInt(memParts[2]) || 0,
            usagePercent: totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0,
          },
          disk: {
            total: diskParts[0] || '?',
            used: diskParts[1] || '?',
            available: diskParts[2] || '?',
            usagePercent: parseInt((diskParts[3] || '0%').replace('%', '')) || 0,
          },
          uptime: lines['UPTIME'] || '-',
          fetchedAt: Date.now(),
        },
      }
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

  // ── Autenticação ─────────────────────────────────────────────────────────────
  ipcMain.handle('auth:status', async () => {
    const count = await authSvc.countUsers().catch(() => 0)
    sessionRequired = count > 0
    return { user: session, needsSetup: count === 0, sessionRequired }
  })

  ipcMain.handle('auth:setup', async (_, { username, password }: { username: string; password: string }) => {
    const count = await authSvc.countUsers()
    if (count > 0) return { error: 'Setup já realizado. Use login.' }
    return wrapHandler(async () => {
      const user = await authSvc.createUser(username, password, 'admin')
      sessionRequired = true
      session = user
      return { user }
    })
  })

  ipcMain.handle('auth:login', (_, { username, password }: { username: string; password: string }) =>
    wrapHandler(async () => {
      const user = await authSvc.validatePassword(username, password)
      if (!user) throw new Error('Usuário ou senha incorretos.')
      session = user
      return { user }
    })
  )

  ipcMain.handle('auth:logout', () => {
    session = null
    return { success: true }
  })

  ipcMain.handle('auth:currentUser', () => ({ user: session }))

  ipcMain.handle('auth:users:list', () =>
    wrapHandler(() => { requireAdmin(); return authSvc.listUsers() })
  )

  ipcMain.handle('auth:users:create', (_, data: { username: string; password: string; role: 'admin' | 'viewer' }) =>
    wrapHandler(() => { requireAdmin(); return authSvc.createUser(data.username, data.password, data.role) })
  )

  ipcMain.handle('auth:users:delete', (_, { id }: { id: string }) =>
    wrapHandler(async () => {
      requireAdmin()
      if (session?.id === id) throw new Error('Não é possível excluir o próprio usuário.')
      await authSvc.deleteUser(id)
      const remaining = await authSvc.countUsers()
      if (remaining === 0) sessionRequired = false
    })
  )

  ipcMain.handle('auth:users:changePassword', (_, { id, newPassword }: { id: string; newPassword: string }) =>
    wrapHandler(() => {
      if (session?.id !== id) requireAdmin()
      return authSvc.changePassword(id, newPassword)
    })
  )

  // ── shell:openExternal ───────────────────────────────────────────────────────
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    if (typeof url !== 'string') return { error: 'URL inválida' }
    const allowed = ['https://claude.ai/', 'https://www.anthropic.com/']
    if (!allowed.some(p => url.startsWith(p))) return { error: 'URL não permitida' }
    await shell.openExternal(url)
    return { success: true }
  })

  // ── claude:usage — lê credenciais + tenta buscar uso via API claude.ai ───────
  ipcMain.handle('claude:usage', async () => {
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT configDir FROM claude_code_accounts WHERE isActive=1 LIMIT 1`
      ) as Array<{ configDir: string }>
      if (!rows.length) return { error: 'Nenhuma conta Claude ativa' }
      const { configDir } = rows[0]

      let cred: Record<string, unknown> | null = null
      for (const p of [path.join(configDir, '.credentials.json'), path.join(configDir, 'credentials.json')]) {
        try { cred = JSON.parse(await fs.readFile(p, 'utf-8')); break } catch { /* próximo */ }
      }
      if (!cred) return { error: 'Credenciais não encontradas. Execute "claude" no terminal para fazer login.' }

      const acct = (cred.claudeAiOauthAccount as Record<string, unknown>) ?? {}
      const tok = cred.claudeAiOauthToken
      const accessToken = typeof tok === 'string' ? tok
        : ((tok as Record<string, unknown>)?.accessToken as string ?? '')
      const email   = (acct.emailAddress  as string) ?? ''
      const plan    = (acct.planType      as string) ?? ''
      const orgId   = (acct.organizationId as string) ?? ''

      let usageData: Record<string, unknown> | null = null
      if (accessToken) {
        usageData = await fetchClaudeUsage(accessToken, orgId).catch(() => null)
      }

      return { email, plan, orgId, usageData }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Notificações de sistema ──────────────────────────────────────────────────
  ipcMain.handle('notifications:getEnabled', () => ({ enabled: notificationsEnabled }))

  ipcMain.handle('notifications:setEnabled', async (_, { enabled }: { enabled: boolean }) => {
    try { requireAdmin() } catch (e) { return { error: (e as Error).message } }
    notificationsEnabled = enabled
    notifMonitor?.setEnabled(enabled)
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO settings (id, notificationsEnabled, updatedAt)
         VALUES ('default', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET notificationsEnabled = excluded.notificationsEnabled, updatedAt = CURRENT_TIMESTAMP`,
        enabled ? 1 : 0
      )
    } catch { /* silent */ }
    return { success: true }
  })

  // ── Base de Conhecimento ─────────────────────────────────────────────────────
  ipcMain.handle('knowledge:list', () =>
    wrapHandler(() => knowledgeSvc.list())
  )

  ipcMain.handle('knowledge:create', (_, data: unknown) =>
    wrapHandler(() => {
      requireAdmin()
      return knowledgeSvc.create(data as Parameters<typeof knowledgeSvc.create>[0])
    })
  )

  ipcMain.handle('knowledge:update', (_, { id, ...data }: { id: string } & Record<string, unknown>) =>
    wrapHandler(() => {
      requireAdmin()
      return knowledgeSvc.update(id, data as Parameters<typeof knowledgeSvc.update>[1])
    })
  )

  ipcMain.handle('knowledge:delete', (_, id: string) =>
    wrapHandler(() => {
      requireAdmin()
      return knowledgeSvc.delete(id)
    })
  )

  ipcMain.handle('knowledge:context', () =>
    wrapHandler(() => knowledgeSvc.buildContext())
  )
}
