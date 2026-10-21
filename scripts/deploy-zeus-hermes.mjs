#!/usr/bin/env node
// Instala/atualiza o serviço zeus-hermes na VPS-1 (Passo 1 do Zeus Mobile, docs/ZEUS_MOBILE_PLAN.md).
// Uso: pnpm --filter @cwm/server build && node scripts/deploy-zeus-hermes.mjs [root@204.168.180.25]
//
// - /opt/zeus-hermes/{app,data,ssh}; systemd zeus-hermes.service (reinicia sozinho); só escuta em 127.0.0.1:8790.
// - Token: gerado no PC na 1ª vez e guardado em %APPDATA%\@cwm\desktop\zeus-hermes\token (o Zeus usa no Passo 2);
//   na VPS fica só o sha256.
// - Chave SSH própria do serviço para falar com o Hermes desta máquina (mesmo código de SSH do Zeus),
//   autorizada em /root/.ssh/authorized_keys só a partir de 127.0.0.1.
// - `tailscale serve` publica https://<vps>.<tailnet>.ts.net:8443 só na rede privada do Tailscale.
// Não mexe em dados: a migração dos projetos do PC para o serviço é outro passo.
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const target = process.argv[2] ?? 'root@204.168.180.25'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'apps', 'server', 'dist')
if (!fs.existsSync(path.join(dist, 'server.cjs'))) throw new Error('Rode antes: pnpm --filter @cwm/server build')

// Token do PC (reaproveitado nas atualizações).
const tokenDir = path.join(process.env.APPDATA ?? path.join(os.homedir(), '.config'), '@cwm', 'desktop', 'zeus-hermes')
const tokenFile = path.join(tokenDir, 'token')
fs.mkdirSync(tokenDir, { recursive: true })
if (!fs.existsSync(tokenFile)) fs.writeFileSync(tokenFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 })
const hash = crypto.createHash('sha256').update(fs.readFileSync(tokenFile, 'utf8').trim()).digest('hex')

const ssh = (args, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', target, ...args], { input, stdio: ['pipe', 'inherit', 'inherit'] })

// Pacote: tar relativo (o tar do Git Bash confunde "C:" com host remoto).
const tgz = 'zeus-hermes-dist.tgz'
execFileSync('tar', ['-czf', tgz, '-C', 'dist', '.'], { cwd: path.join(root, 'apps', 'server') })
try {
  execFileSync('scp', ['-q', '-o', 'BatchMode=yes', tgz, `${target}:/tmp/${tgz}`], { cwd: path.join(root, 'apps', 'server'), stdio: 'inherit' })
} finally {
  fs.rmSync(path.join(root, 'apps', 'server', tgz), { force: true })
}

const remote = String.raw`
set -euo pipefail
B=/opt/zeus-hermes
mkdir -p $B/data $B/ssh
chmod 700 $B/data $B/ssh
rm -rf $B/app.new && mkdir $B/app.new && tar -xzf /tmp/${tgz} -C $B/app.new && rm -f /tmp/${tgz}
if [ -d $B/app ]; then rm -rf $B/app.old && mv $B/app $B/app.old; fi
mv $B/app.new $B/app
umask 077 && echo ${hash} > $B/data/token.sha256
if [ ! -f $B/ssh/id_ed25519 ]; then ssh-keygen -q -t ed25519 -N '' -C zeus-hermes@localhost -f $B/ssh/id_ed25519; fi
PUB=$(cat $B/ssh/id_ed25519.pub)
mkdir -p /root/.ssh && touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
grep -qF "$PUB" /root/.ssh/authorized_keys || echo "from=\"127.0.0.1,::1\" $PUB" >> /root/.ssh/authorized_keys
cat > /etc/systemd/system/zeus-hermes.service <<'UNIT'
[Unit]
Description=zeus-hermes — loop do Hermes do Zeus IDE
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/zeus-hermes/app
Environment=ZEUS_DATA_DIR=/opt/zeus-hermes/data
Environment=ZEUS_PORT=8790
Environment=HOME=/root
ExecStart=/usr/bin/node server.cjs
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable zeus-hermes >/dev/null 2>&1
systemctl restart zeus-hermes
sleep 3
systemctl is-active zeus-hermes
curl -s http://127.0.0.1:8790/health; echo
tailscale serve --bg --https=8443 http://127.0.0.1:8790 >/dev/null
tailscale serve status
`
ssh(['bash', '-s'], remote)
console.log(`\n[deploy] ok. Token do PC em: ${tokenFile}`)
