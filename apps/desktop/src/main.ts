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

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools()
  } else if (!app.isPackaged) {
    // dev sem ELECTRON_RENDERER_URL — Vite roda separado em localhost:5173
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(process.resourcesPath, 'renderer', 'index.html')
    mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  setDatabasePath()
  await initializeDatabase()
  createWindow()
  setupIpcHandlers(ipcMain, mainWindow ?? undefined)

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
