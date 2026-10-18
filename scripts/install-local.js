'use strict'
// Instala neste computador o instalador já gerado por `pnpm package:win` e abre o app.
// Uso: `pnpm install:local` (só instala) ou `pnpm release:local` (gera + instala).
//
// - Fecha o app aberto (o instalador não substitui arquivos em uso) — inclusive o exe com o nome
//   antigo (NEX-ALS IDE), de antes do rebranding para Zeus IDE.
// - Instala em modo silencioso (/S) — instalador NSIS por usuário, sem UAC.
// - Abre o app SEM ELECTRON_RUN_AS_NODE: terminais dentro do VS Code herdam essa variável, e com
//   ela qualquer app Electron roda como Node puro e fecha na hora ("bad option").
//
// Atenção: fechar o app interrompe o loop autônomo do Hermes no painel Agent. A execução em
// andamento na VPS continua e é reconhecida ao reabrir (v3.59.7), mas a próxima tarefa não começa.

const { execFileSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

if (process.platform !== 'win32') {
  console.error('[install-local] só para Windows')
  process.exit(1)
}

const root = path.resolve(__dirname, '..')
const pkg = require(path.join(root, 'apps', 'desktop', 'package.json'))
const { version } = pkg
const productName = pkg.build.productName
const exeNames = [`${productName}.exe`, 'NEX-ALS IDE.exe'].filter((n, i, a) => a.indexOf(n) === i)
const installer = path.join(root, 'apps', 'desktop', 'dist-app', `${productName} Setup ${version}.exe`)
// Atualizações reaproveitam a pasta da instalação anterior (mesmo appId) — quem instalou antes do
// rebranding continua em Programs\NEX-ALS IDE, agora com o exe novo.
const programs = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs')
const exeCandidates = [productName, 'NEX-ALS IDE'].map(dir => path.join(programs, dir, `${productName}.exe`))
const findAppExe = () => exeCandidates.find(p => fs.existsSync(p)) ?? exeCandidates[0]

if (!fs.existsSync(installer)) {
  console.error(`[install-local] instalador não encontrado: ${installer}\nRode antes: pnpm package:win`)
  process.exit(1)
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const running = () => exeNames.filter(exe => {
  try {
    return execFileSync('tasklist', ['/FI', `IMAGENAME eq ${exe}`, '/NH'], { encoding: 'utf8' }).includes(exe)
  } catch { return false }
})

if (running().length > 0) {
  console.log(`[install-local] fechando o app aberto (${running().join(', ')})…`)
  for (const exe of running()) {
    try { execFileSync('taskkill', ['/IM', exe, '/T'], { stdio: 'ignore' }) } catch { /* pode já ter fechado */ }
  }
  for (let i = 0; i < 10 && running().length > 0; i++) sleep(1000)
  for (const exe of running()) {
    try { execFileSync('taskkill', ['/IM', exe, '/T', '/F'], { stdio: 'ignore' }) } catch { /* ignorar */ }
  }
  sleep(2000)
}

console.log(`[install-local] instalando ${productName} v${version} (silencioso)…`)
try {
  execFileSync(installer, ['/S'], { stdio: 'inherit' })
} catch (e) {
  console.error(`[install-local] o instalador falhou: ${e.message}`)
  process.exit(1)
}

const appExe = findAppExe()
const installed = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(path.dirname(appExe), 'resources', 'app', 'package.json'), 'utf8')).version }
  catch { return '?' }
})()
if (installed !== version) {
  console.error(`[install-local] versão instalada (${installed}) diferente da esperada (${version}) em ${appExe}`)
  process.exit(1)
}

const env = { ...process.env }
delete env['ELECTRON_RUN_AS_NODE']
spawn(appExe, [], { cwd: path.dirname(appExe), env, detached: true, stdio: 'ignore' }).unref()
console.log(`[install-local] ${productName} v${installed} instalado e aberto.`)
