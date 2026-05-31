import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { ArrowLeft, Loader2, WifiOff, TerminalSquare } from 'lucide-react'
import { ipc } from '../lib/ipc'

type Status = 'connecting' | 'connected' | 'error' | 'closed'

export default function TerminalPage() {
  const { vpsId } = useParams<{ vpsId: string }>()
  const { vpsName } = useParams<{ vpsName: string }>()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<string | null>(null)

  const [status, setStatus] = useState<Status>('connecting')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!containerRef.current || !vpsId) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
      letterSpacing: 0,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#7c3aed',
        cursorAccent: '#0d1117',
        selectionBackground: '#3d3d7a60',
        black:   '#484f58', red:     '#ff7b72', green:   '#3fb950',
        yellow:  '#d29922', blue:    '#58a6ff', magenta: '#bc8cff',
        cyan:    '#39c5cf', white:   '#b1bac4',
        brightBlack:   '#6e7681', brightRed:     '#ffa198',
        brightGreen:   '#56d364', brightYellow:  '#e3b341',
        brightBlue:    '#79c0ff', brightMagenta: '#d2a8ff',
        brightCyan:    '#56d4dd', brightWhite:   '#f0f6fc',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    termRef.current = term
    fitRef.current = fitAddon

    term.write('\x1b[90mConectando à VPS...\x1b[0m\r\n')

    let unsubData: (() => void) | null = null
    let unsubExit: (() => void) | null = null
    let resizeObserver: ResizeObserver | null = null

    ipc.terminal.open(vpsId).then(result => {
      if (!result.success || !result.sessionId) {
        term.write(`\r\n\x1b[31m✗ ${result.error ?? 'Falha ao conectar'}\x1b[0m\r\n`)
        setStatus('error')
        setErrorMsg(result.error ?? 'Falha ao conectar')
        return
      }

      sessionRef.current = result.sessionId
      setStatus('connected')

      fitAddon.fit()
      ipc.terminal.resize(result.sessionId, term.cols, term.rows)

      // recebe dados do SSH → escreve no terminal
      unsubData = window.electron.on('terminal:data', (payload: unknown) => {
        const p = payload as { sessionId: string; data: string }
        if (p.sessionId === result.sessionId) term.write(p.data)
      })

      // SSH fechou
      unsubExit = window.electron.on('terminal:exit', (payload: unknown) => {
        const p = payload as { sessionId: string }
        if (p.sessionId === result.sessionId) {
          term.write('\r\n\x1b[90m─── Sessão encerrada ───\x1b[0m\r\n')
          setStatus('closed')
        }
      })

      // input do usuário → envia para SSH
      term.onData(data => {
        if (sessionRef.current) ipc.terminal.input(result.sessionId, data)
      })

      // auto-resize
      resizeObserver = new ResizeObserver(() => {
        fitAddon.fit()
        if (sessionRef.current) ipc.terminal.resize(result.sessionId, term.cols, term.rows)
      })
      resizeObserver.observe(containerRef.current!)
    })

    return () => {
      unsubData?.()
      unsubExit?.()
      resizeObserver?.disconnect()
      if (sessionRef.current) {
        ipc.terminal.close(sessionRef.current)
        sessionRef.current = null
      }
      term.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vpsId])

  const statusColor = {
    connecting: 'text-slate-400',
    connected: 'text-emerald-400',
    error: 'text-red-400',
    closed: 'text-slate-500',
  }[status]

  const statusLabel = {
    connecting: 'Conectando…',
    connected: 'Conectado',
    error: 'Erro',
    closed: 'Desconectado',
  }[status]

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">

      {/* Barra superior */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className="w-px h-4 bg-slate-700" />

        <div className="flex items-center gap-2 flex-1">
          <TerminalSquare size={14} className="text-brand-400" />
          <span className="text-sm text-slate-100 font-medium">
            Terminal SSH{vpsName ? ` — ${decodeURIComponent(vpsName)}` : ''}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 text-xs ${statusColor}`}>
          {status === 'connecting' && <Loader2 size={11} className="animate-spin" />}
          {status === 'error' && <WifiOff size={11} />}
          {statusLabel}
        </div>
      </div>

      {/* Área do terminal */}
      <div className="flex-1 overflow-hidden p-2">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Banner de erro */}
      {status === 'error' && (
        <div className="shrink-0 px-4 py-3 bg-red-900/20 border-t border-red-800/30 text-red-300 text-xs flex items-center gap-2">
          <WifiOff size={13} />
          {errorMsg}
          <button
            className="ml-auto text-red-400 hover:text-red-200 underline"
            onClick={() => navigate(-1)}
          >
            Voltar e verificar a VPS
          </button>
        </div>
      )}
    </div>
  )
}
