import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { DiagnosticItem, DiagnosticResults } from '@cwm/config'

const execAsync = promisify(exec)

async function checkCommand(cmd: string, label: string, versionFlag = '--version'): Promise<DiagnosticItem> {
  try {
    const { stdout } = await execAsync(`${cmd} ${versionFlag}`, { timeout: 8000 })
    const version = stdout.trim().split('\n')[0].trim()
    return { status: 'ok', label, version, message: `${label} disponível` }
  } catch {
    return { status: 'error', label, message: `${label} não encontrado no PATH` }
  }
}

export class DiagnosticsService {
  async runAll(): Promise<DiagnosticResults> {
    const [ssh, git, node] = await Promise.allSettled([
      checkCommand('ssh', 'SSH', '-V'),
      checkCommand('git', 'Git'),
      checkCommand('node', 'Node.js'),
    ])

    return {
      ssh: settled(ssh, 'SSH'),
      git: settled(git, 'Git'),
      node: settled(node, 'Node.js'),
    }
  }
}

function settled(result: PromiseSettledResult<DiagnosticItem>, label: string): DiagnosticItem {
  if (result.status === 'fulfilled') return result.value
  return { status: 'error', label, message: `Erro ao verificar ${label}` }
}
