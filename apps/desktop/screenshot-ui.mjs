import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const WEB_DIST = resolve(__dirname, '../../apps/web/dist')
const SHOTS = join(os.tmpdir(), 'cwm-shots')
fs.mkdirSync(SHOTS, { recursive: true })

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json',
}

const server = createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0]
  if (urlPath === '/' || !urlPath.includes('.')) urlPath = '/index.html'
  const file = join(WEB_DIST, urlPath)
  try {
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'text/plain' })
    res.end(data)
  } catch {
    const data = await readFile(join(WEB_DIST, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(data)
  }
})

await new Promise(r => server.listen(0, '127.0.0.1', r))
const { port } = server.address()
console.log(`Servidor em http://localhost:${port}`)

let browser
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({ channel, headless: true, args: ['--no-sandbox', '--disable-gpu'] })
    console.log(`Browser: ${channel}`)
    break
  } catch { /* try next */ }
}
if (!browser) throw new Error('Edge ou Chrome não encontrado')

const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } })
const page = await ctx.newPage()
page.on('pageerror', () => {})

async function ss(name, hash) {
  await page.goto(`http://localhost:${port}/#${hash}`)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(700)
  const file = join(SHOTS, `${name}.png`)
  await page.screenshot({ path: file })
  console.log(`Screenshot: ${file}`)
  return file
}

const files = []
files.push(await ss('01-dashboard', '/'))
files.push(await ss('02-vps', '/vps'))
files.push(await ss('03-projects', '/projects'))
files.push(await ss('04-accounts', '/accounts'))
files.push(await ss('05-launcher', '/launcher'))
files.push(await ss('06-settings', '/settings'))
files.push(await ss('07-diagnostics', '/diagnostics'))

await browser.close()
server.close()
console.log(`\n${files.length} screenshots em: ${SHOTS}`)
