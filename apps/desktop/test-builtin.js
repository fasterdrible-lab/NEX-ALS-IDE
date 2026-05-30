const { builtinModules } = require('module')
console.log('electron in builtinModules?', builtinModules.includes('electron'))
console.log('electron in process.binding?', !!process.binding)
// Check if electron is accessible via a different mechanism
try {
  const e = process.mainModule && process.mainModule.require('electron')
  console.log('mainModule.require(electron):', typeof e)
} catch(err) {
  console.log('mainModule.require error:', err.message.slice(0,50))
}
process.exit(0)
