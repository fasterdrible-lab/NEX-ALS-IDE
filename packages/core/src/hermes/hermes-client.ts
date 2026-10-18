import type { TerminalService } from '../terminal/terminal.service.js'
import type { SftpService } from '../sftp/sftp.service.js'
import { HermesEventStream } from './hermes-events.js'

/**
 * ssh2 `exec()` não roda um shell de login, então o PATH configurado no
 * .bashrc/.profile do usuário (incluindo o que o installer do Hermes adiciona)
 * não é herdado automaticamente. Todo comando precisa reexportar o PATH —
 * mesmo problema já resolvido para o Claude CLI em vps.service.ts.
 *
 * Instalado como root, o installer usa /usr/local/lib/hermes-agent/ (Hermes v0.20.0).
 * O comando real fica em venv/bin/ — o `hermes` na raiz do repo é só um launcher
 * que quebra (ModuleNotFoundError) se o venv não tiver as dependências, então
 * NÃO entra no PATH: uma instalação incompleta deve continuar como "não instalado".
 */
const PATH_PREFIX =
  'export PATH="$PATH:/usr/local/bin:/usr/bin:$HOME/.local/bin:$HOME/.hermes/bin:$HOME/.npm/bin:/usr/local/lib/hermes-agent/venv/bin";'

const NEX_LOG_DIR = '$HOME/.hermes-nex'
const NEX_LOG_FILE = `${NEX_LOG_DIR}/gateway.log`
const NEX_PID_FILE = `${NEX_LOG_DIR}/gateway.pid`

const INSTALL_URL = 'https://hermes-agent.nousresearch.com/install.sh'

const HAS_CLAUDE_MARK = '__NEX_HAS_CLAUDE__'

/**
 * Quando o Claude Code CLI existe na VPS (logado na conta do usuário, dentro da própria VPS),
 * o Hermes vira coordenador e delega a implementação a `claude -p` — o modelo do Hermes pode
 * ser um gratuito/barato, e o código sai do Claude Code com a assinatura do usuário. A
 * governança do lado do Claude Code fica em /etc/claude-code/managed-settings.json (deny list +
 * bypass desativado), que o Hermes não consegue sobrescrever.
 */
const CLAUDE_DELEGATION_NOTE = [
  '[Instrução do NEX — delegação de código]',
  'O Claude Code CLI está disponível nesta VPS. Você COORDENA; o Claude Code IMPLEMENTA.',
  'Para escrever, alterar ou corrigir código, use a skill claude-code em print mode, no diretório do projeto:',
  '  claude -p "<tarefa clara e completa>" --allowedTools "Read,Edit,Write,Bash" --max-turns 30',
  'com timeout=600 na chamada do terminal (teto do modo foreground). Divida trabalho grande em várias chamadas menores,',
  'cada uma cabendo em 10 minutos. Depois revise o resultado (git diff) e rode os testes/build você mesmo.',
  'Nunca use --dangerously-skip-permissions (está desativado). Se o Claude Code recusar um comando por política,',
  'não contorne. Se ele falhar por autenticação ou limite de uso, faça a alteração você mesmo e avise no final.',
].join('\n')

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
    // v0.22+ imprime várias linhas (versão, diretório, Python, "Up to date"…) — a versão vem na 1ª.
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
    const tagged = lines.find(l => /^Hermes Agent v\d/i.test(l)) ?? lines[0] ?? ''
    return tagged.match(/v\d+(\.\d+)+[\w.-]*/)?.[0] ?? (tagged || 'unknown')
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

  /**
   * PID do gateway vivo, venha de onde vier: o processo que o NEX iniciou (`pid`), o serviço
   * systemd que o `hermes setup` instala (`hermes-gateway.service` → `… gateway run`) ou um
   * `hermes gateway` manual. `[g]ateway` evita que o pgrep case com a própria linha do bash.
   */
  async findGatewayPid(vpsId: string, pid: number | null): Promise<number | null> {
    const own = pid ? `kill -0 ${pid} 2>/dev/null && echo ${pid} && exit 0;` : ''
    const out = await this.run(vpsId, `${own} pgrep -o -f "hermes.*[g]ateway( run)?$|[g]ateway run$" || true`)
    const found = parseInt(out.trim().split('\n')[0] ?? '', 10)
    return Number.isFinite(found) ? found : null
  }

  async startGateway(vpsId: string): Promise<number | null> {
    // Uma instância de gateway por host (o Hermes recusa uma segunda): adota a que já existir.
    const existing = await this.findGatewayPid(vpsId, null)
    if (existing) {
      await this.run(vpsId, `mkdir -p ${NEX_LOG_DIR}; echo ${existing} > ${NEX_PID_FILE}`)
      return existing
    }
    // Serviço instalado pelo `hermes setup` (systemd/launchd): sobe por ele, sobrevive a reboot.
    const viaService = await this.run(vpsId, 'hermes gateway start >/dev/null 2>&1 && echo ok || echo no')
    if (viaService.trim().endsWith('ok')) {
      await this.run(vpsId, 'sleep 3')
      const svcPid = await this.findGatewayPid(vpsId, null)
      if (svcPid) {
        await this.run(vpsId, `mkdir -p ${NEX_LOG_DIR}; echo ${svcPid} > ${NEX_PID_FILE}`)
        return svcPid
      }
    }
    await this.run(
      vpsId,
      `mkdir -p ${NEX_LOG_DIR}; nohup hermes gateway > ${NEX_LOG_FILE} 2>&1 & echo $! > ${NEX_PID_FILE}; sleep 1; cat ${NEX_PID_FILE}`,
      30000
    )
    const out = await this.run(vpsId, `cat ${NEX_PID_FILE} 2>/dev/null || true`)
    const pid = parseInt(out.trim(), 10)
    if (!Number.isFinite(pid)) return null
    // `$!` existe mesmo quando o nohup falha na hora (ex.: binário fora do PATH) —
    // confirmar que o processo sobreviveu antes de reportar 'running'.
    const check = await this.run(
      vpsId,
      `sleep 2; kill -0 ${pid} 2>/dev/null && echo alive || { echo dead; tail -5 ${NEX_LOG_FILE} 2>/dev/null; }`
    )
    if (!check.trim().startsWith('alive')) {
      throw new Error(`hermes gateway encerrou logo após iniciar: ${check.replace(/^dead\s*/, '').trim() || 'sem log'}`)
    }
    return pid
  }

  async stopGateway(vpsId: string, pid: number | null): Promise<void> {
    // Primeiro pelo serviço — senão o systemd religa o gateway logo depois do kill.
    await this.run(vpsId, 'hermes gateway stop >/dev/null 2>&1 || true', 30000)
    if (pid) {
      await this.run(vpsId, `kill ${pid} 2>/dev/null || true`)
    }
    await this.run(vpsId, 'pkill -f "hermes.*[g]ateway( run)?$|[g]ateway run$" 2>/dev/null || true')
    await this.run(vpsId, `rm -f ${NEX_PID_FILE}`)
  }

  /**
   * PIDs de execuções `hermes chat --query-file` cujo diretório atual é `workspace` — olhando a
   * VPS, não a memória do app. Pega também execuções órfãs: fechar o NEX derruba o canal SSH,
   * mas o Hermes (sem pty, não recebe SIGHUP) segue rodando sob o systemd e segurando a sessão.
   * `[q]uery-file` evita casar com a própria linha deste comando.
   */
  async findRunsInWorkspace(vpsId: string, workspace: string): Promise<number[]> {
    const ws = workspace.replace(/\/+$/, '')
    const out = await this.run(
      vpsId,
      `for p in $(pgrep -f "[q]uery-file"); do [ "$(readlink /proc/$p/cwd 2>/dev/null)" = "${ws}" ] && echo $p; done; true`
    )
    return out.split('\n').map(l => parseInt(l.trim(), 10)).filter(Number.isFinite)
  }

  /** Encerra as execuções do Hermes no workspace e toda a árvore de processos (inclui `claude -p`). */
  async killRunsInWorkspace(vpsId: string, workspace: string): Promise<number> {
    const pids = await this.findRunsInWorkspace(vpsId, workspace)
    if (pids.length === 0) return 0
    await this.run(
      vpsId,
      `desc() { for c in $(pgrep -P $1); do desc $c; echo $c; done; }; for r in ${pids.join(' ')}; do kill -TERM $(desc $r) $r 2>/dev/null; done; sleep 2; true`
    )
    return pids.length
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
   * Envia um objetivo ao Hermes via `hermes chat --query-file` (one-shot em non-TTY).
   * O objetivo é escrito num arquivo remoto via SFTP e lido pelo próprio Hermes
   * (`--query-file`, v0.22+), que não passa o conteúdo por nenhum shell — nada do
   * texto do usuário entra na string do comando SSH.
   *
   * Antes usava `-q ${resumeFlag} "$(cat …)"`: com resume, o argparse pegava
   * `--resume` como valor de `-q` e falhava ("expected one argument") — toda
   * mensagem a partir da segunda num projeto quebrava.
   */
  async streamObjective(
    vpsId: string,
    opts: { workspace: string; objective: string; resume: boolean }
  ): Promise<HermesEventStream> {
    // Mesmo round-trip: $HOME, cria o diretório e detecta o Claude Code CLI na VPS.
    const probe = (await this.run(
      vpsId, `echo $HOME; mkdir -p "$HOME/.hermes-nex"; command -v claude >/dev/null 2>&1 && echo ${HAS_CLAUDE_MARK}`
    )).split('\n').map(l => l.trim())
    const home = probe[0] || '~'
    const hasClaude = probe.includes(HAS_CLAUDE_MARK)
    const remoteDir = `${home}/.hermes-nex`
    const remoteFile = `${remoteDir}/objective_${crypto.randomUUID()}.txt`

    const session = await this.sftp.openSession(vpsId)
    try {
      await session.writeFile(remoteFile, hasClaude ? `${opts.objective}\n\n${CLAUDE_DELEGATION_NOTE}` : opts.objective)
    } finally {
      session.destroy()
    }

    const resumeFlag = opts.resume ? `--resume latest --in "${opts.workspace}"` : ''
    const skillFlag = hasClaude ? '-s claude-code' : ''
    const cmd = [
      PATH_PREFIX,
      `cd "${opts.workspace}" &&`,
      `hermes chat -Q --format stream-json ${skillFlag} --query-file "${remoteFile}" ${resumeFlag} </dev/null;`,
      `rm -f "${remoteFile}"`,
    ].join(' ')

    return new HermesEventStream(await this.terminal.execStream(vpsId, cmd))
  }

  /**
   * Executa um comando que o Hermes teve bloqueado (dangerous em modo headless) e que o
   * usuário autorizou explicitamente na UI. Roda no workspace do projeto. O comando vem do
   * próprio Hermes, não de input livre — e só chega aqui após clique em "Autorizar".
   */
  async runApprovedCommand(vpsId: string, workspace: string, command: string): Promise<string> {
    return this.run(vpsId, `cd "${workspace}" && { ${command}\n} 2>&1; echo "[exit $?]"`, 120000)
  }
}
