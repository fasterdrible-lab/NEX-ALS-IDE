// Testa o que _resolveFilename retorna para 'electron' ANTES de qualquer patch
const Module = require('module')
const orig = Module._resolveFilename.bind(Module)
try {
  const resolved = orig('electron', module, false)
  console.log('resolved:', resolved)
} catch(e) {
  console.log('erro:', e.message)
}
process.exit(0)
