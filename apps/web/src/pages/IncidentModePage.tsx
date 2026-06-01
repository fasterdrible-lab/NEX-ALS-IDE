import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  X, AlertTriangle, Loader2, RefreshCw, Send,
  Terminal, Box, Cpu, Activity,
} from 'lucide-react'
import { ipc } from '../lib/ipc'

interface VpsStats { cpu: number; ram: number; disk: number; uptime: string }
interface DockerContainer { id: string; name: string; image: string; status: string; state: string }
interface Pm2Process { id: number; name: string; status: string; cpu: number; memory: number; restarts: number }
interface ChatMsg { role: 'user' | 'assistant'; text: string }

export default function IncidentModePage() {
  const { vpsId = '', vpsName: encodedName = '' } = useParams()
  const vpsName = decodeURIComponent(encodedName)
  const navigate = useNavigate()

  // ── Estado de cada painel ─────────────────────────────────────────────────
  const [stats, setStats]           = useState<VpsStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [docker, setDocker]         = useState<DockerContainer[]>([])
  const [dockerLoading, setDockerLoading] = useState(true)
  const [pm2, setPm2]               = useState<Pm2Process[]>([])
  const [pm2Loading, setPm2Loading] = useState(true)
  const [logs, setLogs]             = useState('')
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsCmd, setLogsCmd]       = useState('journalctl -n 100 --no-pager 2>/dev/null || tail -n 100 /var/log/syslog 2>/dev/null')
  const [termOutput, setTermOutput] = useState('')
  const [termInput, setTermInput]   = useState('')
  const [termRunning, setTermRunning] = useState(false)

  // ── Chat IA ────────────────────────────────────────────────────────────────
  const [chatMsgs, setChatMsgs]     = useState<ChatMsg[]>([])
  const [chatInput, setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const logsRef = useRef<HTMLPreElement>(null)
  const termEndRef = useRef<HTMLDivElement>(null)

  const scrollChat = () => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  const scrollLogs = () => setTimeout(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight }, 80)
  const scrollTerm = () => setTimeout(() => termEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)

  // ── Carrega dados de todos os painéis ─────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const r = await ipc.monitor.getStats(vpsId)
      if (r.success && r.stats) {
        const s = r.stats as { cpu?: number; ram?: number; disk?: number; uptime?: string }
        setStats({ cpu: s.cpu ?? 0, ram: s.ram ?? 0, disk: s.disk ?? 0, uptime: s.uptime ?? '—' })
      }
    } catch { /* silencioso */ }
    setStatsLoading(false)
  }, [vpsId])

  const loadDocker = useCallback(async () => {
    setDockerLoading(true)
    try {
      const r = await ipc.docker.list(vpsId)
      if (r.success) setDocker(r.containers)
    } catch { /* silencioso */ }
    setDockerLoading(false)
  }, [vpsId])

  const loadPm2 = useCallback(async () => {
    setPm2Loading(true)
    try {
      const r = await ipc.pm2.list(vpsId)
      if (r.success) setPm2(r.processes)
    } catch { /* silencioso */ }
    setPm2Loading(false)
  }, [vpsId])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const r = await ipc.terminal.exec(vpsId, logsCmd, 20000)
      setLogs(r.success ? (r.output || '(sem output)') : `Erro: ${r.error}`)
      scrollLogs()
    } catch (e) { setLogs(`Erro: ${String(e)}`) }
    setLogsLoading(false)
  }, [vpsId, logsCmd])

  const loadAll = useCallback(() => {
    loadStats(); loadDocker(); loadPm2(); loadLogs()
  }, [loadStats, loadDocker, loadPm2, loadLogs])

  useEffect(() => { loadAll() }, [loadAll])

  // Auto-refresh 30s
  useEffect(() => {
    const t = setInterval(() => { loadStats(); loadDocker(); loadPm2() }, 30000)
    return () => clearInterval(t)
  }, [loadStats, loadDocker, loadPm2])

  // ── Diagnóstico automático ao abrir ────────────────────────────────────────
  useEffect(() => {
    if (diagnosing) return
    // Aguarda dados iniciais carregarem (1.5s)
    const t = setTimeout(async () => {
      setDiagnosing(true)
      setChatLoading(true)
      setStreamContent('')

      const contextParts = [
        `VPS: ${vpsName}`,
        stats ? `CPU: ${stats.cpu}% | RAM: ${stats.ram}% | Disco: ${stats.disk}% | Uptime: ${stats.uptime}` : '',
        docker.length ? `Docker: ${docker.map(d => `${d.name} [${d.state}]`).join(', ')}` : 'Docker: sem dados',
        pm2.length ? `PM2: ${pm2.map(p => `${p.name} [${p.status}] restarts:${p.restarts}`).join(', ')}` : 'PM2: sem dados',
        logs ? `Logs recentes:\n${logs.slice(-3000)}` : '',
      ].filter(Boolean).join('\n\n')

      try {
        const res = await ipc.ai.stream.start({
          messages: [{
            role: 'user',
            content: `Analise o estado atual da VPS abaixo e informe:\n1. STATUS: OK / DEGRADADO / CRÍTICO\n2. Problemas identificados (se houver)\n3. Ação imediata recomendada\n\n${contextParts}`,
          }],
          maxTokens: 2048,
        })
        setActiveStreamId(res.streamId)
      } catch (e) {
        setChatLoading(false)
        setChatMsgs([{ role: 'assistant', text: `❌ Não foi possível conectar ao provedor de IA: ${String(e)}` }])
      }
    }, 1500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // executa apenas uma vez ao montar

  // ── Listener de streaming ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = ipc.ai.stream.onChunk((chunk) => {
      if (chunk.type === 'text_delta' && chunk.delta) {
        setStreamContent(s => s + chunk.delta!)
      }
      if (chunk.type === 'done' || chunk.type === 'error') {
        setActiveStreamId(null)
        setChatLoading(false)
        if (chunk.type === 'done') {
          setStreamContent(prev => {
            if (prev) setChatMsgs(m => [...m, { role: 'assistant', text: prev }])
            return ''
          })
        }
        scrollChat()
      }
    })
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [])

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMsgs(m => [...m, { role: 'user', text: msg }])
    scrollChat()
    setChatLoading(true)
    setStreamContent('')

    try {
      const history = chatMsgs.map(m => ({ role: m.role, content: m.text }))
      const res = await ipc.ai.stream.start({
        messages: [...history, { role: 'user', content: msg }],
        maxTokens: 2048,
      })
      setActiveStreamId(res.streamId)
    } catch (e) {
      setChatLoading(false)
      setChatMsgs(m => [...m, { role: 'assistant', text: `❌ ${String(e)}` }])
    }
  }

  const runTermCmd = async () => {
    if (!termInput.trim() || termRunning) return
    const cmd = termInput.trim()
    setTermInput('')
    setTermOutput(o => `${o}$ ${cmd}\n`)
    setTermRunning(true)
    try {
      const r = await ipc.terminal.exec(vpsId, cmd, 30000)
      setTermOutput(o => `${o}${r.success ? r.output : `Erro: ${r.error}`}\n`)
    } catch (e) { setTermOutput(o => `${o}Erro: ${String(e)}\n`) }
    setTermRunning(false)
    scrollTerm()
  }

  // ── Helpers de cores ──────────────────────────────────────────────────────
  const pct = (v: number) => v >= 85 ? 'text-red-400' : v >= 60 ? 'text-amber-400' : 'text-emerald-400'
  const dockerState = (s: string) => s === 'running' ? 'text-emerald-400' : 'text-red-400'
  const pm2Status = (s: string) => s === 'online' ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-4 py-2 bg-red-950/80 border-b border-red-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 animate-pulse"/>
          <span className="text-sm font-bold text-red-300 tracking-wide">INCIDENT MODE</span>
          <span className="text-slate-400 text-sm">—</span>
          <span className="text-slate-200 text-sm font-medium">{vpsName}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Monitor bar inline */}
          {stats && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className={pct(stats.cpu)}>CPU {stats.cpu}%</span>
              <span className={pct(stats.ram)}>RAM {stats.ram}%</span>
              <span className={pct(stats.disk)}>Disco {stats.disk}%</span>
              <span className="text-slate-500">↑ {stats.uptime}</span>
            </div>
          )}
          <button onClick={loadAll} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-100" title="Atualizar tudo">
            <RefreshCw size={13}/>
          </button>
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-red-900/40 rounded text-red-400 hover:text-red-200" title="Encerrar Incident Mode">
            <X size={14}/>
          </button>
        </div>
      </div>

      {/* ═══ GRID PRINCIPAL ═══ */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-0.5 bg-slate-800/30 overflow-hidden">

        {/* [0,0] Chat IA — top-left */}
        <div className="flex flex-col bg-slate-950 border-r border-b border-slate-800/50 overflow-hidden">
          <PanelHeader icon={<Activity size={11}/>} title="Diagnóstico IA" extra={
            chatLoading && <span className="flex items-center gap-1 text-[9px] text-purple-400"><Loader2 size={8} className="animate-spin"/> analisando…</span>
          }/>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {chatMsgs.length === 0 && !streamContent && !chatLoading && (
              <p className="text-slate-600 text-center pt-4">Aguardando diagnóstico inicial…</p>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 whitespace-pre-wrap ${m.role === 'user' ? 'bg-slate-800 text-slate-300 ml-4' : 'bg-red-950/30 border border-red-800/30 text-slate-200'}`}>
                {m.text}
              </div>
            ))}
            {streamContent && (
              <div className="rounded-lg px-3 py-2 bg-red-950/30 border border-red-800/30 text-slate-200 whitespace-pre-wrap">
                {streamContent}<span className="animate-pulse text-purple-400">▌</span>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>
          <div className="border-t border-slate-800 px-2 py-2 flex gap-1.5 shrink-0">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Pergunte ao diagnóstico…"
              disabled={chatLoading}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
              className="p-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-30 rounded">
              <Send size={11}/>
            </button>
          </div>
        </div>

        {/* [0,1] Logs — top-right */}
        <div className="flex flex-col bg-slate-950 border-b border-slate-800/50 overflow-hidden">
          <PanelHeader icon={<Terminal size={11}/>} title="Logs" extra={
            <div className="flex items-center gap-1">
              <button onClick={loadLogs} className="p-0.5 hover:text-emerald-400" title="Atualizar logs">
                <RefreshCw size={9} className={logsLoading ? 'animate-spin' : ''}/>
              </button>
            </div>
          }/>
          <div className="px-2 py-1 border-b border-slate-800 shrink-0">
            <input
              value={logsCmd}
              onChange={e => setLogsCmd(e.target.value)}
              onBlur={loadLogs}
              className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-400 focus:outline-none focus:border-slate-500 font-mono"
            />
          </div>
          <pre
            ref={logsRef}
            className="flex-1 overflow-y-auto p-2 text-[10px] font-mono text-slate-400 whitespace-pre-wrap"
          >
            {logsLoading ? <span className="text-slate-600">Carregando logs…</span> : logs || '(sem output)'}
          </pre>
        </div>

        {/* [1,0] Docker — bottom-left */}
        <div className="flex flex-col bg-slate-950 border-r border-slate-800/50 overflow-hidden">
          <PanelHeader icon={<Box size={11}/>} title="Docker" extra={
            <button onClick={loadDocker} className="p-0.5 hover:text-emerald-400">
              <RefreshCw size={9} className={dockerLoading ? 'animate-spin' : ''}/>
            </button>
          }/>
          <div className="flex-1 overflow-y-auto">
            {dockerLoading ? (
              <p className="text-[10px] text-slate-600 p-3">Carregando…</p>
            ) : docker.length === 0 ? (
              <p className="text-[10px] text-slate-600 p-3">Sem containers Docker</p>
            ) : (
              <table className="w-full text-[10px]">
                <thead className="bg-slate-900/60">
                  <tr className="text-slate-500">
                    <th className="px-2 py-1 text-left font-normal">Container</th>
                    <th className="px-2 py-1 text-left font-normal">Imagem</th>
                    <th className="px-2 py-1 text-left font-normal">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {docker.map(c => (
                    <tr key={c.id} className="border-t border-slate-800/50 hover:bg-slate-900/30">
                      <td className="px-2 py-1 font-mono text-slate-300">{c.name}</td>
                      <td className="px-2 py-1 text-slate-500 truncate max-w-[120px]">{c.image}</td>
                      <td className={`px-2 py-1 font-semibold ${dockerState(c.state)}`}>{c.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PM2 na metade inferior do mesmo painel */}
          <div className="border-t border-slate-800 flex flex-col" style={{ height: '50%' }}>
            <PanelHeader icon={<Cpu size={11}/>} title="PM2" extra={
              <button onClick={loadPm2} className="p-0.5 hover:text-emerald-400">
                <RefreshCw size={9} className={pm2Loading ? 'animate-spin' : ''}/>
              </button>
            }/>
            <div className="flex-1 overflow-y-auto">
              {pm2Loading ? (
                <p className="text-[10px] text-slate-600 p-3">Carregando…</p>
              ) : pm2.length === 0 ? (
                <p className="text-[10px] text-slate-600 p-3">Sem processos PM2</p>
              ) : (
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-900/60">
                    <tr className="text-slate-500">
                      <th className="px-2 py-1 text-left font-normal">Processo</th>
                      <th className="px-2 py-1 text-left font-normal">Status</th>
                      <th className="px-2 py-1 text-left font-normal">CPU</th>
                      <th className="px-2 py-1 text-left font-normal">RAM</th>
                      <th className="px-2 py-1 text-left font-normal">Restarts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pm2.map(p => (
                      <tr key={p.id} className="border-t border-slate-800/50 hover:bg-slate-900/30">
                        <td className="px-2 py-1 font-mono text-slate-300">{p.name}</td>
                        <td className={`px-2 py-1 font-semibold ${pm2Status(p.status)}`}>{p.status}</td>
                        <td className={`px-2 py-1 ${pct(p.cpu)}`}>{p.cpu}%</td>
                        <td className="px-2 py-1 text-slate-400">{(p.memory / 1024 / 1024).toFixed(0)}MB</td>
                        <td className={`px-2 py-1 ${p.restarts > 5 ? 'text-red-400' : 'text-slate-400'}`}>{p.restarts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* [1,1] Terminal — bottom-right */}
        <div className="flex flex-col bg-slate-950 overflow-hidden">
          <PanelHeader icon={<Terminal size={11}/>} title="Terminal de emergência"/>
          <pre className="flex-1 overflow-y-auto p-2 text-[10px] font-mono text-slate-400 whitespace-pre-wrap bg-slate-900/30">
            {termOutput || <span className="text-slate-700">Terminal pronto. Execute comandos abaixo.\n</span>}
            <div ref={termEndRef}/>
          </pre>
          <div className="border-t border-slate-800 px-2 py-2 flex gap-1.5 shrink-0">
            <span className="text-[10px] text-emerald-600 font-mono self-center shrink-0">$</span>
            <input
              value={termInput}
              onChange={e => setTermInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runTermCmd()}
              placeholder="comando…"
              disabled={termRunning}
              className="flex-1 bg-transparent text-[10px] font-mono text-slate-200 placeholder-slate-700 focus:outline-none disabled:opacity-50"
            />
            {termRunning && <Loader2 size={10} className="animate-spin text-slate-500 self-center shrink-0"/>}
          </div>
        </div>
      </div>
    </div>
  )
}

function PanelHeader({ icon, title, extra }: { icon?: React.ReactNode; title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800/50 bg-slate-900/40 shrink-0">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
        {icon}{title}
      </div>
      {extra && <div className="flex items-center gap-1 text-slate-500">{extra}</div>}
    </div>
  )
}
