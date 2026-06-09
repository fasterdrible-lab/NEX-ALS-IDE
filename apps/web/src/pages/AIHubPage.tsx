import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, MessageSquare, Star, StarOff, Trash2, Send,
  Loader2, Bot, ChevronRight, Pencil, Check, X,
  Cpu, Copy, PanelRightClose, PanelRightOpen, Database, FileCode,
  Server, Layers, Terminal, Box as DockerBox, Activity,
} from 'lucide-react'
import { ipc } from '../lib/ipc'

interface Conversation {
  id: string; title: string; provider: string; model: string
  isPinned: boolean; totalTokens: number; createdAt: string; updatedAt: string
}

interface Message {
  id: string; role: string; content: string; createdAt: string
}

interface ModelInfo {
  id: string; name: string; contextWindow: number; supportsTools: boolean; supportsVision: boolean
}

const PROVIDERS = ['anthropic','openai','gemini','deepseek','groq','mistral','xai','openrouter','ollama']

const CTX_ITEMS = [
  { key: 'logs',     label: 'Logs do sistema',  icon: Terminal,   needsVps: true },
  { key: 'docker',   label: 'Docker containers', icon: DockerBox,  needsVps: true },
  { key: 'pm2',      label: 'PM2 processos',     icon: Activity,   needsVps: true },
  { key: 'vpsStats', label: 'Métricas da VPS',   icon: Server,     needsVps: true },
  { key: 'memory',   label: 'Memória do projeto', icon: Database,  needsVps: false },
] as const
type CtxKey = typeof CTX_ITEMS[number]['key']

interface MemoryBlock { id: string; key: string; value: string; updatedAt: string }
type RightTab = 'context' | 'memory'

export default function AIHubPage() {
  const navigate = useNavigate()
  const [convList, setConvList] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [showProviderMenu, setShowProviderMenu] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Painel lateral direito
  const [rightOpen, setRightOpen]       = useState(true)
  const [rightTab, setRightTab]         = useState<RightTab>('context')
  // Context Selector
  const [ctxVpsId, setCtxVpsId]         = useState<string>('')
  const [vpsList, setVpsList]           = useState<Array<{ id: string; name: string }>>([])
  const [ctxSel, setCtxSel]             = useState<Set<CtxKey>>(new Set())
  // Project Memory
  const [memBlocks, setMemBlocks]       = useState<MemoryBlock[]>([])
  const [editMemId, setEditMemId]       = useState<string | null>(null)
  const [editMemVal, setEditMemVal]     = useState('')
  const [newMemKey, setNewMemKey]       = useState('')
  const [newMemVal, setNewMemVal]       = useState('')
  const [savingMem, setSavingMem]       = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)

  // Carrega lista de conversas
  const loadConvList = useCallback(async () => {
    try { setConvList(await ipc.ai.conv.list()) } catch { /* silencioso */ }
  }, [])

  useEffect(() => { loadConvList() }, [loadConvList])

  useEffect(() => {
    ipc.vps.list().then(list => setVpsList(list.map(v => ({ id: v.id, name: v.name })))).catch(() => {})
  }, [])

  const loadMemory = useCallback(async () => {
    try {
      const blocks = await ipc.memory.list({ vpsId: ctxVpsId || null })
      setMemBlocks(blocks as MemoryBlock[])
    } catch { /* silencioso */ }
  }, [ctxVpsId])

  useEffect(() => { loadMemory() }, [loadMemory])

  // Carrega modelos ao trocar provider
  useEffect(() => {
    setLoadingModels(true)
    ipc.ai.models(provider)
      .then(m => { setModels(m); if (m.length) setModel(m[0].id) })
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false))
  }, [provider])

  // Listener de streaming
  useEffect(() => {
    const unsub = ipc.ai.stream.onChunk((chunk) => {
      if (chunk.type === 'text_delta' && chunk.delta) {
        setStreamContent(s => s + chunk.delta!)
      }
      if (chunk.type === 'done' || chunk.type === 'error') {
        setActiveStreamId(null)
        setLoading(false)
        if (chunk.type === 'done') {
          setStreamContent(prev => {
            if (prev) {
              const msg: Message = { id: Date.now().toString(), role: 'assistant', content: prev, createdAt: new Date().toISOString() }
              setMessages(m => [...m, msg])
              if (activeConv) ipc.ai.conv.addMsg({ conversationId: activeConv.id, role: 'assistant', content: prev }).catch(() => {})
            }
            return ''
          })
        }
        scrollToBottom()
      }
    })
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [activeConv])

  const openConv = async (conv: Conversation) => {
    setActiveConv(conv)
    setTitleInput(conv.title)
    setMessages([])
    try {
      const msgs = await ipc.ai.conv.messages(conv.id)
      setMessages(msgs as Message[])
      scrollToBottom()
    } catch { /* silencioso */ }
  }

  const newConv = async () => {
    try {
      const conv = await ipc.ai.conv.create({ provider, model: model || 'default', title: 'Nova conversa' })
      await loadConvList()
      await openConv({ ...conv as Conversation, isPinned: false, totalTokens: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    } catch (e) { alert(String(e)) }
  }

  const deleteConv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Excluir esta conversa?')) return
    await ipc.ai.conv.delete(id)
    if (activeConv?.id === id) { setActiveConv(null); setMessages([]) }
    loadConvList()
  }

  const pinConv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await ipc.ai.conv.pin(id)
    loadConvList()
    if (activeConv?.id === id) setActiveConv(c => c ? { ...c, isPinned: !c.isPinned } : c)
  }

  const saveTitle = async () => {
    if (!activeConv || !titleInput.trim()) return
    await ipc.ai.conv.updateTitle(activeConv.id, titleInput.trim())
    setActiveConv(c => c ? { ...c, title: titleInput.trim() } : c)
    setEditingTitle(false)
    loadConvList()
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !activeConv) return
    const userMsg = input.trim()
    setInput('')
    const uiMsg: Message = { id: Date.now().toString(), role: 'user', content: userMsg, createdAt: new Date().toISOString() }
    setMessages(m => [...m, uiMsg])
    await ipc.ai.conv.addMsg({ conversationId: activeConv.id, role: 'user', content: userMsg }).catch(() => {})
    scrollToBottom()

    setLoading(true)
    setStreamContent('')

    try {
      // Monta contexto selecionado
      let systemPrompt: string | undefined
      if (ctxSel.size > 0 || ctxVpsId) {
        const parts: string[] = ['Responda em português brasileiro.']

        if (ctxSel.has('memory') && memBlocks.length) {
          parts.push(`## Memória do projeto\n${memBlocks.map(b => `### ${b.key}\n${b.value}`).join('\n\n')}`)
        }
        if (ctxVpsId && ctxSel.has('vpsStats')) {
          const r = await ipc.monitor.getStats(ctxVpsId).catch(() => null)
          if (r?.success && r.stats) {
            const s = r.stats as { cpu?: number; ram?: number; disk?: number; uptime?: string }
            parts.push(`## Métricas da VPS\nCPU: ${s.cpu}% | RAM: ${s.ram}% | Disco: ${s.disk}% | Uptime: ${s.uptime}`)
          }
        }
        if (ctxVpsId && ctxSel.has('docker')) {
          const r = await ipc.docker.list(ctxVpsId).catch(() => null)
          if (r?.success) parts.push(`## Docker\n${r.containers.map(c => `${c.name} [${c.state}] ${c.image}`).join('\n')}`)
        }
        if (ctxVpsId && ctxSel.has('pm2')) {
          const r = await ipc.pm2.list(ctxVpsId).catch(() => null)
          if (r?.success) parts.push(`## PM2\n${r.processes.map(p => `${p.name} [${p.status}] CPU:${p.cpu}% restarts:${p.restarts}`).join('\n')}`)
        }
        if (ctxVpsId && ctxSel.has('logs')) {
          const r = await ipc.terminal.exec(ctxVpsId, 'journalctl -n 80 --no-pager 2>/dev/null || tail -n 80 /var/log/syslog 2>/dev/null', 15000).catch(() => null)
          if (r?.success && r.output) parts.push(`## Logs recentes\n\`\`\`\n${r.output.slice(-3000)}\n\`\`\``)
        }

        if (parts.length > 1) systemPrompt = parts.join('\n\n')
      }

      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await ipc.ai.stream.start({
        messages: [...history, { role: 'user', content: userMsg }],
        provider,
        systemPrompt,
        maxTokens: 4096,
      })
      setActiveStreamId(res.streamId)
    } catch (e) {
      setLoading(false)
      const errMsg: Message = { id: Date.now().toString(), role: 'assistant', content: `❌ Erro: ${String(e)}`, createdAt: new Date().toISOString() }
      setMessages(m => [...m, errMsg])
    }
  }

  const cancelStream = () => {
    if (activeStreamId) { ipc.ai.stream.cancel(activeStreamId); setActiveStreamId(null); setLoading(false); setStreamContent('') }
  }

  const pinned = convList.filter(c => c.isPinned)
  const unpinned = convList.filter(c => !c.isPinned)

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar esquerda */}
      <div className="w-60 border-r border-slate-800 flex flex-col shrink-0 bg-slate-900">
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200">
            <ArrowLeft size={11}/> Voltar
          </button>
          <span className="text-[11px] font-semibold text-slate-300 tracking-wide">AI HUB</span>
          <button onClick={newConv} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100" title="Nova conversa">
            <Plus size={14}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
          {pinned.length > 0 && (
            <>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest px-1 mb-1">Favoritos</p>
              {pinned.map(c => <ConvItem key={c.id} c={c} active={activeConv?.id === c.id} onOpen={openConv} onDelete={deleteConv} onPin={pinConv}/>)}
            </>
          )}
          {unpinned.length > 0 && (
            <>
              {pinned.length > 0 && <p className="text-[9px] text-slate-600 uppercase tracking-widest px-1 mt-2 mb-1">Conversas</p>}
              {unpinned.map(c => <ConvItem key={c.id} c={c} active={activeConv?.id === c.id} onOpen={openConv} onDelete={deleteConv} onPin={pinConv}/>)}
            </>
          )}
          {convList.length === 0 && (
            <p className="text-xs text-slate-600 text-center pt-8">Nenhuma conversa ainda.<br/>Clique em + para começar.</p>
          )}
        </div>

        {/* Seletor de provider */}
        <div className="border-t border-slate-800 p-2 space-y-1">
          <p className="text-[9px] text-slate-600 uppercase tracking-widest px-1">Provedor</p>
          <div className="relative">
            <button
              onClick={() => setShowProviderMenu(v => !v)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300"
            >
              <span className="capitalize">{provider}</span>
              <ChevronRight size={10} className={`transition-transform ${showProviderMenu ? 'rotate-90' : ''}`}/>
            </button>
            {showProviderMenu && (
              <div className="absolute bottom-full left-0 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl mb-1 overflow-hidden z-50">
                {PROVIDERS.map(p => (
                  <button key={p} onClick={() => { setProvider(p); setShowProviderMenu(false) }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-700 capitalize ${p === provider ? 'text-purple-400' : 'text-slate-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          {loadingModels ? (
            <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-600"><Loader2 size={9} className="animate-spin"/> Carregando modelos…</div>
          ) : models.length > 0 ? (
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-purple-500"
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : (
            <p className="text-[10px] text-slate-600 px-2">Sem modelos disponíveis</p>
          )}
        </div>
      </div>

      {/* Área central */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
            {editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  autoFocus value={titleInput} onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                  className="flex-1 text-sm bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-slate-100 focus:outline-none focus:border-purple-500"
                />
                <button onClick={saveTitle} className="p-1 hover:text-emerald-400"><Check size={13}/></button>
                <button onClick={() => setEditingTitle(false)} className="p-1 hover:text-red-400"><X size={13}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-200 truncate">{activeConv.title}</span>
                <button onClick={() => setEditingTitle(true)} className="p-1 text-slate-600 hover:text-slate-300 shrink-0"><Pencil size={11}/></button>
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-600">
              <Cpu size={10}/> {activeConv.provider} · {activeConv.model}
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streamContent && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                <Bot size={32}/>
                <p className="text-sm">Como posso ajudar?</p>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg}/>
            ))}
            {streamContent && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500">Claude</span>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 whitespace-pre-wrap max-w-3xl">
                  {streamContent}<span className="animate-pulse text-purple-400">▌</span>
                </div>
              </div>
            )}
            {loading && !streamContent && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Loader2 size={12} className="animate-spin text-purple-400"/>
                <span>Pensando…</span>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Input */}
          <div className="border-t border-slate-800 bg-slate-900 px-4 py-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Mensagem… (Enter para enviar, Shift+Enter nova linha)"
                rows={2}
                disabled={loading}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50"
              />
              {loading ? (
                <button onClick={cancelStream} className="shrink-0 p-2.5 rounded-xl bg-red-900/40 border border-red-700/40 text-red-400 hover:bg-red-800/60">
                  <X size={15}/>
                </button>
              ) : (
                <button onClick={sendMessage} disabled={!input.trim()} className="shrink-0 p-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <Send size={15}/>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-600">
          <Bot size={48}/>
          <p className="text-lg font-medium">NEX-ALS AI HUB</p>
          <p className="text-sm">Selecione uma conversa ou crie uma nova</p>
          <button onClick={newConv} className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-sm transition-colors">
            <Plus size={14}/> Nova conversa
          </button>
        </div>
      )}

      {/* ═══ PAINEL LATERAL DIREITO ═══ */}
      <div className={`border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 transition-all duration-200 ${rightOpen ? 'w-64' : 'w-8'}`}>
        {/* Toggle */}
        <button
          onClick={() => setRightOpen(v => !v)}
          className="p-2 text-slate-600 hover:text-slate-300 self-end shrink-0"
          title={rightOpen ? 'Fechar painel' : 'Abrir painel'}
        >
          {rightOpen ? <PanelRightClose size={13}/> : <PanelRightOpen size={13}/>}
        </button>

        {rightOpen && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-800 px-2 shrink-0">
              {([['context','Contexto',Layers],['memory','Memória',Database]] as const).map(([tab, label, Icon]) => (
                <button key={tab} onClick={() => setRightTab(tab)}
                  className={`flex items-center gap-1 px-2 py-2 text-[10px] border-b-2 transition-colors ${rightTab === tab ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  <Icon size={10}/>{label}
                </button>
              ))}
            </div>

            {rightTab === 'context' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* VPS selector */}
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">VPS (opcional)</p>
                  <select value={ctxVpsId} onChange={e => setCtxVpsId(e.target.value)}
                    className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-purple-500">
                    <option value="">— sem VPS —</option>
                    {vpsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                {/* Checkboxes */}
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-2">Incluir no contexto</p>
                  <div className="space-y-1.5">
                    {CTX_ITEMS.map(item => {
                      const Icon = item.icon
                      const disabled = item.needsVps && !ctxVpsId
                      const checked = ctxSel.has(item.key)
                      return (
                        <label key={item.key} className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={e => {
                              setCtxSel(s => {
                                const next = new Set(s)
                                e.target.checked ? next.add(item.key) : next.delete(item.key)
                                return next
                              })
                            }}
                            className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                          />
                          <Icon size={10} className="text-slate-500 shrink-0"/>
                          <span className="text-[10px] text-slate-400">{item.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                {ctxSel.size > 0 && (
                  <p className="text-[9px] text-slate-600 italic">
                    {ctxSel.size} item{ctxSel.size > 1 ? 's' : ''} será{ctxSel.size > 1 ? 'ão' : ''} incluído{ctxSel.size > 1 ? 's' : ''} na próxima mensagem.
                  </p>
                )}
              </div>
            )}

            {rightTab === 'memory' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">Memória do projeto</p>
                {/* VPS filter */}
                <select value={ctxVpsId} onChange={e => setCtxVpsId(e.target.value)}
                  className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-purple-500">
                  <option value="">— global —</option>
                  {vpsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>

                {/* Blocks */}
                {memBlocks.map(block => (
                  <div key={block.id} className="border border-slate-800 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/60">
                      <span className="text-[10px] font-medium text-slate-300">{block.key}</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditMemId(block.id); setEditMemVal(block.value) }}
                          className="p-0.5 text-slate-600 hover:text-slate-300"><Pencil size={9}/></button>
                        <button onClick={async () => { await ipc.memory.delete(block.id); loadMemory() }}
                          className="p-0.5 text-slate-600 hover:text-red-400"><X size={9}/></button>
                      </div>
                    </div>
                    {editMemId === block.id ? (
                      <div className="p-2 space-y-1">
                        <textarea value={editMemVal} onChange={e => setEditMemVal(e.target.value)} rows={3}
                          className="w-full text-[10px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 resize-none focus:outline-none focus:border-purple-500"/>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditMemId(null)} className="text-[9px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded">Cancelar</button>
                          <button onClick={async () => {
                            setSavingMem(true)
                            await ipc.memory.save({ vpsId: ctxVpsId || null, key: block.key, value: editMemVal })
                            await loadMemory(); setEditMemId(null); setSavingMem(false)
                          }} disabled={savingMem}
                            className="text-[9px] px-2 py-0.5 bg-purple-700 hover:bg-purple-600 rounded disabled:opacity-50">Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <pre className="px-2 py-1.5 text-[9px] text-slate-500 whitespace-pre-wrap max-h-20 overflow-y-auto">{block.value}</pre>
                    )}
                  </div>
                ))}

                {/* Novo bloco */}
                <div className="border border-slate-700 rounded-lg p-2 space-y-1.5">
                  <p className="text-[9px] text-slate-600">+ Novo bloco</p>
                  <input value={newMemKey} onChange={e => setNewMemKey(e.target.value)}
                    placeholder="chave (ex: stack, padrões)"
                    className="w-full text-[10px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-purple-500"/>
                  <textarea value={newMemVal} onChange={e => setNewMemVal(e.target.value)}
                    placeholder="conteúdo…" rows={2}
                    className="w-full text-[10px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 resize-none focus:outline-none focus:border-purple-500"/>
                  <button
                    onClick={async () => {
                      if (!newMemKey.trim() || !newMemVal.trim()) return
                      setSavingMem(true)
                      await ipc.memory.save({ vpsId: ctxVpsId || null, key: newMemKey.trim(), value: newMemVal.trim() })
                      setNewMemKey(''); setNewMemVal(''); await loadMemory(); setSavingMem(false)
                    }}
                    disabled={savingMem || !newMemKey.trim() || !newMemVal.trim()}
                    className="w-full text-[10px] py-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 rounded transition-colors"
                  >
                    {savingMem ? 'Salvando…' : 'Adicionar bloco'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ConvItem({ c, active, onOpen, onDelete, onPin }: {
  c: Conversation
  active: boolean
  onOpen: (c: Conversation) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onPin: (id: string, e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={() => onOpen(c)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left group transition-colors ${active ? 'bg-purple-900/40 text-slate-100' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
    >
      <MessageSquare size={12} className="shrink-0 text-slate-600"/>
      <span className="text-[11px] truncate flex-1">{c.title}</span>
      <span className="hidden group-hover:flex items-center gap-1">
        <span onClick={e => onPin(c.id, e)} className="p-0.5 hover:text-amber-400">
          {c.isPinned ? <StarOff size={10}/> : <Star size={10}/>}
        </span>
        <span onClick={e => onDelete(c.id, e)} className="p-0.5 hover:text-red-400">
          <Trash2 size={10}/>
        </span>
      </span>
    </button>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(msg.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] text-slate-500">{isUser ? 'Você' : 'Claude'}</span>
      <div className={`relative group max-w-3xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
        isUser ? 'bg-purple-900/50 border border-purple-700/40 text-slate-100' : 'bg-slate-800/60 border border-slate-700 text-slate-200'
      }`}>
        {msg.content}
        <button
          onClick={copy}
          className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-300"
          title="Copiar"
        >
          {copied ? <Check size={10} className="text-emerald-400"/> : <Copy size={10}/>}
        </button>
      </div>
    </div>
  )
}
