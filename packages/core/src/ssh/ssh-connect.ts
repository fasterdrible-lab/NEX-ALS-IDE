import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AuthMethod, ConnectConfig } from 'ssh2'
import { getPrismaClient } from '@cwm/db'

const DEFAULT_KEY_NAMES = ['id_ed25519', 'id_ecdsa', 'id_rsa']

/**
 * Configura a autenticação no ConnectConfig tentando, em ordem:
 *   1. chave configurada em Settings (se houver)
 *   2. chaves padrão de ~/.ssh (id_ed25519, id_ecdsa, id_rsa)
 *   3. senha da VPS
 * Assim uma única configuração global funciona para VPS que aceitam só chave,
 * só senha, ou ambas. A senha também é usada como passphrase das chaves
 * (chaves sem passphrase a ignoram; chaves que não decifram são puladas pelo ssh2).
 * Sem chave nem senha, recorre ao SSH agent.
 */
export function applySshAuth(config: ConnectConfig, sshKeyPath: string | null | undefined, password?: string): void {
  const username = config.username ?? 'root'
  const paths = [sshKeyPath, ...DEFAULT_KEY_NAMES.map(n => join(homedir(), '.ssh', n))]
    .filter((p): p is string => !!p)
  const methods: AuthMethod[] = []
  for (const p of new Set(paths)) {
    let key: Buffer
    try { key = readFileSync(p) } catch { continue }
    methods.push({ type: 'publickey', username, key, ...(password ? { passphrase: password } : {}) } as AuthMethod)
  }
  if (password) methods.push({ type: 'password', username, password } as AuthMethod)

  if (methods.length) {
    config.authHandler = methods
    return
  }
  const agentSock = process.env['SSH_AUTH_SOCK']
    ?? (process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : undefined)
  if (agentSock) config.agent = agentSock
}

function persistFingerprint(vpsId: string, fp: string): void {
  getPrismaClient().vpsServer
    .update({ where: { id: vpsId }, data: { sshHostFingerprint: fp } })
    .catch((e: unknown) => console.error('[fingerprint] save failed:', e))
}

/**
 * Builds a hostVerifier for ssh2 that stores the fingerprint on first connect
 * and rejects if it changes on subsequent connections (possible MITM).
 *
 * ssh2 v1.17 passes the raw host key buffer to the verifier function;
 * we compute SHA256 ourselves to get the standard fingerprint format.
 */
export function buildHostVerifier(vpsId: string, storedFp: string | null): {
  hostVerifier: (key: Buffer) => boolean
  wasMismatch: () => boolean
} {
  let mismatch = false

  return {
    hostVerifier(key: Buffer): boolean {
      const fp = `SHA256:${createHash('sha256').update(key).digest('base64')}`
      if (!storedFp) {
        persistFingerprint(vpsId, fp)
        return true
      }
      if (fp === storedFp) return true
      mismatch = true
      return false
    },
    wasMismatch: () => mismatch,
  }
}

export const FINGERPRINT_MISMATCH_MSG =
  'Fingerprint SSH mudou — possível ataque MITM. Vá em VPS → Limpar fingerprint para confiar no novo host.'
