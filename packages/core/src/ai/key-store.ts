/**
 * KeyStore — armazenamento seguro de API keys.
 *
 * A implementação padrão usa AES-256 sobre SQLite (mesma chave atual).
 * Para produção com máxima segurança, injete uma implementação baseada em
 * electron.safeStorage (Windows DPAPI / macOS Keychain / Linux Secret Service)
 * via KeyStore.use() antes de inicializar o AiService.
 *
 * Interface compatível com a API do keytar para facilitar migração futura.
 */

import { encryptPassword, decryptPassword } from '@cwm/config'
import { getPrismaClient } from '@cwm/db'

export interface IKeyStore {
  get(provider: string): Promise<string | null>
  set(provider: string, key: string): Promise<void>
  delete(provider: string): Promise<void>
}

// Implementação padrão: AES-256 em SQLite
const defaultStore: IKeyStore = {
  async get(provider: string): Promise<string | null> {
    const rows = (await getPrismaClient().$queryRawUnsafe(
      `SELECT apiKey FROM ai_providers WHERE provider = ? LIMIT 1`, provider
    )) as Array<{ apiKey: string }>
    if (!rows.length || !rows[0].apiKey || rows[0].apiKey === 'MIGRATED') return null
    const plain = decryptPassword(rows[0].apiKey)
    return plain || null
  },

  async set(provider: string, key: string): Promise<void> {
    const encrypted = encryptPassword(key)
    await getPrismaClient().$executeRawUnsafe(
      `UPDATE ai_providers SET apiKey = ?, updatedAt = CURRENT_TIMESTAMP WHERE provider = ?`,
      encrypted, provider
    )
  },

  async delete(provider: string): Promise<void> {
    await getPrismaClient().$executeRawUnsafe(
      `UPDATE ai_providers SET apiKey = '' WHERE provider = ?`, provider
    )
  },
}

let _store: IKeyStore = defaultStore

export const KeyStore = {
  /** Injeta uma implementação alternativa (ex: electron.safeStorage). */
  use(impl: IKeyStore): void {
    _store = impl
  },

  get(provider: string): Promise<string | null> {
    return _store.get(provider)
  },

  set(provider: string, key: string): Promise<void> {
    return _store.set(provider, key)
  },

  delete(provider: string): Promise<void> {
    return _store.delete(provider)
  },
}
