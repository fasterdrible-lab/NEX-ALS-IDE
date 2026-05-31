'use strict'
// Garante que ELECTRON_RUN_AS_NODE não está definido antes de iniciar o Electron.
// Claude Code (e ferramentas similares) definem esta var para evitar janelas Electron
// durante execução de comandos — o que quebra require('electron') no main process.
delete process.env['ELECTRON_RUN_AS_NODE']

const { spawn } = require('child_process')
const isWin = process.platform === 'win32'
const proc = spawn('pnpm', ['run', 'dev:inner'], {
  stdio: 'inherit',
  shell: isWin,
})
proc.on('exit', (code) => process.exit(code ?? 0))
