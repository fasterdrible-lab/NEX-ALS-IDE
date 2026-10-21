import { spawn } from 'node:child_process'
import { getPrismaClient } from '@cwm/db'

export class LauncherService {
  private get db() {
    return getPrismaClient()
  }

  async openTerminal(vpsId: string): Promise<{ success: boolean; message: string }> {
    const vps = await this.db.vpsServer.findUnique({ where: { id: vpsId } })
    if (!vps) return { success: false, message: 'VPS não encontrada' }

    const sanitizedUser = vps.username.replace(/[^a-zA-Z0-9.\-_]/g, '')
    const sanitizedHost = vps.host.replace(/[^a-zA-Z0-9.\-_]/g, '')
    const port = Number(vps.port)
    const sshCmd = `ssh -p ${port} ${sanitizedUser}@${sanitizedHost}`

    try {
      if (process.platform === 'win32') {
        // cmd /c start abre janela nova independente do processo Electron
        // Tenta Windows Terminal primeiro, cai em PowerShell se não tiver
        const wtCmd = `start wt.exe -w new-tab -- powershell.exe -NoExit -Command "${sshCmd}" 2>nul || start powershell.exe -NoExit -Command "${sshCmd}"`
        spawn('cmd.exe', ['/c', wtCmd], { detached: true, stdio: 'ignore', shell: false }).unref()
      } else {
        spawn('bash', ['-c', `gnome-terminal -- ${sshCmd} || xterm -e ${sshCmd}`], { detached: true, stdio: 'ignore' }).unref()
      }
      return { success: true, message: `Terminal SSH aberto para ${vps.name}` }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, message: `Erro ao abrir terminal: ${msg}` }
    }
  }
}
