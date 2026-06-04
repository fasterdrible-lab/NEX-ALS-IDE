import { getPrismaClient } from '@cwm/db'
import { TerminalService } from '../terminal/terminal.service.js'

export interface NotificationAlert {
  vpsId: string
  vpsName: string
  type: 'disk' | 'cpu' | 'ram'
  value: number
  threshold: number
  title: string
  body: string
}

const THRESHOLDS = { disk: 85, cpu: 90, ram: 90 }
const POLL_INTERVAL_MS = 60_000
const COOLDOWN_MS = 30 * 60_000

export class NotificationMonitor {
  private terminal = new TerminalService()
  private cooldowns = new Map<string, number>()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private alertCb: ((alert: NotificationAlert) => void) | null = null
  private enabled = true

  onAlert(cb: (alert: NotificationAlert) => void): void {
    this.alertCb = cb
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  start(): void {
    if (this.intervalId) return
    // Aguarda 5s após iniciar para DB estar pronto
    setTimeout(() => { void this.poll() }, 5_000)
    this.intervalId = setInterval(() => { void this.poll() }, POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private canNotify(vpsId: string, type: string): boolean {
    const key = `${vpsId}:${type}`
    const last = this.cooldowns.get(key) ?? 0
    if (Date.now() - last < COOLDOWN_MS) return false
    this.cooldowns.set(key, Date.now())
    return true
  }

  private emit(alert: NotificationAlert): void {
    if (this.alertCb) this.alertCb(alert)
  }

  private async poll(): Promise<void> {
    if (!this.enabled) return
    try {
      const db = getPrismaClient()
      const vpsList = await db.vpsServer.findMany({ orderBy: { createdAt: 'asc' } })
      await Promise.allSettled(vpsList.map((v: { id: string; name: string }) => this.checkVps(v.id, v.name)))
    } catch { /* silent */ }
  }

  private async checkVps(vpsId: string, vpsName: string): Promise<void> {
    const cmd = [
      'echo "LOAD:$(cat /proc/loadavg 2>/dev/null || echo 0)"',
      'echo "CORES:$(nproc 2>/dev/null || echo 1)"',
      'echo "MEM:$(free -m 2>/dev/null | awk \'NR==2{print $2,$3}\' || echo 0 0)"',
      'echo "DISK:$(df / 2>/dev/null | awk \'NR==2{print $5}\' | tr -d % || echo 0)"',
    ].join('; ')

    try {
      const output = await this.terminal.exec(vpsId, cmd, 12_000)
      const lines: Record<string, string> = {}
      for (const line of output.split('\n')) {
        const idx = line.indexOf(':')
        if (idx !== -1) lines[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }

      const loadParts = (lines['LOAD'] || '0 0 0').split(' ')
      const load1 = parseFloat(loadParts[0]) || 0
      const cores = Math.max(1, parseInt(lines['CORES'] || '1') || 1)
      const cpuPct = Math.min(100, Math.round((load1 / cores) * 100))

      const memParts = (lines['MEM'] || '0 0').split(' ')
      const totalMb = parseInt(memParts[0]) || 0
      const usedMb = parseInt(memParts[1]) || 0
      const ramPct = totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0

      const diskPct = parseInt(lines['DISK'] || '0') || 0

      if (diskPct >= THRESHOLDS.disk && this.canNotify(vpsId, 'disk')) {
        this.emit({
          vpsId, vpsName, type: 'disk', value: diskPct, threshold: THRESHOLDS.disk,
          title: `Disco Cheio — ${vpsName}`,
          body: `Uso do disco em ${diskPct}% (alerta: ${THRESHOLDS.disk}%)`,
        })
      }

      if (cpuPct >= THRESHOLDS.cpu && this.canNotify(vpsId, 'cpu')) {
        this.emit({
          vpsId, vpsName, type: 'cpu', value: cpuPct, threshold: THRESHOLDS.cpu,
          title: `CPU Alta — ${vpsName}`,
          body: `Uso de CPU em ${cpuPct}% (alerta: ${THRESHOLDS.cpu}%)`,
        })
      }

      if (ramPct >= THRESHOLDS.ram && this.canNotify(vpsId, 'ram')) {
        this.emit({
          vpsId, vpsName, type: 'ram', value: ramPct, threshold: THRESHOLDS.ram,
          title: `RAM Crítica — ${vpsName}`,
          body: `Uso de memória em ${ramPct}% (alerta: ${THRESHOLDS.ram}%)`,
        })
      }
    } catch { /* VPS offline ou erro SSH — silencioso */ }
  }
}
