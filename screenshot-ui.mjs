// Tira screenshots do app servido pelo Vite preview com Microsoft Edge
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.join(os.tmpdir(), 'cwm-shots')
fs.mkdirSync(SHOTS, { recursive: true })

function freePort() {
  return new Promise(resolve => {
    const s = createServer()
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)) })
  })
}

const port = await freePort()
console.log(`Iniciando Vite preview na porta ${port}...`)

const vite = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: path.join(__dirname, 'apps/web'),
  shell: true,
  stdio: 'pipe',
})

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Vite preview timeout')), 15000)
  vite.stdout.on('data', d => {
    if (String(d).includes('localhost')) { clearTimeout(timer); resolve() }
  })
  vite.stderr.on('data', d => {
    if (String(d).includes('localhost')) { clearTimeout(timer); resolve() }
  })
})

console.log(`Vite preview rodando em http://localhost:${port}`)

// Tenta Edge, fallback para Chrome
let browser
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({ channel, headless: true, args: ['--no-sandbox'] })
    console.log(`Browser: ${channel}`)
    break
  } catch { /* tenta próximo */ }
}
if (!browser) throw new Error('Nenhum browser encontrado (Edge ou Chrome)')

const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } })
const page = await ctx.newPage()

async function ss(name, hash) {
  await page.goto(`http://localhost:${port}/#${hash}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const file = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: file })
  console.log(`Screenshot: ${file}`)
}

await ss('01-dashboard', '/')
await ss('02-vps', '/vps')
await ss('03-projects', '/projects')
await ss('04-accounts', '/accounts')
await ss('05-launcher', '/launcher')
await ss('06-settings', '/settings')
await ss('07-diagnostics', '/diagnostics')

await browser.close()
vite.kill()
console.log(`\nScreenshots em: ${SHOTS}`)
