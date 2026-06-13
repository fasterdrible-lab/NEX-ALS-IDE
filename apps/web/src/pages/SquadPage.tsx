import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, X, Loader2, Users, Bot, Zap, Play, CheckCircle, AlertCircle, Server, FolderOpen, ChevronDown, ChevronRight, ChevronUp, FileText, Monitor, Trash2, Eraser, ArrowDown, User2, ExternalLink, RefreshCw, BookOpen, Sparkles, RotateCw, BarChart2, Activity, FilePen, Cpu, Clock, FileCheck2 } from 'lucide-react'
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

// ── Knowledge Base ────────────────────────────────────────────────────────────
interface KnowledgeBase {
  projeto: string
  stack: string
  estrutura: string
  status: string
  convencoes: string
  regras: string
  agentes: string
  notas: string
}
const KB_DEFAULT: KnowledgeBase = { projeto: '', stack: '', estrutura: '', status: '', convencoes: '', regras: '', agentes: '', notas: '' }
const KB_LS_KEY = 'squad_knowledge_bases'
function loadAllKBs(): Record<string, KnowledgeBase> { try { const r = localStorage.getItem(KB_LS_KEY); return r ? JSON.parse(r) : {} } catch { return {} } }
function loadKB(projectKey: string): KnowledgeBase { const all = loadAllKBs(); return all[projectKey] ? { ...KB_DEFAULT, ...all[projectKey] } : KB_DEFAULT }
function saveKB(projectKey: string, kb: KnowledgeBase) { try { localStorage.setItem(KB_LS_KEY, JSON.stringify({ ...loadAllKBs(), [projectKey]: kb })) } catch {} }
function buildKBString(kb: KnowledgeBase): string {
  const sections: [string, string][] = [
    ['PROJETO', kb.projeto], ['STACK', kb.stack], ['ESTRUTURA DE ARQUIVOS', kb.estrutura],
    ['STATUS ATUAL', kb.status], ['CONVENÇÕES', kb.convencoes],
    ['REGRAS DO SQUAD', kb.regras], ['HABILIDADES DOS AGENTES', kb.agentes], ['NOTAS TÉCNICAS', kb.notas],
  ]
  const filled = sections.filter(([, v]) => v.trim())
  return filled.length === 0 ? '' : filled.map(([k, v]) => `## ${k}\n${v.trim()}`).join('\n\n')
}
const KB_SECTIONS: { key: keyof KnowledgeBase; label: string; placeholder: string }[] = [
  { key: 'projeto',     label: 'Projeto',               placeholder: 'O que é, objetivo, usuários-alvo…' },
  { key: 'stack',       label: 'Stack',                  placeholder: 'Framework, banco, libs, versões…' },
  { key: 'estrutura',   label: 'Estrutura de arquivos',  placeholder: 'Caminhos-chave: apps/web/ → frontend\napps/api/ → API\npackages/db/ → schema…' },
  { key: 'status',      label: 'Status atual',           placeholder: 'Fase concluída, próxima tarefa, o que está pendente…' },
  { key: 'convencoes',  label: 'Convenções',             placeholder: 'Padrões de código, naming, estrutura de componentes…' },
  { key: 'regras',      label: 'Regras do squad',        placeholder: 'Jarvis: lê CURRENT_STATE primeiro\nFriday: TypeScript strict…' },
  { key: 'agentes',     label: 'Habilidades dos agentes',placeholder: 'Instruções específicas por agente…' },
  { key: 'notas',       label: 'Notas técnicas',         placeholder: 'Gotchas, configs especiais, limitações conhecidas…' },
]
const KB_TEMPLATES: Record<string, Partial<KnowledgeBase>> = {
  'Next.js SaaS': {
    stack: 'Frontend: Next.js 15 App Router + Tailwind CSS\nAPI: Next.js API Routes\nBanco: MySQL + Drizzle ORM\nFila: Redis + BullMQ\nStorage: Cloudflare R2 (AWS SDK v3)\nMonorepo: Turborepo + pnpm\nTypeScript strict',
    estrutura: 'apps/web/     → Next.js frontend\napps/api/     → API Routes\napps/workers/ → BullMQ workers\npackages/db/  → Drizzle schema + client\npackages/queue/ → BullMQ config\npackages/storage/ → StorageService\ndocs/ → CURRENT_STATE.md, TASKS.md, ARCHITECTURE.md',
    convencoes: '- TypeScript strict (sem any)\n- Singletons com lazy proxy (não falham no build Next.js)\n- export const dynamic = "force-dynamic" em rotas API\n- Imports absolutos (@/ ou @easy-sub/)\n- Componentes em PascalCase, hooks em camelCase',
    regras: '- Jarvis: ler CURRENT_STATE.md e TASKS.md antes de qualquer ação\n- Friday: TypeScript strict, sem any, sempre testa o caminho feliz\n- Shuri: gerar spec de UX antes de Friday implementar\n- Todos: um READ_FILE por arquivo, nunca reler o mesmo no mesmo ciclo\n- Use READ_DIR para explorar pasta antes de READ_FILE',
    notas: '- pnpm install requer --ignore-scripts nesta máquina\n- Singletons são lazy proxies para evitar erros no build Next.js\n- Rotas API usam export const dynamic = "force-dynamic"',
  },
  'Node.js API': {
    stack: 'Runtime: Node.js 22 LTS\nFramework: Express / Fastify\nBanco: PostgreSQL + Prisma\nValidação: Zod\nTypeScript strict\nTestes: Vitest',
    estrutura: 'src/routes/     → rotas HTTP\nsrc/services/   → lógica de negócio\nsrc/middleware/  → auth, logging, validação\nsrc/types/       → interfaces e schemas Zod\ntests/           → testes unitários',
    convencoes: '- TypeScript strict (sem any)\n- Zod para validação de input nas rotas\n- Nunca expor stack trace ao cliente\n- Logging estruturado com pino\n- Handlers async sempre com try/catch',
    regras: '- Friday: implementar rota + service + validação juntos\n- Tester: teste para toda rota nova (happy path + edge cases)\n- Requis: documentar endpoints com JSDoc',
    notas: '',
  },
  'React + Vite': {
    stack: 'Framework: React 18 + Vite\nEstilo: Tailwind CSS\nRoteamento: React Router 6\nEstado: Zustand ou Context\nTypeScript strict',
    estrutura: 'src/components/  → componentes reutilizáveis\nsrc/pages/       → páginas (por rota)\nsrc/hooks/       → hooks customizados\nsrc/lib/         → utilitários\nsrc/types/       → interfaces TypeScript',
    convencoes: '- Componentes em PascalCase\n- Hooks em camelCase com prefixo use\n- Props tipadas com interface (não type para props de componentes)\n- Evitar any — usar unknown + type guard',
    regras: '- Shuri: spec de componente antes de Friday implementar\n- Friday: componentes stateless quando possível, state no nível certo',
    notas: '',
  },
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

interface ActivityEntry {
  id: string
  ts: number
  type: ActionType
  label: string
  status: 'running' | 'ok' | 'error'
  output?: string
  durationMs?: number
}

interface SessionStats { reads: number; writes: number; shells: number; errors: number }

function parseActions(text: string): ActionBlock[] {
  const blocks: ActionBlock[] = []
  const matchedAt = new Set<number>()
  let m: RegExpExecArray | null

  function extractParams(raw: string): Record<string, string> {
    const p: Record<string, string> = {}
    const pr = /(\w+)="([^"]*)"/g; let pm: RegExpExecArray | null
    while ((pm = pr.exec(raw)) !== null) p[pm[1]] = pm[2]
    return p
  }

  // Cleans up common LLM patterns: [ cmd ], ```shell\ncmd\n```, backtick wrapping
  function cleanShellContent(raw: string, tagPos: number): string {
    let c = raw.trim()
    // Strip [ cmd ] wrapper — agents sometimes write the command between [ ]
    if (c.startsWith('[') && c.endsWith(']') && !c.startsWith('[ACTION:') && !c.startsWith('[/ACTION')) {
      c = c.slice(1, -1).trim()
    }
    // Strip markdown code fences: ```shell\n...\n``` or ```\n...\n```
    c = c.replace(/^```[\w]*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    // Strip single-backtick wrapping: `cmd`
    if (c.startsWith('`') && c.endsWith('`') && !c.includes('\n')) c = c.slice(1, -1).trim()

    // If still empty, scan backward in text for the last backtick/code block before this tag
    if (!c) {
      const before = text.slice(0, tagPos)
      // Look for a backtick code block just before the tag
      const codeBlock = /```[\w]*\n([\s\S]+?)\n```\s*$/.exec(before)
      if (codeBlock) c = codeBlock[1].trim()
      else {
        // Look for a line that starts with a Windows command keyword
        const lines = before.split('\n').map(l => l.trim()).filter(Boolean)
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
          const l = lines[i]
          if (/^(npx|npm|node|mkdir|rmdir|xcopy|rd |cd |dir |if exist|where|cmd )/i.test(l) ||
              /^(npx |npm |node |mkdir |rmdir |xcopy |echo |del |copy |move )/i.test(l)) {
            // Strip surrounding backticks if present
            c = l.replace(/^`|`$/g, '').trim()
            break
          }
        }
      }
    }
    return c
  }

  function pushBlock(idx: number, type: string, paramStr: string, content: string) {
    matchedAt.add(idx)
    const p = extractParams(paramStr)
    const cleaned = type.toLowerCase() === 'shell' ? cleanShellContent(content, idx) : content.trim()
    blocks.push({ id: `act-${Math.random().toString(36).slice(2)}`, type: type.toLowerCase() as ActionType, cwd: p['cwd'], path: p['path'], content: cleaned })
  }

  // Pass 1: [ACTION:TYPE params]content[/ACTION] — handles missing ] on closing tag
  const reFull = /\[ACTION:(\w+)([^\]]*)\]([\s\S]*?)\[\/ACTION\]?/gi
  while ((m = reFull.exec(text)) !== null) pushBlock(m.index, m[1], m[2], m[3])

  // Pass 2: orphan [ACTION:TYPE params] with no closing tag at all (e.g. model truncation)
  const reOrphan = /\[ACTION:(\w+)([^\]\n]*)\]/gi
  while ((m = reOrphan.exec(text)) !== null) {
    if (!matchedAt.has(m.index)) pushBlock(m.index, m[1], m[2], '')
  }

  return blocks
}

function stripActions(text: string): string {
  return text
    .replace(/\[ACTION:[^\]]*\][\s\S]*?(?:\[\/ACTION\]?)/gi, '')
    .replace(/\[ACTION:[^\]\n]*\]/gi, '') // remove orphan open tags
    .trim()
}

// ── VS Code-style file explorer ──────────────────────────────────────────────
interface ExplorerEntry { name: string; path: string; isDirectory: boolean; depth: number }

const EXPLORER_SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'dist-app', '.turbo', '__pycache__', '.venv', 'venv', '.cache'])

function fileIconColor(name: string): string {
  const ext = name.split('.').at(-1)?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'text-blue-400', tsx: 'text-blue-300', js: 'text-yellow-300', jsx: 'text-yellow-200',
    json: 'text-amber-300', md: 'text-slate-300', css: 'text-pink-400', html: 'text-orange-400',
    py: 'text-green-400', sql: 'text-purple-400', sh: 'text-green-300', env: 'text-red-400',
  }
  return map[ext] ?? 'text-slate-400'
}

// ── Client-side helpers ──────────────────────────────────────────────────────
function detectDelegations(agentName: AgentName, text: string): AgentName[] {
  const lower = text.toLowerCase()
  return AGENT_NAMES.filter(a => a !== agentName && lower.includes(`@${a}`))
}

function extractTask(text: string, target: AgentName): string {
  // Captura tudo a partir de @target até o próximo @agente ou fim do texto
  const agentsAlt = AGENT_NAMES.map(a => `@${a}`).join('|')
  const pattern = new RegExp(`@${target}[\\s\\S]*?(?=${agentsAlt}|$)`, 'i')
  const match = text.match(pattern)
  if (match) {
    const task = match[0].replace(new RegExp(`^@${target}[:\\s—\\-]*`, 'i'), '').trim()
    if (task.length > 20) return task.slice(0, 1200)
  }
  return text.slice(0, 1200)
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
  // Knowledge Base + local execution
  const [kb, setKb] = useState<KnowledgeBase>(() => loadKB('__global__'))
  const [kbOpen, setKbOpen] = useState(false)
  const [kbSection, setKbSection] = useState<keyof KnowledgeBase | null>(null)
  const projectContext = useMemo(() => buildKBString(kb), [kb])
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
  const [maxAutoIter, setMaxAutoIter] = useState(30)
  const maxAutoIterRef = useRef(30)
  const [syncingKB, setSyncingKB] = useState(false)

  // Auto-executar ações (padrão ON — sem precisar clicar "Executar" em cada action)
  const [autoExecute, setAutoExecute] = useState(() => localStorage.getItem('squad_auto_execute') !== 'false')
  const autoExecuteRef = useRef(autoExecute)

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
  const rootAgentRef = useRef<AgentName>('jarvis')

  // ── Activity panel ───────────────────────────────────────────────────────────
  const [liveShellOutput, setLiveShellOutput] = useState('')
  const liveShellRef = useRef<HTMLDivElement>(null)
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const activityLogRef = useRef<ActivityEntry[]>([])
  const [sessionStats, setSessionStats] = useState<SessionStats>({ reads: 0, writes: 0, shells: 0, errors: 0 })
  const sessionStatsRef = useRef<SessionStats>({ reads: 0, writes: 0, shells: 0, errors: 0 })
  const [modifiedFiles, setModifiedFiles] = useState<string[]>([])
  const modifiedFilesRef = useRef<string[]>([])
  const [rightTab, setRightTab] = useState<'history' | 'activity' | 'context'>('history')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // ── Explorer state ────────────────────────────────────────────────────────────
  const [explorerCache, setExplorerCache] = useState<Record<string, ExplorerEntry[]>>({})
  const [explorerExpanded, setExplorerExpanded] = useState<Set<string>>(new Set())
  const [recentlyChanged, setRecentlyChanged] = useState<Record<string, number>>({})
  const explorerWatchIdRef = useRef<string | null>(null)

  const setAndRefBubbles = useCallback((updater: (prev: ChatBubble[]) => ChatBubble[]) => {
    setBubbles(prev => {
      const next = updater(prev)
      bubblesRef.current = next
      return next
    })
  }, [])

  function pushActivity(entry: ActivityEntry) {
    activityLogRef.current = [entry, ...activityLogRef.current].slice(0, 300)
    setActivityLog([...activityLogRef.current])
    setRightTab('activity')
  }

  function updateActivity(id: string, status: 'ok' | 'error', output: string, startTs: number) {
    activityLogRef.current = activityLogRef.current.map(e =>
      e.id === id ? { ...e, status, output, durationMs: Date.now() - startTs } : e
    )
    setActivityLog([...activityLogRef.current])
    const entry = activityLogRef.current.find(e => e.id === id)
    if (!entry) return
    const st = { ...sessionStatsRef.current }
    if (status === 'error') st.errors++
    else if (entry.type === 'read_file' || entry.type === 'read_dir') st.reads++
    else if (entry.type === 'write_file') st.writes++
    else if (entry.type === 'shell') st.shells++
    sessionStatsRef.current = st
    setSessionStats(st)
    if (status === 'ok' && entry.type === 'write_file' && entry.label) {
      const mf = modifiedFilesRef.current
      if (!mf.includes(entry.label)) {
        modifiedFilesRef.current = [entry.label, ...mf]
        setModifiedFiles([...modifiedFilesRef.current])
      }
    }
  }

  function clearActivity() {
    activityLogRef.current = []
    setActivityLog([])
    sessionStatsRef.current = { reads: 0, writes: 0, shells: 0, errors: 0 }
    setSessionStats({ reads: 0, writes: 0, shells: 0, errors: 0 })
    modifiedFilesRef.current = []
    setModifiedFiles([])
    setExpandedLogId(null)
  }

  // ── Explorer helpers ──────────────────────────────────────────────────────────
  async function loadExplorerDir(dirPath: string) {
    try {
      const raw = await ipc.local.readdir(dirPath)
      const entries: ExplorerEntry[] = raw
        .filter(e => !EXPLORER_SKIP.has(e.name))
        .map(e => ({ name: e.name, path: e.path, isDirectory: e.isDirectory, depth: 0 }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      setExplorerCache(prev => ({ ...prev, [dirPath]: entries }))
    } catch {}
  }

  async function toggleExplorerDir(entry: ExplorerEntry) {
    if (!entry.isDirectory) return
    const next = new Set(explorerExpanded)
    if (next.has(entry.path)) {
      next.delete(entry.path)
    } else {
      next.add(entry.path)
      if (!explorerCache[entry.path]) await loadExplorerDir(entry.path)
    }
    setExplorerExpanded(next)
  }

  const explorerFlat = useMemo((): ExplorerEntry[] => {
    if (!localPath || !explorerCache[localPath]) return []
    function buildFlat(entries: ExplorerEntry[], depth: number): ExplorerEntry[] {
      const result: ExplorerEntry[] = []
      for (const e of entries) {
        result.push({ ...e, depth })
        if (e.isDirectory && explorerExpanded.has(e.path)) {
          result.push(...buildFlat(explorerCache[e.path] ?? [], depth + 1))
        }
      }
      return result
    }
    return buildFlat(explorerCache[localPath], 0)
  }, [explorerCache, explorerExpanded, localPath])

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
  useEffect(() => { maxAutoIterRef.current = maxAutoIter }, [maxAutoIter])
  useEffect(() => {
    autoExecuteRef.current = autoExecute
    localStorage.setItem('squad_auto_execute', String(autoExecute))
  }, [autoExecute])
  // Reload KB when project (localPath) changes
  useEffect(() => { setKb(loadKB(localPath || '__global__')) }, [localPath])

  // Explorer watcher — start/stop when localPath changes
  useEffect(() => {
    if (!localPath || executionMode !== 'local') {
      setExplorerCache({})
      setExplorerExpanded(new Set())
      return
    }
    void loadExplorerDir(localPath)
    const watchId = `explorer-${Date.now()}`
    explorerWatchIdRef.current = watchId
    ipc.local.watch(watchId, localPath).catch(console.error)
    const unsub = ipc.local.onFsChange(e => {
      if (e.watchId !== watchId) return
      const sep = e.fullPath.includes('\\') ? '\\' : '/'
      const parentDir = e.fullPath.includes(sep)
        ? e.fullPath.slice(0, e.fullPath.lastIndexOf(sep))
        : localPath
      setExplorerCache(prev => {
        if (prev[parentDir] !== undefined) void loadExplorerDir(parentDir)
        return prev
      })
      if (parentDir === localPath) void loadExplorerDir(localPath)
      setRecentlyChanged(prev => ({ ...prev, [e.fullPath]: Date.now() }))
    })
    return () => {
      unsub()
      if (explorerWatchIdRef.current) {
        ipc.local.unwatch(explorerWatchIdRef.current).catch(console.error)
        explorerWatchIdRef.current = null
      }
      setExplorerCache({})
      setExplorerExpanded(new Set())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPath, executionMode])

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
    clearActivity()
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

  // Live shell output streaming
  useEffect(() => {
    return ipc.squad.shell.onLine((line: string) => {
      setLiveShellOutput(prev => prev + line)
      setTimeout(() => {
        if (liveShellRef.current) liveShellRef.current.scrollTop = liveShellRef.current.scrollHeight
      }, 0)
    })
  }, [])

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

    rootAgentRef.current = targetAgent
    await streamAgent(targetAgent, message, sid, undefined, 0)

    if (autonomousModeRef.current) {
      await autonomousLoop(sid)
    } else if (autoExecuteRef.current) {
      // Exec auto: executa actions e envia resultados de volta (até 6 rodadas por mensagem)
      await autoExecRound(sid)
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
    clearActivity()
  }

  function cancelStream() {
    if (activeStreamId) ipc.squad.stream.cancel(activeStreamId).catch(console.error)
  }

  function stopAutonomous() {
    stopRequestedRef.current = true
    if (activeStreamId) ipc.squad.stream.cancel(activeStreamId).catch(console.error)
  }

  async function syncKBFromProject() {
    if (!localPath || syncingKB) return
    setSyncingKB(true)
    const sep = localPath.includes('\\') ? '\\' : '/'
    const join = (...parts: string[]) => parts.join(sep).replace(/[\\/]+/g, sep)
    const candidates: [string, keyof KnowledgeBase][] = [
      [join(localPath, 'README.md'),                 'projeto'],
      [join(localPath, 'readme.md'),                 'projeto'],
      [join(localPath, 'docs', 'CURRENT_STATE.md'),  'status'],
      [join(localPath, 'CURRENT_STATE.md'),          'status'],
      [join(localPath, 'docs', 'TASKS.md'),          'status'],
      [join(localPath, 'docs', 'ARCHITECTURE.md'),   'estrutura'],
      [join(localPath, 'ARCHITECTURE.md'),           'estrutura'],
    ]
    const updates: Partial<KnowledgeBase> = {}
    for (const [filePath, section] of candidates) {
      if (updates[section]) continue // already got this section
      try {
        const res = await ipc.squad.action.execute({ type: 'read_file', content: '', path: filePath, vpsId: '__local__' })
        if (res.output && !res.output.startsWith('[Pasta detectada')) {
          updates[section] = section === 'status' && updates.status
            ? `${updates.status}\n\n---\n\n${res.output.slice(0, 2000)}`
            : res.output.slice(0, 3000)
        }
      } catch { /* file missing, skip */ }
    }
    if (Object.keys(updates).length > 0) {
      const nk = { ...kb, ...updates }
      setKb(nk)
      saveKB(localPath || '__global__', nk)
    }
    setSyncingKB(false)
  }

  async function executeActionsAuto(actions: ActionBlock[]): Promise<Array<{ type: string; desc: string; output: string; ok: boolean }>> {
    const results: Array<{ type: string; desc: string; output: string; ok: boolean }> = []
    for (const action of actions) {
      // Skip empty SHELL — agent produced [ACTION:SHELL][/ACTION] with no command
      if (action.type === 'shell' && !action.content.trim()) {
        const projPath = (executionMode === 'local' && localPath) ? localPath : 'C:\\projeto'
        results.push({
          type: action.type, desc: '', ok: false,
          output: `[ERRO] Comando SHELL vazio. O comando DEVE ficar entre as tags, assim:\n\n[ACTION:SHELL cwd="${projPath}"]\nseu-comando-aqui\n[/ACTION]\n\nVocê escreveu o comando FORA ou ANTES do tag. Repita com o comando dentro.`,
        })
        continue
      }
      const desc = action.cwd ? `cwd:${action.cwd}` : action.path ? `path:${action.path}` : ''
      const label = action.path || (action.content.slice(0, 70).replace(/\n/g, ' '))
      const startTs = Date.now()
      if (action.type === 'shell') setLiveShellOutput('')
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'running' } }))
      pushActivity({ id: action.id, ts: startTs, type: action.type, label, status: 'running' })
      try {
        const vpsId = executionMode === 'local' ? '__local__' : selectedVpsId
        if (!vpsId) {
          const msg = 'Sem VPS/pasta configurada'
          setActionStates(prev => ({ ...prev, [action.id]: { status: 'error', output: msg } }))
          updateActivity(action.id, 'error', msg, startTs)
          results.push({ type: action.type, desc, output: msg, ok: false })
          continue
        }
        const cwd = executionMode === 'local' ? (action.cwd ?? localPath ?? undefined) : action.cwd
        const res = await ipc.squad.action.execute({ type: action.type, content: action.content, cwd, path: action.path, vpsId })
        // Detect backend-signalled shell errors (ENOENT, non-zero exit code, etc.)
        const isShellErr = action.type === 'shell' && res.output.startsWith('[SHELL_ERROR')
        const actionStatus = isShellErr ? 'error' : 'ok'
        setActionStates(prev => ({ ...prev, [action.id]: { status: actionStatus, output: res.output } }))
        updateActivity(action.id, actionStatus, res.output, startTs)
        results.push({ type: action.type, desc, output: res.output, ok: !isShellErr })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setActionStates(prev => ({ ...prev, [action.id]: { status: 'error', output: msg } }))
        updateActivity(action.id, 'error', msg, startTs)
        results.push({ type: action.type, desc, output: msg, ok: false })
      }
    }
    return results
  }

  async function autonomousLoop(sid: string): Promise<void> {
    setIsAutonomousRunning(true)
    stopRequestedRef.current = false
    autoIterRef.current = 0
    const report = { reads: 0, writes: 0, shells: 0, errors: 0, filesWritten: [] as string[] }
    try {
      while (!stopRequestedRef.current && autoIterRef.current < maxAutoIterRef.current) {
        const agentBubbles = bubblesRef.current.filter(b => b.type === 'agent' && !b.isStreaming)
        const lastBubble = agentBubbles.at(-1)
        if (!lastBubble) break

        // Stop if ANY agent concluded
        if (/\[PRONTO\]|\[DONE\]|\[CONCLUÍDO\]/i.test(lastBubble.content)) {
          setAndRefBubbles(prev => [...prev, { id: crypto.randomUUID(), type: 'system', content: '✅ Tarefa concluída pelo agente' }])
          break
        }

        const hasActions = (lastBubble.actions?.length ?? 0) > 0
        const isRootBubble = lastBubble.agentName === rootAgentRef.current

        if (!hasActions) {
          // Check if the last response contains a delegation to another agent
          const hasDelegation = lastBubble.agentName
            ? detectDelegations(lastBubble.agentName, lastBubble.content).length > 0
            : false

          // Root with no actions and no delegation → done
          if (isRootBubble && !hasDelegation) break

          // Root delegated → delegation already ran at depth=1 inside streamAgent;
          // the delegated agent's bubble is now the effective last — continue to pick it up
          if (isRootBubble && hasDelegation) { continue }

          // Non-root agent planned without action tags → push them to execute NOW
          autoIterRef.current++
          setAutoIteration(autoIterRef.current)
          const agentToPush = lastBubble.agentName ?? rootAgentRef.current
          setAndRefBubbles(prev => [...prev, {
            id: crypto.randomUUID(), type: 'system',
            content: `⚙️ Iteração ${autoIterRef.current} — aguardando ${AGENT_META[agentToPush]?.label ?? agentToPush} executar…`,
          }])
          const projPath = (executionMode === 'local' && localPath) ? localPath : 'C:\\caminho\\do\\projeto'
          await streamAgent(
            agentToPush,
            `EXECUTE AGORA. Emita apenas um ACTION tag (sem texto antes ou depois).\n\nFormato obrigatório:\n[ACTION:SHELL cwd="${projPath}"]\nseu-comando-aqui\n[/ACTION]\n\nOu para criar arquivo:\n[ACTION:WRITE_FILE path="${projPath}\\\\arquivo.ts"]\nconteúdo\n[/ACTION]\n\nCaminho do projeto: ${projPath}\nNão escreva explicação. Não planeje. Apenas o ACTION.`,
            sid,
            lastBubble.delegatedBy,
            1,
          )
          continue
        }

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
          if (r.type === 'read_file' || r.type === 'read_dir') report.reads++
          else if (r.type === 'write_file') { report.writes++; if (r.ok && r.desc) report.filesWritten.push(r.desc.replace('path:', '').trim()) }
          else if (r.type === 'shell') report.shells++
          if (!r.ok) report.errors++
        }
        lines.push('\nAnalise os resultados e continue trabalhando. Se concluiu tudo, inclua [PRONTO] na resposta.')

        // Return results to the agent that produced the actions:
        // — root agent → depth 0 (can trigger further delegations)
        // — delegated agent → depth 1 (stays focused on its own task)
        const resultAgent = isRootBubble ? rootAgentRef.current : (lastBubble.agentName ?? rootAgentRef.current)
        const resultDepth = isRootBubble ? 0 : 1
        const resultDelegatedBy = isRootBubble ? undefined : lastBubble.delegatedBy
        await streamAgent(resultAgent, lines.join('\n'), sid, resultDelegatedBy, resultDepth)
      }
      if (!stopRequestedRef.current && autoIterRef.current >= maxAutoIterRef.current) {
        setAndRefBubbles(prev => [...prev, { id: crypto.randomUUID(), type: 'system', content: `⚠️ Limite de ${maxAutoIterRef.current} iterações atingido` }])
      }
      // Relatório final do ciclo
      if (autoIterRef.current > 0) {
        const parts: string[] = [`📊 Ciclo autônomo concluído — ${autoIterRef.current} iteração(ões)`]
        if (report.filesWritten.length > 0) parts.push(`✏️ Arquivos criados/modificados: ${report.filesWritten.join(', ')}`)
        if (report.reads > 0) parts.push(`📖 Leituras: ${report.reads}`)
        if (report.shells > 0) parts.push(`⚡ Comandos: ${report.shells}`)
        if (report.errors > 0) parts.push(`⚠️ ${report.errors} erro(s)`)
        setAndRefBubbles(prev => [...prev, { id: crypto.randomUUID(), type: 'system', content: parts.join('  ·  ') }])
      }
    } finally {
      setIsAutonomousRunning(false)
      setAutoIteration(0)
      autoIterRef.current = 0
    }
  }

  // Exec auto: executa actions, envia resultados ao root agent e repete até não haver mais actions
  async function autoExecRound(sid: string, maxRounds = 20): Promise<void> {
    let round = 0
    for (; round < maxRounds; round++) {
      const agentBubbles = bubblesRef.current.filter(b => b.type === 'agent' && !b.isStreaming)
      const lastBubble = agentBubbles.at(-1)
      if (!lastBubble?.actions?.length) break

      if (/\[PRONTO\]|\[DONE\]|\[CONCLUÍDO\]/i.test(lastBubble.content)) break

      setAndRefBubbles(prev => [...prev, {
        id: crypto.randomUUID(), type: 'system',
        content: `⚡ Rodada ${round + 1} — executando ${lastBubble.actions!.length} ação(ões)…`,
      }])

      const results = await executeActionsAuto(lastBubble.actions!)

      const lines: string[] = ['[RESULTADO DAS AÇÕES]']
      for (const r of results) {
        const desc = r.desc ? ` (${r.desc})` : ''
        lines.push(`\n${r.type.toUpperCase()}${desc}:\n${r.ok ? '✅ Sucesso' : '❌ Erro'}\n${r.output.slice(0, 2000)}`)
      }
      lines.push('\nAnalise os resultados e continue. Se concluiu tudo, inclua [PRONTO].')

      // Route results to the agent that produced the actions (not always root)
      const isRoot = lastBubble.agentName === rootAgentRef.current
      const resultAgent = isRoot ? rootAgentRef.current : (lastBubble.agentName ?? rootAgentRef.current)
      await streamAgent(resultAgent, lines.join('\n'), sid, isRoot ? undefined : lastBubble.delegatedBy, isRoot ? 0 : 1)
    }
    if (round >= maxRounds) {
      setAndRefBubbles(prev => [...prev, {
        id: crypto.randomUUID(), type: 'system',
        content: `⚠️ ${maxRounds} rodadas concluídas. Ative "Auto" para continuar automaticamente ou envie uma nova mensagem.`,
      }])
    }
  }

  async function executeAction(action: ActionBlock) {
    const vpsId = executionMode === 'local' ? '__local__' : selectedVpsId
    if (!vpsId) return
    setActionStates(prev => ({ ...prev, [action.id]: { status: 'running' } }))
    const label = action.path || (action.content.slice(0, 70).replace(/\n/g, ' '))
    const startTs = Date.now()
    pushActivity({ id: action.id, ts: startTs, type: action.type, label, status: 'running' })
    try {
      const cwd = executionMode === 'local' ? (action.cwd ?? localPath ?? undefined) : action.cwd
      const res = await ipc.squad.action.execute({ type: action.type, content: action.content, cwd, path: action.path, vpsId })
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'ok', output: res.output } }))
      updateActivity(action.id, 'ok', res.output, startTs)
      if (executionMode === 'vps' && pipelineMode && prodVpsId && prodVpsId !== selectedVpsId) {
        setPipelineGates(prev => ({ ...prev, [action.id]: { action, homologOutput: res.output, status: 'pending' } }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionStates(prev => ({ ...prev, [action.id]: { status: 'error', output: msg } }))
      updateActivity(action.id, 'error', msg, startTs)
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

        {/* ── VS Code-style live file explorer ─────────────────────────────── */}
        {executionMode === 'local' && (
          <div className="border-t border-slate-800 flex flex-col shrink-0" style={{ maxHeight: localPath ? 320 : 80 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 shrink-0 bg-slate-900/80">
              <div className="flex items-center gap-1.5 min-w-0">
                <FolderOpen size={11} className="shrink-0 text-amber-400/70" />
                <span className="truncate text-[10px] font-semibold text-slate-300" title={localPath || 'Explorer'}>
                  {localPath ? (localPath.split(/[\\/]/).at(-1) || 'Projeto') : 'Explorer'}
                </span>
              </div>
              {localPath && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => void loadExplorerDir(localPath)}
                    title="Atualizar"
                    className="p-0.5 text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    <RefreshCw size={10} />
                  </button>
                  <button
                    onClick={() => ipc.local.exec(`code-insiders "${localPath}"`, localPath).catch(() =>
                      ipc.local.exec(`code "${localPath}"`, localPath).catch(console.error)
                    )}
                    title="Abrir no VS Code Insiders"
                    className="p-0.5 text-slate-600 hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* Empty state — no path set */}
            {!localPath && (
              <button
                onClick={async () => {
                  const res = await ipc.local.openFolder()
                  if (res) setLocalPath(res)
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
              >
                <FolderOpen size={13} className="shrink-0 text-amber-400/60" />
                <span className="text-[10px] text-slate-500 leading-tight">
                  Selecionar pasta do projeto<br />
                  <span className="text-slate-700">para ver arquivos em tempo real</span>
                </span>
              </button>
            )}

            {/* File tree */}
            {localPath && (
              <div className="overflow-y-auto flex-1 text-[11px]">
                {explorerFlat.length === 0 ? (
                  <p className="text-slate-700 text-[10px] px-3 py-2 italic">carregando…</p>
                ) : explorerFlat.map(entry => {
                  const changedAt = recentlyChanged[entry.path]
                  const isNew = !!changedAt && Date.now() - changedAt < 8000
                  return (
                    <div
                      key={entry.path}
                      onClick={() => { if (entry.isDirectory) void toggleExplorerDir(entry) }}
                      className={`flex items-center gap-1 py-0.5 cursor-pointer hover:bg-slate-800/70 transition-colors ${isNew ? 'bg-amber-900/20' : ''}`}
                      style={{ paddingLeft: 8 + entry.depth * 10 }}
                    >
                      {entry.isDirectory
                        ? explorerExpanded.has(entry.path)
                          ? <ChevronDown size={10} className="shrink-0 text-slate-500" />
                          : <ChevronRight size={10} className="shrink-0 text-slate-500" />
                        : <span className="w-2.5 shrink-0" />
                      }
                      {entry.isDirectory
                        ? <FolderOpen size={11} className="shrink-0 text-amber-400/60" />
                        : <FileText size={11} className={`shrink-0 ${fileIconColor(entry.name)}`} />
                      }
                      <span className={`truncate ml-0.5 ${isNew ? 'text-amber-300 font-semibold' : entry.isDirectory ? 'text-slate-300' : 'text-slate-400'}`}>
                        {entry.name}
                      </span>
                      {isNew && !entry.isDirectory && (
                        <span className="shrink-0 text-[9px] font-bold text-amber-400 ml-auto mr-1">W</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
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
                autônomo · {autoIteration}/{maxAutoIter}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAutoExecute(v => !v)}
              disabled={isStreaming || isAutonomousRunning}
              title={autoExecute ? 'Auto-executar ações ON — ações executam automaticamente (sem clicar Executar)' : 'Auto-executar ações OFF — clique Executar em cada action manualmente'}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                autoExecute
                  ? 'bg-amber-900/30 border-amber-700/50 text-amber-400'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              <Zap size={10} />
              Exec auto
            </button>
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
            {autonomousMode && (
              <input
                type="number"
                min={5} max={200}
                value={maxAutoIter}
                onChange={e => setMaxAutoIter(Math.max(5, Math.min(200, Number(e.target.value))))}
                disabled={isAutonomousRunning}
                title="Limite de iterações do modo autônomo"
                className="w-12 text-center text-[10px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-300 focus:outline-none focus:border-green-600 disabled:opacity-40"
              />
            )}
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
        {/* ── Knowledge Base ─────────────────────────────────── */}
        <div className="border-b border-slate-800">
          <button
            onClick={() => setKbOpen(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <BookOpen size={12} className="text-violet-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Base de Conhecimento</span>
              {localPath ? (
                <span className="text-[9px] text-violet-400/70 bg-violet-400/10 border border-violet-400/20 rounded px-1.5 py-0.5 truncate max-w-[80px]" title={localPath}>
                  {localPath.split(/[\\/]/).at(-1)}
                </span>
              ) : null}
              {projectContext && (
                <span className="text-[9px] text-green-400 bg-green-400/10 border border-green-400/20 rounded px-1.5 py-0.5 font-medium">ativo</span>
              )}
            </div>
            {kbOpen ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
          </button>
          {kbOpen && (
            <div className="px-3 pb-4 space-y-1">
              {/* Sincronizar + Templates */}
              <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-800/80">
                {localPath && (
                  <button
                    onClick={syncKBFromProject}
                    disabled={syncingKB}
                    title="Preencher KB com README, CURRENT_STATE e ARCHITECTURE do projeto"
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-violet-700/50 text-violet-400 hover:border-violet-500 hover:text-violet-300 transition-colors disabled:opacity-50"
                  >
                    <RotateCw size={9} className={syncingKB ? 'animate-spin' : ''} />
                    {syncingKB ? 'Sincronizando…' : 'Sincronizar'}
                  </button>
                )}
                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                  <Sparkles size={8} />
                </span>
                {Object.entries(KB_TEMPLATES).map(([name, tmpl]) => (
                  <button
                    key={name}
                    onClick={() => { const nk = { ...kb, ...tmpl }; setKb(nk); saveKB(localPath || '__global__', nk) }}
                    className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:border-violet-600/60 hover:text-violet-300 transition-colors"
                  >{name}</button>
                ))}
                <button
                  onClick={() => { setKb(KB_DEFAULT); saveKB(localPath || '__global__', KB_DEFAULT) }}
                  className="text-[10px] px-2 py-0.5 rounded border border-red-900/40 text-red-500/60 hover:border-red-500/50 hover:text-red-400 transition-colors ml-auto"
                >Limpar</button>
              </div>

              {/* Accordion sections */}
              {KB_SECTIONS.map(({ key, label, placeholder }) => {
                const val = kb[key]
                const open = kbSection === key
                return (
                  <div key={key} className="rounded-lg border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setKbSection(prev => prev === key ? null : key)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">{label}</span>
                        {val.trim() && (
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                        )}
                      </div>
                      {open ? <ChevronUp size={10} className="text-slate-600 shrink-0" /> : <ChevronDown size={10} className="text-slate-600 shrink-0" />}
                    </button>
                    {open && (
                      <textarea
                        value={val}
                        onChange={e => { const nk = { ...kb, [key]: e.target.value }; setKb(nk); saveKB(localPath || '__global__', nk) }}
                        placeholder={placeholder}
                        rows={4}
                        className="w-full bg-slate-900/80 border-t border-slate-800 px-2.5 py-2 text-xs text-slate-200 placeholder-slate-700 resize-none focus:outline-none focus:bg-slate-900 transition-colors leading-relaxed"
                      />
                    )}
                  </div>
                )
              })}

              {projectContext ? (
                <p className="text-[10px] text-green-500 pt-1 flex items-center gap-1">
                  <CheckCircle size={9} /> {projectContext.length} chars injetados em todos os agentes
                </p>
              ) : (
                <p className="text-[10px] text-slate-600 pt-1">Preencha as seções para dar contexto ao squad.</p>
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
              {localPath ? (
                <p className="text-[10px] text-green-500 flex items-center gap-1">
                  <CheckCircle size={9} /> <span className="truncate">{localPath}</span>
                </p>
              ) : (
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertCircle size={9} className="shrink-0" /> Defina a pasta para os agentes saberem onde escrever
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

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-800 shrink-0">
          {([
            { key: 'history',  icon: Clock,    label: 'Histórico' },
            { key: 'activity', icon: Activity, label: 'Atividade' },
            { key: 'context',  icon: Cpu,      label: 'Contexto'  },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setRightTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${
                rightTab === key
                  ? 'text-brand-400 border-brand-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              <Icon size={10} />
              {label}
              {key === 'activity' && activityLog.length > 0 && (
                <span className="ml-0.5 bg-brand-600/40 text-brand-300 text-[9px] px-1 rounded-full">{activityLog.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Histórico ───────────────────────────────────────────── */}
        {rightTab === 'history' && (
          <>
            <div className="px-3 py-1.5 border-b border-slate-800 flex justify-end">
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
          </>
        )}

        {/* ── Tab: Atividade ───────────────────────────────────────────── */}
        {rightTab === 'activity' && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-px bg-slate-800 border-b border-slate-700 shrink-0">
              {([
                { label: 'Iter',  value: autoIteration,        color: 'text-brand-400'  },
                { label: 'Leit',  value: sessionStats.reads,   color: 'text-blue-400'   },
                { label: 'Escr',  value: sessionStats.writes,  color: 'text-green-400'  },
                { label: 'Erros', value: sessionStats.errors,  color: 'text-red-400'    },
              ] as const).map(({ label, value, color }) => (
                <div key={label} className="bg-slate-900 px-1 py-2 text-center">
                  <p className={`text-sm font-bold leading-none ${color}`}>{value}</p>
                  <p className="text-[8px] text-slate-500 uppercase mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Terminal live — output em tempo real do SHELL */}
            {liveShellOutput && (
              <div className="border-b border-slate-800 shrink-0">
                <p className="text-[9px] text-slate-500 uppercase font-semibold px-3 pt-2 pb-1 flex items-center gap-1">
                  <Activity size={9} className="text-amber-400 animate-pulse" />
                  Terminal ao vivo
                </p>
                <div ref={liveShellRef} className="max-h-40 overflow-y-auto bg-slate-950 px-3 pb-2">
                  <pre className="text-[9px] text-green-300 whitespace-pre-wrap leading-relaxed font-mono">{liveShellOutput}</pre>
                </div>
              </div>
            )}

            {/* Arquivos modificados — estilo VS Code Explorer */}
            {modifiedFiles.length > 0 && (
              <div className="px-3 py-2 border-b border-slate-800 shrink-0">
                <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1.5 flex items-center gap-1">
                  <FilePen size={9} className="text-emerald-400" />
                  Arquivos modificados ({modifiedFiles.length})
                </p>
                <div className="space-y-px max-h-36 overflow-y-auto">
                  {modifiedFiles.map(f => {
                    const parts = f.replace(/\\/g, '/').split('/')
                    const filename = parts.at(-1) ?? f
                    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
                    const ext = filename.includes('.') ? filename.split('.').at(-1)!.toLowerCase() : ''
                    const extColor: Record<string, string> = {
                      ts: 'text-blue-400', tsx: 'text-blue-300', js: 'text-yellow-300',
                      jsx: 'text-yellow-200', py: 'text-green-400', json: 'text-amber-300',
                      md: 'text-slate-300', css: 'text-pink-400', html: 'text-orange-400',
                      sql: 'text-purple-400', sh: 'text-green-300', env: 'text-red-400',
                    }
                    const fileColor = extColor[ext] ?? 'text-slate-300'
                    return (
                      <div key={f} className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800/60 group" title={f}>
                        <FileCheck2 size={10} className={`shrink-0 ${fileColor}`} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] font-semibold ${fileColor}`}>{filename}</span>
                          {parentPath && (
                            <span className="text-[9px] text-slate-600 ml-1.5 truncate">{parentPath}</span>
                          )}
                        </div>
                        <span className="shrink-0 text-[8px] font-bold text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 rounded px-1 leading-4">W</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Log de ações */}
            <div className="flex-1 overflow-y-auto">
              {activityLog.length === 0 ? (
                <p className="text-xs text-slate-600 px-4 py-4">Nenhuma ação executada nesta sessão.</p>
              ) : (
                activityLog.map(entry => {
                  const typeIcon = entry.type === 'shell' ? '⚡' : entry.type === 'write_file' ? '✏️' : entry.type === 'read_dir' ? '📂' : '📖'
                  const isExpanded = expandedLogId === entry.id
                  return (
                    <div key={entry.id} className="border-b border-slate-800/50">
                      <button
                        onClick={() => setExpandedLogId(prev => prev === entry.id ? null : entry.id)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800/40 transition-colors flex items-start gap-2"
                      >
                        <span className="text-xs mt-px shrink-0">{typeIcon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-300 truncate leading-relaxed">{entry.label}</p>
                          <p className="text-[9px] text-slate-600">
                            {new Date(entry.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            {entry.durationMs !== undefined && ` · ${entry.durationMs}ms`}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs mt-px font-bold ${
                          entry.status === 'ok' ? 'text-green-400' : entry.status === 'error' ? 'text-red-400' : 'text-yellow-400 animate-pulse'
                        }`}>
                          {entry.status === 'ok' ? '✓' : entry.status === 'error' ? '✗' : '…'}
                        </span>
                      </button>
                      {isExpanded && entry.output && (
                        <pre className="px-3 pb-2 text-[9px] text-slate-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-slate-900/60 border-t border-slate-800/60">
                          {entry.output.slice(0, 3000)}
                        </pre>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Contexto ────────────────────────────────────────────── */}
        {rightTab === 'context' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">

            {/* Agente ativo */}
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold tracking-wider mb-1.5">Agente ativo</p>
              <div className={`rounded-lg border px-3 py-2 ${meta.bgClass} ${meta.borderClass}`}>
                <p className={`text-xs font-semibold ${meta.colorClass}`}>{meta.emoji} {meta.label}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{meta.role}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Provider: {meta.provider}</p>
              </div>
            </div>

            {/* Modo de execução */}
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold tracking-wider mb-1.5">Execução</p>
              <div className="bg-slate-800/50 rounded-lg px-3 py-2 space-y-1">
                <p className="text-[10px] text-slate-200">{executionMode === 'local' ? '💻 Local' : '🖥️ VPS'}</p>
                {executionMode === 'local' && localPath && (
                  <p className="text-[9px] text-green-400 truncate" title={localPath}>{localPath}</p>
                )}
                {executionMode === 'vps' && selectedVpsId && (
                  <p className="text-[9px] text-blue-400">{vpsList.find(v => v.id === selectedVpsId)?.name ?? selectedVpsId}</p>
                )}
                {autonomousMode && (
                  <p className="text-[9px] text-yellow-400 flex items-center gap-1">
                    <Zap size={8} /> Autônomo ativo · máx {maxAutoIter} iter
                  </p>
                )}
              </div>
            </div>

            {/* KB injetada */}
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold tracking-wider mb-1.5 flex items-center gap-1">
                <BookOpen size={9} />
                KB injetada
              </p>
              {projectContext ? (
                <div className="bg-slate-800/50 rounded-lg p-2.5">
                  <p className="text-[9px] text-green-400 mb-1.5 font-medium">
                    {projectContext.length.toLocaleString()} chars · ~{Math.round(projectContext.length / 4).toLocaleString()} tokens
                  </p>
                  <pre className="text-[9px] text-slate-400 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                    {projectContext.slice(0, 2000)}{projectContext.length > 2000 ? '\n…' : ''}
                  </pre>
                </div>
              ) : (
                <p className="text-[10px] text-slate-600">KB vazia — preencha as seções acima.</p>
              )}
            </div>

          </div>
        )}

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
