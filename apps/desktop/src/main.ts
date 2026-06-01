import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { setupIpcHandlers } from './ipc/handlers'
import { disconnectPrisma, initializeDatabase } from '@cwm/db'
import { autoUpdater } from 'electron-updater'

// electron-vite output: out/main/index.js
// preload:              out/preload/index.js
// renderer (prod):      ../../web/dist/index.html (relative to out/main/)
// electron-vite sets ELECTRON_RENDERER_URL in dev mode — usar isso é mais seguro
// que app.isPackaged no nível do módulo com pnpm + Windows + Electron 33

let mainWindow: BrowserWindow | null = null

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

function createWindow(): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']

  mainWindow = new BrowserWindow({
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
    title: 'HEXAGON IDE',
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

function createIdeWindow(vpsId: string, vpsName: string): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  const encodedName = encodeURIComponent(vpsName)
  const hashPath = `/ide/${vpsId}/${encodedName}`

  const win = new BrowserWindow({
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
    title: `HEXAGON IDE — ${vpsName}`,
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

app.whenReady().then(async () => {
  setDatabasePath()
  await initializeDatabase()
  createWindow()
  setupIpcHandlers(ipcMain, mainWindow ?? undefined)

  ipcMain.handle('window:openIde', (_, data: { vpsId: string; vpsName: string }) => {
    createIdeWindow(data.vpsId, data.vpsName)
    return { success: true }
  })

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
  await disconnectPrisma()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
