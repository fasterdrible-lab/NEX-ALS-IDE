import { _electron as electron } from 'playwright-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.join(os.tmpdir(), 'cwm-electron-shots')
fs.mkdirSync(SHOTS, { recursive: true })

const electronBin = path.join(__dirname, 'node_modules/electron/dist/electron.exe')
const dbPath = path.join(os.tmpdir(), 'cwm-electron-test.db')

console.log('Lançando Electron via resources/app/ ...')

const app = await electron.launch({
  executablePath: electronBin,
  // Sem args - Electron carrega de resources/app/
  args: [],
  env: {
    ...process.env,
    DATABASE_URL: `file:${dbPath}`,
  },
  timeout: 30000,
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')

try {
  await page.waitForSelector('nav a', { timeout: 12000 })
  console.log('UI carregada!')
} catch {
  console.log('Timeout aguardando sidebar — tirando screenshot mesmo assim')
}

async function ss(name, hash) {
  if (hash) await page.evaluate(h => { window.location.hash = h }, hash)
  await page.waitForTimeout(600)
  const f = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: f })
  console.log(`Screenshot: ${f}`)
}

await ss('electron-01-dashboard', '/')
await ss('electron-02-vps', '/vps')
await ss('electron-03-launcher', '/launcher')
await ss('electron-04-settings', '/settings')
await ss('electron-05-diagnostics', '/diagnostics')

await app.close()
console.log(`\nScreenshots em: ${SHOTS}`)
