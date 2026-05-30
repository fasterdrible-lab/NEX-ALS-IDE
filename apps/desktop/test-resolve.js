const Module = require('module')
// Electron's _resolveFilename should be the c patched version
const orig = Module._resolveFilename.bind(Module)
try {
  const r = orig('electron', module, false)
  console.log('_resolveFilename("electron"):', r.slice(-60))
} catch(e) {
  console.log('ERROR:', e.message.split('\n')[0])
}
process.exit(0)
