import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { getPrismaClient } from '@cwm/db'
import { SettingsService } from '../settings/settings.service.js'

const execAsync = promisify(exec)

export class LauncherService {
  private settings = new SettingsService()

  private get db() {
    return getPrismaClient()
  }

  async openProject(projectId: string): Promise<{ success: boolean; message: string }> {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      include: { vpsServer: true },
    })
    if (!project) return { success: false, message: 'Projeto não encontrado' }

    const cfg = await this.settings.get()
    const { vpsServer: vps } = project

    const sanitizedUser = vps.username.replace(/[^a-zA-Z0-9.\-_]/g, '')
    const sanitizedHost = vps.host.replace(/[^a-zA-Z0-9.\-_]/g, '')
    const sanitizedPath = project.remotePath.replace(/[^a-zA-Z0-9/.\-_ ]/g, '')

    const sshTarget = `${sanitizedUser}@${sanitizedHost}`
    const folderUri = `vscode-remote://ssh-remote+${sshTarget}${sanitizedPath}`

    try {
      await execAsync(`"${cfg.vscodePath}" --folder-uri "${folderUri}"`, { timeout: 15000 })

      await this.db.launchHistory.create({
        data: { projectId, success: true },
      })

      return { success: true, message: `VS Code aberto — ${vps.name} → ${project.remotePath}` }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)

      await this.db.launchHistory.create({
        data: { projectId, success: false, errorMsg: msg },
      })

      return {
        success: false,
        message: msg.includes('not found') || msg.includes('ENOENT')
          ? `VS Code não encontrado em "${cfg.vscodePath}". Verifique as Configurações.`
          : `Erro ao abrir VS Code: ${msg.split('\n')[0]}`,
      }
    }
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
