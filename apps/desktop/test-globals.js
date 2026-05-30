// Check what's available in the Electron main process
const checks = ['app', 'BrowserWindow', 'ipcMain', 'electron']
for (const k of checks) {
  try { console.log(k, ':', typeof global[k]) } catch(e) { console.log(k, ': error') }
}
console.log('process.type:', process.type)
console.log('process.versions.electron:', process.versions && process.versions.electron)
// Try binding
try {
  const b = process.electronBinding('app')
  console.log('process.electronBinding(app):', typeof b)
} catch(e) {
  console.log('electronBinding:', e.message.split('\n')[0])
}
process.exit(0)
