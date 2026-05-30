// Launch driver — tira screenshots do app Electron para inspeção
// Uso: node launch-driver.mjs
import { _electron as electron } from 'playwright-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = __dirname
const SHOTS_DIR = path.join(os.tmpdir(), 'cwm-shots')
fs.mkdirSync(SHOTS_DIR, { recursive: true })

const electronBin = path.join(APP_ROOT, 'node_modules/electron/dist/electron.exe')
const dbPath = path.join(os.tmpdir(), 'cwm-test.db')

console.log('Lançando Electron...')
console.log('  Binary:', electronBin)
console.log('  DB:', dbPath)
console.log('  Screenshots:', SHOTS_DIR)

const app = await electron.launch({
  executablePath: electronBin,
  args: ['--no-sandbox', APP_ROOT],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: `file:${dbPath}`,
  },
  timeout: 30000,
})

// Aguarda a janela principal carregar
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')

// Aguarda o React montar (aguarda a sidebar aparecer)
try {
  await page.waitForSelector('nav a', { timeout: 15000 })
} catch {
  console.log('Aviso: sidebar demorou a aparecer')
}

async function ss(name) {
  const f = path.join(SHOTS_DIR, `${name}.png`)
  await page.screenshot({ path: f, fullPage: false })
  console.log(`Screenshot: ${f}`)
}

async function navigate(hash) {
  await page.evaluate(h => { window.location.hash = h }, hash)
  await page.waitForTimeout(600)
}

// Dashboard
await ss('01-dashboard')

// VPS page
await navigate('/vps')
await ss('02-vps')

// Projects page
await navigate('/projects')
await ss('03-projects')

// Launcher
await navigate('/launcher')
await ss('04-launcher')

// Diagnostics
await navigate('/diagnostics')
await ss('05-diagnostics')

console.log('\nApp rodando. Pressione Ctrl+C para fechar.')
console.log(`\nScreenshots salvas em: ${SHOTS_DIR}`)
