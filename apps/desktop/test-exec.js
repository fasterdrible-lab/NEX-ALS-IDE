console.log('execPath:', process.execPath)
console.log('resourcesPath:', process.resourcesPath)
console.log('type:', process.type)
const path = require('path'), fs = require('fs')
const resDir = process.resourcesPath || path.dirname(process.execPath)
try { console.log('resources:', fs.readdirSync(resDir).slice(0,5)) } catch(e) { console.log('resDir error:', e.message) }
process.exit(0)
