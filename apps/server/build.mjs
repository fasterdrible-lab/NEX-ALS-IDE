// Gera dist/ para copiar na VPS: server.cjs (tudo empacotado) + prisma-client/ (cliente Prisma com o
// motor de Linux, gerado pelo generator "server" do schema). O @cwm/db carrega '../generated/client';
// aqui ele vira './prisma-client', que fica ao lado do server.cjs.
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(root, 'dist')
fs.rmSync(out, { recursive: true, force: true })

await build({
  entryPoints: [path.join(root, 'src/index.ts')],
  outfile: path.join(out, 'server.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'warning',
  // ssh2 tem binding opcional (cpu-features) que não existe na VPS — o próprio ssh2 cai no JS.
  external: ['cpu-features', './crypto/build/Release/sshcrypto.node'],
  plugins: [{
    name: 'prisma-client-ao-lado',
    setup(b) {
      b.onResolve({ filter: /generated[\\/]client$/ }, () => ({ path: './prisma-client/index.js', external: true }))
    },
  }],
})

const src = path.join(root, 'generated/prisma-client')
if (!fs.existsSync(src)) throw new Error('Rode antes: pnpm --filter @cwm/db generate')
fs.cpSync(src, path.join(out, 'prisma-client'), {
  recursive: true,
  // Só o motor de Linux vai para a VPS.
  filter: f => !/query_engine-windows/.test(f),
})
console.log('[server] dist/ pronto:', fs.readdirSync(out).join(', '))
