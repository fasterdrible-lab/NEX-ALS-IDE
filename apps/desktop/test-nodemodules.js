// Test exactly how Module._load handles require("electron")
const Module = require('module')
const orig = Module._load
// Patch to log what happens
Module._load = function(req, parent, isMain) {
  if (req === 'electron' || req.includes('electron')) {
    console.log('_load called with:', req.slice(0,100))
  }
  return orig.call(this, req, parent, isMain)
}
try { require('electron') } catch(e) {}
Module._load = orig
process.exit(0)
