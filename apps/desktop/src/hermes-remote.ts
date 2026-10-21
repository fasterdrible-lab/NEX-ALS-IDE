import fs from 'node:fs'
import path from 'node:path'

/**
 * Projetos cujo Hermes roda no serviço zeus-hermes da VPS (Passo 2 do Zeus Mobile). O main repassa
 * ao serviço tudo o que o painel Agent pede desses projetos e retransmite os eventos ao vivo (SSE)
 * para as janelas — o painel não sabe se o loop é local ou remoto.
 *
 * Config em <userData>/zeus-hermes/: `token` (gerado pelo scripts/deploy-zeus-hermes.mjs) e
 * `config.json` = { url, projectIds } (gravado pelo scripts/migrate-to-zeus-hermes.mjs). Só os
 * projetos migrados vão para o serviço; os outros continuam com o loop no PC.
 */

interface RemoteConfig { url: string; projectIds: string[] }

export class HermesRemote {
  private config: RemoteConfig | null = null
  private token = ''
  private sseAbort: AbortController | null = null
  private stopped = false

  constructor(private readonly dir: string, private readonly onEvent: (e: Record<string, unknown>) => void) {
    this.load()
  }

  private load(): void {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(this.dir, 'config.json'), 'utf8')) as Partial<RemoteConfig>
      const token = fs.readFileSync(path.join(this.dir, 'token'), 'utf8').trim()
      if (typeof c.url === 'string' && /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(c.url) && Array.isArray(c.projectIds) && token) {
        this.config = { url: c.url, projectIds: c.projectIds.filter((p): p is string => typeof p === 'string') }
        this.token = token
      }
    } catch { this.config = null }
  }

  get enabled(): boolean { return this.config !== null }

  isRemote(projectId: unknown): boolean {
    return typeof projectId === 'string' && !!this.config?.projectIds.includes(projectId)
  }

  async call<T = unknown>(method: 'GET' | 'POST', p: string, body?: unknown): Promise<T> {
    if (!this.config) throw new Error('Serviço do Hermes na VPS não configurado.')
    let res: Response
    try {
      res = await fetch(`${this.config.url}${p}`, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      })
    } catch (e) {
      throw new Error(`Sem conexão com o serviço do Hermes na VPS (Tailscale ligado?): ${e instanceof Error ? e.message : String(e)}`)
    }
    const data = await res.json().catch(() => null) as { error?: string } | null
    if (!res.ok) throw new Error(data?.error ?? `Serviço do Hermes respondeu ${res.status}`)
    return data as T
  }

  /** Eventos ao vivo do serviço (todas as janelas). Reconecta sozinho se cair. */
  start(): void {
    if (!this.config || this.sseAbort) return
    const loop = async () => {
      let wait = 2_000
      while (!this.stopped && this.config) {
        this.sseAbort = new AbortController()
        try {
          const res = await fetch(`${this.config.url}/api/events`, {
            headers: { Authorization: `Bearer ${this.token}` }, signal: this.sseAbort.signal,
          })
          if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)
          wait = 2_000
          const reader = res.body.getReader()
          const dec = new TextDecoder()
          let buf = ''
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            buf += dec.decode(value, { stream: true })
            let i: number
            while ((i = buf.indexOf('\n\n')) >= 0) {
              const block = buf.slice(0, i); buf = buf.slice(i + 2)
              const line = block.split('\n').find(l => l.startsWith('data: '))
              if (!line) continue
              try { this.onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>) } catch { /* evento malformado */ }
            }
          }
        } catch (e) {
          if (this.stopped) return
          console.error('[hermes-remote] eventos caíram, reconectando:', e instanceof Error ? e.message : e)
        }
        await new Promise(r => setTimeout(r, wait))
        wait = Math.min(wait * 2, 30_000)
      }
    }
    void loop()
  }

  stop(): void { this.stopped = true; this.sseAbort?.abort() }
}
