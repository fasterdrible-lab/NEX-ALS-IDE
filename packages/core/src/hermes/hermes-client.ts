import type { TerminalService, ExecStream } from '../terminal/terminal.service.js'
import type { SftpService } from '../sftp/sftp.service.js'

/**
 * ssh2 `exec()` não roda um shell de login, então o PATH configurado no
 * .bashrc/.profile do usuário (incluindo o que o installer do Hermes adiciona)
 * não é herdado automaticamente. Todo comando precisa reexportar o PATH —
 * mesmo problema já resolvido para o Claude CLI em vps.service.ts.
 */
const PATH_PREFIX =
  'export PATH="$PATH:/usr/local/bin:/usr/bin:$HOME/.local/bin:$HOME/.hermes/bin:$HOME/.npm/bin";'

const NEX_LOG_DIR = '$HOME/.hermes-nex'
const NEX_LOG_FILE = `${NEX_LOG_DIR}/gateway.log`
const NEX_PID_FILE = `${NEX_LOG_DIR}/gateway.pid`

const INSTALL_URL = 'https://hermes-agent.nousresearch.com/install.sh'

export class HermesClient {
  constructor(private readonly terminal: TerminalService, private readonly sftp: SftpService) {}

  private run(vpsId: string, cmd: string, timeoutMs = 20000): Promise<string> {
    return this.terminal.exec(vpsId, `${PATH_PREFIX} ${cmd}`, timeoutMs)
  }

  async detect(vpsId: string): Promise<boolean> {
    const out = await this.run(vpsId, 'command -v hermes || true')
    return out.trim().length > 0
  }

  async version(vpsId: string): Promise<string> {
    const out = await this.run(vpsId, '(hermes --version || hermes -V || echo "") 2>&1')
    const trimmed = out.trim().split('\n').pop()?.trim() ?? ''
    return trimmed || 'unknown'
  }

  async installPath(vpsId: string): Promise<string> {
    const out = await this.run(vpsId, 'command -v hermes || true')
    return out.trim()
  }

  async install(vpsId: string): Promise<string> {
    return this.run(vpsId, `mkdir -p ${NEX_LOG_DIR}; curl -fsSL ${INSTALL_URL} | bash 2>&1`, 600000)
  }

  async update(vpsId: string): Promise<string> {
    return this.run(vpsId, 'hermes update 2>&1', 300000)
  }

  async startGateway(vpsId: string): Promise<number | null> {
    await this.run(
      vpsId,
      `mkdir -p ${NEX_LOG_DIR}; nohup hermes gateway > ${NEX_LOG_FILE} 2>&1 & echo $! > ${NEX_PID_FILE}; sleep 1; cat ${NEX_PID_FILE}`,
      30000
    )
    const out = await this.run(vpsId, `cat ${NEX_PID_FILE} 2>/dev/null || true`)
    const pid = parseInt(out.trim(), 10)
    return Number.isFinite(pid) ? pid : null
  }

  async stopGateway(vpsId: string, pid: number | null): Promise<void> {
    if (pid) {
      await this.run(vpsId, `kill ${pid} 2>/dev/null || true`)
    }
    await this.run(vpsId, 'pkill -f "hermes gateway" 2>/dev/null || true')
    await this.run(vpsId, `rm -f ${NEX_PID_FILE}`)
  }

  async isRunning(vpsId: string, pid: number | null): Promise<boolean> {
    if (!pid) return false
    const out = await this.run(vpsId, `kill -0 ${pid} 2>/dev/null && echo alive || echo dead`)
    return out.trim().includes('alive')
  }

  async execCommand(vpsId: string, args: string): Promise<string> {
    const safeArgs = args.replace(/[\r\n]/g, ' ').trim()
    return this.run(vpsId, `hermes ${safeArgs} 2>&1`, 60000)
  }

  async readLogs(vpsId: string, lines = 200): Promise<string> {
    return this.run(vpsId, `tail -n ${Math.max(1, Math.min(2000, lines))} ${NEX_LOG_FILE} 2>/dev/null || echo "(sem logs ainda)"`)
  }

  /**
   * Concatena o conteúdo de todos os SKILL.md instalados (`~/.hermes/skills/**`) com um
   * marcador `@@@FILE:<path>` antes de cada um, para o parser em hermes.service.ts separar.
   * Só leitura (`cat`) — nunca cria/edita/apaga skills (ETAPA 19: usar só a API/mecanismo do Hermes).
   */
  async listSkillFiles(vpsId: string): Promise<string> {
    return this.run(
      vpsId,
      `for f in $HOME/.hermes/skills/*/*/SKILL.md $HOME/.hermes/skills/*/SKILL.md; do ` +
      `[ -f "$f" ] && echo "@@@FILE:$f" && cat "$f" && echo; done 2>/dev/null`,
      20000
    )
  }

  /**
   * Envia um objetivo ao Hermes via `hermes chat -q` (inclui saída de tools no
   * transcript — melhor para activity feed do que `hermes -z`, que só devolve
   * a resposta final). O objetivo é escrito num arquivo remoto via SFTP e lido
   * de volta com `$(cat …)` para não precisar escapar aspas/quebras de linha
   * do texto do usuário dentro do comando SSH (mesma técnica do Chat Claude do IDE-21).
   */
  async streamObjective(
    vpsId: string,
    opts: { workspace: string; objective: string; resume: boolean }
  ): Promise<ExecStream> {
    const homeOut = await this.run(vpsId, 'echo $HOME')
    const home = homeOut.trim() || '~'
    const remoteDir = `${home}/.hermes-nex`
    const remoteFile = `${remoteDir}/objective_${crypto.randomUUID()}.txt`

    await this.run(vpsId, `mkdir -p ${remoteDir}`)

    const session = await this.sftp.openSession(vpsId)
    try {
      await session.writeFile(remoteFile, opts.objective)
    } finally {
      session.destroy()
    }

    const resumeFlag = opts.resume ? `--resume latest --in "${opts.workspace}"` : ''
    const cmd = [
      PATH_PREFIX,
      `cd "${opts.workspace}" &&`,
      `hermes -Q chat -q ${resumeFlag} "$(cat "${remoteFile}")";`,
      `rm -f "${remoteFile}"`,
    ].join(' ')

    return this.terminal.execStream(vpsId, cmd)
  }
}
