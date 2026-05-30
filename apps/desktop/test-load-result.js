const Module = require('module')
const orig = Module._load.bind(Module)
Module._load = function(req, parent, isMain) {
  const result = orig(req, parent, isMain)
  if (req === 'electron') {
    console.log('_load("electron") returned:', typeof result, '→', typeof result === 'string' ? 'PATH:'+result.slice(-30) : Object.keys(result||{}).slice(0,5).join(','))
  }
  return result
}
const e = require('electron')
console.log('require("electron"):', typeof e)
process.exit(0)
