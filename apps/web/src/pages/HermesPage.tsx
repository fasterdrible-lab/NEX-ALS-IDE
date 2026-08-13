import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Bot, X, RefreshCw, Download, ArrowUpCircle, Play, Square, RotateCw,
  Send, Loader2, Terminal as TerminalIcon, Sparkles, History,
} from 'lucide-react'
import { ipc, type HermesInstanceInfo, type HermesStatus, type HermesSkillInfo } from '../lib/ipc'

const STATUS_LABEL: Record<HermesStatus, string> = {
  unknown: 'Desconhecido',
  not_installed: 'Não instalado',
  installed: 'Instalado (parado)',
  running: 'Rodando',
  stopped: 'Parado',
  error: 'Erro',
}

const STATUS_COLOR: Record<HermesStatus, string> = {
  unknown: 'text-slate-400 bg-slate-800',
  not_installed: 'text-amber-400 bg-amber-950/40',
  installed: 'text-sky-400 bg-sky-950/40',
  running: 'text-emerald-400 bg-emerald-950/40',
  stopped: 'text-slate-400 bg-slate-800',
  error: 'text-red-400 bg-red-950/40',
}

type BusyAction = 'status' | 'install' | 'update' | 'start' | 'stop' | 'restart' | 'exec' | 'logs' | null

export default function HermesPage() {
  const { vpsId = '', vpsName: encodedName = '' } = useParams()
  const vpsName = decodeURIComponent(encodedName)
  const navigate = useNavigate()

  const [info, setInfo] = useState<HermesInstanceInfo | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [output, setOutput] = useState('(nenhuma saída ainda)')
  const [cmdInput, setCmdInput] = useState('')
  const outputRef = useRef<HTMLPreElement>(null)

  // FASE 5 — abas Skills/Sessões (só leitura)
  const [rightView, setRightView] = useState<'console' | 'skills' | 'sessions'>('console')
  const [skills, setSkills] = useState<HermesSkillInfo[]>([])
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [sessionsOutput, setSessionsOutput] = useState('')
  const [loadingSessions, setLoadingSessions] = useState(false)

  const scrollOutput = () => setTimeout(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, 60)

  const refreshStatus = useCallback(async () => {
    setBusy('status')
    try {
      const result = await ipc.hermes.status(vpsId)
      setInfo(result)
    } catch (e) {
      setOutput(`Erro ao consultar status: ${String(e)}`)
    }
    setBusy(null)
  }, [vpsId])

  useEffect(() => { void refreshStatus() }, [refreshStatus])

  const run = useCallback(async (
    action: Exclude<BusyAction, null | 'status'>,
    fn: () => Promise<{ success: boolean; output: string }>
  ) => {
    setBusy(action)
    try {
      const result = await fn()
      setOutput(result.output || '(sem saída)')
      scrollOutput()
    } catch (e) {
      setOutput(`Erro: ${String(e)}`)
    }
    await refreshStatus()
    setBusy(null)
  }, [refreshStatus])

  const handleExec = useCallback(async () => {
    if (!cmdInput.trim()) return
    const args = cmdInput.trim()
    setBusy('exec')
    try {
      const result = await ipc.hermes.exec(vpsId, args)
      setOutput(prev => `${prev}\n\n$ hermes ${args}\n${result.output || '(sem saída)'}`)
      scrollOutput()
    } catch (e) {
      setOutput(prev => `${prev}\n\nErro: ${String(e)}`)
    }
    setBusy(null)
  }, [vpsId, cmdInput])

  const loadSkills = useCallback(async () => {
    setLoadingSkills(true)
    try { setSkills(await ipc.hermes.skills.list(vpsId)) } catch { setSkills([]) }
    setLoadingSkills(false)
  }, [vpsId])

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const result = await ipc.hermes.sessions.summary(vpsId)
      setSessionsOutput(result.output || '(sem saída)')
    } catch (e) { setSessionsOutput(`Erro: ${String(e)}`) }
    setLoadingSessions(false)
  }, [vpsId])

  useEffect(() => {
    if (rightView === 'skills' && skills.length === 0 && !loadingSkills) void loadSkills()
    if (rightView === 'sessions' && !sessionsOutput && !loadingSessions) void loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightView])

  const status = info?.status ?? 'unknown'
  const busyAny = busy !== null

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0D0A24] border-b border-purple-900/40 shrink-0">
        <div className="flex items-center gap-3">
          <Bot size={16} className="text-purple-400" />
          <span className="text-sm font-bold text-purple-300 tracking-wide">HERMES</span>
          <span className="text-slate-500 text-sm">—</span>
          <span className="text-slate-200 text-sm font-medium">{vpsName}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshStatus()}
            disabled={busyAny}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 disabled:opacity-40"
            title="Atualizar status"
          >
            {busy === 'status' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100" title="Fechar">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ═══ CORPO ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Painel esquerdo — status + ações */}
        <div className="w-72 shrink-0 border-r border-slate-800/60 p-4 space-y-4 overflow-y-auto">
          <div className="card space-y-1.5 text-xs">
            <p className="text-slate-500">Versão</p>
            <p className="text-slate-200 font-mono">{info?.version || '—'}</p>
            <p className="text-slate-500 pt-1">Caminho instalado</p>
            <p className="text-slate-200 font-mono break-all">{info?.installPath || '—'}</p>
            <p className="text-slate-500 pt-1">PID</p>
            <p className="text-slate-200 font-mono">{info?.pid ?? '—'}</p>
            <p className="text-slate-500 pt-1">Última verificação</p>
            <p className="text-slate-200">{info?.lastSeen ? new Date(info.lastSeen).toLocaleString() : '—'}</p>
            {info?.lastError && (
              <p className="text-red-400 pt-1 break-words">{info.lastError}</p>
            )}
          </div>

          <div className="space-y-2">
            <button
              onClick={() => void run('install', () => ipc.hermes.install(vpsId))}
              disabled={busyAny}
              className="btn-primary w-full text-xs py-1.5 justify-center"
            >
              {busy === 'install' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Instalar
            </button>
            <button
              onClick={() => void run('update', () => ipc.hermes.update(vpsId))}
              disabled={busyAny || status === 'not_installed'}
              className="btn-secondary w-full text-xs py-1.5 justify-center"
            >
              {busy === 'update' ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpCircle size={13} />} Atualizar
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => void run('start', () => ipc.hermes.start(vpsId))}
                disabled={busyAny || status === 'not_installed' || status === 'running'}
                className="btn-secondary flex-1 text-xs py-1.5 justify-center text-emerald-400 hover:text-emerald-300 border-emerald-800/40"
              >
                {busy === 'start' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Iniciar
              </button>
              <button
                onClick={() => void run('stop', () => ipc.hermes.stop(vpsId))}
                disabled={busyAny || status !== 'running'}
                className="btn-secondary flex-1 text-xs py-1.5 justify-center text-red-400 hover:text-red-300 border-red-800/40"
              >
                {busy === 'stop' ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />} Parar
              </button>
            </div>
            <button
              onClick={() => void run('restart', () => ipc.hermes.restart(vpsId))}
              disabled={busyAny || status === 'not_installed'}
              className="btn-secondary w-full text-xs py-1.5 justify-center"
            >
              {busy === 'restart' ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />} Reiniciar
            </button>
            <button
              onClick={() => void run('logs', () => ipc.hermes.logs(vpsId, 300))}
              disabled={busyAny || status === 'not_installed'}
              className="btn-secondary w-full text-xs py-1.5 justify-center"
            >
              {busy === 'logs' ? <Loader2 size={13} className="animate-spin" /> : <TerminalIcon size={13} />} Ver logs
            </button>
          </div>
        </div>

        {/* Painel direito — Console/Skills/Sessões */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-3 pt-2 border-b border-slate-800/60 shrink-0">
            {([
              ['console', 'Console', TerminalIcon],
              ['skills', 'Skills', Sparkles],
              ['sessions', 'Sessões', History],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setRightView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors ${rightView === key ? 'bg-slate-900 text-purple-300 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {rightView === 'console' && (
            <>
              <pre
                ref={outputRef}
                className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-slate-300 bg-slate-950"
              >
                {output}
              </pre>
              <div className="border-t border-slate-800 px-3 py-2 flex gap-2 shrink-0">
                <span className="text-slate-500 text-xs font-mono self-center">hermes</span>
                <input
                  value={cmdInput}
                  onChange={e => setCmdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void handleExec()}
                  placeholder="setup | model | tools | config get provider …"
                  disabled={busyAny || status === 'not_installed'}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                <button
                  onClick={() => void handleExec()}
                  disabled={busyAny || status === 'not_installed' || !cmdInput.trim()}
                  className="p-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-30 rounded"
                  title="Executar comando hermes"
                >
                  {busy === 'exec' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
            </>
          )}

          {rightView === 'skills' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  Skills instaladas ({skills.length}) — só leitura
                </p>
                <button
                  onClick={() => void loadSkills()}
                  disabled={loadingSkills}
                  className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1"
                >
                  {loadingSkills ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Atualizar
                </button>
              </div>
              {skills.length === 0 && !loadingSkills && (
                <p className="text-xs text-slate-600">Nenhuma skill encontrada (ou Hermes não instalado nesta VPS).</p>
              )}
              {skills.map(s => (
                <div key={s.path} className="bg-slate-800/60 border border-slate-700/60 rounded px-3 py-2 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-200">{s.name}</span>
                    <span className="text-[9px] text-slate-500 font-mono shrink-0">v{s.version}</span>
                  </div>
                  {s.description && <p className="text-[11px] text-slate-400">{s.description}</p>}
                  <p className="text-[9px] text-slate-600 font-mono truncate">{s.path}</p>
                </div>
              ))}
            </div>
          )}

          {rightView === 'sessions' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Sessões (hermes sessions)</p>
                <button
                  onClick={() => void loadSessions()}
                  disabled={loadingSessions}
                  className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1"
                >
                  {loadingSessions ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Atualizar
                </button>
              </div>
              <pre className="flex-1 overflow-auto px-4 pb-4 text-xs font-mono whitespace-pre-wrap text-slate-300">
                {sessionsOutput || '(carregando…)'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
