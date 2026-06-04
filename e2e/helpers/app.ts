import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'

const ROOT = path.join(__dirname, '../..')
const MAIN = path.join(ROOT, 'apps/desktop/out/main/index.js')
const RENDERER_DIST = path.join(ROOT, 'apps/web/dist/index.html')
const TEST_DB_DIR = path.join(ROOT, 'e2e/.test-db')

/**
 * Launches a fresh Electron app instance against an isolated SQLite test DB.
 * Each call creates a unique DB file so parallel or repeated runs don't conflict.
 */
export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  fs.mkdirSync(TEST_DB_DIR, { recursive: true })
  const dbPath = path.join(TEST_DB_DIR, `test-${process.pid}-${Date.now()}.db`)

  // The `electron` npm package exports the binary path as its module value at runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronExec = require('electron') as string

  const electronApp = await electron.launch({
    executablePath: electronExec,
    args: [MAIN],
    env: {
      ...process.env,
      // Load the built web app from disk so no dev server is needed
      ELECTRON_RENDERER_URL: pathToFileURL(RENDERER_DIST).href,
      DATABASE_URL: `file:${dbPath}`,
      NODE_ENV: 'test',
      // Suppress auto-update network calls during tests
      SKIP_AUTO_UPDATE: '1',
    },
  })

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  // Allow React to mount and IPC to initialize
  await page.waitForTimeout(800)

  return { app: electronApp, page }
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close().catch(() => {})
}
