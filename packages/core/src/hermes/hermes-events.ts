import { EventEmitter } from 'node:events'
import type { ExecStream } from '../terminal/terminal.service.js'

/**
 * Eventos estruturados do `hermes chat --format stream-json` (Hermes v0.22+), já
 * reduzidos ao que o NEX usa. Formato real do JSONL documentado em
 * docs/HERMES_INTEGRATION.md → "Fato real — teste contra VPS real".
 */
export type HermesEvent =
  | { kind: 'init'; model: string; sessionId: string }
  | { kind: 'tool_use'; tool: string; summary: string }
  | { kind: 'tool_result'; tool: string; ok: boolean; summary: string }
  | { kind: 'blocked'; tool: string; command: string; reason: string }
  | { kind: 'result'; ok: boolean; error: string; sessionId: string; durationMs: number; totalTokens: number }

const BLOCKED_REASON_RE = /flagged as dangerous \(([^)]+)\)/

function short(s: string, max = 160): string {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function summarizeInput(tool: string, input: Record<string, unknown>): string {
  if (typeof input['command'] === 'string') return short(input['command'])
  if (typeof input['path'] === 'string') return short(input['path'])
  if (typeof input['code'] === 'string') return short(input['code'])
  return short(`${tool} ${JSON.stringify(input)}`)
}

/**
 * Embrulha o ExecStream de um `hermes chat --format stream-json` mantendo o contrato antigo
 * ('data' com texto puro, 'close', 'error', kill()) — o loop autônomo, o cron e a execução
 * paralela continuam lendo só o texto (tags [TAREFA_CONCLUIDA] etc.) — e adiciona 'event'
 * com HermesEvent. Linhas que não são JSON são ignoradas (ex.: trailer `session_id: …`).
 */
export class HermesEventStream extends EventEmitter {
  private buf = ''
  /** tool_use pendente por nome de tool, para recuperar o comando de um tool_result BLOCKED. */
  private lastInput = new Map<string, Record<string, unknown>>()
  private resultSeen: Extract<HermesEvent, { kind: 'result' }> | null = null
  /** Últimas linhas que não são JSON — quando o Hermes aborta antes de emitir `result`
   *  (ex.: "Refused active session … already held"), o motivo só aparece aqui. */
  private strayLines: string[] = []

  constructor(private readonly inner: ExecStream) {
    super()
    inner.on('data', (chunk: string) => this.push(chunk))
    inner.on('close', (code: number | null) => {
      this.flushLine(this.buf)
      this.buf = ''
      this.emit('close', code)
    })
    inner.on('error', (err: Error) => this.emit('error', err))
  }

  /** Último evento `result` recebido (null se o Hermes morreu antes de emitir). */
  get result(): Extract<HermesEvent, { kind: 'result' }> | null {
    return this.resultSeen
  }

  /** Saída não-JSON recente (até 5 linhas), para compor a mensagem de erro sem `result`. */
  get strayOutput(): string {
    return this.strayLines.join(' · ')
  }

  kill(): void {
    this.inner.kill()
  }

  private push(chunk: string): void {
    this.buf += chunk
    let nl: number
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl)
      this.buf = this.buf.slice(nl + 1)
      this.flushLine(line)
    }
  }

  private flushLine(raw: string): void {
    const line = raw.trim()
    if (!line.startsWith('{')) {
      if (line && !/^session_id:/i.test(line)) this.strayLines = [...this.strayLines.slice(-4), short(line, 240)]
      return
    }
    let ev: Record<string, unknown>
    try { ev = JSON.parse(line) as Record<string, unknown> } catch { return }

    const type = ev['type']
    if (type === 'text' && typeof ev['text'] === 'string') {
      this.emit('data', ev['text'])
      return
    }
    if (type === 'system' && ev['subtype'] === 'init') {
      this.emitEvent({ kind: 'init', model: String(ev['model'] ?? ''), sessionId: String(ev['session_id'] ?? '') })
      return
    }
    if (type === 'tool_use') {
      const tool = String(ev['name'] ?? '')
      const input = (ev['input'] && typeof ev['input'] === 'object' ? ev['input'] : {}) as Record<string, unknown>
      this.lastInput.set(tool, input)
      this.emitEvent({ kind: 'tool_use', tool, summary: summarizeInput(tool, input) })
      return
    }
    if (type === 'tool_result') {
      const tool = String(ev['name'] ?? '')
      let out: Record<string, unknown> = {}
      try {
        const parsed = typeof ev['output'] === 'string' ? JSON.parse(ev['output']) : ev['output']
        if (parsed && typeof parsed === 'object') out = parsed as Record<string, unknown>
      } catch { /* output não-JSON */ }
      const error = typeof out['error'] === 'string' ? out['error'] : ''
      if (error.startsWith('BLOCKED')) {
        const input = this.lastInput.get(tool) ?? {}
        const command = typeof input['command'] === 'string' ? input['command']
          : typeof input['code'] === 'string' ? input['code'] : ''
        const reason = BLOCKED_REASON_RE.exec(error)?.[1] ?? (tool === 'execute_code' ? 'código Python arbitrário' : 'ação perigosa')
        this.emitEvent({ kind: 'blocked', tool, command, reason })
        return
      }
      const ok = !error && out['status'] !== 'error' && (typeof out['exit_code'] !== 'number' || out['exit_code'] === 0)
      this.emitEvent({ kind: 'tool_result', tool, ok, summary: short(error || String(out['output'] ?? '')) })
      return
    }
    if (type === 'result') {
      const tokens = (ev['tokens'] ?? {}) as Record<string, unknown>
      const r: Extract<HermesEvent, { kind: 'result' }> = {
        kind: 'result',
        ok: ev['exit_code'] === 0,
        error: typeof ev['error'] === 'string' ? ev['error'] : '',
        sessionId: String(ev['session_id'] ?? ''),
        durationMs: Number(ev['duration_ms'] ?? 0),
        totalTokens: Number(tokens['total'] ?? 0),
      }
      this.resultSeen = r
      this.emitEvent(r)
    }
  }

  private emitEvent(e: HermesEvent): void {
    this.emit('event', e)
  }
}
