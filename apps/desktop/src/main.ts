import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { setupIpcHandlers } from './ipc/handlers'
import { disconnectPrisma, initializeDatabase } from '@cwm/db'

// electron-vite output: out/main/index.js
// preload:              out/preload/index.js
// renderer (prod):      ../../web/dist/index.html (relative to out/main/)

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

let mainWindow: BrowserWindow | null = null

function setDatabasePath(): void {
  const dbPath = path.join(app.getPath('userData'), 'cwm.db')
  process.env['DATABASE_URL'] = `file:${dbPath}`
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      // electron-vite output: out/preload/index.js
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Claude Workspace Manager',
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // em produção o web dist fica em resources/renderer/ (via extraResources no electron-builder)
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
  setupIpcHandlers(ipcMain)
  createWindow()
})

app.on('window-all-closed', async () => {
  await disconnectPrisma()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
