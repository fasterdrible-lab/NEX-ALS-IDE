const paths = [
  '@electron/internal/browser/api/exports/electron',
  'electron/main',
  'electron/common',
]
for (const p of paths) {
  try {
    const m = require(p)
    console.log(p, '→ type:', typeof m, 'app:', m.app ? 'OK' : 'MISSING')
  } catch(e) {
    console.log(p, '→ ERROR:', e.message.split('\n')[0])
  }
}
process.exit(0)
