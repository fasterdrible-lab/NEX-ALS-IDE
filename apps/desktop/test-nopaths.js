const Module = require('module')
// Temporarily remove all paths that have node_modules/electron
const origFn = Module._resolveFilename
Module._resolveFilename = function(req, parent, isMain, opts) {
  if (req === 'electron') {
    // Try resolving without any node_modules paths
    const fakePaths = {paths: []}
    return origFn.call(this, req, {...(parent||{}), paths: []}, isMain, opts)
  }
  return origFn.call(this, req, parent, isMain, opts)
}
const result = require('electron')
console.log('result type:', typeof result)
process.exit(0)
