// Must test from app directory approach to get full Electron init
console.log('[START] process.type:', process.type)
const electronPath = require('electron') // returns path string
console.log('[START] require(electron):', typeof electronPath === 'string' ? 'PATH' : 'API')

// Can we use process.binding to get Electron APIs?
try {
  const feat = process.binding('electron_renderer_web_frame')
  console.log('electron_renderer_web_frame binding:', typeof feat)
} catch(e) { console.log('renderer binding error:', e.message.slice(0,40)) }

try {
  const app = process.binding('app')
  console.log('app binding:', typeof app)
} catch(e) { console.log('app binding error:', e.message.slice(0,40)) }

// What bindings are available?
const bindings = ['app', 'atom_browser_app', 'electron_browser_app', 'electron_common_features']
for (const b of bindings) {
  try {
    const r = process.binding(b)
    console.log('binding', b, ':', typeof r, typeof r === 'object' ? Object.keys(r||{}).slice(0,3) : r)
  } catch { }
}
process.exit(0)
