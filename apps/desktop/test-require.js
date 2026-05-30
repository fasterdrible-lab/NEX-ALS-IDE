const e = require('electron')
console.log('typeof electron:', typeof e)
console.log('app:', typeof e === 'object' ? (e.app ? 'OK' : 'MISSING') : 'STRING: ' + e.slice(0, 80))
process.exit(0)
