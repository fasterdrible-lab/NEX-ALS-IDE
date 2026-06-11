import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, X, Loader2, Users, Bot, Zap, Play, CheckCircle, AlertCircle, Server, FolderOpen, ChevronDown, ChevronUp, FileText, Monitor, Trash2, Eraser, ArrowDown, User2, ExternalLink, RefreshCw } from 'lucide-react'
import { ipc } from '../lib/ipc'

// ── Agent metadata (UI only) ─────────────────────────────────────────────────
const AGENT_NAMES = [
  'jarvis', 'friday', 'fury', 'shuri', 'pepper', 'vision', 'requis', 'tester',
] as const
type AgentName = typeof AGENT_NAMES[number]

const AGENT_META: Record<AgentName, {
  label: string; role: string; provider: string; emoji: string
  colorClass: string; bgClass: string; borderClass: string
}> = {
  jarvis:  { label: 'Jarvis',  role: 'PM / Orquestrador',      provider: 'Claude',  emoji: '🎯', colorClass: 'text-blue-400',   bgClass: 'bg-blue-900/20',   borderClass: 'border-blue-700/40' },
  friday:  { label: 'Friday',  role: 'Engenheira de Software',  provider: 'GPT',    emoji: '👩‍💻', colorClass: 'text-green-400',  bgClass: 'bg-green-900/20',  borderClass: 'border-green-700/40' },
  fury:    { label: 'Fury',    role: 'Pesquisa de Mercado',     provider: 'Gemini', emoji: '🔍', colorClass: 'text-orange-400', bgClass: 'bg-orange-900/20', borderClass: 'border-orange-700/40' },
  shuri:   { label: 'Shuri',   role: 'UX / Design',             provider: 'Claude',  emoji: '🎨', colorClass: 'text-purple-400', bgClass: 'bg-purple-900/20', borderClass: 'border-purple-700/40' },
  pepper:  { label: 'Pepper',  role: 'Marketing / Brand',       provider: 'GPT',    emoji: '📣', colorClass: 'text-pink-400',   bgClass: 'bg-pink-900/20',   borderClass: 'border-pink-700/40' },
  vision:  { label: 'Vision',  role: 'Growth / Métricas',       provider: 'Gemini', emoji: '📊', colorClass: 'text-teal-400',   bgClass: 'bg-teal-900/20',   borderClass: 'border-teal-700/40' },
  requis:  { label: 'Requis',  role: 'Documentação',            provider: 'Claude',  emoji: '📋', colorClass: 'text-yellow-400', bgClass: 'bg-yellow-900/20', borderClass: 'border-yellow-700/40' },
  tester:  { label: 'Tester',  role: 'QA / Testes',             provider: 'GPT',    emoji: '🧪', colorClass: 'text-red-400',    bgClass: 'bg-red-900/20',    borderClass: 'border-red-700/40' },
}

// ── Types ────────────────────────────────────────────────────────────────────
interface ChatBubble {
  id: string
  type: 'user' | 'agent' | 'system'
  agentName?: AgentName
  content: string
  delegatedBy?: AgentName
  isStreaming?: boolean
  actions?: ActionBlock[]
}

interface VpsItem { id: string; name: string; host: string }

interface SessionItem {
  id: string
  title: string
  agentName: string
  createdAt: string
  updatedAt: string
}

interface StreamHandler {
  bubbleId: string
  onDone: () => void
  onError: (msg?: string) => void
}

// ── ACTION tags ──────────────────────────────────────────────────────────────
type ActionType = 'shell' | 'write_file' | 'read_file' | 'read_dir'
interface ActionBlock { id: string; type: ActionType; cwd?: string; path?: string; content: string }
type ActionState = { status: 'idle' | 'running' | 'ok' | 'error'; output?: string }
type PipelineGate = {
  action: ActionBlock
  homologOutput: string
  status: 'pending' | 'approved' | 'deploying' | 'done' | 'rejected' | 'failed'
  prodOutput?: string
}

function parseActions(text: string): ActionBlock[] {
  const blocks: ActionBlock[] = []
  const re = /\[ACTION:(\w+)([^\]]*)\]([\s\S]*?)\[\/ACTION\]/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const type = m[1].toLowerCase() as ActionType
    const params: Record<string, string> = {}
    const pr = /(\w+)="([^"]*)"/g; let pm: RegExpExecArray | null
    while ((pm = pr.exec(m[2])) !== null) params[pm[1]] = pm[2]
    blocks.push({ id: `act-${Math.random().toString(36).slice(2)}`, type, cwd: params['cwd'], path: params['path'], content: m[3].trim() })
  }
  return blocks
}

function stripActions(text: string): string {
  return text.replace(/\[ACTION:[^\]]*\][\s\S]*?\[\/ACTION\]/gi, '').trim()
}

// ── Client-side helpers ──────────────────────────────────────────────────────
function detectDelegations(agentName: AgentName, text: string): AgentName[] {
  const lower = text.toLowerCase()
  return AGENT_NAMES.filter(a => a !== agentName && lower.includes(`@${a}`))
}

function extractTask(text: string, target: AgentName): string {
  const pattern = new RegExp(`@${target}[^.!?\\n]*[.!?\\n]?`, 'i')
  const match = text.match(pattern)
  if (match) {
    const task = match[0].replace(new RegExp(`@${target}[:\\s]*`, 'i'), '').trim()
    return task || text.slice(0, 400)
  }
  return text.slice(0, 400)
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SquadPage() {
  const navigate = useNavigate()

  const [activeAgent, setActiveAgent] = useState<AgentName>('jarvis')
  const [bubbles, setBubbles] = useState<ChatBubble[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [vpsList, setVpsList] = useState<VpsItem[]>([])
  const [selectedVpsId, setSelectedVpsId] = useState<string>('')
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({})
  const [pipelineMode, setPipelineMode] = useState(false)
  const [prodVpsId, setProdVpsId] = useState<string>('')
  const [pipelineGates, setPipelineGates] = useState<Record<string, PipelineGate>>({})
  // Project context + local execution
  const [projectContext, setProjectContext] = useState('')
  const [contextOpen, setContextOpen] = useState(false)
  const [executionMode, setExecutionMode] = useState<'vps' | 'local'>('vps')
  const [localPath, setLocalPath] = useState('')

  const [leftWidth, setLeftWidth] = useState(208)
  const [rightWidth, setRightWidth] = useState(240)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showUsage, setShowUsage] = useState(false)
  const [usageInfo, setUsageInfo] = useState<{
    email?: string; plan?: string; usageData?: Record<string, unknown> | null; error?: string
  } | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  // Modo autônomo
  const [autonomousMode, setAutonomousMode] = useState(false)
  const [isAutonomousRunning, setIsAutonomousRunning] = useState(false)
  const [autoIteration, setAutoIteration] = useState(0)
  const MAX_AUTO_ITER = 30

  const endRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bubblesRef = useRef<ChatBubble[]>([])
  const streamHandlers = useRef<Map<string, StreamHandler>>(new Map())
  const dragState = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null)
  const autonomousModeRef = useRef(false)
  const stopRequestedRef = useRef(false)
  const autoIterRef = useRef(0)
  const activeAgentRef = useRef<AgentName>('jarvis')

  const setAndRefBubbles = useCallback((updater: (prev: ChatBubble[]) => ChatBubble[]) => {
    setBubbles(prev => {
      const next = updater(prev)
      bubblesRef.current = next
      return next
    })
  }, [])

  // Load sessions + VPS list
  useEffect(() => {
    ipc.squad.session.list().then(setSessions).catch(console.error)
    ipc.vps.list().then(list => {
      setVpsList(list as VpsItem[])
      if (list.length > 0) setSelectedVpsId((list[0] as VpsItem).id)
      if (list.length > 1) setProdVpsId((list[1] as VpsItem).id)
    }).catch(console.error)
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles, autoScroll])

  // Resizable panels — global mouse listeners
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragState.current
      if (!d) return
      const delta = e.clientX - d.startX
      if (d.side === 'left') setLeftWidth(Math.max(160, Math.min(320, d.startW + delta)))
      else setRightWidth(Math.max(160, Math.min(360, d.startW - delta)))
    }
    const onUp = () => { dragState.current = null; document.body.style.cursor = '' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => { autonomousModeRef.current = autonomousMode }, [autonomousMode])
  useEffect(() => { activeAgentRef.current = activeAgent }, [activeAgent])

  function startDrag(side: 'left' | 'right', e: React.MouseEvent) {
    dragState.current = { side, startX: e.clientX, startW: side === 'left' ? leftWidth : rightWidth }
    document.body.style.cursor = 'col-resize'
    e.preventDefault()
  }

  function handleChatScroll() {
    const el = chatScrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAutoScroll(atBottom)
  }

  function scrollToBottom() {
    setAutoScroll(true)
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function clearChat() {
    if (isStreaming) return
    setBubbles([])
    bubblesRef.current = []
    setSessionId(null)
  }

  async function fetchUsage() {
    setUsageLoading(true)
    setUsageInfo(null)
    try {
      const data = await ipc.claude.usage()
      setUsageInfo(data)
    } catch (err) {
      setUsageInfo({ error: String(err) })
    } finally {
      setUsageLoading(false)
    }
  }

  // Single global stream chunk listener
  useEffect(() => {
    const unsub = ipc.squad.stream.onChunk(chunk => {
      const handler = streamHandlers.current.get(chunk.streamId)
      if (!handler) return

      if (chunk.type === 'text_delta' && chunk.delta) {
        setAndRefBubbles(prev =>
          prev.map(b => b.id === handler.bubbleId ? { ...b, content: b.content + chunk.delta! } : b)
        )
      }

      if (chunk.type === 'done') {
        streamHandlers.current.delete(chunk.streamId)
        handler.onDone()
      }

      if (chunk.type === 'error') {
        streamHandlers.current.delete(chunk.streamId)
        handler.onError(chunk.error)
      }
    })
    return unsub
  }, [setAndRefBubbles])

  // Textarea auto-resize
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  // Core: stream a single agent
  async function streamAgent(
    agent: AgentName,
    message: string,
    sid: string,
    delegatedBy: AgentName | undefined,
    depth: number
  ): Promise<void> {
    return new Promise(resolve => {
      void (async () => {
        setIsStreaming(true)
        setActiveAgent(agent)

        const bubbleId = crypto.randomUUID()

        setAndRefBubbles(prev => [...prev, {
          id: bubbleId,
          type: 'agent',
          agentName: agent,
          content: '',
          delegatedBy,
          isStreaming: true,
        }])

        const history = bubblesRef.current
          .filter(b => !b.isStreaming && b.type !== 'system')
          .slice(-20)
          .map(b => ({ role: b.type === 'user' ? 'user' : 'assistant', content: b.content }))

        let streamId: string
        try {
          const res = await ipc.squad.stream.start({
            agent, message, history,
            projectContext: projectContext || undefined,
            localPath: executionMode === 'local' ? (localPath || undefined) : undefined,
            autonomous: autonomousModeRef.current,
          })
          streamId = res.streamId
        } catch (err) {
          console.error('stream.start failed:', err)
          setIsStreaming(false)
          setAndRefBubbles(prev => prev.map(b =>
            b.id === bubbleId ? { ...b, isStreaming: false, content: '❌ Falha ao iniciar stream' } : b
          ))
          resolve()
          return
        }

        setActiveStreamId(streamId)

        streamHandlers.current.set(streamId, {
          bubbleId,
          onDone: () => {
            const finalContent = bubblesRef.current.find(b => b.id === bubbleId)?.content ?? ''
            const actions = parseActions(finalContent)
            const cleanContent = actions.length > 0 ? stripActions(finalContent) : finalContent
            setIsStreaming(false)
            setActiveStreamId(null)
            setAndRefBubbles(prev =>
              prev.map(b => b.id === bubbleId ? { ...b, isStreaming: false, content: cleanContent, actions } : b)
            )

            ipc.squad.session.addMsg({
              sessionId: sid,
              agentName: agent,
              role: 'agent',
              content: finalContent,
              delegatedBy: delegatedBy ?? null,
            }).catch(console.error)

            // Auto-delegation (depth=0 only)
            if (depth === 0 && finalContent) {
              const delegations = detectDelegations(agent, finalContent)
              void (async () => {
                for (const target of delegations) {
                  const task = extractTask(finalContent, target)
                  setAndRefBubbles(prev => [...prev, {
                    id: crypto.randomUUID(),
                    type: 'system',
                    content: `@${agent} delegou para @${target}`,
                  }])
                  await streamAgent(target, task, sid, agent, 1)
                }
                resolve()
              })()
            } else {
              resolve()
            }
          },
          onError: (msg?: string) => {
            setIsStreaming(false)
            setActiveStreamId(null)
            setAndRefBubbles(prev =>
              prev.map(b => b.id === bubbleId
                ? { ...b, isStreaming: false, content: b.content || `❌ ${msg || 'Erro ao processar resposta'}` }
                : b
              )
            )
            resolve()
          },
        })
      })()
    })
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return

    // Parse @agent mention at start
    let targetAgent = activeAgent
    let message = text
    const mentionMatch = text.match(/^@(\w+)\s+([\s\S]+)/i)
    if (mentionMatch) {
      const mentioned = mentionMatch[1].toLowerCase() as AgentName
      if (AGENT_NAMES.includes(mentioned)) {
        targetAgent = mentioned
        message = mentionMatch[2].trim()
        setActiveAgent(targetAgent)
      }
    }

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    textareaRef.current?.focus()

    setAndRefBubbles(prev => [...prev, { id: crypto.randomUUID(), type: 'user', content: text }])

    // Create session if needed
    let sid = sessionId
    if (!sid) {
      try {
        const s = await ipc.squad.session.create({ agentName: targetAgent, title: message.slice(0, 60) })
        sid = s.id
        setSessionId(sid)
        setSessions(prev => [s as SessionItem, ...prev])
      } catch (err) {
        console.error('session.create failed:', err)
        return
      }
    }

    await ipc.squad.session.addMsg({
      sessionId: sid, agentName: 'user', role: 'user', content: text, delegatedBy: null,
    }).catch(console.error)

    await streamAgent(targetAgent, message, sid, undefined, 0)

    if (autonomousModeRef.current) {
      await autonomousLoop(sid)
    }
  }

  async function loadSession(s: SessionItem) {
    if (isStreaming) return
    try {
      const msgs = await ipc.squad.session.messages(s.id)
      const loaded: ChatBubble[] = msgs.map(m => ({
        id: m.id,
        type: m.role === 'user' ? 'user' : 'agent',
        agentName: m.role === 'agent' ? (m.agentName as AgentName) : undefined,
        content: m.content,
        delegatedBy: m.delegatedBy ? (m.delegatedBy as AgentName) : undefined,
      }))
      setBubbles(loaded)
      bubblesRef.current = loaded
      setSessionId(s.id)
      const firstAgent = msgs.find(m => m.role === 'agent')?.agentName as AgentName | undefined
      if (firstAgent && AGENT_NAMES.includes(firstAgent)) setActiveAgent(firstAgent)
    } catch (err) {
      console.error('loadSession failed:', err)
    }
  }

  function newSession() {
    if (isStreaming) return
    setBubbles([])
    bubblesRef.current = []
    setSessionId(null)
    setActiveAgent('jarvis')
    setInput('')
  }

  function cancelStream() {
    if (activeStreamId) ipc.squad.stream.cancel(activeStreamId).catch(console.error)
  }

  function stopAutonomous() {
    stopRequestedRef.current = true
    if (activeStreamId) ipc.squad.stream.cancel(activeStreamId).catch(console.error)
  }

  async function executeActionsAuto(actions: ActionBlock[]): Promise<Array<{ type: string; desc: string; output: string; ok: boolean }>> {
    const results: Array<{ type: string; desc: string; output: string; ok: boolean }> = []
    for (const action of actions) {
      const desc = action.cwd ? `cwd:${action.cwd}` : action.path ? `path:${action.path}` : ''
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'running' } }))
      try {
        const vpsId = executionMode === 'local' ? '__local__' : selectedVpsId
        if (!vpsId) {
          const msg = 'Sem VPS/pasta configurada'
          setActionStates(prev => ({ ...prev, [action.id]: { status: 'error', output: msg } }))
          results.push({ type: action.type, desc, output: msg, ok: false })
          continue
        }
        const cwd = executionMode === 'local' ? (action.cwd ?? localPath ?? undefined) : action.cwd
        const res = await ipc.squad.action.execute({ type: action.type, content: action.content, cwd, path: action.path, vpsId })
        setActionStates(prev => ({ ...prev, [action.id]: { status: 'ok', output: res.output } }))
        results.push({ type: action.type, desc, output: res.output, ok: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setActionStates(prev => ({ ...prev, [action.id]: { status: 'error', output: msg } }))
        results.push({ type: action.type, desc, output: msg, ok: false })
      }
    }
    return results
  }

  async function autonomousLoop(sid: string): Promise<void> {
    setIsAutonomousRunning(true)
    stopRequestedRef.current = false
    autoIterRef.current = 0
    try {
      while (!stopRequestedRef.current && autoIterRef.current < MAX_AUTO_ITER) {
        const lastBubble = [...bubblesRef.current].reverse().find(b => b.type === 'agent' && !b.isStreaming)
        if (!lastBubble) break

        if (/\[PRONTO\]|\[DONE\]|\[CONCLUÍDO\]/i.test(lastBubble.content)) {
          setAndRefBubbles(prev => [...prev, { id: crypto.randomUUID(), type: 'system', content: '✅ Tarefa concluída pelo agente' }])
          break
        }

        if (!lastBubble.actions || lastBubble.actions.length === 0) break

        autoIterRef.current++
        setAutoIteration(autoIterRef.current)
        setAndRefBubbles(prev => [...prev, {
          id: crypto.randomUUID(), type: 'system',
          content: `⚙️ Iteração ${autoIterRef.current} — executando ${lastBubble.actions!.length} ação(ões)…`,
        }])

        const results = await executeActionsAuto(lastBubble.actions!)
        if (stopRequestedRef.current) break

        const lines: string[] = [`[RESULTADO DAS AÇÕES — iteração ${autoIterRef.current}]`]
        for (const r of results) {
          lines.push(`\n${r.type.toUpperCase()}${r.desc ? ` (${r.desc})` : ''}:\n${r.ok ? '✅ Sucesso' : '❌ Erro'}\n${r.output.slice(0, 2000)}`)
        }
        lines.push('\nAnalise os resultados e continue trabalhando. Se concluiu tudo, inclua [PRONTO] na resposta.')

        await streamAgent(activeAgentRef.current, lines.join('\n'), sid, undefined, 0)
      }
      if (!stopRequestedRef.current && autoIterRef.current >= MAX_AUTO_ITER) {
        setAndRefBubbles(prev => [...prev, { id: crypto.randomUUID(), type: 'system', content: `⚠️ Limite de ${MAX_AUTO_ITER} iterações atingido` }])
      }
    } finally {
      setIsAutonomousRunning(false)
      setAutoIteration(0)
      autoIterRef.current = 0
    }
  }

  async function executeAction(action: ActionBlock) {
    const vpsId = executionMode === 'local' ? '__local__' : selectedVpsId
    if (!vpsId) return
    setActionStates(prev => ({ ...prev, [action.id]: { status: 'running' } }))
    try {
      const cwd = executionMode === 'local' ? (action.cwd ?? localPath ?? undefined) : action.cwd
      const res = await ipc.squad.action.execute({ type: action.type, content: action.content, cwd, path: action.path, vpsId })
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'ok', output: res.output } }))
      if (executionMode === 'vps' && pipelineMode && prodVpsId && prodVpsId !== selectedVpsId) {
        setPipelineGates(prev => ({ ...prev, [action.id]: { action, homologOutput: res.output, status: 'pending' } }))
      }
    } catch (err) {
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'error', output: err instanceof Error ? err.message : String(err) } }))
    }
  }

  async function approvePipeline(actionId: string) {
    const gate = pipelineGates[actionId]
    if (!gate || !prodVpsId) return
    setPipelineGates(prev => ({ ...prev, [actionId]: { ...gate, status: 'deploying' } }))
    try {
      const res = await ipc.squad.action.execute({ type: gate.action.type, content: gate.action.content, cwd: gate.action.cwd, path: gate.action.path, vpsId: prodVpsId })
      setPipelineGates(prev => ({ ...prev, [actionId]: { ...gate, status: 'done', prodOutput: res.output } }))
    } catch (err) {
      setPipelineGates(prev => ({ ...prev, [actionId]: { ...gate, status: 'failed', prodOutput: err instanceof Error ? err.message : String(err) } }))
    }
  }

  function rejectPipeline(actionId: string) {
    setPipelineGates(prev => {
      const gate = prev[actionId]
      if (!gate) return prev
      return { ...prev, [actionId]: { ...gate, status: 'rejected' } }
    })
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (isStreaming) return
    try {
      await ipc.squad.session.delete(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (sessionId === id) {
        setBubbles([])
        bubblesRef.current = []
        setSessionId(null)
      }
    } catch (err) {
      console.error('deleteSession failed:', err)
    }
  }

  const meta = AGENT_META[activeAgent]

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ── Left panel — Agents ──────────────────────────────────────────────── */}
      <aside className="bg-slate-900 border-r border-slate-800 flex flex-col shrink-0" style={{ width: leftWidth }}>
        <div className="flex items-center gap-2 px-4 py-[15px] border-b border-slate-800">
          <button
            onClick={() => navigate('/')}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
            title="Voltar"
          >
            <ArrowLeft size={15} />
          </button>
          <Users size={15} className="text-brand-400 shrink-0" />
          <span className="font-semibold text-sm text-slate-100">Squad</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {AGENT_NAMES.map(name => {
            const m = AGENT_META[name]
            const isActive = activeAgent === name
            return (
              <button
                key={name}
                onClick={() => setActiveAgent(name)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  isActive
                    ? `${m.bgClass} ${m.borderClass} ${m.colorClass}`
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{m.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{m.label}</p>
                    <p className="text-[10px] text-slate-500 truncate leading-snug">{m.role}</p>
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-500">
                    {m.provider}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Drag handle — left */}
      <div
        onMouseDown={e => startDrag('left', e)}
        className="w-1 shrink-0 cursor-col-resize bg-slate-800 hover:bg-brand-600/60 transition-colors select-none"
      />

      {/* ── Center panel — Chat ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl leading-none">{meta.emoji}</span>
            <div>
              <h2 className={`text-sm font-semibold ${meta.colorClass}`}>{meta.label}</h2>
              <p className="text-xs text-slate-500">{meta.role}</p>
            </div>
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
                <Loader2 size={11} className="animate-spin" />
                respondendo...
              </span>
            )}
            {isAutonomousRunning && (
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium ml-2">
                <Zap size={11} className="animate-pulse" />
                autônomo · {autoIteration}/{MAX_AUTO_ITER}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAutonomousMode(v => !v)}
              disabled={isStreaming || isAutonomousRunning}
              title={autonomousMode ? 'Modo autônomo ON — clique para desativar' : 'Ativar modo autônomo (executa ações sozinho até concluir)'}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                autonomousMode
                  ? 'bg-green-900/30 border-green-700/50 text-green-400'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              <Bot size={10} />
              Auto
            </button>
            <button
              onClick={clearChat}
              disabled={isStreaming || isAutonomousRunning || bubbles.length === 0}
              title="Limpar conversa"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              <Eraser size={11} /> Limpar
            </button>
            <button
              onClick={newSession}
              disabled={isStreaming || isAutonomousRunning}
              className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              + Nova sessão
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-6 space-y-4 relative">
          {bubbles.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 select-none">
              <Bot size={40} className="text-slate-800" />
              <div>
                <p className="text-slate-500 text-sm font-medium">Selecione um agente e envie sua mensagem</p>
                <p className="text-slate-600 text-xs mt-1">
                  Use <span className="text-slate-400 font-mono">@agente mensagem</span> para direcionar a um agente específico
                </p>
              </div>
            </div>
          )}

          {bubbles.map(bubble => {
            if (bubble.type === 'system') {
              return (
                <div key={bubble.id} className="flex justify-center">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-800/50 border border-slate-700/30 px-3 py-1 rounded-full">
                    <Zap size={10} className="text-yellow-600" />
                    {bubble.content}
                  </span>
                </div>
              )
            }

            if (bubble.type === 'user') {
              return (
                <div key={bubble.id} className="flex justify-end">
                  <div className="max-w-[72%] bg-brand-600/20 border border-brand-700/30 text-slate-200 rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed">
                    {bubble.content}
                  </div>
                </div>
              )
            }

            // Agent bubble
            const aName = bubble.agentName ?? 'jarvis'
            const am = AGENT_META[aName]
            return (
              <div key={bubble.id} className="flex gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${am.bgClass} border ${am.borderClass}`}>
                  {am.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-semibold ${am.colorClass}`}>{am.label}</span>
                    {bubble.delegatedBy && (
                      <span className="text-[10px] text-slate-600 bg-slate-800 border border-slate-700/40 px-1.5 py-0.5 rounded">
                        via @{bubble.delegatedBy}
                      </span>
                    )}
                    {bubble.isStreaming && (
                      <Loader2 size={11} className="animate-spin text-slate-500" />
                    )}
                  </div>
                  <div className={`text-sm text-slate-200 leading-relaxed whitespace-pre-wrap ${am.bgClass} border ${am.borderClass} rounded-2xl rounded-tl-md px-4 py-3`}>
                    {bubble.content
                      ? bubble.content
                      : <span className="text-slate-600 italic text-xs">aguardando...</span>
                    }
                  </div>
                  {bubble.actions && bubble.actions.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {bubble.actions.map(action => {
                        const st = actionStates[action.id] ?? { status: 'idle' }
                        const label = action.type === 'shell' ? 'SHELL' : action.type === 'write_file' ? 'WRITE' : action.type === 'read_dir' ? 'DIR' : 'READ'
                        const labelColor = action.type === 'shell' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40' : action.type === 'write_file' ? 'text-blue-400 bg-blue-900/30 border-blue-700/40' : action.type === 'read_dir' ? 'text-cyan-400 bg-cyan-900/30 border-cyan-700/40' : 'text-slate-400 bg-slate-800 border-slate-700/40'
                        return (
                          <div key={action.id} className="border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/60">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/60 border-b border-slate-700/40">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${labelColor}`}>{label}</span>
                                {(action.cwd || action.path) && (
                                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{action.cwd || action.path}</span>
                                )}
                              </div>
                              <button
                                onClick={() => void executeAction(action)}
                                disabled={(executionMode === 'vps' ? !selectedVpsId : !localPath) || st.status === 'running'}
                                className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-brand-600/30 border border-brand-600/50 text-brand-300 hover:bg-brand-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {st.status === 'running' ? <Loader2 size={11} className="animate-spin" /> : st.status === 'ok' ? <CheckCircle size={11} /> : st.status === 'error' ? <AlertCircle size={11} /> : <Play size={11} />}
                                {st.status === 'running' ? 'Executando…' : st.status === 'ok' ? 'Executado' : st.status === 'error' ? 'Erro' : 'Executar'}
                              </button>
                            </div>
                            <pre className="text-xs text-slate-300 font-mono px-3 py-2 overflow-x-auto max-h-32 leading-relaxed">{action.content}</pre>
                            {st.output && (
                              <div className={`px-3 py-2 border-t border-slate-700/40 ${st.status === 'error' ? 'bg-red-950/30' : 'bg-slate-950/40'}`}>
                                <pre className={`text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${st.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>{st.output}</pre>
                              </div>
                            )}
                            {/* Pipeline gate — inside the card */}
                            {pipelineMode && (() => {
                              const gate = pipelineGates[action.id]
                              if (!gate) return null
                              const prodName = vpsList.find(v => v.id === prodVpsId)?.name ?? 'Prod'
                              return (
                                <div className={`px-3 py-2 border-t flex items-center justify-between gap-3 ${
                                  gate.status === 'pending' ? 'border-amber-700/40 bg-amber-950/20' :
                                  gate.status === 'deploying' ? 'border-blue-700/40 bg-blue-950/20' :
                                  gate.status === 'done' ? 'border-green-700/40 bg-green-950/20' :
                                  gate.status === 'failed' ? 'border-red-700/40 bg-red-950/20' :
                                  'border-slate-700/40 bg-slate-800/30'
                                }`}>
                                  <div className="min-w-0 flex-1">
                                    {gate.status === 'pending' && <p className="text-xs text-amber-300 font-semibold">✓ Homolog OK — Deploy em <span className="font-bold">{prodName}</span>?</p>}
                                    {gate.status === 'deploying' && <span className="text-xs text-blue-300 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" />Executando em {prodName}…</span>}
                                    {gate.status === 'done' && <p className="text-xs text-green-300 font-semibold">✓ Deploy em {prodName} concluído{gate.prodOutput ? ` — ${gate.prodOutput.slice(0,60)}` : ''}</p>}
                                    {gate.status === 'failed' && <p className="text-xs text-red-300 font-semibold">✗ Falhou em {prodName}: {gate.prodOutput?.slice(0,80)}</p>}
                                    {gate.status === 'rejected' && <p className="text-xs text-slate-500">— Deploy rejeitado</p>}
                                  </div>
                                  {gate.status === 'pending' && (
                                    <div className="flex gap-2 shrink-0">
                                      <button onClick={() => void approvePipeline(action.id)} className="text-xs px-3 py-1 rounded-lg bg-green-700/30 border border-green-600/50 text-green-300 hover:bg-green-700/50 transition-colors font-semibold">Aprovar</button>
                                      <button onClick={() => rejectPipeline(action.id)} className="text-xs px-3 py-1 rounded-lg bg-slate-700/30 border border-slate-600/50 text-slate-400 hover:bg-slate-700/50 transition-colors">Rejeitar</button>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
          {/* Botão Acompanhar — aparece quando o usuário rola para cima */}
          {!autoScroll && (
            <div className="sticky bottom-2 flex justify-center pointer-events-none">
              <button
                onClick={scrollToBottom}
                className="pointer-events-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-600 text-slate-300 hover:bg-slate-700 shadow-lg transition-colors backdrop-blur-sm"
              >
                <ArrowDown size={11} /> Acompanhar
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/30 shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
              }}
              placeholder={isAutonomousRunning ? 'Agente trabalhando autonomamente…' : `Mensagem para @${activeAgent}… (Shift+Enter = nova linha)`}
              disabled={isAutonomousRunning}
              rows={1}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            {(isStreaming || isAutonomousRunning) ? (
              <button
                onClick={isAutonomousRunning ? stopAutonomous : cancelStream}
                title={isAutonomousRunning ? 'Parar execução autônoma' : 'Cancelar'}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-red-900/40 border border-red-700/40 text-red-400 hover:bg-red-900/60 transition-colors"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim()}
                title="Enviar (Enter)"
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600/30 border border-brand-600/50 text-brand-300 hover:bg-brand-600/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={15} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-700 mt-2">
            Enter para enviar · Shift+Enter para quebra · <span className="font-mono">@agente</span> para direcionar
          </p>
        </div>
      </div>

      {/* Drag handle — right */}
      <div
        onMouseDown={e => startDrag('right', e)}
        className="w-1 shrink-0 cursor-col-resize bg-slate-800 hover:bg-brand-600/60 transition-colors select-none"
      />

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      <aside className="bg-slate-900 border-l border-slate-800 flex flex-col shrink-0" style={{ width: rightWidth }}>

        {/* Project context — collapsible */}
        <div className="border-b border-slate-800">
          <button
            onClick={() => setContextOpen(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <FileText size={12} className="text-slate-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contexto do Projeto</span>
            </div>
            {contextOpen ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
          </button>
          {contextOpen && (
            <div className="px-3 pb-3">
              <textarea
                value={projectContext}
                onChange={e => setProjectContext(e.target.value)}
                placeholder="Cole aqui o README, arquitetura, stack técnica… Todos os agentes usarão este contexto automaticamente."
                rows={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-brand-600 transition-colors leading-relaxed"
              />
              {projectContext && (
                <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1">
                  <CheckCircle size={9} /> Contexto ativo ({projectContext.length} chars)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Execution mode — VPS or Local */}
        <div className="px-4 py-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Monitor size={12} className="text-slate-500 shrink-0" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Execução</h3>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
            <button
              onClick={() => setExecutionMode('vps')}
              className={`flex-1 py-1.5 transition-colors font-medium ${
                executionMode === 'vps' ? 'bg-brand-600/40 text-brand-300' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              VPS
            </button>
            <button
              onClick={() => setExecutionMode('local')}
              className={`flex-1 py-1.5 transition-colors font-medium ${
                executionMode === 'local' ? 'bg-green-700/40 text-green-300' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              Local
            </button>
          </div>

          {executionMode === 'vps' && (
            vpsList.length === 0 ? (
              <p className="text-[10px] text-slate-600">Nenhuma VPS cadastrada</p>
            ) : (
              <select
                value={selectedVpsId}
                onChange={e => setSelectedVpsId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-600"
              >
                {vpsList.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            )
          )}

          {executionMode === 'local' && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={localPath}
                  onChange={e => setLocalPath(e.target.value)}
                  placeholder="Pasta local (ex: C:\OneDrive\projeto)"
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-600 transition-colors"
                />
                <button
                  onClick={async () => {
                    const res = await ipc.local.openFolder()
                    if (res) setLocalPath(res)
                  }}
                  title="Selecionar pasta"
                  className="shrink-0 px-2 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  <FolderOpen size={12} />
                </button>
              </div>
              {localPath && (
                <p className="text-[10px] text-green-500 flex items-center gap-1">
                  <CheckCircle size={9} /> Pasta selecionada
                </p>
              )}
              <p className="text-[10px] text-slate-600">Ações SHELL, READ e WRITE rodam no seu PC (sem VPS).</p>
            </div>
          )}
        </div>

        {/* Pipeline mode toggle — only for VPS mode */}
        {executionMode === 'vps' && (
          <div className="px-4 py-3 border-b border-slate-800 space-y-2">
            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline</span>
              <button
                onClick={() => setPipelineMode(v => !v)}
                className={`relative w-9 h-5 rounded-full border transition-colors ${
                  pipelineMode ? 'bg-brand-600/40 border-brand-600/60' : 'bg-slate-700/50 border-slate-600/50'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                  pipelineMode ? 'translate-x-4 bg-brand-400' : 'translate-x-0 bg-slate-500'
                }`} />
              </button>
            </label>
            {pipelineMode && (
              <>
                <p className="text-[10px] text-slate-500">Após homolog OK, confirme deploy em Prod:</p>
                {vpsList.length === 0 ? (
                  <p className="text-[10px] text-slate-600">Nenhuma VPS cadastrada</p>
                ) : (
                  <select
                    value={prodVpsId}
                    onChange={e => setProdVpsId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-600"
                  >
                    <option value="">— VPS Prod —</option>
                    {vpsList.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        )}

        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Histórico</h3>
          <button
            onClick={() => { setShowUsage(true); void fetchUsage() }}
            title="Ver conta e uso Claude"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-blue-900/30 border border-blue-700/40 text-blue-400 hover:bg-blue-900/50 transition-colors"
          >
            <User2 size={11} />
            Uso
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="text-xs text-slate-600 px-4 py-4">Nenhuma sessão ainda.</p>
          )}
          {sessions.map(s => {
            const sm = AGENT_META[s.agentName as AgentName] ?? AGENT_META.jarvis
            return (
              <div
                key={s.id}
                className={`group relative border-b border-slate-800/50 ${
                  s.id === sessionId ? 'bg-slate-800/60' : ''
                }`}
              >
                <button
                  onClick={() => void loadSession(s)}
                  disabled={isStreaming}
                  className="w-full text-left px-4 py-3 pr-8 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm leading-none">{sm.emoji}</span>
                    <span className={`text-[11px] font-semibold ${sm.colorClass}`}>{sm.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </button>
                <button
                  onClick={e => void deleteSession(s.id, e)}
                  disabled={isStreaming}
                  title="Excluir conversa"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-all disabled:pointer-events-none"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── Modal: Conta & Uso Claude ─────────────────────────────────── */}
      {showUsage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowUsage(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <User2 size={14} className="text-blue-400" />
                Conta Claude
              </h2>
              <button
                onClick={() => setShowUsage(false)}
                className="text-slate-600 hover:text-slate-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {usageLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
                <Loader2 size={15} className="animate-spin" />
                Carregando…
              </div>
            )}

            {!usageLoading && usageInfo && (
              <div className="space-y-3">
                {usageInfo.error ? (
                  <p className="text-xs text-red-400 leading-relaxed">{usageInfo.error}</p>
                ) : (
                  <>
                    <div className="bg-slate-800/60 rounded-xl px-4 py-3">
                      <p className="text-sm text-slate-100 font-medium">{usageInfo.email || '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        {(usageInfo.plan || 'plan').replace(/_/g, ' ')}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Para ver uso detalhado da sessão (5h) e semanal, abra o painel da conta no site.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => void fetchUsage()}
                disabled={usageLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={10} className={usageLoading ? 'animate-spin' : ''} />
                Atualizar
              </button>
              <button
                onClick={() => void ipc.shell.openExternal('https://claude.ai/settings')}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-900/30 border border-blue-700/40 text-blue-300 hover:bg-blue-900/50 transition-colors"
              >
                <ExternalLink size={10} />
                Abrir claude.ai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
