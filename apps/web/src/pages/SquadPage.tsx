import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, X, Loader2, Users, Bot, Zap, Play, CheckCircle, AlertCircle, Server } from 'lucide-react'
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
  onError: () => void
}

// ── ACTION tags ──────────────────────────────────────────────────────────────
type ActionType = 'shell' | 'write_file' | 'read_file'
interface ActionBlock { id: string; type: ActionType; cwd?: string; path?: string; content: string }
type ActionState = { status: 'idle' | 'running' | 'ok' | 'error'; output?: string }

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

  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bubblesRef = useRef<ChatBubble[]>([])
  const streamHandlers = useRef<Map<string, StreamHandler>>(new Map())

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
    }).catch(console.error)
  }, [])

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles])

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
        handler.onError()
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
          const res = await ipc.squad.stream.start({ agent, message, history })
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
          onError: () => {
            setIsStreaming(false)
            setActiveStreamId(null)
            setAndRefBubbles(prev =>
              prev.map(b => b.id === bubbleId
                ? { ...b, isStreaming: false, content: b.content || '❌ Erro ao processar resposta' }
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

  async function executeAction(action: ActionBlock) {
    if (!selectedVpsId) return
    setActionStates(prev => ({ ...prev, [action.id]: { status: 'running' } }))
    try {
      const res = await ipc.squad.action.execute({ type: action.type, content: action.content, cwd: action.cwd, path: action.path, vpsId: selectedVpsId })
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'ok', output: res.output } }))
    } catch (err) {
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'error', output: err instanceof Error ? err.message : String(err) } }))
    }
  }

  const meta = AGENT_META[activeAgent]

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ── Left panel — Agents ──────────────────────────────────────────────── */}
      <aside className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
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
          </div>
          <button
            onClick={newSession}
            disabled={isStreaming}
            className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            + Nova sessão
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                        const label = action.type === 'shell' ? 'SHELL' : action.type === 'write_file' ? 'WRITE' : 'READ'
                        const labelColor = action.type === 'shell' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40' : action.type === 'write_file' ? 'text-blue-400 bg-blue-900/30 border-blue-700/40' : 'text-slate-400 bg-slate-800 border-slate-700/40'
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
                                disabled={!selectedVpsId || st.status === 'running'}
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
              placeholder={`Mensagem para @${activeAgent}… (Shift+Enter = nova linha)`}
              rows={1}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-brand-600 transition-colors"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            {isStreaming ? (
              <button
                onClick={cancelStream}
                title="Cancelar"
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

      {/* ── Right panel — Sessions ───────────────────────────────────────────── */}
      <aside className="w-60 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5">
            <Server size={12} className="text-slate-500 shrink-0" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">VPS Alvo</h3>
          </div>
          {vpsList.length === 0 ? (
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
          )}
        </div>
        <div className="px-4 py-2 border-b border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Histórico</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="text-xs text-slate-600 px-4 py-4">Nenhuma sessão ainda.</p>
          )}
          {sessions.map(s => {
            const sm = AGENT_META[s.agentName as AgentName] ?? AGENT_META.jarvis
            return (
              <button
                key={s.id}
                onClick={() => void loadSession(s)}
                disabled={isStreaming}
                className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800/50 disabled:opacity-50 ${
                  s.id === sessionId ? 'bg-slate-800/60' : ''
                }`}
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
            )
          })}
        </div>
      </aside>
    </div>
  )
}
