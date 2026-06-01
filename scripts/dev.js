'use strict'
// Garante que ELECTRON_RUN_AS_NODE não está definido antes de iniciar o Electron.
delete process.env['ELECTRON_RUN_AS_NODE']

const { spawnSync, spawn } = require('child_process')
const isWin = process.platform === 'win32'

// Rebuilda os pacotes workspace antes de iniciar o dev server.
// Necessário para garantir que migrations e providers estejam atualizados.
const pkgs = ['@cwm/config', '@cwm/db', '@cwm/core']
for (const pkg of pkgs) {
  console.log(`[dev] building ${pkg}…`)
  const r = spawnSync('pnpm', ['--filter', pkg, 'build'], { stdio: 'inherit', shell: isWin })
  if (r.status !== 0) { console.error(`[dev] build failed for ${pkg}`); process.exit(1) }
}

const proc = spawn('pnpm', ['run', 'dev:inner'], {
  stdio: 'inherit',
  shell: isWin,
})
proc.on('exit', (code) => process.exit(code ?? 0))
