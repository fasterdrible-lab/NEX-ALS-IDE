import { app, BrowserWindow, ipcMain, shell, Notification, session, dialog, Menu, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { setupIpcHandlers, setIncidentWindowOpener, setLocalFolderOpener } from './ipc/handlers'
import { LocalFolderStore, folderKey, defaultProjectsParent } from './local-folders'

// Ícone das janelas/barra de tarefas — instalado vai em resources/ (extraResources), em dev fica em build/
const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '../../build/icon.png')
import { disconnectPrisma, initializeDatabase } from '@cwm/db'
import { backupDatabase, startDatabaseBackups } from './db-backup'
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

// Tamanho inicial cabendo na área útil do monitor onde a janela vai abrir, e mínimo baixo o
// bastante para o Snap do Windows (metade/quarto da tela) — 1536px a 125% → metade = 768px.
// Mínimo acima disso fazia o Windows recusar o encaixe e a janela passava da borda da tela.
function windowSize(width: number, height: number) {
  const { workAreaSize } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  return {
    width: Math.min(width, workAreaSize.width),
    height: Math.min(height, workAreaSize.height),
    minWidth: 600,
    minHeight: 400,
  }
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
    ...windowSize(1280, 820),
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
    ...windowSize(1200, 800),
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
    ...windowSize(1440, 900),
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

function createIdeWindow({ vpsId, vpsName, path: remotePath, folder }: IdeWindowTarget): BrowserWindow {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  const encodedName = encodeURIComponent(vpsName)
  const hashPath = folder
    ? `/ide/local?folder=${encodeURIComponent(folder)}`
    : `/ide/${vpsId}/${encodedName}${remotePath ? `?path=${encodeURIComponent(remotePath)}` : ''}`

  const win = new BrowserWindow({
    icon: APP_ICON,
    ...windowSize(1280, 820),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Como no VS Code: o nome do projeto primeiro — é o que aparece na barra de tarefas
    title: folder ? `${path.basename(folder)} — Zeus IDE` : `${vpsName} (VPS) — Zeus IDE`,
    show: false,
    backgroundColor: '#0f172a',
  })
  // Sem isto o <title> da página ("Zeus IDE") substitui o título e todas as janelas ficam iguais
  win.on('page-title-updated', e => e.preventDefault())

  win.once('ready-to-show', () => win.show())
  applyWindowDefaults(win)

  if (rendererUrl) {
    win.loadURL(`${rendererUrl}/#${hashPath}`)
  } else if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173/#${hashPath}`)
  } else {
    win.loadFile(getRendererIndexPath(), { hash: hashPath })
  }
  return win
}

// ── Pastas locais, uma janela por pasta (como o VS Code) ──
let localFolders: LocalFolderStore | null = null
const localWindows = new Map<string, { folder: string; win: BrowserWindow }>()
let quitting = false

function saveOpenFolders(): void {
  if (!quitting) localFolders?.setOpen([...localWindows.values()].map(w => w.folder))
}

/** Abre a pasta numa janela própria; se já estiver aberta, só traz a janela dela para frente. */
function openLocalFolderWindow(folder: string): { focused: boolean } {
  const st = fs.statSync(folder, { throwIfNoEntry: false })
  if (!path.isAbsolute(folder) || !st?.isDirectory()) throw new Error(`Pasta não encontrada: ${folder}`)
  const resolved = path.resolve(folder)
  const key = folderKey(resolved)
  localFolders?.touch(resolved)
  rebuildMenu()
  const existing = localWindows.get(key)
  if (existing && !existing.win.isDestroyed()) {
    if (existing.win.isMinimized()) existing.win.restore()
    existing.win.show(); existing.win.focus()
    return { focused: true }
  }
  const win = createIdeWindow({ vpsName: '', folder: resolved })
  localWindows.set(key, { folder: resolved, win })
  win.on('closed', () => {
    localWindows.delete(key)
    // Grava com atraso: quando o app inteiro está fechando (última janela no X, instalador, desligar o
    // Windows — que fecham as janelas uma a uma), o encerramento chega antes e a lista fica intacta
    // para reabrir tudo no próximo início. Fechar só esta janela grava depois de 1,5s.
    setTimeout(saveOpenFolders, 1500)
  })
  saveOpenFolders()
  return { focused: false }
}

async function pickAndOpenLocalFolder(parent?: BrowserWindow | null): Promise<string | null> {
  const opts = { properties: ['openDirectory' as const], title: 'Abrir pasta no Zeus IDE' }
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return null
  openLocalFolderWindow(r.filePaths[0])
  return r.filePaths[0]
}

function rebuildMenu(): void {
  const recent = localFolders?.recent() ?? []
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Abrir pasta…', accelerator: 'CmdOrCtrl+O', click: (_i, w) => { void pickAndOpenLocalFolder(w as BrowserWindow | undefined) } },
        {
          label: 'Abrir recente',
          submenu: recent.length
            ? recent.slice(0, 12).map(r => ({ label: r.path, click: () => { try { openLocalFolderWindow(r.path) } catch (e) { dialog.showErrorBox('Zeus IDE', String(e instanceof Error ? e.message : e)) } } }))
            : [{ label: 'Nenhuma pasta recente', enabled: false }],
        },
        { type: 'separator' },
        { label: 'Janela principal', click: () => focusMainWindow() },
        // Sem Ctrl+W: no VS Code ele fecha a aba, aqui fecharia o projeto inteiro
        { label: 'Fechar janela', click: (_i, w) => { (w as BrowserWindow | undefined)?.close() } },
        { type: 'separator' },
        { role: 'quit', label: 'Sair do Zeus IDE' },
      ],
    },
    { role: 'editMenu', label: 'Editar' },
    { role: 'viewMenu', label: 'Exibir' },
    { role: 'windowMenu', label: 'Janela' },
  ]))
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
  // Se o formato de alguma tabela mudar, guarda o banco antes (falha no backup = não migra).
  await initializeDatabase({ beforeRebuild: () => backupDatabase(app.getPath('userData'), 'antes-da-migracao') })
  // Antes das migrações do handlers.ts e de qualquer tela: guarda o banco como estava ao abrir.
  await startDatabaseBackups(app.getPath('userData'))
  localFolders = new LocalFolderStore(path.join(app.getPath('userData'), 'local-folders.json'))
  rebuildMenu()
  createWindow()
  setupIpcHandlers(ipcMain, mainWindow ?? undefined, notifMonitor)
  // Reabre as pastas que estavam abertas quando o app fechou
  for (const folder of localFolders.openOnLastExit()) {
    try { openLocalFolderWindow(folder) } catch (e) { console.error('[local-folders] não reabriu', folder, e) }
  }
  setIncidentWindowOpener(createIncidentWindow)
  setLocalFolderOpener(folder => { openLocalFolderWindow(folder) })

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
    try {
      const t = parseIdeTarget(data)
      if (t.folder) openLocalFolderWindow(t.folder)
      else createIdeWindow(t)
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
    return { success: true }
  })

  // Pastas locais: seletor → janela própria; recentes (com "aberta" e "não existe mais")
  ipcMain.handle('local:openFolderWindow', async (event) => {
    try { return { folder: await pickAndOpenLocalFolder(BrowserWindow.fromWebContents(event.sender)) } }
    catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
  })
  ipcMain.handle('local:recent:list', () => (localFolders?.recent() ?? []).map(r => ({
    path: r.path,
    name: path.basename(r.path),
    lastOpened: r.lastOpened,
    exists: !!fs.statSync(r.path, { throwIfNoEntry: false })?.isDirectory(),
    open: localWindows.has(folderKey(r.path)),
  })))
  ipcMain.handle('local:recent:open', (_, data: { path?: unknown }) => {
    if (typeof data?.path !== 'string') return { error: 'Pasta inválida' }
    try { return openLocalFolderWindow(data.path) } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
  })
  // Pasta sugerida para Novo projeto (OneDrive). Criar = projects:createLocal (handlers.ts), que também cadastra o projeto.
  ipcMain.handle('local:project:defaults', () => ({ parent: defaultProjectsParent() }))
  ipcMain.handle('local:recent:remove', (_, data: { path?: unknown }) => {
    if (typeof data?.path === 'string') { localFolders?.remove(data.path); rebuildMenu() }
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

// Sair com janelas de pasta abertas (menu Sair, desligar): grava quais eram, antes de elas fecharem
// (Janelas já fechadas pelo encerramento saíram do mapa, mas a gravação delas ainda não aconteceu — não sobrescreve.)
app.on('before-quit', () => { if (localWindows.size > 0) saveOpenFolders(); quitting = true })

app.on('window-all-closed', async () => {
  notifMonitor.stop()
  await disconnectPrisma()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
