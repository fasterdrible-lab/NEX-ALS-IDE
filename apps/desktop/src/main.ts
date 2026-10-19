import { app, BrowserWindow, ipcMain, shell, Notification, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { setupIpcHandlers, setIncidentWindowOpener } from './ipc/handlers'

// Ícone das janelas/barra de tarefas — instalado vai em resources/ (extraResources), em dev fica em build/
const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '../../build/icon.png')
import { disconnectPrisma, initializeDatabase } from '@cwm/db'
import { autoUpdater } from 'electron-updater'
import { NotificationMonitor } from '@cwm/core'

// electron-vite output: out/main/index.js
// preload:              out/preload/index.js
// renderer (prod):      ../../web/dist/index.html (relative to out/main/)
// electron-vite sets ELECTRON_RENDERER_URL in dev mode — usar isso é mais seguro
// que app.isPackaged no nível do módulo com pnpm + Windows + Electron 33

let mainWindow: BrowserWindow | null = null
const notifMonitor = new NotificationMonitor()

function setDatabasePath(): void {
  const dbPath = path.join(app.getPath('userData'), 'cwm.db')
  process.env['DATABASE_URL'] = `file:${dbPath}`
}

function getRendererIndexPath(): string {
  return path.join(process.resourcesPath, 'renderer', 'index.html')
}

function applyWindowDefaults(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function setupCSP(): void {
  // Monaco Editor requires 'unsafe-eval' for its parser workers (uses Function constructor).
  // All other directives are as restrictive as possible for a desktop app that:
  //   - loads local/SFTP images as data: URIs
  //   - creates Monaco workers as blob: URLs
  //   - connects to AI provider APIs over https:
  //   - uses WebSocket for LSP (ws://) and xterm.js resize
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: https: http://localhost:*",
    "worker-src blob: 'self'",
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}

function createWindow(): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']

  mainWindow = new BrowserWindow({
    icon: APP_ICON,
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Zeus IDE',
    show: false,
    backgroundColor: '#0f172a',
  })

  mainWindow.once('ready-to-show', () => { mainWindow?.show() })
  applyWindowDefaults(mainWindow)

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools()
  } else if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(getRendererIndexPath())
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

function createDeployWindow(vpsId: string, vpsName: string): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  const encodedName = encodeURIComponent(vpsName)
  const hashPath = `/deploy/${vpsId}/${encodedName}`

  const win = new BrowserWindow({
    icon: APP_ICON,
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: `🚀 Deploy Assistant — ${vpsName}`,
    show: false,
    backgroundColor: '#0f172a',
  })

  win.once('ready-to-show', () => win.show())
  applyWindowDefaults(win)

  if (rendererUrl) {
    win.loadURL(`${rendererUrl}/#${hashPath}`)
  } else if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173/#${hashPath}`)
  } else {
    win.loadFile(getRendererIndexPath(), { hash: hashPath })
  }
}

function createIncidentWindow(vpsId: string, vpsName: string): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  const encodedName = encodeURIComponent(vpsName)
  const hashPath = `/incident/${vpsId}/${encodedName}`

  const win = new BrowserWindow({
    icon: APP_ICON,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: `🚨 INCIDENT MODE — ${vpsName}`,
    show: false,
    backgroundColor: '#0f172a',
  })

  win.once('ready-to-show', () => win.show())
  applyWindowDefaults(win)

  if (rendererUrl) {
    win.loadURL(`${rendererUrl}/#${hashPath}`)
  } else if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173/#${hashPath}`)
  } else {
    win.loadFile(getRendererIndexPath(), { hash: hashPath })
  }
}

/** IDE em janela própria. Remoto: `path` = pasta do projeto na VPS. Local: `folder` = pasta do PC (sem abrir o seletor). */
interface IdeWindowTarget { vpsId?: string; vpsName: string; path?: string; folder?: string }

function createIdeWindow({ vpsId, vpsName, path: remotePath, folder }: IdeWindowTarget): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  const encodedName = encodeURIComponent(vpsName)
  const hashPath = folder
    ? `/ide/local?folder=${encodeURIComponent(folder)}`
    : `/ide/${vpsId}/${encodedName}${remotePath ? `?path=${encodeURIComponent(remotePath)}` : ''}`

  const win = new BrowserWindow({
    icon: APP_ICON,
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: `Zeus IDE — ${folder ? path.basename(folder) : vpsName}`,
    show: false,
    backgroundColor: '#0f172a',
  })

  win.once('ready-to-show', () => win.show())
  applyWindowDefaults(win)

  if (rendererUrl) {
    win.loadURL(`${rendererUrl}/#${hashPath}`)
  } else if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173/#${hashPath}`)
  } else {
    win.loadFile(getRendererIndexPath(), { hash: hashPath })
  }
}

/** Traz a janela principal para frente — ou a recria, se o usuário a fechou deixando outras janelas abertas. */
function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** Valida o pedido de nova janela de IDE vindo do renderer (rota montada aqui, não pela UI). */
function parseIdeTarget(data: unknown): IdeWindowTarget {
  const d = (data ?? {}) as Record<string, unknown>
  const vpsName = typeof d['vpsName'] === 'string' ? d['vpsName'].slice(0, 200) : ''
  if (typeof d['folder'] === 'string') {
    const folder = d['folder']
    if (!path.isAbsolute(folder) || !fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory()) throw new Error('Pasta local inválida')
    return { vpsName, folder }
  }
  const vpsId = d['vpsId']
  if (typeof vpsId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(vpsId)) throw new Error('VPS inválida')
  let remotePath: string | undefined
  if (typeof d['path'] === 'string' && d['path']) {
    const p = d['path']
    if (!p.startsWith('/') || p.length > 1024 || p.split('/').includes('..') || /[\u0000-\u001f'"`]/.test(p)) throw new Error('Caminho remoto inválido')
    remotePath = p
  }
  return { vpsId, vpsName, path: remotePath }
}

// Agrupa as janelas na barra de tarefas sob o mesmo ícone do atalho instalado (appId do electron-builder)
if (process.platform === 'win32') app.setAppUserModelId('com.nexals.ide')

// Uma instância só: um segundo processo no mesmo banco rodaria a recuperação de boot (marcando como
// interrompidas as sessões do Hermes que o primeiro está executando), outro monitor de alertas e outro
// agendador (automações em dobro). Abrir o Zeus de novo só traz a janela principal para frente.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  console.log('[main] o Zeus IDE já está aberto — trazendo a janela existente para frente')
  app.quit()
} else {
  app.on('second-instance', () => { if (app.isReady()) focusMainWindow() })
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return
  if (app.isPackaged) setupCSP()
  setDatabasePath()
  await initializeDatabase()
  createWindow()
  setupIpcHandlers(ipcMain, mainWindow ?? undefined, notifMonitor)
  setIncidentWindowOpener(createIncidentWindow)

  // FASE 7: o alerta também vira incidente + diagnóstico do Hermes (handlers.ts) — por isso o
  // monitor roda mesmo sem suporte a notificação; o clique na notificação abre o Incident Mode.
  if (Notification.isSupported()) {
    notifMonitor.onAlert(alert => {
      const n = new Notification({ title: alert.title, body: `${alert.body} — clique para abrir o Incident Mode` })
      n.on('click', () => createIncidentWindow(alert.vpsId, alert.vpsName))
      n.show()
    })
  }
  notifMonitor.start()

  ipcMain.handle('window:openIde', (_, data: unknown) => {
    try { createIdeWindow(parseIdeTarget(data)) } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
    return { success: true }
  })

  // Janelas independentes: saber se é a principal, fechar a própria, trazer a principal de volta.
  ipcMain.handle('window:info', (event) => ({ isMain: !!mainWindow && BrowserWindow.fromWebContents(event.sender) === mainWindow }))
  ipcMain.handle('window:closeSelf', (event) => {
    const w = BrowserWindow.fromWebContents(event.sender)
    if (w && w !== mainWindow) w.close()
    return { success: true }
  })
  ipcMain.handle('window:focusMain', () => { focusMainWindow(); return { success: true } })

  ipcMain.handle('window:openIncident', (_, data: { vpsId: string; vpsName: string }) => {
    createIncidentWindow(data.vpsId, data.vpsName)
    return { success: true }
  })

  ipcMain.handle('window:openDeploy', (_, data: { vpsId: string; vpsName: string }) => {
    createDeployWindow(data.vpsId, data.vpsName)
    return { success: true }
  })

  // Auto-update: verifica silenciosamente após iniciar (só em produção)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => { /* sem servidor de update configurado */ })
  }
})

app.on('window-all-closed', async () => {
  notifMonitor.stop()
  await disconnectPrisma()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
