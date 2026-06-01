import { createHash } from 'node:crypto'
import { getPrismaClient } from '@cwm/db'

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
