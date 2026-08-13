import type { HermesClient } from './hermes-client.js'
import type { HermesInstallResult } from './hermes.types.js'

export async function runInstall(client: HermesClient, vpsId: string): Promise<HermesInstallResult> {
  const output = await client.install(vpsId)
  const installedPath = await client.installPath(vpsId)
  if (!installedPath) {
    return { success: false, output, version: 'unknown', installPath: '' }
  }
  const version = await client.version(vpsId)
  return { success: true, output, version, installPath: installedPath }
}
