import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import {
  ArrowLeft, Folder, FolderOpen, File, FileCode, FileText, FileJson, FileImage,
  Loader2, RefreshCw, FolderPlus, FilePlus, Trash2, Pencil, ChevronRight,
  AlertCircle, Save, X, Circle, TerminalSquare, HardDrive, ShieldAlert,
  GitBranch, Plus, Minus, Upload, Download, GitCommit as GitCommitIcon,
  Command, Search, PanelBottom, Copy, Files, Check, FolderOpen as FolderOpenIcon,
  MessageSquare, Send, Bot, Columns2, PanelRightClose, Network, Globe, Box, Cpu,
  ExternalLink, Siren, Rocket as RocketDeployIcon, List,
  BookMarked, Lightbulb,
} from 'lucide-react'
import { ipc, type FileEntry, type GitStatus, type GitFileStatus } from '../lib/ipc'
import { LSP_CONFIGS, monacoLangToLspKey } from '../lib/lsp'

// ── language / icon helpers ────────────────────────────────────────────

const LANG_MAP: Record<string, string> = {
  ts:'typescript', tsx:'typescript', js:'javascript', jsx:'javascript',
  py:'python', go:'go', rs:'rust', java:'java', rb:'ruby', php:'php',
  c:'c', cpp:'cpp', h:'c', cs:'csharp', swift:'swift', kt:'kotlin',
  json:'json', jsonc:'json', yaml:'yaml', yml:'yaml', toml:'ini',
  html:'html', htm:'html', css:'css', scss:'scss', less:'less',
  md:'markdown', sh:'shell', bash:'shell', zsh:'shell',
  sql:'sql', xml:'xml', svg:'xml', dockerfile:'dockerfile',
  env:'plaintext', gitignore:'plaintext', txt:'plaintext', log:'plaintext',
}
function detectLang(name: string) {
  if (name.toLowerCase() === 'dockerfile') return 'dockerfile'
  return LANG_MAP[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext'
}

const CODE_EXT = new Set(['ts','tsx','js','jsx','py','go','rs','java','c','cpp','h','sh','php','rb','swift','kt','cs'])
const TEXT_EXT = new Set(['md','txt','log','csv','env','gitignore','dockerfile','toml','ini','conf','yaml','yml'])
const JSON_EXT = new Set(['json','jsonc','lock'])
const IMG_EXT  = new Set(['png','jpg','jpeg','gif','svg','webp','ico'])
const IMG_PREVIEW = new Set(['png','jpg','jpeg','gif','webp','ico'])
const BIN_EXT     = new Set(['bmp','pdf','zip','tar','gz','exe','bin','node'])

function FileIcon({ name, isDir, open=false, sz=14 }: { name:string; isDir:boolean; open?:boolean; sz?:number }) {
  if (isDir) { const C = open ? FolderOpen : Folder; return <C size={sz} className="text-yellow-400 shrink-0" /> }
  const e = name.split('.').pop()?.toLowerCase() ?? ''
  if (CODE_EXT.has(e)) return <FileCode  size={sz} className="text-blue-400  shrink-0" />
  if (TEXT_EXT.has(e)) return <FileText  size={sz} className="text-slate-300 shrink-0" />
  if (JSON_EXT.has(e)) return <FileJson  size={sz} className="text-green-400 shrink-0" />
  if (IMG_EXT.has(e))  return <FileImage size={sz} className="text-pink-400  shrink-0" />
  return <File size={sz} className="text-slate-400 shrink-0" />
}

// ── git helpers ────────────────────────────────────────────────────────

const GIT_STATUS_COLOR: Record<string, string> = {
  M:'text-amber-400', A:'text-emerald-400', D:'text-red-400',
  R:'text-blue-400', C:'text-blue-400', '?':'text-slate-400',
}

// ── types ──────────────────────────────────────────────────────────────

interface OpenFile { path:string; name:string; content:string; savedContent:string; language:string; loading:boolean; imageDataUrl?:string }
interface Problem  { file:string; line:number; col:number; message:string; severity:'error'|'warning'|'info'; code?:string|number }
interface CtxMenu  { x:number; y:number; entry:FileEntry }
interface GitDiff  { content:string; filePath:string; staged:boolean }
interface SearchResult { file:string; line:number; preview:string }
interface KbSuggestion { title: string; content: string; category: string; tags: string }
interface OutlineSymbol { name:string; kind:number; line:number; endLine:number; detail?:string; children?:OutlineSymbol[] }

// ── Outline helpers ────────────────────────────────────────────────────
const SYMBOL_KIND: Record<number, { icon:string; color:string }> = {
  1:  { icon:'⬡',   color:'text-slate-400'  },
  2:  { icon:'▼',   color:'text-purple-400' },
  3:  { icon:'▼',   color:'text-purple-400' },
  4:  { icon:'▣',   color:'text-yellow-400' },
  5:  { icon:'◆',   color:'text-yellow-400' },
  6:  { icon:'⊕',   color:'text-emerald-400'},
  7:  { icon:'●',   color:'text-blue-400'   },
  8:  { icon:'●',   color:'text-sky-400'    },
  9:  { icon:'⊕',   color:'text-emerald-400'},
  10: { icon:'⊞',   color:'text-orange-400' },
  11: { icon:'◇',   color:'text-emerald-300'},
  12: { icon:'ƒ',   color:'text-emerald-400'},
  13: { icon:'◎',   color:'text-sky-400'    },
  14: { icon:'○',   color:'text-brand-300'  },
  15: { icon:'"',   color:'text-amber-400'  },
  16: { icon:'#',   color:'text-green-400'  },
  17: { icon:'?',   color:'text-sky-300'    },
  18: { icon:'[]',  color:'text-sky-400'    },
  19: { icon:'{}',  color:'text-slate-400'  },
  22: { icon:'⊞',   color:'text-orange-300' },
  23: { icon:'◆',   color:'text-orange-400' },
  24: { icon:'⚡',   color:'text-amber-300'  },
  26: { icon:'<T>', color:'text-sky-400'    },
}
function tsKindToSymbolKind(kind: string): number {
  const m: Record<string,number> = {
    module:11, class:5, method:6, property:7, field:8,
    constructor:9, enum:10, interface:11, function:12,
    var:13, variable:13, const:14, let:13, type:11, alias:11,
  }
  return m[kind] ?? 13
}

// IDE-05 multi-terminal
interface TermTab { id:string; title:string; sessionId:string|null; status:'connecting'|'connected'|'error'|'closed'; errMsg:string }
interface TermInstance { term:XTerm; fit:FitAddon; sessionId:string|null; unsubs:Array<()=>void>; ro:ResizeObserver|null }

// ── IDE-02: tree flatten helper ────────────────────────────────────────

interface FlatNode { entry:FileEntry; depth:number; childLoading:boolean }

function flattenTree(
  entries: FileEntry[], depth: number,
  expanded: Set<string>, children: Map<string, FileEntry[]>, loading: Set<string>
): FlatNode[] {
  const result: FlatNode[] = []
  for (const e of entries) {
    result.push({ entry:e, depth, childLoading: e.isDirectory && loading.has(e.path) })
    if (e.isDirectory && expanded.has(e.path)) {
      const ch = children.get(e.path) ?? []
      result.push(...flattenTree(ch, depth + 1, expanded, children, loading))
    }
  }
  return result
}

// ── small sub-components ───────────────────────────────────────────────

function Toast({ msg }: { msg: { ok:boolean; text:string } | null }) {
  if (!msg) return null
  return (
    <div className={`shrink-0 px-3 py-1 text-xs flex items-center gap-1.5 z-10 ${msg.ok?'bg-emerald-900/40 text-emerald-300':'bg-red-900/40 text-red-300'}`}>
      {msg.ok ? '✓' : '✗'} {msg.text}
    </div>
  )
}

function useResize(initial:number, min:number, max:number, axis:'x'|'y') {
  const [size, setSize] = useState(initial)
  const start = useCallback((e:React.MouseEvent) => {
    const origin = axis==='x' ? e.clientX : e.clientY
    const startSize = size
    const onMove = (ev:MouseEvent) => {
      setSize(Math.max(min, Math.min(max, startSize + (axis==='x'?ev.clientX:ev.clientY) - origin)))
    }
    const onUp = () => { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
    document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp)
  }, [size, min, max, axis])
  return [size, start] as const
}

// ── continuous learning — manifest heuristic ──────────────────────────

const MANIFEST_NAMES = new Set(['package.json','requirements.txt','go.mod','cargo.toml','docker-compose.yml','docker-compose.yaml','pyproject.toml'])

function analyzeManifest(name: string, content: string): KbSuggestion | null {
  const lower = name.toLowerCase()
  if (!MANIFEST_NAMES.has(lower)) return null
  try {
    if (lower === 'package.json') {
      const pkg = JSON.parse(content) as Record<string, unknown>
      const deps = Object.keys({ ...(pkg.dependencies as Record<string,unknown> ?? {}), ...(pkg.devDependencies as Record<string,unknown> ?? {}) }).slice(0, 20)
      return {
        title: `Stack Node.js: ${String(pkg.name ?? 'projeto')}`,
        content: `**Versão:** ${String(pkg.name ?? '')}@${String(pkg.version ?? '')}\n**Runtime:** Node.js\n**Dependências principais:** ${deps.join(', ')}`,
        category: 'stack',
        tags: `node,npm,${String(pkg.name ?? '')}`,
      }
    }
    if (lower === 'requirements.txt') {
      const libs = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).slice(0, 15).join(', ')
      return { title: 'Stack Python: dependências', content: `**Runtime:** Python\n**Libs:** ${libs}`, category: 'stack', tags: 'python,pip' }
    }
    if (lower === 'go.mod') {
      const mod = content.match(/^module\s+(.+)/m)?.[1] ?? 'go-project'
      const goVer = content.match(/^go\s+(\S+)/m)?.[1] ?? ''
      return { title: `Stack Go: ${mod}`, content: `**Module:** ${mod}\n**Go:** ${goVer}`, category: 'stack', tags: 'go,golang' }
    }
    if (lower === 'cargo.toml') {
      const crate = content.match(/^name\s*=\s*"(.+)"/m)?.[1] ?? 'rust-project'
      const ver = content.match(/^version\s*=\s*"(.+)"/m)?.[1] ?? ''
      return { title: `Stack Rust: ${crate}`, content: `**Crate:** ${crate} v${ver}\n**Runtime:** Rust`, category: 'stack', tags: 'rust,cargo' }
    }
    if (lower.startsWith('docker-compose')) {
      const services = [...content.matchAll(/^\s{2}(\w[\w-]+):\s*$/gm)].map(m => m[1]).slice(0, 10)
      return { title: 'Docker Compose: serviços', content: `**Serviços:** ${services.join(', ')}`, category: 'arquitetura', tags: 'docker,compose,containers' }
    }
  } catch { /* invalid JSON or parse error — skip */ }
  return null
}

// ── main ───────────────────────────────────────────────────────────────

export default function IDEPage() {
  const { vpsId, vpsName } = useParams<{ vpsId:string; vpsName:string }>()
  const navigate = useNavigate()

  // IDE-20: modo local (sem VPS) quando rota é /ide/local
  const isLocal = !vpsId
  const [localRoot, setLocalRoot] = useState('')
  const localRootRef = useRef('')

  const displayName = isLocal
    ? (localRoot ? localRoot.split(/[\\/]/).pop() || 'Local' : 'Abrindo…')
    : (vpsName ? decodeURIComponent(vpsName) : 'VPS')

  const [leftW,    startResizeLeft] = useResize(240, 140, 500, 'x')
  const [termH,    startResizeTerm] = useResize(200, 100, 600, 'y')
  const [chatW,    startResizeChat] = useResize(320, 200, 600, 'x')
  const [showTerm,    setShowTerm]    = useState(false)
  const [leftPanel,   setLeftPanel]   = useState<'files'|'search'|'git'|'ports'|'docker'|'pm2'|'outline'>('files')
  const [pm2Processes, setPm2Processes] = useState<Array<{id:number;name:string;status:string;cpu:number;memory:number;restarts:number;uptime:number}>>([])
  const [pm2Loading, setPm2Loading] = useState(false)
  const [pm2Logs, setPm2Logs] = useState<{name:string;logs:string}|null>(null)
  const [pm2ActionName, setPm2ActionName] = useState<string|null>(null)

  const [dockerContainers, setDockerContainers] = useState<Array<{id:string;name:string;image:string;status:string;state:string;ports:string}>>([])
  const [dockerLoading, setDockerLoading] = useState(false)
  const [dockerLogs, setDockerLogs] = useState<{id:string;name:string;logs:string}|null>(null)
  const [dockerActionId, setDockerActionId] = useState<string|null>(null)
  const [bottomPanel, setBottomPanel] = useState<'terminal'|'problems'|'logs'>('terminal')
  const [logsCmd,     setLogsCmd]     = useState('tail -n 200 /var/log/syslog')
  const [logsOutput,  setLogsOutput]  = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsWatch,   setLogsWatch]   = useState(false)
  const logsWatchRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const logsEndRef   = useRef<HTMLDivElement>(null)
  const [problems,    setProblems]    = useState<Problem[]>([])
  const markerDisposableRef = useRef<{ dispose(): void } | null>(null)

  // IDE-16 / IDE-22: LSP multi-linguagem (TS/PY/RS/GO)
  const [lspStates, setLspStates] = useState<Record<string, boolean>>({})
  const [lspLoading, setLspLoading] = useState(false)
  const monacoRef = useRef<Monaco|null>(null)

  // Outline & Breadcrumbs
  const [outlineSymbols, setOutlineSymbols] = useState<OutlineSymbol[]>([])
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [currentSymbol,  setCurrentSymbol]  = useState<string|null>(null)
  const outlineRef = useRef<OutlineSymbol[]>([])

  const toggleLSP = async (langKey: string) => {
    if (lspLoading) return
    const config = LSP_CONFIGS[langKey]
    if (!config) return
    setLspLoading(true)
    try {
      const { connectLSP, disconnectLSP, isLSPConnected } = await import('../lib/lsp')
      if (isLSPConnected(langKey)) {
        disconnectLSP(langKey)
        setLspStates(s => ({ ...s, [langKey]: false }))
        if (isLocal) ipc.lsp.stop().catch(() => {})
        showToast(true, `${config.name} desconectado`)
      } else if (isLocal) {
        // Auto-start local LSP bridge (spawns typescript-language-server locally)
        const res = await ipc.lsp.start(localRootRef.current)
        if ((res as unknown as { error: string }).error) throw new Error((res as unknown as { error: string }).error)
        await connectLSP(monacoRef.current!, langKey, (res as { port: number }).port)
        setLspStates(s => ({ ...s, [langKey]: true }))
        showToast(true, `${config.name} conectado (local)`)
      } else {
        await connectLSP(monacoRef.current!, langKey)
        setLspStates(s => ({ ...s, [langKey]: true }))
        showToast(true, `${config.name} conectado`)
      }
    } catch (err) {
      showToast(false, `LSP: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setLspLoading(false) }
  }

  // IDE-17: Port forwarding
  const [tunnels, setTunnels] = useState<{id:string;localPort:number;remotePort:number;remoteHost:string;status:string}[]>([])
  const [tunnelLocal,  setTunnelLocal]  = useState('3000')
  const [tunnelRemote, setTunnelRemote] = useState('3000')
  const [tunnelHost,   setTunnelHost]   = useState('127.0.0.1')
  const [tunnelLoading, setTunnelLoading] = useState(false)

  const refreshPm2 = useCallback(async () => {
    if (!vpsId) return
    setPm2Loading(true)
    const r = await ipc.pm2.list(vpsId)
    setPm2Loading(false)
    if (r.success) setPm2Processes(r.processes)
    else showToast(false, r.error ?? 'PM2 não encontrado na VPS')
  }, [vpsId])

  const refreshDocker = useCallback(async () => {
    if (!vpsId) return
    setDockerLoading(true)
    const r = await ipc.docker.list(vpsId)
    setDockerLoading(false)
    if (r.success) setDockerContainers(r.containers)
    else showToast(false, r.error ?? 'Docker não encontrado na VPS')
  }, [vpsId])

  const refreshTunnels = useCallback(async () => {
    const r = await ipc.tunnel.list()
    if (r?.tunnels) setTunnels(r.tunnels.filter(t => t.vpsId === vpsId))
  }, [vpsId])

  const openTunnel = async () => {
    if (!vpsId || tunnelLoading) return
    setTunnelLoading(true)
    const r = await ipc.tunnel.open(vpsId, Number(tunnelLocal), Number(tunnelRemote), tunnelHost)
    setTunnelLoading(false)
    if (r.success) { showToast(true, `Túnel localhost:${tunnelLocal} → VPS:${tunnelRemote} ativo`); refreshTunnels() }
    else showToast(false, r.error ?? 'Erro ao abrir túnel')
  }

  const closeTunnel = async (id: string) => {
    await ipc.tunnel.close(id)
    refreshTunnels()
    showToast(true, 'Túnel encerrado')
  }

  // IDE-21: Chat Claude via SSH (disponível em ambos os modos)
  const [showChat,    setShowChat]    = useState(false)
  const [chatMessages, setChatMessages] = useState<{role:'user'|'assistant'; text:string; imageDataUrl?:string}[]>([])
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatElapsed, setChatElapsed] = useState(0)
  const [chatVpsId,   setChatVpsId]   = useState<string>(vpsId ?? '')
  const [chatVpsList, setChatVpsList] = useState<{id:string;name:string}[]>([])
  const chatEndRef  = useRef<HTMLDivElement>(null)
  const chatTimerRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const [chatSaveAs, setChatSaveAs] = useState<{code:string;lang:string}|null>(null)
  const [chatSaveAsName, setChatSaveAsName] = useState('')
  const [applyAllModal, setApplyAllModal] = useState<{
    items: Array<{code:string; lang:string; name:string; selected:boolean}>
  }|null>(null)
  const [applyAllLoading, setApplyAllLoading] = useState(false)
  const [cmdOutputs, setCmdOutputs] = useState<Record<string, {running:boolean; output:string; ok:boolean}>>({})

  const SHELL_LANGS = new Set(['bash','sh','shell','zsh','powershell','ps1','cmd','batch'])
  const [chatImage, setChatImage] = useState<{dataUrl:string; base64:string; mime:string; filePath:string}|null>(null)
  const [aiProviderName, setAiProviderName] = useState<string|null>(null)
  const [agentMode, setAgentMode] = useState(false)
  type AgentStep = { id: string; tool: string; input: string; output?: string; status: 'running'|'done'|'error' }
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [agentPaused, setAgentPaused] = useState(false)
  const agentResumeRef = useRef<{ messages: Array<{role: string; content: unknown}>; systemCtx: string } | null>(null)
  const agentStopRef   = useRef(false)
  // ToolExecutor — confirmação de ações perigosas em PROD
  type ToolConfirmState = { toolName: string; cmdSummary: string; resolve: (ok: boolean) => void }
  const [toolConfirm, setToolConfirm] = useState<ToolConfirmState | null>(null)
  const [toolConfirmInput, setToolConfirmInput] = useState('')
  type FileSnapshot = { path: string; originalContent: string; savedAt: number }
  const agentSnapshotsRef = useRef<Map<string, FileSnapshot>>(new Map())
  const [agentSnapshots, setAgentSnapshots] = useState<FileSnapshot[]>([])

  // ── IDE-02: hierarchical file tree ─────────────────────────────────

  const sftpSession       = useRef<string|null>(null)
  const expandedFoldersRef = useRef<Set<string>>(new Set())   // IDE-14: ref para polling
  const [rootEntries,   setRootEntries]   = useState<FileEntry[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [folderChildren, setFolderChildren]  = useState<Map<string,FileEntry[]>>(new Map())
  const [loadingFolders, setLoadingFolders]  = useState<Set<string>>(new Set())
  const [treeConnecting, setTreeConnecting]  = useState(true)
  const [treeError,    setTreeError]    = useState('')
  const [activeDir,    setActiveDir]    = useState('/root')

  // new file/folder inline
  const [newFileMode, setNewFileMode] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newDirMode,  setNewDirMode]  = useState(false)
  const [newDirName,  setNewDirName]  = useState('')

  // editor
  const editorRef   = useRef<MonacoEditor.IStandaloneCodeEditor|null>(null)
  const editorRef2  = useRef<MonacoEditor.IStandaloneCodeEditor|null>(null)
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeTab,  setActiveTab]  = useState<string|null>(null)
  const [activeTab2, setActiveTab2] = useState<string|null>(null)
  const [focusedPane, setFocusedPane] = useState<1|2>(1)
  const [splitMode,  setSplitMode]  = useState(false)
  const [cursorPos, setCursorPos] = useState({ line:1, col:1 })
  const [gitDiff,   setGitDiff]   = useState<GitDiff|null>(null)
  const pendingRevealLine = useRef<number|null>(null)

  // IDE-05: multi-terminal
  const termInstancesRef    = useRef<Map<string,TermInstance>>(new Map())
  const termContainerMapRef = useRef<Map<string,HTMLDivElement>>(new Map())
  const [termTabs,     setTermTabs]     = useState<TermTab[]>([])
  const [activeTermId, setActiveTermId] = useState<string|null>(null)

  // git
  const [gitStatus,  setGitStatus]  = useState<GitStatus|null>(null)
  const [gitLoading, setGitLoading] = useState(false)
  const [commitMsg,  setCommitMsg]  = useState('')
  const [gitOp,      setGitOp]      = useState<string|null>(null)

  // IDE-03: search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchGlob,  setSearchGlob]  = useState('')
  const [searchCase,  setSearchCase]  = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchDone,    setSearchDone]    = useState(false)

  // misc
  const [renaming,  setRenaming]  = useState<FileEntry|null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [ctxMenu,   setCtxMenu]   = useState<CtxMenu|null>(null)
  // F2 rename: tracks the explorer entry that was last clicked (no re-render needed)
  const selectedEntryRef = useRef<FileEntry|null>(null)
  const [selectedPath, setSelectedPath] = useState<string|null>(null)
  // Ctrl+Shift+T: stack of recently closed tabs (max 15)
  const closedTabsRef = useRef<OpenFile[]>([])
  const [toast,     setToast]     = useState<{ok:boolean;text:string}|null>(null)
  const [kbSuggestion,  setKbSuggestion]  = useState<KbSuggestion | null>(null)
  const [aiLearning,    setAiLearning]    = useState(false)
  const [aiLearnResult, setAiLearnResult] = useState<KbSuggestion | null>(null)

  const showToast = (ok:boolean, text:string) => { setToast({ok,text}); setTimeout(()=>setToast(null), 3500) }
  const isDirty = (f:OpenFile) => f.content !== f.savedContent && !f.loading

  // ── IDE-20: filesystem abstraction (local vs remote SFTP) ─────────────

  const fsReaddir = useCallback(async (dir: string): Promise<{ success: boolean; entries: FileEntry[] }> => {
    if (isLocal) {
      try {
        const entries = await ipc.local.readdir(dir)
        return { success: true, entries: (entries ?? []).map(e => ({ ...e, size:0, modifiedAt:0, permissions:'' })) }
      } catch { return { success: false, entries: [] } }
    }
    if (!sftpSession.current) return { success: false, entries: [] }
    return ipc.sftp.readdir(sftpSession.current, dir)
  }, [isLocal])

  const fsReadFile = useCallback(async (filePath: string): Promise<{ success: boolean; content: string; error?: string }> => {
    if (isLocal) {
      try { return { success: true, content: (await ipc.local.readFile(filePath)) ?? '' } }
      catch (e) { return { success: false, content: '', error: String(e) } }
    }
    if (!sftpSession.current) return { success: false, content: '', error: 'Sem sessão SFTP' }
    return ipc.sftp.readFile(sftpSession.current, filePath)
  }, [isLocal])

  const fsReadFileBase64 = useCallback(async (filePath: string): Promise<{ success: boolean; data: string; error?: string }> => {
    if (isLocal) {
      try { return { success: true, data: (await ipc.local.readFileBase64(filePath)) ?? '' } }
      catch (e) { return { success: false, data: '', error: String(e) } }
    }
    if (!sftpSession.current) return { success: false, data: '', error: 'Sem sessão SFTP' }
    return ipc.sftp.readFileBase64(sftpSession.current, filePath)
  }, [isLocal])

  const fsWriteFile = useCallback(async (filePath: string, content: string): Promise<{ success: boolean; error?: string }> => {
    if (isLocal) {
      try { return await ipc.local.writeFile(filePath, content) ?? { success: true } }
      catch (e) { return { success: false, error: String(e) } }
    }
    if (!sftpSession.current) return { success: false, error: 'Sem sessão SFTP' }
    return ipc.sftp.writeFile(sftpSession.current, filePath, content)
  }, [isLocal])

  const fsMkdir = useCallback(async (dirPath: string): Promise<{ success: boolean; error?: string }> => {
    if (isLocal) {
      try { return await ipc.local.mkdir(dirPath) ?? { success: true } }
      catch (e) { return { success: false, error: String(e) } }
    }
    if (!sftpSession.current) return { success: false, error: 'Sem sessão SFTP' }
    return ipc.sftp.mkdir(sftpSession.current, dirPath)
  }, [isLocal])

  const fsDelete = useCallback(async (filePath: string, isDir: boolean): Promise<{ success: boolean; error?: string }> => {
    if (isLocal) {
      try { return await ipc.local.delete(filePath) ?? { success: true } }
      catch (e) { return { success: false, error: String(e) } }
    }
    if (!sftpSession.current) return { success: false, error: 'Sem sessão SFTP' }
    return ipc.sftp.delete(sftpSession.current, filePath, isDir)
  }, [isLocal])

  const fsRename = useCallback(async (oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> => {
    if (isLocal) {
      try { return await ipc.local.rename(oldPath, newPath) ?? { success: true } }
      catch (e) { return { success: false, error: String(e) } }
    }
    if (!sftpSession.current) return { success: false, error: 'Sem sessão SFTP' }
    return ipc.sftp.rename(sftpSession.current, oldPath, newPath)
  }, [isLocal])

  const fsTouch = useCallback(async (filePath: string): Promise<{ success: boolean; error?: string }> => {
    if (isLocal) {
      try { return await ipc.local.touch(filePath) ?? { success: true } }
      catch (e) { return { success: false, error: String(e) } }
    }
    if (!sftpSession.current) return { success: false, error: 'Sem sessão SFTP' }
    return ipc.sftp.touch(sftpSession.current, filePath)
  }, [isLocal])

  // ── connect (local folder picker or remote SFTP) ───────────────────────

  useEffect(() => {
    if (isLocal) {
      ipc.local.openFolder().then(async folder => {
        if (!folder) { navigate(-1); return }
        const root = folder.replace(/\\/g, '/')
        setLocalRoot(root); localRootRef.current = root
        setActiveDir(root)
        const entries = await ipc.local.readdir(root)
        setRootEntries((entries ?? []).map(e => ({ ...e, size:0, modifiedAt:0, permissions:'' })))
        setTreeConnecting(false)
      }).catch(() => { setTreeError('Erro ao abrir pasta'); setTreeConnecting(false) })
      return
    }
    if (!vpsId) return
    let sid:string|null = null
    ipc.sftp.open(vpsId).then(async r => {
      if (!r.success || !r.sessionId) { setTreeError(r.error ?? 'Falha SFTP'); setTreeConnecting(false); return }
      sid = r.sessionId; sftpSession.current = sid
      const r2 = await ipc.sftp.readdir(sid, '/root')
      if (r2.success) { setRootEntries(r2.entries); setTreeConnecting(false) }
      else { setTreeError(r2.error ?? 'Erro SFTP'); setTreeConnecting(false) }
    })
    return () => { if (sid) ipc.sftp.close(sid) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // IDE-14: mantém ref sincronizada para polling sem re-criar interval
  useEffect(() => { expandedFoldersRef.current = expandedFolders }, [expandedFolders])

  // IDE-14: auto-refresh da tree a cada 30s
  useEffect(() => {
    const id = setInterval(async () => {
      const root = isLocal ? localRootRef.current : '/root'
      if (!root) return
      const r = await fsReaddir(root)
      if (r.success) setRootEntries(r.entries)
      expandedFoldersRef.current.forEach(async p => {
        const fr = await fsReaddir(p)
        if (fr.success) setFolderChildren(m => new Map([...m, [p, fr.entries]]))
      })
    }, 30000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal]) // fsReaddir é estável

  // ── IDE-02: tree operations ───────────────────────────────────────────

  const reloadDir = useCallback(async (dirPath:string) => {
    const r = await fsReaddir(dirPath)
    if (!r.success) return
    const root = isLocal ? localRootRef.current : '/root'
    if (dirPath === root) setRootEntries(r.entries)
    else setFolderChildren(m => new Map([...m, [dirPath, r.entries]]))
  }, [fsReaddir, isLocal])

  const handleToggleFolder = useCallback(async (entry:FileEntry) => {
    const p = entry.path
    setActiveDir(p)
    if (expandedFolders.has(p)) {
      setExpandedFolders(s => { const n = new Set(s); n.delete(p); return n })
    } else {
      setExpandedFolders(s => new Set([...s, p]))
      if (!folderChildren.has(p)) {
        setLoadingFolders(s => new Set([...s, p]))
        try {
          const r = await fsReaddir(p)
          if (r.success) setFolderChildren(m => new Map([...m, [p, r.entries]]))
        } finally {
          setLoadingFolders(s => { const n = new Set(s); n.delete(p); return n })
        }
      }
    }
  }, [expandedFolders, folderChildren, fsReaddir])

  // ── git status ────────────────────────────────────────────────────────

  const loadGitStatus = useCallback(async (cwd?:string) => {
    if (!vpsId) return
    setGitLoading(true)
    try {
      const s = await ipc.git.status(vpsId, cwd ?? activeDir)
      setGitStatus(s)
    } catch (e) {
      showToast(false, `Git: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGitLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vpsId, activeDir])

  useEffect(() => {
    if (leftPanel === 'git' && !gitStatus && !gitLoading) loadGitStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftPanel])

  // Auto-fetch git status when tree first loads (VPS mode only)
  useEffect(() => {
    if (!isLocal && rootEntries.length > 0 && !gitStatus && !gitLoading) loadGitStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootEntries.length, isLocal])

  // ── IDE-05: multi-terminal ────────────────────────────────────────────

  const termXtermTheme = {
    background:'#0d1117', foreground:'#c9d1d9', cursor:'#7c3aed',
    selectionBackground:'#3d3d7a55',
    black:'#484f58', red:'#ff7b72', green:'#3fb950', yellow:'#d29922',
    blue:'#58a6ff', magenta:'#bc8cff', cyan:'#39c5cf', white:'#b1bac4',
    brightBlack:'#6e7681', brightRed:'#ffa198', brightGreen:'#56d364',
    brightYellow:'#e3b341', brightBlue:'#79c0ff', brightMagenta:'#d2a8ff',
    brightCyan:'#56d4dd', brightWhite:'#f0f6fc',
  }

  const initTermTab = useCallback((tabId:string, container:HTMLDivElement) => {
    if (!vpsId || termInstancesRef.current.has(tabId)) return
    const term = new XTerm({
      cursorBlink:true, cursorStyle:'bar', fontSize:13,
      fontFamily:'"Cascadia Code","Fira Code",Consolas,monospace',
      lineHeight:1.2, scrollback:5000, theme: termXtermTheme,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    term.write('\x1b[90mConectando terminal SSH…\x1b[0m\r\n')

    const inst: TermInstance = { term, fit, sessionId:null, unsubs:[], ro:null }
    termInstancesRef.current.set(tabId, inst)

    ipc.terminal.open(vpsId).then(r => {
      const i = termInstancesRef.current.get(tabId)
      if (!i) return
      if (!r.success || !r.sessionId) {
        term.write(`\r\n\x1b[31m✗ ${r.error ?? 'Falha'}\x1b[0m\r\n`)
        setTermTabs(tabs => tabs.map(t => t.id===tabId ? {...t, status:'error', errMsg:r.error??'Falha'} : t))
        return
      }
      i.sessionId = r.sessionId
      setTermTabs(tabs => tabs.map(t => t.id===tabId ? {...t, sessionId:r.sessionId, status:'connected'} : t))
      fit.fit()
      ipc.terminal.resize(r.sessionId, term.cols, term.rows)
      term.focus()

      const u1 = window.electron.on('terminal:data', (p:unknown) => {
        const x = p as {sessionId:string;data:string}
        if (x.sessionId === r.sessionId) term.write(x.data)
      })
      const u2 = window.electron.on('terminal:exit', (p:unknown) => {
        const x = p as {sessionId:string}
        if (x.sessionId === r.sessionId) {
          term.write('\r\n\x1b[90m─── Sessão encerrada ───\x1b[0m\r\n')
          setTermTabs(tabs => tabs.map(t => t.id===tabId ? {...t, status:'closed'} : t))
        }
      })
      i.unsubs.push(u1, u2)
      term.onData(data => { if (i.sessionId) ipc.terminal.input(r.sessionId, data) })
      const ro = new ResizeObserver(() => { fit.fit(); if (i.sessionId) ipc.terminal.resize(r.sessionId, term.cols, term.rows) })
      ro.observe(container)
      i.ro = ro
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vpsId])

  const openNewTermTab = useCallback(() => {
    const id = `tab_${Date.now()}`
    setTermTabs(tabs => {
      const n = tabs.length + 1
      return [...tabs, { id, title:`Terminal ${n}`, sessionId:null, status:'connecting', errMsg:'' }]
    })
    setActiveTermId(id)
  }, [])

  const closeTermTab = useCallback((tabId:string, e:React.MouseEvent) => {
    e.stopPropagation()
    const inst = termInstancesRef.current.get(tabId)
    if (inst) {
      inst.unsubs.forEach(u => u()); inst.ro?.disconnect(); inst.term.dispose()
      if (inst.sessionId) ipc.terminal.close(inst.sessionId).catch(() => {})
      termInstancesRef.current.delete(tabId)
    }
    termContainerMapRef.current.delete(tabId)
    setTermTabs(tabs => {
      const remaining = tabs.filter(t => t.id !== tabId)
      return remaining
    })
    setActiveTermId(prev => {
      if (prev !== tabId) return prev
      setTermTabs(tabs => {
        const idx = tabs.findIndex(t => t.id === tabId)
        const next = tabs[idx+1]?.id ?? tabs[idx-1]?.id ?? null
        setTimeout(() => setActiveTermId(next), 0)
        return tabs
      })
      return prev
    })
  }, [])

  // Init tabs when containers mount
  useEffect(() => {
    termTabs.forEach(tab => {
      if (!termInstancesRef.current.has(tab.id)) {
        const container = termContainerMapRef.current.get(tab.id)
        if (container) initTermTab(tab.id, container)
      }
    })
  }, [termTabs, initTermTab])

  // Auto-open first tab when terminal shows
  useEffect(() => {
    if (showTerm && termTabs.length === 0) openNewTermTab()
  }, [showTerm, termTabs.length, openNewTermTab])

  // Refit active terminal on resize
  useEffect(() => {
    if (!activeTermId) return
    const inst = termInstancesRef.current.get(activeTermId)
    if (inst) { inst.fit.fit() }
  }, [termH, activeTermId])

  // Refit + refocus on show
  useEffect(() => {
    if (!showTerm || !activeTermId) return
    setTimeout(() => {
      const inst = termInstancesRef.current.get(activeTermId)
      if (inst) { inst.fit.fit(); inst.term.focus() }
    }, 100)
  }, [showTerm, activeTermId, bottomPanel])

  // Cleanup all terminals + marker subscription + LSP connections on unmount
  useEffect(() => {
    return () => {
      termInstancesRef.current.forEach(inst => {
        inst.unsubs.forEach(u => u()); inst.ro?.disconnect(); inst.term.dispose()
        if (inst.sessionId) ipc.terminal.close(inst.sessionId).catch(() => {})
      })
      markerDisposableRef.current?.dispose()
      import('../lib/lsp').then(({ disconnectAllLSP }) => disconnectAllLSP()).catch(() => {})
    }
  }, [])

  const switchTermTab = (tabId:string) => {
    setActiveTermId(tabId)
    setTimeout(() => {
      const inst = termInstancesRef.current.get(tabId)
      if (inst) { inst.fit.fit(); inst.term.focus() }
    }, 50)
  }

  // ── keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const h = (e:KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key==='s') { e.preventDefault(); const t = focusedPane===2 ? activeTab2 : activeTab; if(t) handleSave(t) }
      if (ctrl && e.key==='`') { e.preventDefault(); setShowTerm(v=>!v) }
      if (ctrl && e.shiftKey && e.key==='P') {
        e.preventDefault()
        editorRef.current?.trigger('keyboard','editor.action.quickCommand',null)
      }
      if (ctrl && e.shiftKey && e.key==='F') {
        e.preventDefault()
        setLeftPanel('search')
        setTimeout(() => document.getElementById('search-input')?.focus(), 100)
      }
      if (e.key==='Escape') { setGitDiff(null); setCtxMenu(null) }

      // F2 — rename the focused tree entry inline
      if (e.key==='F2' && !renaming && selectedEntryRef.current) {
        const entry = selectedEntryRef.current
        setRenaming(entry); setRenameVal(entry.name)
      }

      // Ctrl+Shift+T — reopen last closed tab
      if (ctrl && e.shiftKey && e.key==='T') {
        e.preventDefault()
        const last = closedTabsRef.current[0]
        if (last) {
          closedTabsRef.current = closedTabsRef.current.slice(1)
          setOpenFiles(f => f.find(x=>x.path===last.path) ? f : [...f, last])
          setActiveTab(last.path)
          setGitDiff(null)
        }
      }

      // Ctrl+V no terminal — Electron intercepta o paste antes do xterm; repassamos manualmente
      if (ctrl && e.key === 'v' && showTerm && bottomPanel === 'terminal' && activeTermId) {
        const inst = termInstancesRef.current.get(activeTermId)
        if (inst?.sessionId) {
          e.preventDefault()
          navigator.clipboard.readText().then(text => {
            if (text) inst.term.paste(text)
          }).catch(() => {})
        }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, openFiles, showTerm, bottomPanel, activeTermId])

  // IDE-21: carregar lista de VPS para seletor de chat no modo local
  useEffect(() => {
    if (!isLocal) return
    ipc.vps.list().then(list => {
      if (Array.isArray(list)) {
        setChatVpsList(list.map((v: {id:string;name:string}) => ({ id:v.id, name:v.name })))
        if (list.length > 0 && !chatVpsId) setChatVpsId(list[0].id)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal])

  // Verifica se há provedor de IA configurado (API direta — mais rápido que claude -p)
  useEffect(() => {
    ipc.ai.list().then(list => {
      const active = list.find(p => p.isDefault && p.enabled && p.hasKey)
        ?? list.find(p => p.enabled && p.hasKey)
      setAiProviderName(active?.provider ?? null)
    }).catch(() => {})
  }, [])

  // ── file operations ───────────────────────────────────────────────────

  const openFile = async (entry:FileEntry, revealLine?:number) => {
    if (entry.isDirectory) { handleToggleFolder(entry); return }
    const ext = entry.name.split('.').pop()?.toLowerCase()??''

    // IDE-15: helper para setar tab no painel correto
    const setPane = (path: string) => {
      if (splitMode && focusedPane === 2) setActiveTab2(path)
      else { setActiveTab(path); setGitDiff(null) }
    }

    // IDE-11: preview de imagem via base64
    if (IMG_PREVIEW.has(ext)) {
      const existing = openFiles.find(f=>f.path===entry.path)
      if (existing) { setPane(entry.path); return }
      const nf:OpenFile = { path:entry.path, name:entry.name, content:'', savedContent:'', language:'plaintext', loading:true }
      setOpenFiles(f=>[...f,nf]); setPane(entry.path)
      const r = await fsReadFileBase64(entry.path)
      const mime = ext==='svg' ? 'image/svg+xml' : `image/${ext==='jpg'?'jpeg':ext}`
      const dataUrl = r.success ? `data:${mime};base64,${r.data}` : ''
      setOpenFiles(f=>f.map(fl=>fl.path===entry.path ? {...fl, loading:false, imageDataUrl:dataUrl} : fl))
      return
    }

    if (BIN_EXT.has(ext)) { showToast(false, `Arquivos .${ext} não suportados`); return }
    const existing = openFiles.find(f=>f.path===entry.path)
    if (existing) {
      setPane(entry.path)
      if (revealLine) pendingRevealLine.current = revealLine
      return
    }
    const nf:OpenFile = { path:entry.path, name:entry.name, content:'', savedContent:'', language:detectLang(entry.name), loading:true }
    setOpenFiles(f=>[...f,nf]); setPane(entry.path)
    if (revealLine) pendingRevealLine.current = revealLine
    const r = await fsReadFile(entry.path)
    setOpenFiles(f=>f.map(fl=>fl.path===entry.path ? {...fl, content:r.success?r.content:`// Erro: ${r.error}`, savedContent:r.success?r.content:'', loading:false} : fl))
    if (r.success && r.content) {
      const suggestion = analyzeManifest(entry.name, r.content)
      if (suggestion) setKbSuggestion(suggestion)
    }
  }

  const handleSave = async (filePath:string) => {
    const file = openFiles.find(f=>f.path===filePath)
    if (!file||!isDirty(file)) return
    const r = await fsWriteFile(filePath, file.content)
    if (r.success) {
      setOpenFiles(f=>f.map(fl=>fl.path===filePath?{...fl,savedContent:fl.content}:fl))
      showToast(true, `${file.name} salvo`)
      // IDE-14: refresh da pasta após salvar
      const parentDir = filePath.split('/').slice(0,-1).join('/')
      reloadDir(parentDir || (isLocal ? localRootRef.current : '/root')).catch(() => {})
    } else showToast(false, r.error??'Erro ao salvar')
  }

  const closeTab = (path:string, e:React.MouseEvent) => {
    e.stopPropagation()
    const file = openFiles.find(f=>f.path===path)
    if (file&&isDirty(file)&&!confirm(`"${file.name}" tem alterações não salvas. Fechar?`)) return
    // Push to closed-tab history (max 15 entries, Ctrl+Shift+T to reopen)
    if (file) closedTabsRef.current = [file, ...closedTabsRef.current].slice(0, 15)
    const idx = openFiles.findIndex(f=>f.path===path)
    const next = openFiles[idx+1]?.path ?? openFiles[idx-1]?.path ?? null
    setOpenFiles(f=>f.filter(fl=>fl.path!==path)); setActiveTab(next)
  }

  const handleSaveToKb = async (s: KbSuggestion) => {
    try {
      await ipc.knowledge.create({ title: s.title, content: s.content, category: s.category as 'geral', tags: s.tags, isActive: true })
      showToast(true, 'Salvo na KB ✓')
      setKbSuggestion(null)
      setAiLearnResult(null)
    } catch (e) { showToast(false, `Erro ao salvar: ${(e as Error).message}`) }
  }

  const handleLearnFile = async () => {
    const file = openFiles.find(f => f.path === activeTab)
    if (!file || !file.content || aiLearning) return
    setAiLearning(true)
    setAiLearnResult(null)
    try {
      const result = await ipc.learning.analyzeFile({ name: file.name, content: file.content, language: file.language })
      setAiLearnResult(result)
    } catch (e) { showToast(false, `Aprendizado falhou: ${(e as Error).message}`) }
    finally { setAiLearning(false) }
  }

  const handleDelete = async (e:FileEntry) => {
    if (!confirm(`Excluir "${e.name}"?`)) return
    const r = await fsDelete(e.path, e.isDirectory)
    if (r.success) {
      showToast(true, `"${e.name}" excluído`)
      setOpenFiles(f=>f.filter(fl=>fl.path!==e.path))
      if (activeTab===e.path) setActiveTab(null)
      const parentDir = e.path.split('/').slice(0,-1).join('/') || (isLocal ? localRootRef.current : '/root')
      await reloadDir(parentDir)
    } else showToast(false, r.error??'Erro ao excluir')
  }

  const handleRename = async () => {
    if (!renaming||!renameVal.trim()) return
    const parentDir = renaming.path.split('/').slice(0,-1).join('/') || (isLocal ? localRootRef.current : '/root')
    const newPath = parentDir + '/' + renameVal.trim()
    const r = await fsRename(renaming.path, newPath)
    if (r.success) {
      showToast(true, `Renomeado para "${renameVal.trim()}"`)
      setOpenFiles(f=>f.map(fl=>fl.path===renaming.path ? {...fl,path:newPath,name:renameVal.trim()} : fl))
      if (activeTab===renaming.path) setActiveTab(newPath)
      await reloadDir(parentDir)
    } else showToast(false, r.error??'Erro ao renomear')
    setRenaming(null)
  }

  const handleMkdir = async () => {
    if (!newDirName.trim()) return
    const p = activeDir.replace(/\/$/,'') + '/' + newDirName.trim()
    const r = await fsMkdir(p)
    if (r.success) { showToast(true,'Pasta criada'); await reloadDir(activeDir) }
    else showToast(false, r.error??'Erro ao criar pasta')
    setNewDirMode(false); setNewDirName('')
  }

  const handleTouch = async () => {
    if (!newFileName.trim()) return
    const p = activeDir.replace(/\/$/,'') + '/' + newFileName.trim()
    const r = await fsTouch(p)
    if (r.success) {
      showToast(true, `"${newFileName.trim()}" criado`)
      await reloadDir(activeDir)
      openFile({ name:newFileName.trim(), path:p, isDirectory:false, size:0, modifiedAt:Date.now(), permissions:'' })
    } else showToast(false, r.error??'Erro ao criar arquivo')
    setNewFileMode(false); setNewFileName('')
  }

  // IDE-13: copiar caminho e duplicar arquivo
  const handleCopyPath = (entry:FileEntry) => {
    navigator.clipboard.writeText(entry.path)
      .then(() => showToast(true, 'Caminho copiado'))
      .catch(() => showToast(false, 'Falha ao copiar para área de transferência'))
  }

  const handleDuplicate = async (entry:FileEntry) => {
    if (!vpsId) return
    const dir = entry.path.split('/').slice(0,-1).join('/') || '/root'
    const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop() : ''
    const base = entry.name.replace(/\.[^.]+$/, '')
    const newName = `${base}_copia${ext}`
    const newPath = `${dir}/${newName}`
    const flag = entry.isDirectory ? '-r ' : ''
    const r = await ipc.terminal.exec(vpsId, `cp ${flag}-p '${entry.path}' '${newPath}' 2>&1`)
    if (r.success && !r.output.trim()) {
      showToast(true, `"${newName}" criado`)
      await reloadDir(dir)
    } else {
      showToast(false, r.output.trim() || r.error || 'Erro ao duplicar')
    }
  }

  // ── IDE-03: search ────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    if (!isLocal && !vpsId) return
    setSearchLoading(true); setSearchResults([]); setSearchDone(false)
    try {
      const results: SearchResult[] = []
      if (isLocal) {
        const root = localRootRef.current
        if (!root) { setSearchDone(true); return }
        const esc = searchQuery.replace(/"/g, '\\"')
        // Try ripgrep first (fast), fall back to Windows findstr
        const caseFlag = searchCase ? '' : '-i '
        const cmd = `rg ${caseFlag}"${esc}" . --line-number --no-heading --color=never -m 200 2>nul || findstr /n /s ${searchCase ? '' : '/i '}"${esc}" *`
        const res = await ipc.local.exec(cmd, root)
        if (res.success || res.output) {
          const rootNorm = root.replace(/\\/g, '/')
          for (const line of res.output.split('\n')) {
            if (!line.trim()) continue
            const m = line.match(/^(.+?):(\d+):(.*)$/)
            if (!m) continue
            // Normalize to absolute path
            const rel = m[1].replace(/\\/g, '/')
            const absPath = rel.startsWith('/') || /^[A-Za-z]:/.test(rel)
              ? rel
              : `${rootNorm}/${rel}`
            results.push({ file: absPath, line: parseInt(m[2]), preview: m[3].trim() })
          }
        }
      } else {
        const flags = ['-r', '-n', '--color=never', '-m 50']
        if (!searchCase) flags.push('-i')
        const globs = searchGlob.trim()
          ? searchGlob.split(',').map(g => `--include="${g.trim()}"`).join(' ')
          : ''
        const pattern = searchQuery.replace(/'/g, "'\\''")
        const cmd = `grep ${flags.join(' ')} ${globs} '${pattern}' /root 2>/dev/null | head -200`
        const res = await ipc.terminal.exec(vpsId!, cmd)
        if (res.success) {
          for (const line of res.output.split('\n')) {
            if (!line.trim()) continue
            const m = line.match(/^(.+?):(\d+):(.*)$/)
            if (m) results.push({ file:m[1], line:parseInt(m[2]), preview:m[3].trim() })
          }
        }
      }
      setSearchResults(results)
    } finally {
      setSearchLoading(false); setSearchDone(true)
    }
  }

  // ── Outline / Breadcrumbs ─────────────────────────────────────────────

  const refreshOutline = useCallback(async () => {
    const mon = monacoRef.current
    const ed  = editorRef.current
    if (!mon || !ed) return
    const model = ed.getModel()
    if (!model) return
    const lang = model.getLanguageId()
    setOutlineLoading(true)
    try {
      if (['typescript','javascript','typescriptreact','javascriptreact'].includes(lang)) {
        type NavItem = {text:string;kind:string;spans:{start:number;length:number}[];childItems?:NavItem[]}
        const getWorker = await (mon.languages as unknown as {typescript:{getTypeScriptWorker:()=>Promise<(...u:unknown[])=>Promise<unknown>>}}).typescript.getTypeScriptWorker()
        const worker = await getWorker(model.uri)
        const items = await (worker as unknown as {getNavigationBarItems:(f:string)=>Promise<NavItem[]>})
          .getNavigationBarItems(model.uri.toString())
        const convert = (item: NavItem, depth=0): OutlineSymbol[] => {
          if (!item || depth > 6) return []
          const span = item.spans[0]
          const line    = span ? model.getPositionAt(span.start).lineNumber - 1 : 0
          const endLine = span ? model.getPositionAt(span.start + span.length).lineNumber - 1 : line
          return [{
            name: item.text, kind: tsKindToSymbolKind(item.kind), line, endLine,
            children: item.childItems?.flatMap(c => convert(c, depth+1)) ?? [],
          }]
        }
        const syms = items.flatMap(item => {
          if (item.text === '<global>' || item.text === 'module' || item.kind === 'module') {
            return item.childItems?.flatMap(c => convert(c)) ?? []
          }
          return convert(item)
        })
        setOutlineSymbols(syms)
        outlineRef.current = syms
      } else {
        // Fallback: regex para Python e outros
        const content = model.getValue()
        const syms: OutlineSymbol[] = []
        const patterns: Array<{re:RegExp;kind:number}> = [
          { re: /^class\s+(\w+)/gm,       kind:5  },
          { re: /^def\s+(\w+)/gm,          kind:12 },
          { re: /^function\s+(\w+)/gm,     kind:12 },
          { re: /^(?:const|let|var)\s+(\w+)\s*=/gm, kind:14 },
        ]
        for (const { re, kind } of patterns) {
          let m: RegExpExecArray | null
          while ((m = re.exec(content)) !== null) {
            const line = model.getPositionAt(m.index).lineNumber - 1
            syms.push({ name:m[1], kind, line, endLine: line })
          }
        }
        syms.sort((a,b) => a.line - b.line)
        setOutlineSymbols(syms)
        outlineRef.current = syms
      }
    } catch {
      setOutlineSymbols([])
      outlineRef.current = []
    } finally {
      setOutlineLoading(false)
    }
  }, [])

  // ── git operations ────────────────────────────────────────────────────

  const handleGitAdd = async (f:GitFileStatus) => {
    if (!vpsId) return; setGitOp('add:'+f.path)
    try { await ipc.git.add(vpsId, activeDir, [f.path]); await loadGitStatus() }
    catch (e) { showToast(false, `git add: ${e instanceof Error?e.message:String(e)}`) }
    finally { setGitOp(null) }
  }

  const handleGitRestore = async (f:GitFileStatus, staged:boolean) => {
    if (!vpsId) return; setGitOp('restore:'+f.path)
    try { await ipc.git.restore(vpsId, activeDir, [f.path], staged); await loadGitStatus() }
    catch (e) { showToast(false, `git restore: ${e instanceof Error?e.message:String(e)}`) }
    finally { setGitOp(null) }
  }

  const handleGitCommit = async () => {
    if (!vpsId||!commitMsg.trim()) { showToast(false,'Digite uma mensagem de commit'); return }
    setGitOp('commit')
    try { await ipc.git.commit(vpsId, activeDir, commitMsg.trim()); setCommitMsg(''); await loadGitStatus(); showToast(true,'Commit criado') }
    catch (e) { showToast(false, `git commit: ${e instanceof Error?e.message:String(e)}`) }
    finally { setGitOp(null) }
  }

  const handleGitPush = async () => {
    if (!vpsId) return; setGitOp('push')
    try { const out = await ipc.git.push(vpsId, activeDir); await loadGitStatus(); showToast(true, out.split('\n').slice(-2).join(' ').trim()||'Push concluído') }
    catch (e) { showToast(false, `git push: ${e instanceof Error?e.message:String(e)}`) }
    finally { setGitOp(null) }
  }

  const handleGitPull = async () => {
    if (!vpsId) return; setGitOp('pull')
    try { const out = await ipc.git.pull(vpsId, activeDir); await loadGitStatus(); showToast(true, out.split('\n').filter(Boolean).slice(-1)[0]||'Pull concluído') }
    catch (e) { showToast(false, `git pull: ${e instanceof Error?e.message:String(e)}`) }
    finally { setGitOp(null) }
  }

  const handleGitDiff = async (f:GitFileStatus) => {
    if (!vpsId) return
    const content = await ipc.git.diff(vpsId, activeDir, f.path, f.type==='staged')
    setGitDiff({ content, filePath:f.path, staged:f.type==='staged' })
    setActiveTab(null)
  }

  const handleLocalDiff = async () => {
    if (!isLocal || !activeFile) return
    const root = localRootRef.current
    if (!root) return
    try {
      // Use the file path relative to root if possible; git diff needs the path as known by git
      const absPath = activeFile.path.replace(/\\/g, '/')
      const res = await ipc.local.exec(`git diff -- "${absPath}"`, root)
      if (!res.success && !res.output) { showToast(false, 'git diff falhou'); return }
      if (!res.output.trim()) { showToast(true, 'Sem alterações no arquivo'); return }
      const rootNorm = root.replace(/\\/g, '/')
      const relPath = absPath.startsWith(rootNorm)
        ? absPath.slice(rootNorm.length).replace(/^\//, '')
        : activeFile.name
      setGitDiff({ content: res.output, filePath: relPath, staged: false })
      setActiveTab(null)
    } catch { showToast(false, 'Erro ao executar git diff') }
  }

  // IDE-12: navegar até a linha do problema
  const jumpToLine = (p:Problem) => {
    const file = openFiles.find(f => f.path === p.file || p.file.endsWith(f.path))
    if (file) {
      setActiveTab(file.path); setGitDiff(null)
      setTimeout(() => {
        editorRef.current?.revealLineInCenter(p.line)
        editorRef.current?.setPosition({ lineNumber:p.line, column:p.col })
      }, 100)
    }
  }

  // ── derived ───────────────────────────────────────────────────────────

  const activeFile = openFiles.find(f=>f.path===activeTab)

  // Auto-refresh outline quando arquivo abre — alimenta breadcrumbs mesmo com painel fechado
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!activeFile || activeFile.loading || activeFile.imageDataUrl) return
    const timer = setTimeout(() => refreshOutline(), 450)
    return () => clearTimeout(timer)
  }, [activeFile?.path, activeFile?.loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalGitChanges = gitStatus ? gitStatus.staged.length+gitStatus.unstaged.length+gitStatus.untracked.length : 0
  const flatTree = flattenTree(rootEntries, 0, expandedFolders, folderChildren, loadingFolders)
  const errCount  = problems.filter(p=>p.severity==='error').length
  const warnCount = problems.filter(p=>p.severity==='warning').length

  // ── Git status overlay for file tree ───────────────────────────────────
  const gitFileMap = useMemo(() => {
    const map = new Map<string, { letter: string; color: string }>()
    if (!gitStatus?.isRepo) return map
    const add = (files: GitFileStatus[], fallback: string) => {
      for (const f of files) {
        const letter = (f.status?.trim()[0] ?? fallback)
        map.set(f.path.replace(/\\/g, '/'), { letter, color: GIT_STATUS_COLOR[letter] ?? 'text-slate-400' })
      }
    }
    add(gitStatus.staged, 'A')
    add(gitStatus.unstaged, 'M')
    add(gitStatus.untracked, '?')
    return map
  }, [gitStatus])

  const dirtyDirSet = useMemo(() => {
    const dirs = new Set<string>()
    for (const [p] of gitFileMap) {
      const parts = p.split('/')
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
    }
    return dirs
  }, [gitFileMap])

  // Search results grouped by file
  const searchByFile = searchResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.file]) acc[r.file] = []
    acc[r.file].push(r)
    return acc
  }, {})

  const handleEditorMount: OnMount = (ed, mon: Monaco) => {
    editorRef.current = ed
    monacoRef.current = mon
    ed.focus()

    // Semantic highlighting — VS Code-level token colors (TS worker faz o resto)
    ed.updateOptions({ 'semanticHighlighting.enabled': true } as Parameters<typeof ed.updateOptions>[0])

    ed.onDidChangeCursorPosition(e => {
      setCursorPos({ line:e.position.lineNumber, col:e.position.column })
      // Breadcrumbs: encontra símbolo que contém o cursor
      const line = e.position.lineNumber - 1
      const findSym = (syms: OutlineSymbol[]): string|null => {
        for (let i = syms.length - 1; i >= 0; i--) {
          const s = syms[i]
          if (s.line <= line && s.endLine >= line) {
            const child = s.children ? findSym(s.children) : null
            return child ?? s.name
          }
        }
        return null
      }
      setCurrentSymbol(findSym(outlineRef.current))
    })
    // IDE-12: subscribe to Monaco markers (errors/warnings)
    markerDisposableRef.current?.dispose()
    markerDisposableRef.current = mon.editor.onDidChangeMarkers(() => {
      const markers = mon.editor.getModelMarkers({})
      setProblems(markers.map((m: import('monaco-editor').editor.IMarker) => ({
        file: m.resource.path,
        line: m.startLineNumber,
        col: m.startColumn,
        message: m.message,
        severity: m.severity === mon.MarkerSeverity.Error ? 'error'
                : m.severity === mon.MarkerSeverity.Warning ? 'warning' : 'info',
        code: m.code ? (typeof m.code === 'object' ? m.code.value : m.code) : undefined,
      })))
    })
    // IDE-08: Ctrl+H — Find/Replace (ensure not intercepted by Electron)
    ed.addCommand(mon.KeyMod.CtrlCmd | mon.KeyCode.KeyH, () => {
      ed.trigger('keyboard', 'editor.action.startFindReplaceAction', null)
    })
    // IDE-09: Ctrl+G — Go to Line
    ed.addCommand(mon.KeyMod.CtrlCmd | mon.KeyCode.KeyG, () => {
      ed.trigger('keyboard', 'editor.action.gotoLine', null)
    })
    // Reveal pending line (from search click)
    if (pendingRevealLine.current !== null) {
      const line = pendingRevealLine.current
      pendingRevealLine.current = null
      setTimeout(() => {
        ed.revealLineInCenter(line)
        ed.setPosition({ lineNumber:line, column:1 })
      }, 100)
    }
  }

  // IDE-21: colar imagem no chat via Ctrl+V
  const handleChatPaste = (e: React.ClipboardEvent) => {
    const imgItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'))
    if (!imgItem) return
    e.preventDefault()

    const blob = imgItem.getAsFile()
    if (blob) {
      // Caminho A: getAsFile() funcionou — usa blob: URL para preview (sempre funciona no Electron)
      const displayUrl = URL.createObjectURL(blob)
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1] ?? ''
        setChatImage({ dataUrl: displayUrl, base64, mime: blob.type || 'image/png', filePath: '' })
      }
      reader.onerror = () => {
        // base64 falhou mas temos o displayUrl — ainda mostra preview, envia sem imagem
        setChatImage({ dataUrl: displayUrl, base64: '', mime: blob.type || 'image/png', filePath: '' })
      }
      reader.readAsDataURL(blob)
    } else {
      // Caminho B: fallback via nativeImage no main process
      ipc.clipboard.readImage().then(async res => {
        if (!res?.filePath) return
        const r = await ipc.local.readFileBase64(res.filePath)
        if (r) {
          const dataUrl = `data:image/png;base64,${r}`
          setChatImage({ dataUrl, base64: r as string, mime: 'image/png', filePath: res.filePath })
        }
      })
    }
  }

  // Logs Viewer — executa tail na VPS e opcionalmente repete em intervalo
  const runLogs = useCallback(async (cmd?: string) => {
    if (!vpsId || isLocal) return
    const command = cmd ?? logsCmd
    setLogsLoading(true)
    const r = await ipc.terminal.exec(vpsId, command, 10000)
    setLogsLoading(false)
    setLogsOutput(r.success ? (r.output || '(sem output)') : `Erro: ${r.error}`)
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [vpsId, isLocal, logsCmd])

  useEffect(() => {
    if (logsWatchRef.current) { clearInterval(logsWatchRef.current); logsWatchRef.current = null }
    if (logsWatch && vpsId && !isLocal) {
      logsWatchRef.current = setInterval(() => runLogs(), 3000)
    }
    return () => { if (logsWatchRef.current) clearInterval(logsWatchRef.current) }
  }, [logsWatch, vpsId, isLocal, runLogs])

  // Extrai sugestão de nome de arquivo do texto antes de um bloco de código
  function extractFilenameHint(textBefore: string): string {
    if (!textBefore) return ''
    const lines = textBefore.split('\n').filter(l => l.trim()).slice(-5).join('\n')
    const pats = [
      // **`path/file.ts`** ou **`path/file.ts`:**
      /\*\*`([^`\n]+\.[a-zA-Z]{1,10})`\*?\*?:?/,
      // `path/file.ts`: ou `path/file.ts`
      /`([^`\s\n]+\.[a-zA-Z]{1,10})`\s*:?/,
      // **path/file.ts** ou **path/file.ts:**
      /\*\*([^\*\s\n`]+\.[a-zA-Z]{1,10})\*\*:?/,
      // ### path/file.ts ou #### `path/file.ts`
      /#{1,6}\s+\*?\*?`?([^\s`\n*]+\.[a-zA-Z]{1,10})`?\*?\*?/,
      // Arquivo: path/file.ts | File: path/file.ts | 📄 path/file.ts
      /(?:arquivo|file|path|caminho|📄|📁)\s*:?\s*`?([^\s`\n]+\.[a-zA-Z]{1,10})`?/i,
      // 1. path/file.ts ou - path/file.ts (listas numeradas/bullet com caminho)
      /^[\s\-\*\d\.]+([a-zA-Z][^\s`\n"'*]+\.[a-zA-Z]{1,10})\s*$/m,
    ]
    for (const p of pats) {
      const m = lines.match(p)
      if (m?.[1]) {
        const name = m[1].replace(/^[./]+/, '').trim()
        if (name.includes('/') || name.includes('.')) return name
      }
    }
    return ''
  }

  // Aplica todos os arquivos do modal de revisão de alterações
  const handleApplyAll = async () => {
    if (!applyAllModal) return
    const root = isLocal ? localRootRef.current : (activeDir || (vpsId ? '/root' : null))
    if (!root) { showToast(false, 'Abra uma pasta ou arquivo antes de aplicar alterações'); return }
    setApplyAllLoading(true)
    let ok = 0
    let errors = 0
    for (const item of applyAllModal.items.filter(i => i.selected && i.name.trim())) {
      const rel = item.name.trim().replace(/\\/g, '/')
      const fullPath = rel.startsWith('/') ? rel : `${root}/${rel}`
      const r = await fsWriteFile(fullPath, item.code)
      if (r.success) {
        ok++
        const name = fullPath.split('/').pop() || rel
        openFile({ name, path: fullPath, isDirectory: false, size: 0, modifiedAt: Date.now(), permissions: '' })
        reloadDir(fullPath.split('/').slice(0, -1).join('/') || root).catch(() => {})
      } else {
        errors++
        console.error('[ApplyAll]', fullPath, r.error)
      }
    }
    setApplyAllLoading(false)
    setApplyAllModal(null)
    if (ok > 0) showToast(true, `${ok} arquivo${ok > 1 ? 's' : ''} salvo${ok > 1 ? 's' : ''}${errors > 0 ? ` (${errors} erro${errors > 1 ? 's' : ''})` : ''}`)
    else showToast(false, errors > 0 ? 'Falha ao salvar — verifique os caminhos' : 'Nenhum arquivo selecionado com nome válido')
  }

  // ── Ferramentas do agente ────────────────────────────────────────────────
  type AgProp = { type: string; description?: string }
  const AGENT_TOOLS: Array<{name: string; description: string; input_schema: {type: string; properties: Record<string, AgProp>; required: string[]}}> = [
    { name: 'read_file',       description: 'Lê o conteúdo de um arquivo do projeto.',
      input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Caminho do arquivo' } }, required: ['path'] } },
    { name: 'write_file',      description: 'Cria ou sobrescreve um arquivo. Leia antes de escrever para não perder código existente.',
      input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'Conteúdo completo' } }, required: ['path', 'content'] } },
    { name: 'list_directory',  description: 'Lista arquivos e pastas de um diretório.',
      input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'execute_command', description: 'Executa um comando no terminal do projeto (bash/PowerShell). Use para npm install, build, testes, criar pastas, etc.',
      input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
    { name: 'search_files',    description: 'Busca um padrão de texto em arquivos do projeto.',
      input_schema: { type: 'object', properties: { pattern: { type: 'string' }, directory: { type: 'string', description: 'Diretório (padrão: raiz)' } }, required: ['pattern'] } },
  ]

  const executeTool = useCallback(async (
    toolName: string,
    toolInput: Record<string, unknown>,
    sftpSid: string | null,
    root: string
  ): Promise<string> => {
    const resolvePath = (p: string) => (p.startsWith('/') ? p : `${root}/${p}`)
    try {
      switch (toolName) {
        case 'read_file': {
          const fp = resolvePath(toolInput.path as string)
          if (isLocal) return await ipc.local.readFile(fp)
          if (!sftpSid) return 'Erro: sem sessão SFTP'
          const r = await ipc.sftp.readFile(sftpSid, fp)
          return r.success ? r.content : `Erro: ${r.error}`
        }
        case 'write_file': {
          const fp = resolvePath(toolInput.path as string)
          const content = toolInput.content as string
          // Snapshot: lê o conteúdo original antes da primeira escrita (não sobrescreve snapshots de iters anteriores)
          if (!agentSnapshotsRef.current.has(fp)) {
            try {
              let originalContent: string | null = null
              if (isLocal) {
                originalContent = await ipc.local.readFile(fp).catch(() => null)
              } else if (sftpSid) {
                const sr = await ipc.sftp.readFile(sftpSid, fp)
                if (sr.success) originalContent = sr.content
              }
              if (originalContent !== null) {
                const snap: FileSnapshot = { path: fp, originalContent, savedAt: Date.now() }
                agentSnapshotsRef.current.set(fp, snap)
                setAgentSnapshots(Array.from(agentSnapshotsRef.current.values()))
              }
            } catch { /* arquivo novo — sem snapshot */ }
          }
          const r = isLocal
            ? await ipc.local.writeFile(fp, content)
            : (sftpSid ? await ipc.sftp.writeFile(sftpSid, fp, content) : { success: false, error: 'sem SFTP' })
          if (r.success) {
            const name = fp.split('/').pop() || fp
            openFile({ name, path: fp, isDirectory: false, size: 0, modifiedAt: Date.now(), permissions: '' })
            reloadDir(fp.split('/').slice(0, -1).join('/') || root).catch(() => {})
          }
          return r.success ? `✓ Arquivo salvo: ${fp}` : `Erro: ${'error' in r ? r.error : 'desconhecido'}`
        }
        case 'list_directory': {
          const dp = resolvePath(toolInput.path as string)
          if (isLocal) {
            const entries = await ipc.local.readdir(dp).catch(() => [])
            return entries.map((e: {isDirectory: boolean; name: string}) => `${e.isDirectory ? 'DIR' : 'FILE'} ${e.name}`).join('\n')
          }
          if (!sftpSid) return 'Erro: sem sessão SFTP'
          const r = await ipc.sftp.readdir(sftpSid, dp)
          return r.success ? r.entries.map(e => `${e.isDirectory ? 'DIR' : 'FILE'} ${e.name}`).join('\n') : `Erro: ${r.error}`
        }
        case 'execute_command': {
          const cmd = toolInput.command as string
          if (isLocal) {
            // Modo local — executa via child_process no diretório do projeto
            const r = await ipc.local.exec(cmd, root)
            return r.output || '(sem output)'
          }
          if (!vpsId) return '⚠️ Sem VPS configurada.'
          // Confirma comandos perigosos em modo VPS
          const dangerous = /docker\s+(rm|stop|restart)|pm2\s+(delete|stop|restart)|git\s+reset\s+--hard|rm\s+-rf|DROP\s+TABLE|truncate/i.test(cmd)
          if (dangerous) {
            const confirmed = await new Promise<boolean>(resolve => {
              setToolConfirm({ toolName: 'execute_command', cmdSummary: cmd.slice(0, 200), resolve })
              setToolConfirmInput('')
            })
            if (!confirmed) return '⚠️ Comando cancelado pelo usuário.'
          }
          const r = await ipc.terminal.exec(vpsId, cmd, 60000)
          return r.success ? (r.output || '(sem output)') : `Erro: ${r.error}`
        }
        case 'search_files': {
          const pattern = (toolInput.pattern as string).replace(/"/g, '\\"')
          const dir = resolvePath((toolInput.directory as string) || '.')
          if (isLocal) {
            // Modo local — usa findstr (Windows nativo) ou ripgrep se disponível
            const rg = await ipc.local.exec(`rg --version`, root).catch(() => ({ success: false, output: '' }))
            const cmd = rg.success
              ? `rg "${pattern}" "${dir}" -l --max-count 1 2>&1`
              : `findstr /s /r /m "${pattern}" "${dir}\\*.*" 2>&1`
            const r = await ipc.local.exec(cmd, root)
            return r.output || '(sem resultados)'
          }
          if (!vpsId) return '⚠️ Sem VPS configurada.'
          const r = await ipc.terminal.exec(vpsId, `grep -r "${pattern}" "${dir}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" -l 2>&1 | head -30`, 15000)
          return r.success ? (r.output || '(sem resultados)') : `Erro: ${r.error}`
        }
        default: return `Ferramenta desconhecida: ${toolName}`
      }
    } catch (e) { return `Erro: ${e instanceof Error ? e.message : String(e)}` }
  }, [isLocal, vpsId, openFile, reloadDir])

  const runAgentLoop = useCallback(async (
    userMsg: string,
    systemCtx: string,
    resumeMessages?: Array<{role: string; content: unknown}>
  ) => {
    if (!aiProviderName) throw new Error('Configure um provedor de IA nas Configurações.')
    const root = isLocal ? (localRootRef.current ?? '') : (activeDir ?? (vpsId ? '/root' : ''))

    // Abre sessão SFTP uma vez para todo o loop (modo VPS)
    let sftpSid: string | null = null
    if (!isLocal && vpsId) {
      const sr = await ipc.sftp.open(vpsId)
      if (sr.success) sftpSid = sr.sessionId
    }

    const apiMessages: Array<{role: string; content: unknown}> = resumeMessages ?? [
      ...chatMessages.map(m => ({ role: m.role, content: m.text })),
      { role: 'user', content: userMsg },
    ]

    // Nova sessão (não resume): limpa snapshots anteriores
    if (!resumeMessages) {
      agentSnapshotsRef.current.clear()
      setAgentSnapshots([])
    }

    setAgentSteps([])
    agentStopRef.current = false
    let iterations = 0
    const HARD_LIMIT = 500
    const PROGRESS_EVERY = 50

    try {
      while (iterations < HARD_LIMIT && !agentStopRef.current) {
        iterations++

        // Progresso automático a cada 50 iterações — sem pausa
        if (iterations > 1 && (iterations - 1) % PROGRESS_EVERY === 0) {
          setChatMessages(m => [...m, { role: 'assistant', text: `↻ Continuando automaticamente… (${iterations - 1} ações executadas)` }])
        }

        const result = await ipc.ai.chatAgent({
          messages: apiMessages,
          systemPrompt: `Responda em português brasileiro. Você é um agente de código com acesso real ao projeto. Use as ferramentas para ler arquivos antes de modificar. Raiz do projeto: ${root}\n\n${systemCtx}`,
          tools: AGENT_TOOLS,
          maxTokens: 4096,
        })

        if (result.type === 'text') {
          setChatMessages(m => [...m, { role: 'assistant', text: result.content }])
          setAgentPaused(false)
          agentResumeRef.current = null
          break
        }

        // Mostra texto parcial do assistente antes das tool calls
        if (result.text) {
          setChatMessages(m => [...m, { role: 'assistant', text: result.text! }])
        }

        // Adiciona assistantMessage ao histórico da API
        apiMessages.push(result.assistantMessage as {role: string; content: unknown})

        // Executa cada ferramenta
        const toolResults: Array<{role: string; content: unknown}> = []
        for (const call of result.calls) {
          const stepId = `${Date.now()}-${call.name}`
          setAgentSteps(s => [...s, { id: stepId, tool: call.name, input: JSON.stringify(call.input, null, 2), status: 'running' }])

          const output = await executeTool(call.name, call.input, sftpSid, root)

          setAgentSteps(s => s.map(st => st.id === stepId ? { ...st, output, status: 'done' } : st))

          if (result.format === 'anthropic') {
            toolResults.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: call.id, content: output }] })
          } else {
            toolResults.push({ role: 'tool', content: output, tool_call_id: call.id } as unknown as {role: string; content: unknown})
          }
        }

        // Para Anthropic: um único bloco tool_result com todos
        if (result.format === 'anthropic' && toolResults.length > 0) {
          const allResults = toolResults.flatMap(tr => (tr.content as Array<unknown>))
          apiMessages.push({ role: 'user', content: allResults })
        } else {
          apiMessages.push(...toolResults)
        }
      }
      if (agentStopRef.current) {
        setChatMessages(m => [...m, { role: 'assistant', text: `⏹ Agente interrompido após ${iterations} ações.` }])
      } else if (iterations >= HARD_LIMIT) {
        setChatMessages(m => [...m, { role: 'assistant', text: `⚠️ Limite de segurança atingido (${HARD_LIMIT} ações). A tarefa pode estar em loop — verifique o projeto.` }])
      }
    } finally {
      if (sftpSid) ipc.sftp.close(sftpSid).catch(() => {})
    }
  }, [aiProviderName, chatMessages, isLocal, vpsId, activeDir, executeTool, AGENT_TOOLS])

  const handleAgentContinue = useCallback(async () => {
    if (!agentResumeRef.current || chatLoading) return
    const { messages, systemCtx } = agentResumeRef.current
    agentResumeRef.current = null
    setAgentPaused(false)
    setChatLoading(true)
    setChatElapsed(0)
    chatTimerRef.current = setInterval(() => setChatElapsed(s => s + 1), 1000)
    try {
      await runAgentLoop('', systemCtx, messages)
    } finally {
      if (chatTimerRef.current) { clearInterval(chatTimerRef.current); chatTimerRef.current = null }
      setChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [chatLoading, runAgentLoop])

  const handleRollback = useCallback(async (path: string) => {
    const snap = agentSnapshotsRef.current.get(path)
    if (!snap) return
    try {
      if (isLocal) {
        await ipc.local.writeFile(snap.path, snap.originalContent)
      } else if (vpsId) {
        const sr = await ipc.sftp.open(vpsId)
        if (sr.success) {
          await ipc.sftp.writeFile(sr.sessionId, snap.path, snap.originalContent)
          await ipc.sftp.close(sr.sessionId)
        }
      }
      agentSnapshotsRef.current.delete(path)
      setAgentSnapshots(Array.from(agentSnapshotsRef.current.values()))
      const name = path.split('/').pop() || path
      openFile({ name, path, isDirectory: false, size: 0, modifiedAt: Date.now(), permissions: '' })
    } catch (e) {
      alert(`Erro ao restaurar: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [isLocal, vpsId, openFile])

  // IDE-21: enviar mensagem ao Claude via API direta ou fallback SSH
  const handleChatSend = async () => {
    if ((!chatVpsId && !aiProviderName) || (!chatInput.trim() && !chatImage) || chatLoading) return
    const historySnapshot = [...chatMessages]
    const userMsg = chatInput.trim()
    const pendingImage = chatImage
    setChatInput('')
    setChatImage(null)
    setChatMessages(m => [...m, {
      role:'user',
      text: userMsg,
      imageDataUrl: pendingImage?.dataUrl,
    } as {role:'user'|'assistant'; text:string; imageDataUrl?:string}])
    setChatLoading(true)
    setChatElapsed(0)
    chatTimerRef.current = setInterval(() => setChatElapsed(s => s + 1), 1000)
    try {
      // Contexto: arquivo ativo aberto no editor
      let ctx = activeFile && activeFile.content
        ? `## Arquivo aberto no editor: ${activeFile.name}\n\`\`\`\n${activeFile.content.slice(0, 6000)}\n\`\`\`\n\n`
        : ''

      // Modo local: ler árvore de pastas + arquivos-chave do projeto
      if (isLocal && localRootRef.current) {
        const root = localRootRef.current
        const IGNORE = new Set(['node_modules','.git','dist','build','.next','__pycache__',
          'vendor','.venv','venv','coverage','.cache','out','.turbo','target','tmp'])

        // Árvore de pastas até 2 níveis
        const buildTree = async (dir: string, prefix: string, depth: number): Promise<string> => {
          if (depth > 2) return ''
          try {
            const entries = await ipc.local.readdir(dir)
            if (!entries) return ''
            const lines: string[] = []
            for (const e of entries) {
              if (IGNORE.has(e.name) || e.name.startsWith('.')) continue
              lines.push(`${prefix}${e.isDirectory ? '📁' : '📄'} ${e.name}`)
              if (e.isDirectory && depth < 2) {
                const sub = await buildTree(e.path, prefix + '  ', depth + 1)
                if (sub) lines.push(sub)
              }
            }
            return lines.join('\n')
          } catch { return '' }
        }
        const tree = await buildTree(root, '', 1)

        // Documentação
        const KEY_FILES = ['CLAUDE.md','README.md','AGENTE.md','docs/TASKS.md','docs/CURRENT_STATE.md','docs/ARCHITECTURE.md','TASKS.md','CHANGELOG.md']
        const docFiles: string[] = []
        for (const rel of KEY_FILES) {
          const fullPath = root + '/' + rel
          if (activeFile && activeFile.path === fullPath) continue
          try {
            const content = await ipc.local.readFile(fullPath)
            if (content) docFiles.push(`### ${rel}\n${content.slice(0, 2000)}`)
          } catch { /* não existe */ }
        }

        // Código-fonte — lê arquivos de texto até 80KB total
        const CODE_EXTS = new Set(['ts','tsx','js','jsx','mjs','cjs','py','rb','go','java','cs','cpp','c','h','rs','html','css','scss','json','yaml','yml','toml','sql','graphql','sh','vue','svelte','env','example'])
        const SKIP_NAMES = new Set(['package-lock.json','yarn.lock','pnpm-lock.yaml','bun.lockb'])
        const totalRef = { bytes: 0 }
        const sourceFiles: string[] = []

        const collectFiles = async (dir: string, depth: number): Promise<void> => {
          if (depth > 4 || totalRef.bytes > 80000) return
          try {
            const entries = await ipc.local.readdir(dir)
            // pastas primeiro, depois arquivos — para pegar estrutura src/ antes de raiz
            const dirs = entries.filter(e => e.isDirectory && !IGNORE.has(e.name) && !e.name.startsWith('.'))
            const files = entries.filter(e => !e.isDirectory && !e.name.startsWith('.') && !SKIP_NAMES.has(e.name))
            for (const e of files) {
              if (totalRef.bytes > 80000) break
              const ext = e.name.split('.').pop()?.toLowerCase() || ''
              if (!CODE_EXTS.has(ext)) continue
              if (activeFile && activeFile.path === e.path) continue
              try {
                const raw = await ipc.local.readFile(e.path)
                if (!raw) continue
                const rel = e.path.replace(root, '').replace(/^[/\\]/, '')
                const snippet = raw.length > 6000 ? raw.slice(0, 6000) + '\n// ... [truncado]' : raw
                sourceFiles.push(`### ${rel}\n\`\`\`${ext}\n${snippet}\n\`\`\``)
                totalRef.bytes += snippet.length
              } catch { /* skip */ }
            }
            for (const e of dirs) {
              await collectFiles(e.path, depth + 1)
            }
          } catch { /* skip */ }
        }
        await collectFiles(root, 1)

        const projectName = root.split(/[\\/]/).pop() || root
        ctx = [
          `Responda sempre em português brasileiro. Você é um assistente de código para o projeto "${projectName}". Use APENAS o conteúdo abaixo — não tente acessar o disco.`,
          tree ? `## Estrutura\n\`\`\`\n${tree}\n\`\`\`` : '',
          docFiles.length > 0 ? `## Documentação\n\n${docFiles.join('\n\n---\n\n')}` : '',
          sourceFiles.length > 0 ? `## Código-fonte (${sourceFiles.length} arquivo${sourceFiles.length > 1 ? 's' : ''})\n\n${sourceFiles.join('\n\n---\n\n')}` : '',
          '---',
          ctx,
        ].filter(Boolean).join('\n\n')
      }

      // Se há imagem, inclui como base64 inline no prompt
      // (claude -p não suporta --image; a imagem vai como dado no texto)
      let imageNote = ''
      if (pendingImage?.base64) {
        imageNote = `\n\n[IMAGEM ANEXADA — base64 PNG]\ndata:image/png;base64,${pendingImage.base64}\n[FIM DA IMAGEM]`
      }

      const prompt = `${ctx}${userMsg}${imageNote}`
      let reply = ''

      if (aiProviderName && agentMode) {
        // Caminho A1 — Modo Agente: Claude usa ferramentas para ler/escrever arquivos
        await runAgentLoop(`${userMsg}${imageNote}`, ctx)
        return  // runAgentLoop gerencia as mensagens diretamente
      } else if (aiProviderName) {
        // Caminho A2 — API direta (2-5s, histórico completo, sem VPS)
        const history = historySnapshot.map(m => ({ role: m.role as 'user'|'assistant', content: m.text }))
        reply = await ipc.ai.chat({
          messages: [...history, { role: 'user', content: `${userMsg}${imageNote}` }],
          systemPrompt: `Responda sempre em português brasileiro. Quando sugerir alterações em arquivos, SEMPRE prefixe cada bloco de código com o caminho exato do arquivo no formato: **\`caminho/do/arquivo.ext\`** (em negrito com backticks). Exemplo: **\`src/utils/helper.ts\`**\n\n${ctx || ''}`.trim(),
          maxTokens: 4096,
        })
        if (!reply) reply = '(sem resposta)'
      } else if (chatVpsId) {
        // Caminho B — fallback claude -p via SSH (15-30s)
        const ts = Date.now()
        const tmpPrompt = `/tmp/hexagon_chat_${ts}.txt`
        const sftp = await ipc.sftp.open(chatVpsId)
        if (sftp.success && sftp.sessionId) {
          await ipc.sftp.writeFile(sftp.sessionId, tmpPrompt, prompt)
          await ipc.sftp.close(sftp.sessionId)
          const r = await ipc.terminal.exec(
            chatVpsId,
            `cd /tmp && claude -p "$(cat ${tmpPrompt})" --allowedTools '' < /dev/null 2>&1; rm -f ${tmpPrompt}`,
            120000
          )
          reply = r.success ? (r.output?.trim() || '(sem resposta)') : `Erro: ${r.error}`
        } else {
          reply = 'Erro ao conectar SFTP. Verifique a VPS selecionada.'
        }
      } else {
        reply = 'Configure um provedor de IA em Configurações → Provedores de IA.'
      }
      setChatMessages(m => [...m, { role:'assistant', text:reply }])
    } finally {
      if (chatTimerRef.current) { clearInterval(chatTimerRef.current); chatTimerRef.current = null }
      setChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior:'smooth' }), 100)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden select-none">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800 bg-slate-900 shrink-0 min-w-0">
        <button onClick={()=>navigate(-1)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100 shrink-0">
          <ArrowLeft size={12}/> Sair
        </button>
        {!isLocal && vpsId && (
          <>
            <button
              onClick={() => ipc.window.openIde(vpsId, displayName)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 shrink-0"
              title="Abrir esta VPS em nova janela independente"
            >
              <ExternalLink size={11}/>
            </button>
            <button
              onClick={() => ipc.window.openIncident(vpsId, displayName)}
              className="flex items-center gap-1 text-xs text-red-700 hover:text-red-400 shrink-0"
              title="Abrir Incident Mode"
            >
              <Siren size={11}/>
            </button>
            <button
              onClick={() => ipc.window.openDeploy(vpsId, displayName)}
              className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-400 shrink-0"
              title="Deploy Assistant"
            >
              <RocketDeployIcon size={11}/>
            </button>
          </>
        )}
        <div className="w-px h-3.5 bg-slate-700"/>
        <HardDrive size={12} className="text-brand-400 shrink-0"/>
        <span className="text-xs text-slate-300 font-medium shrink-0">{displayName}</span>
        {/* IDE-19/20: badge de modo */}
        {isLocal ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-900/60 text-emerald-400 border border-emerald-700/50 shrink-0">
            <FolderOpenIcon size={9}/> Local
          </span>
        ) : (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-900/60 text-red-400 border border-red-700/50 shrink-0 animate-pulse" title="Você está editando arquivos diretamente na VPS remota">
            <ShieldAlert size={9}/> Produção
          </span>
        )}

        {/* Modo Local: botão git diff do arquivo ativo */}
        {isLocal && activeFile && !activeFile.imageDataUrl && (
          <button onClick={handleLocalDiff}
            title="Ver git diff do arquivo ativo (requer repositório git na pasta local)"
            className="flex items-center gap-1 px-2 text-xs text-slate-600 hover:text-amber-400 transition-colors shrink-0">
            <GitCommitIcon size={11}/> Diff
          </button>
        )}

        {/* file tabs */}
        <div className="flex items-center gap-0 flex-1 min-w-0 overflow-x-auto mx-1">
          {gitDiff && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-950 text-slate-100 border-r border-slate-800 border-t-2 border-t-amber-500 shrink-0">
              <GitCommitIcon size={11} className="text-amber-400"/>
              <span className="max-w-[120px] truncate text-amber-300">{gitDiff.filePath.split('/').pop()}</span>
              <span className="text-slate-600 text-[10px]">{gitDiff.staged?'staged':'unstaged'}</span>
              <button onClick={()=>setGitDiff(null)} className="hover:text-red-400"><X size={10}/></button>
            </div>
          )}
          {openFiles.map(f => {
            const dirty = isDirty(f)
            return (
              <div key={f.path} onClick={()=>{setActiveTab(f.path);setGitDiff(null)}}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs cursor-pointer border-r border-slate-800 shrink-0 group transition-colors ${
                  f.path===activeTab&&!gitDiff?'bg-slate-950 text-slate-100 border-t-2 border-t-brand-500':'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                <FileIcon name={f.name} isDir={false} sz={11}/>
                <span className="max-w-[90px] truncate">{f.name}</span>
                {dirty && <Circle size={5} className="text-brand-400 fill-brand-400 shrink-0"/>}
                <button onClick={e=>closeTab(f.path,e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"><X size={10}/></button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {activeFile && isDirty(activeFile) && (
            <button onClick={()=>handleSave(activeTab!)} className="btn-primary text-xs py-0.5 px-2" title="Ctrl+S">
              <Save size={11}/> Salvar
            </button>
          )}
          <button onClick={()=>editorRef.current?.trigger('keyboard','editor.action.quickCommand',null)}
            title="Paleta de comandos (Ctrl+Shift+P)" className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700">
            <Command size={13}/>
          </button>
          {!isLocal && (
            <button onClick={()=>setShowTerm(v=>!v)} title="Terminal (Ctrl+`)"
              className={`p-1.5 rounded text-xs transition-colors ${showTerm?'bg-brand-600/30 text-brand-300':'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}>
              <TerminalSquare size={14}/>
            </button>
          )}
          {/* IDE-15: split editor */}
          <button onClick={()=>{ setSplitMode(v=>!v); if(splitMode) setActiveTab2(null) }}
            title={splitMode ? 'Fechar split (editor único)' : 'Split — dois arquivos lado a lado'}
            className={`p-1.5 rounded transition-colors ${splitMode?'bg-brand-600/30 text-brand-300':'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}>
            {splitMode ? <PanelRightClose size={14}/> : <Columns2 size={14}/>}
          </button>
          {/* IDE-21: botão chat Claude — disponível em ambos os modos */}
          <button onClick={()=>setShowChat(v=>!v)} title={aiProviderName ? `Chat IA — ${aiProviderName}` : 'Chat Claude via SSH (claude -p)'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${showChat?'bg-purple-600/40 text-purple-200 border border-purple-500/40':'text-purple-400 hover:text-purple-200 hover:bg-purple-900/40 border border-transparent'}`}>
            <Bot size={13}/> IA
          </button>
        </div>
      </div>

      <Toast msg={toast}/>

      {/* ═══ MAIN PANELS ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT PANEL ─── */}
        <div className="flex flex-col bg-slate-900 border-r border-slate-800 overflow-hidden shrink-0" style={{width:leftW}}>

          {/* panel tabs — Files | Search | Git (Git oculto no modo local) */}
          <div className="flex border-b border-slate-800 shrink-0">
            {([
              { id:'files',   icon:<Folder size={11}/>,     label:'Arquivos' },
              { id:'search',  icon:<Search size={11}/>,     label:'Busca' },
              { id:'outline', icon:<List size={11}/>,       label:'Outline' },
              ...(!isLocal ? [{ id:'git',    icon:<GitBranch size={11}/>, label:'Git',    badge: totalGitChanges }] : []),
              ...(!isLocal ? [{ id:'ports',  icon:<Network size={11}/>,   label:'Portas', badge: tunnels.length }] : []),
              ...(!isLocal ? [{ id:'docker', icon:<Box size={11}/>,       label:'Docker', badge: dockerContainers.filter(c=>c.state==='running').length || undefined }] : []),
              ...(!isLocal ? [{ id:'pm2',    icon:<Cpu size={11}/>,       label:'PM2',    badge: pm2Processes.filter(p=>p.status==='online').length || undefined }] : []),
            ] as const).map(p => (
              <button key={p.id}
                onClick={()=>{ setLeftPanel(p.id as 'files'|'search'|'git'|'ports'|'docker'|'pm2'|'outline'); if(p.id==='git'&&!gitStatus&&!gitLoading) loadGitStatus(); if(p.id==='ports') refreshTunnels(); if(p.id==='docker') refreshDocker(); if(p.id==='pm2') refreshPm2(); if(p.id==='outline') refreshOutline() }}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors relative ${leftPanel===p.id?'text-slate-200 border-b-2 border-brand-500':'text-slate-500 hover:text-slate-300'}`}>
                {p.icon} {p.label}
                {'badge' in p && (p.badge ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 text-[9px] bg-brand-600 text-white rounded-full px-1 min-w-[14px] text-center leading-[14px]">
                    {(p.badge ?? 0) > 99 ? '99+' : p.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── FILES panel (IDE-02: hierarchical tree) ── */}
          {leftPanel==='files' && (
            <>
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 shrink-0">
                <span className="text-xs text-slate-600 font-semibold uppercase tracking-wide truncate max-w-[120px]" title={activeDir}>
                  {activeDir.split('/').pop() || '/'}
                </span>
                <div className="flex gap-0.5">
                  <button title="Novo arquivo" onClick={()=>{setNewFileMode(true);setNewFileName('');setNewDirMode(false)}}
                    className="p-1 rounded text-slate-700 hover:text-slate-300 hover:bg-slate-700"><FilePlus size={11}/></button>
                  <button title="Nova pasta" onClick={()=>{setNewDirMode(true);setNewDirName('');setNewFileMode(false)}}
                    className="p-1 rounded text-slate-700 hover:text-slate-300 hover:bg-slate-700"><FolderPlus size={11}/></button>
                  <button title="Atualizar" onClick={()=>reloadDir('/root')}
                    className="p-1 rounded text-slate-700 hover:text-slate-300 hover:bg-slate-700"><RefreshCw size={11}/></button>
                </div>
              </div>
              {newFileMode && (
                <div className="px-2 py-1 border-b border-slate-800 flex items-center gap-1 shrink-0">
                  <input autoFocus className="input text-xs py-0 flex-1" placeholder="nome.ts" value={newFileName}
                    onChange={e=>setNewFileName(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')handleTouch();if(e.key==='Escape'){setNewFileMode(false);setNewFileName('')}}}/>
                  <button onClick={handleTouch}><Save size={11} className="text-emerald-400"/></button>
                  <button onClick={()=>{setNewFileMode(false);setNewFileName('')}}><X size={11} className="text-slate-500"/></button>
                </div>
              )}
              {newDirMode && (
                <div className="px-2 py-1 border-b border-slate-800 flex items-center gap-1 shrink-0">
                  <input autoFocus className="input text-xs py-0 flex-1" placeholder="nova-pasta" value={newDirName}
                    onChange={e=>setNewDirName(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')handleMkdir();if(e.key==='Escape'){setNewDirMode(false);setNewDirName('')}}}/>
                  <button onClick={handleMkdir}><Save size={11} className="text-emerald-400"/></button>
                  <button onClick={()=>{setNewDirMode(false);setNewDirName('')}}><X size={11} className="text-slate-500"/></button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {treeConnecting && <div className="flex justify-center py-6 text-slate-700 text-xs gap-1"><Loader2 size={12} className="animate-spin"/>Conectando…</div>}
                {treeError && <div className="flex flex-col items-center py-6 gap-2 text-red-400 text-xs px-2 text-center"><AlertCircle size={16}/>{treeError}</div>}
                {!treeConnecting && !treeError && (
                  <div className="py-0.5">
                    {flatTree.map(({ entry, depth, childLoading }) => {
                      const relPath = entry.path.startsWith(activeDir + '/')
                        ? entry.path.slice(activeDir.length + 1)
                        : null
                      const gitInfo    = relPath && !entry.isDirectory ? gitFileMap.get(relPath) : undefined
                      const dirtyFolder = relPath && entry.isDirectory  ? dirtyDirSet.has(relPath) : false
                      return (
                        <div key={entry.path}
                          className={`flex items-center group cursor-pointer text-xs hover:bg-slate-800 ${
                            activeTab===entry.path||selectedPath===entry.path?'bg-slate-800/80 text-slate-100':'text-slate-400 hover:text-slate-200'}`}
                          style={{ paddingLeft: depth * 12 + 4 }}
                          onClick={()=>{ selectedEntryRef.current=entry; setSelectedPath(entry.path); entry.isDirectory ? handleToggleFolder(entry) : openFile(entry) }}
                          onContextMenu={ev=>{ev.preventDefault();selectedEntryRef.current=entry;setSelectedPath(entry.path);setCtxMenu({x:ev.clientX,y:ev.clientY,entry})}}
                        >
                          {entry.isDirectory
                            ? <ChevronRight size={11} className={`shrink-0 text-slate-600 transition-transform ${expandedFolders.has(entry.path)?'rotate-90':''}`}/>
                            : <span className="w-3 shrink-0"/>
                          }
                          {renaming?.path===entry.path ? (
                            <div className="flex items-center gap-1 py-0.5 flex-1 min-w-0" onClick={ev=>ev.stopPropagation()}>
                              <input autoFocus className="input text-xs py-0 flex-1" value={renameVal} onChange={ev=>setRenameVal(ev.target.value)}
                                onKeyDown={ev=>{if(ev.key==='Enter')handleRename();if(ev.key==='Escape')setRenaming(null)}}/>
                              <button onClick={handleRename}><Save size={10} className="text-emerald-400"/></button>
                              <button onClick={()=>setRenaming(null)}><X size={10}/></button>
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 py-0.5 flex-1 min-w-0 overflow-hidden">
                              <FileIcon name={entry.name} isDir={entry.isDirectory} open={expandedFolders.has(entry.path)} sz={13}/>
                              <span className={`truncate text-xs flex-1 ${gitInfo ? gitInfo.color : ''}`}>{entry.name}</span>
                              {childLoading && <Loader2 size={9} className="animate-spin text-slate-600 ml-1 shrink-0"/>}
                              {!childLoading && gitInfo && (
                                <span className={`shrink-0 text-[9px] font-bold leading-none mr-1 ${gitInfo.color}`}>{gitInfo.letter}</span>
                              )}
                              {!childLoading && !gitInfo && dirtyFolder && (
                                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400/70 mr-1.5"/>
                              )}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {flatTree.length===0 && <p className="text-xs text-slate-700 px-3 py-3 text-center">Pasta vazia</p>}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── SEARCH panel (IDE-03) ── */}
          {leftPanel==='search' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-2 border-b border-slate-800 flex flex-col gap-1.5 shrink-0">
                <div className="flex gap-1">
                  <input
                    id="search-input"
                    className="input text-xs py-1 flex-1"
                    placeholder="Buscar em arquivos…"
                    value={searchQuery}
                    onChange={e=>setSearchQuery(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') handleSearch() }}
                  />
                  <button onClick={handleSearch} disabled={searchLoading||!searchQuery.trim()}
                    className="px-2 py-1 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded disabled:opacity-50">
                    {searchLoading ? <Loader2 size={10} className="animate-spin"/> : <Search size={10}/>}
                  </button>
                </div>
                <input
                  className="input text-xs py-1"
                  placeholder="Filtro glob: *.ts,*.tsx"
                  value={searchGlob}
                  onChange={e=>setSearchGlob(e.target.value)}
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={searchCase} onChange={e=>setSearchCase(e.target.checked)} className="w-3 h-3"/>
                  Aa Maiúsculas/minúsculas
                </label>
              </div>

              <div className="flex-1 overflow-y-auto">
                {searchLoading && <div className="flex items-center justify-center py-8 gap-1.5 text-slate-600 text-xs"><Loader2 size={12} className="animate-spin"/> Buscando…</div>}
                {searchDone && !searchLoading && searchResults.length===0 && (
                  <div className="flex items-center justify-center py-8 text-slate-700 text-xs">Nenhum resultado</div>
                )}
                {!searchLoading && Object.entries(searchByFile).map(([file, results]) => (
                  <div key={file}>
                    <div className="px-2 py-1 text-[10px] text-slate-500 font-medium bg-slate-900/50 border-b border-slate-800/50 truncate" title={file}>
                      {isLocal
                        ? file.replace(localRootRef.current.replace(/\\/g,'/'), '').replace(/^[\\/]/, '')
                        : file.replace('/root/', '')}
                    </div>
                    {results.map((r, i) => (
                      <div key={i}
                        className="flex items-start gap-2 px-2 py-1 text-xs hover:bg-slate-800 cursor-pointer group"
                        onClick={()=>openFile({ name:file.split('/').pop()??'', path:file, isDirectory:false, size:0, modifiedAt:0, permissions:'' }, r.line)}
                      >
                        <span className="text-slate-600 shrink-0 font-mono w-8 text-right">{r.line}</span>
                        <span className="text-slate-400 group-hover:text-slate-200 truncate font-mono">{r.preview}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {searchDone && !searchLoading && searchResults.length > 0 && (
                  <div className="px-2 py-1.5 text-[10px] text-slate-700 border-t border-slate-800">
                    {searchResults.length} resultado{searchResults.length>1?'s':''} em {Object.keys(searchByFile).length} arquivo{Object.keys(searchByFile).length>1?'s':''}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── OUTLINE panel ── */}
          {leftPanel==='outline' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 shrink-0">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Outline</span>
                <button onClick={refreshOutline} disabled={outlineLoading}
                  className="p-1 rounded text-slate-700 hover:text-slate-300 hover:bg-slate-700">
                  <RefreshCw size={10} className={outlineLoading?'animate-spin':''}/>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {outlineLoading && (
                  <div className="flex items-center justify-center py-6 gap-1.5 text-slate-700 text-xs">
                    <Loader2 size={12} className="animate-spin"/> Carregando…
                  </div>
                )}
                {!outlineLoading && outlineSymbols.length===0 && (
                  <div className="flex flex-col items-center py-8 gap-2 text-slate-700 text-xs px-3 text-center">
                    <List size={18}/>
                    <p>{activeFile ? 'Sem símbolos encontrados' : 'Abra um arquivo para ver o outline'}</p>
                  </div>
                )}
                {!outlineLoading && outlineSymbols.length>0 && (
                  <OutlineTree
                    symbols={outlineSymbols}
                    currentLine={cursorPos.line - 1}
                    onJump={line => {
                      editorRef.current?.revealLineInCenter(line+1)
                      editorRef.current?.setPosition({ lineNumber:line+1, column:1 })
                      editorRef.current?.focus()
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* PM2 Process Manager */}
          {leftPanel==='pm2' && (
            <div className="flex flex-col flex-1 overflow-hidden relative">
              {pm2Logs && (
                <div className="absolute inset-0 z-10 flex flex-col bg-slate-950 border border-slate-700 rounded-lg m-1 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 shrink-0">
                    <Cpu size={11} className="text-emerald-400"/>
                    <span className="text-xs text-slate-300 flex-1 font-mono truncate">{pm2Logs.name}</span>
                    <button onClick={()=>setPm2Logs(null)} className="text-slate-500 hover:text-slate-300"><X size={11}/></button>
                  </div>
                  <pre className="flex-1 overflow-y-auto p-3 text-[10px] font-mono text-slate-300 whitespace-pre-wrap">{pm2Logs.logs || '(sem logs)'}</pre>
                </div>
              )}
              <div className="px-3 py-2 border-b border-slate-800 shrink-0 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Cpu size={11} className="text-emerald-400"/> PM2</p>
                <button onClick={refreshPm2} disabled={pm2Loading}
                  className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 disabled:opacity-40">
                  <RefreshCw size={10} className={pm2Loading?'animate-spin':''}/> Atualizar
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {pm2Loading && pm2Processes.length === 0 && (
                  <p className="text-xs text-slate-600 px-3 py-4 text-center">Carregando...</p>
                )}
                {!pm2Loading && pm2Processes.length === 0 && (
                  <p className="text-xs text-slate-600 px-3 py-4 text-center">Nenhum processo encontrado.<br/>PM2 instalado na VPS?</p>
                )}
                {pm2Processes.map(p => {
                  const online = p.status === 'online'
                  const errored = p.status === 'errored'
                  const busy = pm2ActionName === p.name
                  const memMb = (p.memory / 1024 / 1024).toFixed(1)
                  const statusColor = online ? 'text-emerald-400' : errored ? 'text-red-400' : 'text-slate-500'
                  return (
                    <div key={p.id} className="px-3 py-2.5 border-b border-slate-800/50">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 shrink-0 text-[8px] ${statusColor}`}>●</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 font-medium truncate">{p.name}</p>
                          <div className="flex gap-2 text-[10px] text-slate-500">
                            <span className={statusColor}>{p.status}</span>
                            <span>CPU {p.cpu.toFixed(1)}%</span>
                            <span>{memMb} MB</span>
                            <span>↺ {p.restarts}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1.5 ml-4">
                        <button disabled={busy} onClick={async()=>{
                          setPm2ActionName(p.name)
                          const r = await ipc.pm2.restart(vpsId!, p.name)
                          setPm2ActionName(null)
                          if (r.success) { showToast(true, `${p.name} reiniciado`); refreshPm2() }
                          else showToast(false, r.error ?? 'Erro ao reiniciar')
                        }} className="text-[10px] px-2 py-0.5 rounded bg-brand-700/40 hover:bg-brand-600/60 text-brand-300 disabled:opacity-40">
                          {busy ? '...' : 'Restart'}
                        </button>
                        {online ? (
                          <button disabled={busy} onClick={async()=>{
                            setPm2ActionName(p.name)
                            const r = await ipc.pm2.stop(vpsId!, p.name)
                            setPm2ActionName(null)
                            if (r.success) { showToast(true, `${p.name} parado`); refreshPm2() }
                            else showToast(false, r.error ?? 'Erro ao parar')
                          }} className="text-[10px] px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-800/60 text-red-300 disabled:opacity-40">
                            Stop
                          </button>
                        ) : (
                          <button disabled={busy} onClick={async()=>{
                            setPm2ActionName(p.name)
                            const r = await ipc.pm2.restart(vpsId!, p.name)
                            setPm2ActionName(null)
                            if (r.success) { showToast(true, `${p.name} iniciado`); refreshPm2() }
                            else showToast(false, r.error ?? 'Erro ao iniciar')
                          }} className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 disabled:opacity-40">
                            Start
                          </button>
                        )}
                        <button onClick={async()=>{
                          const r = await ipc.pm2.logs(vpsId!, p.name)
                          if (r.success) setPm2Logs({ name: p.name, logs: r.logs })
                          else showToast(false, r.error ?? 'Erro ao buscar logs')
                        }} className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                          Logs
                        </button>
                        {!online && (
                          <button disabled={busy} onClick={async()=>{
                            if (!confirm(`Excluir processo ${p.name} do PM2?`)) return
                            setPm2ActionName(p.name)
                            const r = await ipc.pm2.delete(vpsId!, p.name)
                            setPm2ActionName(null)
                            if (r.success) { showToast(true, `${p.name} excluído`); refreshPm2() }
                            else showToast(false, r.error ?? 'Erro ao excluir')
                          }} className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-red-900/50 text-slate-500 hover:text-red-400 disabled:opacity-40">
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Docker Explorer */}
          {leftPanel==='docker' && (
            <div className="flex flex-col flex-1 overflow-hidden relative">
              {/* logs overlay */}
              {dockerLogs && (
                <div className="absolute inset-0 z-10 flex flex-col bg-slate-950 border border-slate-700 rounded-lg m-1 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 shrink-0">
                    <Box size={11} className="text-blue-400"/>
                    <span className="text-xs text-slate-300 flex-1 font-mono truncate">{dockerLogs.name}</span>
                    <button onClick={()=>setDockerLogs(null)} className="text-slate-500 hover:text-slate-300"><X size={11}/></button>
                  </div>
                  <pre className="flex-1 overflow-y-auto p-3 text-[10px] font-mono text-slate-300 whitespace-pre-wrap">{dockerLogs.logs || '(sem logs)'}</pre>
                </div>
              )}
              <div className="px-3 py-2 border-b border-slate-800 shrink-0 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Box size={11} className="text-blue-400"/> Docker</p>
                <button onClick={refreshDocker} disabled={dockerLoading}
                  className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 disabled:opacity-40">
                  <RefreshCw size={10} className={dockerLoading?'animate-spin':''}/> Atualizar
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {dockerLoading && dockerContainers.length === 0 && (
                  <p className="text-xs text-slate-600 px-3 py-4 text-center">Carregando...</p>
                )}
                {!dockerLoading && dockerContainers.length === 0 && (
                  <p className="text-xs text-slate-600 px-3 py-4 text-center">Nenhum container encontrado.<br/>Docker instalado na VPS?</p>
                )}
                {dockerContainers.map(c => {
                  const running = c.state === 'running'
                  const busy = dockerActionId === c.id
                  return (
                    <div key={c.id} className="px-3 py-2.5 border-b border-slate-800/50">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 shrink-0 text-[8px] ${running ? 'text-emerald-400' : 'text-slate-600'}`}>●</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 font-medium truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-500 truncate font-mono">{c.image}</p>
                          <p className="text-[10px] text-slate-600 truncate">{c.status}</p>
                          {c.ports && <p className="text-[10px] text-brand-400/70 truncate font-mono">{c.ports}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1.5 ml-4">
                        {running ? (
                          <button disabled={busy} onClick={async()=>{
                            setDockerActionId(c.id)
                            const r = await ipc.docker.stop(vpsId!, c.id)
                            setDockerActionId(null)
                            if (r.success) { showToast(true, `${c.name} parado`); refreshDocker() }
                            else showToast(false, r.error ?? 'Erro ao parar')
                          }} className="text-[10px] px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-800/60 text-red-300 disabled:opacity-40">
                            {busy ? '...' : 'Stop'}
                          </button>
                        ) : (
                          <button disabled={busy} onClick={async()=>{
                            setDockerActionId(c.id)
                            const r = await ipc.docker.start(vpsId!, c.id)
                            setDockerActionId(null)
                            if (r.success) { showToast(true, `${c.name} iniciado`); refreshDocker() }
                            else showToast(false, r.error ?? 'Erro ao iniciar')
                          }} className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 disabled:opacity-40">
                            {busy ? '...' : 'Start'}
                          </button>
                        )}
                        <button onClick={async()=>{
                          const r = await ipc.docker.logs(vpsId!, c.id)
                          if (r.success) setDockerLogs({ id: c.id, name: c.name, logs: r.logs })
                          else showToast(false, r.error ?? 'Erro ao buscar logs')
                        }} className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                          Logs
                        </button>
                        {!running && (
                          <button disabled={busy} onClick={async()=>{
                            if (!confirm(`Remover container ${c.name}?`)) return
                            setDockerActionId(c.id)
                            const r = await ipc.docker.remove(vpsId!, c.id)
                            setDockerActionId(null)
                            if (r.success) { showToast(true, `${c.name} removido`); refreshDocker() }
                            else showToast(false, r.error ?? 'Erro ao remover')
                          }} className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-red-900/50 text-slate-500 hover:text-red-400 disabled:opacity-40">
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── GIT panel ── */}
          {leftPanel==='git' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-800 shrink-0">
                {gitLoading?<Loader2 size={11} className="animate-spin text-slate-500"/>:<GitBranch size={11} className="text-brand-400 shrink-0"/>}
                <span className="text-xs text-slate-300 font-medium flex-1 truncate">
                  {gitStatus?.isRepo ? gitStatus.branch||'HEAD' : 'Não é um repo git'}
                </span>
                {gitStatus?.isRepo && (
                  <span className="text-xs flex items-center gap-1 shrink-0">
                    {gitStatus.ahead>0 && <span className="text-emerald-500">↑{gitStatus.ahead}</span>}
                    {gitStatus.behind>0 && <span className="text-amber-500">↓{gitStatus.behind}</span>}
                  </span>
                )}
                <button onClick={()=>loadGitStatus()} className="p-0.5 rounded text-slate-700 hover:text-slate-300 hover:bg-slate-700">
                  <RefreshCw size={10} className={gitLoading?'animate-spin':''}/>
                </button>
              </div>

              {gitStatus?.isRepo && (
                <div className="flex gap-1 px-2 py-1.5 border-b border-slate-800 shrink-0">
                  <button onClick={handleGitPull} disabled={!!gitOp}
                    className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-50">
                    {gitOp==='pull'?<Loader2 size={10} className="animate-spin"/>:<Download size={10}/>} Pull
                  </button>
                  <button onClick={handleGitPush} disabled={!!gitOp}
                    className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-50">
                    {gitOp==='push'?<Loader2 size={10} className="animate-spin"/>:<Upload size={10}/>} Push
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {!gitStatus && !gitLoading && (
                  <div className="flex flex-col items-center py-8 text-slate-700 text-xs gap-2"><GitBranch size={20}/><p>Clique em ↻ para carregar</p></div>
                )}
                {gitStatus && !gitStatus.isRepo && (
                  <div className="flex flex-col items-center py-8 text-slate-600 text-xs gap-2 px-3 text-center">
                    <AlertCircle size={18}/><p>Não é um repositório git.<br/>Expanda uma pasta git no Explorer.</p>
                  </div>
                )}
                {gitStatus?.isRepo && (
                  <>
                    {gitStatus.staged.length>0 && (
                      <div>
                        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-800/50">
                          <span>Staged ({gitStatus.staged.length})</span>
                          <button onClick={()=>ipc.git.restore(vpsId!,activeDir,gitStatus.staged.map((f:GitFileStatus)=>f.path),true).then(()=>loadGitStatus())}
                            className="text-slate-600 hover:text-slate-300 text-[10px]">Unstage all</button>
                        </div>
                        {gitStatus.staged.map(f=>(
                          <GitFileRow key={`s-${f.path}`} file={f} onAction={()=>handleGitRestore(f,true)} onDiff={()=>handleGitDiff(f)}
                            actionIcon={<Minus size={10}/>} actionTitle="Unstage" busy={gitOp==='restore:'+f.path}/>
                        ))}
                      </div>
                    )}
                    {gitStatus.unstaged.length>0 && (
                      <div>
                        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-800/50">
                          <span>Alterações ({gitStatus.unstaged.length})</span>
                          <button onClick={()=>ipc.git.add(vpsId!,activeDir,gitStatus.unstaged.map((f:GitFileStatus)=>f.path)).then(()=>loadGitStatus())}
                            className="text-slate-600 hover:text-slate-300 text-[10px]">Stage all</button>
                        </div>
                        {gitStatus.unstaged.map(f=>(
                          <GitFileRow key={`u-${f.path}`} file={f} onAction={()=>handleGitAdd(f)} onDiff={()=>handleGitDiff(f)}
                            actionIcon={<Plus size={10}/>} actionTitle="Stage" busy={gitOp==='add:'+f.path}/>
                        ))}
                      </div>
                    )}
                    {gitStatus.untracked.length>0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-800/50">
                          Não rastreados ({gitStatus.untracked.length})
                        </div>
                        {gitStatus.untracked.map(f=>(
                          <GitFileRow key={`n-${f.path}`} file={f} onAction={()=>handleGitAdd(f)} onDiff={null}
                            actionIcon={<Plus size={10}/>} actionTitle="Stage" busy={gitOp==='add:'+f.path}/>
                        ))}
                      </div>
                    )}
                    {gitStatus.staged.length===0&&gitStatus.unstaged.length===0&&gitStatus.untracked.length===0 && (
                      <div className="flex flex-col items-center py-8 text-slate-700 text-xs gap-1"><GitBranch size={16}/><p>Working tree limpa</p></div>
                    )}
                  </>
                )}
              </div>

              {gitStatus?.isRepo && (
                <div className="border-t border-slate-800 p-2 shrink-0">
                  <textarea className="input text-xs py-1 w-full resize-none mb-1.5" rows={2}
                    placeholder="Mensagem de commit…" value={commitMsg} onChange={e=>setCommitMsg(e.target.value)}/>
                  <button onClick={handleGitCommit} disabled={!!gitOp||!commitMsg.trim()||gitStatus.staged.length===0}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {gitOp==='commit'?<Loader2 size={10} className="animate-spin"/>:<GitCommitIcon size={10}/>}
                    Commit ({gitStatus.staged.length} arquivo{gitStatus.staged.length!==1?'s':''})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* IDE-17: Painel de Port Forwarding */}
          {leftPanel==='ports' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800 shrink-0">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2"><Network size={11} className="text-brand-400"/> Port Forwarding</p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1">
                    <input value={tunnelLocal} onChange={e=>setTunnelLocal(e.target.value)} placeholder="Porta local" className="input text-xs py-0.5 w-1/2" type="number"/>
                    <input value={tunnelRemote} onChange={e=>setTunnelRemote(e.target.value)} placeholder="Porta VPS" className="input text-xs py-0.5 w-1/2" type="number"/>
                  </div>
                  <input value={tunnelHost} onChange={e=>setTunnelHost(e.target.value)} placeholder="Host remoto (127.0.0.1)" className="input text-xs py-0.5"/>
                  <button onClick={openTunnel} disabled={tunnelLoading} className="btn-primary text-xs py-1 flex items-center justify-center gap-1">
                    {tunnelLoading ? <Loader2 size={10} className="animate-spin"/> : <Plus size={10}/>}
                    {tunnelLoading ? 'Abrindo…' : 'Abrir túnel'}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {tunnels.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700 text-xs text-center px-3">
                    <Network size={20}/>
                    <p>Nenhum túnel ativo</p>
                    <p className="text-[10px]">Ex: local 3000 → VPS 3000 para acessar seu servidor</p>
                  </div>
                ) : tunnels.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 text-xs">
                    <Globe size={11} className="text-emerald-400 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 font-mono">localhost:{t.localPort} → {t.remoteHost}:{t.remotePort}</p>
                      <a href={`http://localhost:${t.localPort}`} target="_blank" rel="noreferrer"
                        className="text-brand-400 hover:underline text-[10px]">
                        Abrir no navegador
                      </a>
                    </div>
                    <button onClick={()=>closeTunnel(t.id)} className="text-slate-700 hover:text-red-400 shrink-0"><X size={11}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── resize handle ─── */}
        <div className="w-1 bg-slate-800 hover:bg-brand-600/50 cursor-col-resize shrink-0 transition-colors active:bg-brand-500" onMouseDown={startResizeLeft}/>

        {/* ─── RIGHT: editor + terminal ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* IDE-15: editor area — single ou split */}
          <div className="flex-1 overflow-hidden flex">

            {/* ── Painel esquerdo (sempre visível) ── */}
            <div className={`flex flex-col overflow-hidden ${splitMode ? 'w-1/2 border-r border-slate-700' : 'flex-1'}`}
              onClick={()=>setFocusedPane(1)}>
              {gitDiff ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border-b border-slate-800 shrink-0">
                    <GitCommitIcon size={11} className="text-amber-400"/>
                    <span className="text-xs text-amber-300">{gitDiff.filePath}</span>
                    <span className="text-xs text-slate-600">({gitDiff.staged?'staged':'unstaged'})</span>
                    <button onClick={e=>{e.stopPropagation();setGitDiff(null)}} className="ml-auto text-slate-600 hover:text-slate-400"><X size={11}/></button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Editor height="100%" theme="vs-dark" language="diff"
                      value={gitDiff.content||'(sem diferenças)'}
                      options={{ readOnly:true, fontSize:13, fontFamily:'"Cascadia Code",Consolas,monospace', lineNumbers:'off', minimap:{enabled:false}, scrollBeyondLastLine:false, wordWrap:'on', padding:{top:8} }}/>
                  </div>
                </div>
              ) : activeFile?.imageDataUrl ? (
                <div className="flex flex-col items-center justify-center h-full bg-[#0a0f1a] gap-3 p-6">
                  <img src={activeFile.imageDataUrl} alt={activeFile.name} className="max-h-[75%] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800/50"/>
                  <p className="text-xs text-slate-600">{activeFile.name}</p>
                </div>
              ) : !activeFile ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-800">
                  <FileCode size={36}/>
                  <p className="text-sm">Selecione um arquivo para editar</p>
                  <p className="text-xs text-slate-700">Ctrl+Shift+F · busca · Ctrl+Shift+P · paleta · Ctrl+` · terminal</p>
                </div>
              ) : activeFile.loading ? (
                <div className="flex items-center justify-center h-full gap-2 text-slate-600">
                  <Loader2 size={16} className="animate-spin"/> Carregando {activeFile.name}…
                </div>
              ) : (
                <>
                  {/* KB suggestion banner */}
                  {kbSuggestion && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs shrink-0"
                      style={{ background: 'rgba(217,164,65,0.07)', borderBottom: '1px solid rgba(217,164,65,0.14)' }}>
                      <BookMarked size={11} style={{ color: '#D9A441' }} className="shrink-0" />
                      <span style={{ color: '#F2C879' }} className="font-medium truncate flex-1">{kbSuggestion.title}</span>
                      <button
                        onClick={() => handleSaveToKb(kbSuggestion)}
                        className="shrink-0 px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                        style={{ background: 'rgba(217,164,65,0.14)', color: '#D9A441' }}>
                        Salvar na KB
                      </button>
                      <button onClick={() => setKbSuggestion(null)} className="shrink-0 text-slate-600 hover:text-slate-400">
                        <X size={11} />
                      </button>
                    </div>
                  )}
                  {/* Breadcrumbs — path segments + símbolo atual (VS Code-style) */}
                  <div className="flex items-center gap-0.5 px-3 py-0.5 bg-[#161b22] border-b border-slate-800/60 text-[10px] text-slate-600 overflow-hidden shrink-0 select-none">
                    {activeFile.path.replace(/\\/g,'/').split('/').filter(Boolean).slice(-4).map((seg,i,arr) => (
                      <span key={i} className="flex items-center gap-0.5 shrink-0">
                        {i>0 && <ChevronRight size={8} className="text-slate-800 shrink-0"/>}
                        <span className={i===arr.length-1 ? 'text-slate-400 font-medium' : 'text-slate-700'}>{seg}</span>
                      </span>
                    ))}
                    {currentSymbol && (
                      <>
                        <ChevronRight size={8} className="text-slate-800 shrink-0"/>
                        <span className="text-brand-500 font-medium shrink-0">{currentSymbol}</span>
                      </>
                    )}
                  </div>
                  <Editor height="100%" theme="vs-dark"
                    language={activeFile.language} value={activeFile.content} path={activeFile.path}
                    onMount={handleEditorMount}
                    onChange={val=>setOpenFiles(f=>f.map(fl=>fl.path===activeTab?{...fl,content:val??''}:fl))}
                    options={{
                      fontSize:14, fontFamily:'"Cascadia Code","Fira Code",Consolas,"Courier New",monospace',
                      fontLigatures:true, lineHeight:1.6, minimap:{enabled:splitMode?false:true}, wordWrap:'on',
                      automaticLayout:true, scrollBeyondLastLine:false, renderLineHighlight:'gutter',
                      bracketPairColorization:{enabled:true}, smoothScrolling:true,
                      cursorBlinking:'smooth', cursorSmoothCaretAnimation:'on',
                      padding:{top:10,bottom:10}, tabSize:2,
                      'semanticHighlighting.enabled': true,
                    } as Parameters<typeof Editor>[0]['options']}/>
                </>
              )}
            </div>

            {/* ── Painel direito (split mode) ── */}
            {splitMode && (() => {
              const activeFile2 = openFiles.find(f=>f.path===activeTab2)
              return (
                <div className="w-1/2 flex flex-col overflow-hidden" onClick={()=>setFocusedPane(2)}>
                  {/* tab bar do painel direito */}
                  <div className={`flex items-center border-b shrink-0 overflow-x-auto ${focusedPane===2?'border-brand-700/50 bg-slate-950':'border-slate-800 bg-slate-900'}`}>
                    {openFiles.map(f => (
                      <div key={f.path}
                        onClick={e=>{e.stopPropagation();setActiveTab2(f.path);setFocusedPane(2)}}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs cursor-pointer border-r border-slate-800 shrink-0 transition-colors ${
                          f.path===activeTab2?'bg-slate-950 text-slate-100 border-t-2 border-t-brand-400':'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                        <FileIcon name={f.name} isDir={false} sz={11}/>
                        <span className="max-w-[80px] truncate">{f.name}</span>
                        {isDirty(f) && <Circle size={5} className="text-brand-400 fill-brand-400 shrink-0"/>}
                      </div>
                    ))}
                    {openFiles.length === 0 && (
                      <span className="px-3 py-1.5 text-xs text-slate-700 italic">Abra um arquivo</span>
                    )}
                  </div>
                  {/* conteúdo do painel direito */}
                  {!activeFile2 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-800">
                      <Columns2 size={28}/>
                      <p className="text-sm">Clique em uma aba para abrir</p>
                    </div>
                  ) : activeFile2.loading ? (
                    <div className="flex items-center justify-center h-full gap-2 text-slate-600">
                      <Loader2 size={16} className="animate-spin"/> Carregando…
                    </div>
                  ) : activeFile2.imageDataUrl ? (
                    <div className="flex flex-col items-center justify-center h-full bg-[#0a0f1a] gap-3 p-6">
                      <img src={activeFile2.imageDataUrl} alt={activeFile2.name} className="max-h-[75%] max-w-full object-contain rounded-lg border border-slate-800/50"/>
                    </div>
                  ) : (
                    <Editor height="100%" theme="vs-dark"
                      language={activeFile2.language} value={activeFile2.content}
                      path={activeFile2.path + '__split2'}
                      onMount={ed => { editorRef2.current = ed }}
                      onChange={val=>setOpenFiles(f=>f.map(fl=>fl.path===activeTab2?{...fl,content:val??''}:fl))}
                      options={{
                        fontSize:14, fontFamily:'"Cascadia Code","Fira Code",Consolas,"Courier New",monospace',
                        fontLigatures:true, lineHeight:1.6, minimap:{enabled:false}, wordWrap:'on',
                        automaticLayout:true, scrollBeyondLastLine:false, renderLineHighlight:'gutter',
                        bracketPairColorization:{enabled:true}, smoothScrolling:true,
                        cursorBlinking:'smooth', cursorSmoothCaretAnimation:'on',
                        padding:{top:10,bottom:10}, tabSize:2,
                      }}/>
                  )}
                </div>
              )
            })()}
          </div>

          {/* terminal resize handle — oculto no modo local */}
          {!isLocal && showTerm && (
            <div className="h-1 bg-slate-800 hover:bg-brand-600/50 cursor-row-resize shrink-0 transition-colors active:bg-brand-500" onMouseDown={startResizeTerm}/>
          )}

          {/* ─── PAINEL INFERIOR: Terminal + Problemas — oculto no modo local ─── */}
          <div style={{ height: (!isLocal && showTerm) ? termH : 0, overflow:'hidden', flexShrink:0 }}>
            <div className="flex flex-col h-full bg-[#0d1117]">

              {/* header: modo Terminal | Problemas + tabs do terminal ativo + fechar */}
              <div className="flex items-center border-b border-slate-800 bg-slate-900 shrink-0 overflow-x-auto">
                {/* mode buttons */}
                <button onClick={()=>setBottomPanel('terminal')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium shrink-0 border-b-2 transition-colors ${bottomPanel==='terminal'?'text-slate-200 border-brand-500':'text-slate-500 border-transparent hover:text-slate-300'}`}>
                  <TerminalSquare size={10}/> Terminal
                </button>
                <button onClick={()=>setBottomPanel('problems')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium shrink-0 border-b-2 transition-colors ${bottomPanel==='problems'?'text-slate-200 border-brand-500':'text-slate-500 border-transparent hover:text-slate-300'}`}>
                  <AlertCircle size={10}/>
                  Problemas
                  {(errCount+warnCount) > 0 && (
                    <span className={`text-[9px] px-1 rounded-full min-w-[14px] text-center ${errCount>0?'bg-red-600':'bg-amber-600'} text-white`}>
                      {errCount+warnCount}
                    </span>
                  )}
                </button>
                {!isLocal && (
                  <button onClick={()=>{ setBottomPanel('logs'); if(!logsOutput) runLogs() }}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium shrink-0 border-b-2 transition-colors ${bottomPanel==='logs'?'text-slate-200 border-brand-500':'text-slate-500 border-transparent hover:text-slate-300'}`}>
                    <FileText size={10}/> Logs
                    {logsWatch && <span className="text-[8px] text-emerald-400 animate-pulse">●</span>}
                  </button>
                )}
                {/* terminal tabs — só no modo terminal */}
                {bottomPanel==='terminal' && (
                  <>
                    <div className="w-px h-3 bg-slate-800 mx-1 shrink-0"/>
                    {termTabs.map(tab => {
                      const isActive = tab.id === activeTermId
                      return (
                        <div key={tab.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-b-2 shrink-0 group transition-colors ${isActive?'text-slate-200 border-brand-500':'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30'}`}
                          onClick={()=>switchTermTab(tab.id)}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.status==='connected'?'bg-emerald-500':tab.status==='error'||tab.status==='closed'?'bg-red-500':'bg-slate-600'} ${tab.status==='connecting'?'animate-pulse':''}`}/>
                          <span>{tab.title}</span>
                          <button onClick={e=>closeTermTab(tab.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-0.5"><X size={10}/></button>
                        </div>
                      )
                    })}
                    <button onClick={openNewTermTab} title="Novo terminal" className="px-2 py-1.5 text-slate-700 hover:text-slate-300 hover:bg-slate-800/50 shrink-0">
                      <Plus size={12}/>
                    </button>
                  </>
                )}
                <div className="ml-auto pr-2 shrink-0">
                  <button onClick={()=>setShowTerm(false)} className="text-slate-700 hover:text-slate-400 p-1"><X size={12}/></button>
                </div>
              </div>

              {/* terminal containers — sempre montados, escondidos quando modo problemas */}
              <div className="flex-1 overflow-hidden relative" style={{ display: bottomPanel==='terminal' ? '' : 'none' }}>
                {termTabs.map(tab => (
                  <div key={tab.id}
                    ref={el => { if (el) termContainerMapRef.current.set(tab.id, el) }}
                    style={{ display: tab.id===activeTermId ? 'block' : 'none', height:'100%', padding:'4px' }}
                    onClick={() => termInstancesRef.current.get(tab.id)?.term.focus()}
                  />
                ))}
                {termTabs.length===0 && showTerm && (
                  <div className="flex items-center justify-center h-full text-slate-700 text-xs gap-1">
                    <Loader2 size={12} className="animate-spin"/> Abrindo terminal…
                  </div>
                )}
              </div>

              {/* painel de problemas */}
              {bottomPanel==='problems' && (
                <div className="flex-1 overflow-y-auto">
                  {problems.length===0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700 text-xs">
                      <Check size={16}/>
                      <p>Nenhum problema detectado no arquivo atual</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-1 text-[10px] text-slate-600 border-b border-slate-800/50 flex items-center gap-3">
                        {errCount>0 && <span className="text-red-400">✗ {errCount} erro{errCount!==1?'s':''}</span>}
                        {warnCount>0 && <span className="text-amber-400">⚠ {warnCount} aviso{warnCount!==1?'s':''}</span>}
                        <span>— arquivo atual</span>
                      </div>
                      {problems.map((p, i) => (
                        <div key={i} onClick={()=>jumpToLine(p)}
                          className="flex items-start gap-2 px-3 py-1.5 text-xs hover:bg-slate-800/60 cursor-pointer border-b border-slate-800/20">
                          <span className={`shrink-0 mt-0.5 font-bold ${p.severity==='error'?'text-red-400':p.severity==='warning'?'text-amber-400':'text-blue-400'}`}>
                            {p.severity==='error' ? '✗' : p.severity==='warning' ? '⚠' : 'ℹ'}
                          </span>
                          <span className="flex-1 text-slate-300">{p.message}</span>
                          {p.code && <span className="text-slate-700 shrink-0 text-[10px]">[{p.code}]</span>}
                          <span className="text-slate-600 shrink-0 font-mono">{p.line}:{p.col}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* painel de logs */}
              {bottomPanel==='logs' && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* toolbar */}
                  <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800 shrink-0 flex-wrap gap-y-1">
                    <input
                      value={logsCmd} onChange={e=>setLogsCmd(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') runLogs() }}
                      className="flex-1 min-w-0 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300 focus:outline-none focus:border-brand-500"
                      placeholder="tail -n 200 /var/log/syslog"
                    />
                    <button onClick={()=>runLogs()} disabled={logsLoading}
                      className="text-[10px] px-2 py-0.5 rounded bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 disabled:opacity-40 flex items-center gap-1 shrink-0">
                      {logsLoading ? <><RefreshCw size={9} className="animate-spin"/> ...</> : '▶ Executar'}
                    </button>
                    <button onClick={()=>{ setLogsWatch(v=>!v); if(!logsWatch) runLogs() }}
                      className={`text-[10px] px-2 py-0.5 rounded shrink-0 flex items-center gap-1 transition-colors ${logsWatch?'bg-emerald-700/40 text-emerald-300':'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}>
                      {logsWatch ? '⏹ Watch ON' : '▶ Watch'}
                    </button>
                    <button onClick={()=>setLogsOutput('')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-500 shrink-0">Limpar</button>
                  </div>
                  {/* quick presets */}
                  <div className="flex gap-1 px-2 py-1 border-b border-slate-800/50 shrink-0 overflow-x-auto">
                    {[
                      ['syslog', 'tail -n 200 /var/log/syslog'],
                      ['nginx err', 'tail -n 200 /var/log/nginx/error.log'],
                      ['nginx acc', 'tail -n 200 /var/log/nginx/access.log'],
                      ['PM2 all', 'pm2 logs --lines 100 --nostream --no-color 2>&1'],
                      ['journald', 'journalctl -n 150 --no-pager 2>&1'],
                    ].map(([label, cmd]) => (
                      <button key={label} onClick={()=>{ setLogsCmd(cmd); runLogs(cmd) }}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 shrink-0 whitespace-nowrap">
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* output */}
                  <pre className="flex-1 overflow-y-auto p-2 text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {logsOutput || <span className="text-slate-700">Execute um comando para ver os logs</span>}
                    <div ref={logsEndRef}/>
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── IDE-21: CHAT CLAUDE (painel direito — ambos os modos) ─── */}
        {showChat && (
          <>
            {/* resize handle */}
            <div className="w-1 bg-slate-800 hover:bg-purple-600/50 cursor-col-resize shrink-0 transition-colors active:bg-purple-500" onMouseDown={startResizeChat}/>
            <div className="flex flex-col bg-slate-900 border-l border-slate-800 shrink-0 overflow-hidden" style={{width:chatW}}>
              {/* header */}
              <div className="flex flex-col border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Bot size={13} className="text-purple-400"/>
                  <span className="text-xs font-semibold text-slate-300 flex-1">Chat IA</span>
                  <span className="text-[10px] text-slate-600">
                    {aiProviderName
                      ? ({anthropic:'Anthropic',deepseek:'DeepSeek',openai:'OpenAI',gemini:'Gemini',groq:'Groq',mistral:'Mistral',xai:'xAI Grok'} as Record<string,string>)[aiProviderName] ?? aiProviderName
                      : 'claude -p (SSH)'}
                  </span>
                  {aiProviderName && aiProviderName !== 'gemini' && (
                    <button onClick={()=>setAgentMode(v=>!v)}
                      title={agentMode ? 'Modo Agente ON — Claude lê/escreve arquivos diretamente' : 'Ativar Modo Agente'}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${agentMode ? 'bg-emerald-700/40 text-emerald-300 border border-emerald-600/40' : 'text-slate-600 hover:text-slate-400'}`}>
                      🤖 {agentMode ? 'Agente' : 'Agente'}
                    </button>
                  )}
                  <button onClick={()=>setChatMessages([])} className="text-slate-700 hover:text-slate-400 text-[10px]" title="Limpar histórico">✕</button>
                </div>
                {/* seletor de VPS — sempre visível para escolher onde o Claude roda */}
                <div className="px-3 pb-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 shrink-0">VPS:</span>
                  {isLocal ? (
                    <select value={chatVpsId} onChange={e=>setChatVpsId(e.target.value)}
                      className="flex-1 text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-purple-500">
                      {chatVpsList.length === 0
                        ? <option value="">Nenhuma VPS cadastrada</option>
                        : chatVpsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)
                      }
                    </select>
                  ) : (
                    <span className="text-[10px] text-slate-400">{displayName}</span>
                  )}
                </div>
              </div>
              {/* messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Snapshots — rollback de arquivos modificados pelo agente */}
                {agentSnapshots.length > 0 && (
                  <div className="rounded-lg border border-orange-800/40 bg-orange-950/20 overflow-hidden mb-2">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-orange-800/30">
                      <span className="text-[10px] text-orange-400 font-medium">📦 Snapshots — {agentSnapshots.length} arquivo{agentSnapshots.length > 1 ? 's' : ''} modificado{agentSnapshots.length > 1 ? 's' : ''}</span>
                      <button
                        onClick={() => { agentSnapshotsRef.current.clear(); setAgentSnapshots([]) }}
                        className="text-[9px] text-slate-600 hover:text-slate-400"
                        title="Descartar todos os snapshots"
                      >✕ descartar</button>
                    </div>
                    <div className="divide-y divide-orange-900/30">
                      {agentSnapshots.map(snap => (
                        <div key={snap.path} className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                          <span
                            className="text-[10px] text-slate-300 font-mono truncate flex-1 cursor-pointer hover:text-orange-300"
                            title={snap.path}
                            onClick={() => openFile({ name: snap.path.split('/').pop() || snap.path, path: snap.path, isDirectory: false, size: 0, modifiedAt: snap.savedAt, permissions: '' })}
                          >
                            {snap.path.split('/').slice(-2).join('/')}
                          </span>
                          <button
                            onClick={() => handleRollback(snap.path)}
                            className="text-[10px] bg-orange-800/40 hover:bg-orange-700/60 text-orange-300 border border-orange-700/40 rounded px-2 py-0.5 shrink-0 transition-colors"
                            title={`Restaurar versão anterior de ${snap.path}`}
                          >
                            ↩ Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Agent tool call steps */}
                {agentSteps.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {agentSteps.map(step => (
                      <div key={step.id} className={`rounded-lg border text-[10px] font-mono overflow-hidden ${step.status==='running'?'border-yellow-700/40 bg-yellow-900/10':step.status==='error'?'border-red-700/40 bg-red-900/10':'border-slate-700 bg-slate-800/50'}`}>
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span className={step.status==='running'?'animate-pulse text-yellow-400':step.status==='error'?'text-red-400':'text-emerald-400'}>{step.status==='running'?'⟳':step.status==='error'?'✗':'✓'}</span>
                          <span className="text-slate-300">{step.tool}</span>
                          <span className="text-slate-600 truncate flex-1">{Object.values(JSON.parse(step.input))[0] as string}</span>
                        </div>
                        {step.output && (
                          <pre className="px-2 pb-1.5 text-slate-500 whitespace-pre-wrap max-h-24 overflow-y-auto text-[9px]">{step.output.slice(0, 500)}{step.output.length > 500 ? '…' : ''}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {chatMessages.length === 0 && agentSteps.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700 text-xs text-center px-4">
                    <Bot size={24}/>
                    <p>{agentMode
                      ? '🤖 Modo Agente ativo. A IA lê, escreve e executa arquivos diretamente.'
                      : aiProviderName
                        ? 'Chat via API direta. O contexto do arquivo é enviado automaticamente.'
                        : 'Chat via claude -p (SSH). Configure um provedor em Configurações para respostas mais rápidas.'
                    }</p>
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex flex-col gap-1 ${m.role==='user'?'items-end':'items-start'}`}>
                    <span className="text-[10px] text-slate-600">{m.role==='user'?'Você':'Claude'}</span>
                    {m.role === 'user' ? (
                      <div className="flex flex-col gap-1.5 items-end max-w-full">
                        {m.imageDataUrl && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-900/30 border border-purple-700/30 text-[10px] text-purple-400">
                            <FileImage size={11}/> Print enviado
                          </div>
                        )}
                        {m.text && (
                          <div className="text-xs rounded-lg px-3 py-2 max-w-full whitespace-pre-wrap break-words bg-purple-900/50 text-purple-100 border border-purple-700/30">
                            {m.text}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-w-full w-full">
                        {/* Renderiza blocos de código com botões, texto normal como parágrafo */}
                        {(() => {
                          const msgParts = m.text.split(/(```[\s\S]*?```)/g)
                          const codeCount = msgParts.filter(p => /^```[\s\S]*?```$/.test(p)).length
                          if (codeCount >= 2) {
                            const items = msgParts
                              .map((p, idx) => ({ p, idx }))
                              .filter(({ p }) => /^```[\s\S]*?```$/.test(p))
                              .map(({ p, idx }) => {
                                const cm = p.match(/^```(\w*)\n?([\s\S]*?)```$/)
                                const lang = cm?.[1] || ''
                                const code = cm?.[2] ?? p
                                const hint = extractFilenameHint(msgParts[idx - 1] || '')
                                return { code, lang, name: hint, selected: true }
                              })
                            return (
                              <button key="apply-all"
                                onClick={() => setApplyAllModal({ items })}
                                className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-purple-700/20 border border-purple-600/40 text-purple-300 text-xs font-medium hover:bg-purple-700/30 transition-colors">
                                <FilePlus size={13}/>
                                Revisar e aplicar {codeCount} alterações…
                              </button>
                            )
                          }
                          return null
                        })()}
                        {m.text.split(/(```[\s\S]*?```)/g).map((part, pi) => {
                          const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/)
                          if (codeMatch) {
                            const lang = codeMatch[1] || 'código'
                            const code = codeMatch[2]
                            const cmdKey = `${i}-${pi}`
                            const cmdState = cmdOutputs[cmdKey]
                            const isShell = SHELL_LANGS.has(lang.toLowerCase())
                            const canExec = isShell && chatVpsId && !isLocal
                            return (
                              <div key={pi} className="rounded-lg border border-slate-700 overflow-hidden">
                                {/* header do bloco */}
                                <div className="flex items-center justify-between px-3 py-1 bg-slate-800/80 border-b border-slate-700">
                                  <span className="text-[10px] text-slate-500 font-mono">{lang}</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => navigator.clipboard.writeText(code).then(()=>showToast(true,'Código copiado'))}
                                      className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                                      Copiar
                                    </button>
                                    {canExec && (
                                      <button
                                        disabled={cmdState?.running}
                                        onClick={async () => {
                                          setCmdOutputs(o => ({...o, [cmdKey]: {running:true, output:'', ok:true}}))
                                          const r = await ipc.terminal.exec(chatVpsId, code, 60000)
                                          setCmdOutputs(o => ({...o, [cmdKey]: {
                                            running: false,
                                            output: (r.output || r.error || '(sem output)').slice(0, 3000),
                                            ok: r.success,
                                          }}))
                                        }}
                                        className="text-[10px] px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1">
                                        {cmdState?.running ? '⟳ Executando…' : '▶ Executar na VPS'}
                                      </button>
                                    )}
                                    {activeFile && (
                                      <button
                                        onClick={() => {
                                          setOpenFiles(f => f.map(fl => fl.path===activeTab ? {...fl, content:code} : fl))
                                          showToast(true, `Aplicado em ${activeFile.name} — Ctrl+S para salvar`)
                                        }}
                                        className="text-[10px] px-2 py-0.5 rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors"
                                        title={`Substituir conteúdo de ${activeFile.name}`}>
                                        ▶ {activeFile.name}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => { setChatSaveAs({code, lang}); setChatSaveAsName('') }}
                                      className="text-[10px] px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 transition-colors"
                                      title="Salvar como novo arquivo">
                                      Salvar como…
                                    </button>
                                  </div>
                                </div>
                                <pre className="text-[11px] font-mono text-slate-300 p-3 overflow-x-auto bg-slate-900/80 whitespace-pre">{code}</pre>
                                {cmdState && !cmdState.running && cmdState.output && (
                                  <div className={`border-t ${cmdState.ok ? 'border-emerald-900/50 bg-emerald-950/30' : 'border-red-900/50 bg-red-950/30'}`}>
                                    <div className="flex items-center justify-between px-3 py-1">
                                      <span className={`text-[10px] font-mono ${cmdState.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {cmdState.ok ? '✓ Output' : '✗ Erro'}
                                      </span>
                                      <button onClick={() => setCmdOutputs(o => {const n={...o}; delete n[cmdKey]; return n})}
                                        className="text-[10px] text-slate-600 hover:text-slate-400">limpar</button>
                                    </div>
                                    <pre className="text-[11px] font-mono px-3 pb-3 overflow-x-auto whitespace-pre text-slate-300 max-h-48 overflow-y-auto">{cmdState.output}</pre>
                                  </div>
                                )}
                                {cmdState?.running && (
                                  <div className="px-3 py-2 border-t border-slate-700 text-[10px] text-emerald-400 font-mono animate-pulse">
                                    ⟳ Executando na VPS…
                                  </div>
                                )}
                              </div>
                            )
                          }
                          if (!part.trim()) return null
                          return (
                            <div key={pi} className="text-xs rounded-lg px-3 py-2 bg-slate-800 text-slate-200 border border-slate-700/50 whitespace-pre-wrap break-words">
                              {part.trim()}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs bg-slate-800/50 rounded-lg px-3 py-2">
                    <Loader2 size={12} className="animate-spin text-purple-400"/>
                    <span className="flex-1">Claude pensando… <span className="text-slate-600">{chatElapsed}s</span></span>
                    {agentMode && (
                      <button
                        onClick={() => { agentStopRef.current = true }}
                        className="text-xs bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded px-2.5 py-1 transition-colors shrink-0"
                      >
                        ⏹ Parar
                      </button>
                    )}
                  </div>
                )}
                <div ref={chatEndRef}/>
              </div>
              {/* modal: salvar código como novo arquivo */}
              {chatSaveAs && (
                <div className="px-3 py-3 border-t border-slate-700 bg-slate-800/80 shrink-0">
                  <p className="text-[11px] text-slate-300 mb-2 font-medium">Salvar código como arquivo:</p>
                  <input
                    autoFocus
                    value={chatSaveAsName}
                    onChange={e=>setChatSaveAsName(e.target.value)}
                    placeholder={`ex: src/utils/funcao.${chatSaveAs.lang||'ts'}`}
                    className="w-full text-xs bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 mb-2"
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setChatSaveAs(null); return }
                      if (e.key !== 'Enter' || !chatSaveAsName.trim()) return
                      const root = isLocal ? localRootRef.current : activeDir
                      const rel  = chatSaveAsName.trim().replace(/\\/g, '/')
                      const fullPath = rel.startsWith('/') ? rel : `${root}/${rel}`
                      const r = await fsWriteFile(fullPath, chatSaveAs.code)
                      if (r.success) {
                        const name = fullPath.split('/').pop() || rel
                        const entry = { name, path:fullPath, isDirectory:false, size:0, modifiedAt:Date.now(), permissions:'' }
                        openFile(entry)
                        reloadDir(fullPath.split('/').slice(0,-1).join('/') || root)
                        showToast(true, `${name} criado — Ctrl+S para salvar`)
                        setChatSaveAs(null)
                      } else {
                        showToast(false, r.error ?? 'Erro ao criar arquivo')
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!chatSaveAsName.trim()) return
                        const root = isLocal ? localRootRef.current : activeDir
                        const rel  = chatSaveAsName.trim().replace(/\\/g, '/')
                        const fullPath = rel.startsWith('/') ? rel : `${root}/${rel}`
                        const r = await fsWriteFile(fullPath, chatSaveAs.code)
                        if (r.success) {
                          const name = fullPath.split('/').pop() || rel
                          openFile({ name, path:fullPath, isDirectory:false, size:0, modifiedAt:Date.now(), permissions:'' })
                          reloadDir(fullPath.split('/').slice(0,-1).join('/') || root)
                          showToast(true, `${name} criado`)
                          setChatSaveAs(null)
                        } else showToast(false, r.error ?? 'Erro ao criar arquivo')
                      }}
                      className="flex-1 text-[11px] py-1 rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors">
                      Criar arquivo
                    </button>
                    <button onClick={()=>setChatSaveAs(null)} className="text-[11px] px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* modal: revisar e aplicar múltiplas alterações */}
              {applyAllModal && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-h-full flex flex-col shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
                      <FilePlus size={14} className="text-purple-400"/>
                      <span className="text-sm font-semibold text-slate-100 flex-1">
                        Revisar alterações — {applyAllModal.items.filter(i=>i.selected).length} arquivo(s)
                      </span>
                      <button onClick={()=>setApplyAllModal(null)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                      {applyAllModal.items.map((item, idx) => (
                        <div key={idx} className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${item.selected ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                          <input type="checkbox" checked={item.selected}
                            onChange={e => setApplyAllModal(prev => prev ? {
                              items: prev.items.map((it,i) => i===idx ? {...it, selected: e.target.checked} : it)
                            } : null)}
                            className="mt-1.5 shrink-0 accent-purple-500"/>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-slate-500 font-mono mb-1 block">{item.lang || 'código'} · {item.code.split('\n').length} linhas</span>
                            <input type="text" value={item.name}
                              onChange={e => setApplyAllModal(prev => prev ? {
                                items: prev.items.map((it,i) => i===idx ? {...it, name: e.target.value} : it)
                              } : null)}
                              placeholder="caminho/do/arquivo.ts"
                              className="w-full text-xs bg-slate-950 border border-slate-600 rounded px-2 py-1 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"/>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 px-4 py-3 border-t border-slate-800 shrink-0">
                      <button onClick={()=>setApplyAllModal(null)}
                        className="flex-1 text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                        Cancelar
                      </button>
                      <button onClick={handleApplyAll} disabled={applyAllLoading || !applyAllModal.items.some(i=>i.selected && i.name.trim())}
                        className="flex-1 text-xs py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40">
                        {applyAllLoading
                          ? <><span className="animate-spin">⟳</span> Aplicando…</>
                          : <>✓ Aplicar {applyAllModal.items.filter(i=>i.selected && i.name.trim()).length} arquivo(s)</>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* input */}
              <div className="px-3 py-2 border-t border-slate-800 shrink-0">
                {/* badge da imagem colada */}
                {chatImage && (
                  <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-purple-900/40 border border-purple-700/40 text-xs text-purple-300">
                    <FileImage size={13} className="shrink-0"/>
                    <span className="flex-1">Print anexado — será enviado com a mensagem</span>
                    <button onClick={()=>setChatImage(null)} className="text-purple-500 hover:text-red-400 shrink-0">
                      <X size={12}/>
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleChatSend()} }}
                    onPaste={handleChatPaste}
                    placeholder="Pergunte algo… (Enter para enviar, Ctrl+V para colar imagem)"
                    rows={3}
                    className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-purple-500"
                  />
                  <button onClick={handleChatSend} disabled={chatLoading||!chatInput.trim()}
                    className="shrink-0 self-end p-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                    <Send size={13}/>
                  </button>
                </div>
                <p className="text-[10px] text-slate-700 mt-1">Shift+Enter = nova linha · Enter = enviar</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3 py-0.5 border-t border-slate-800 bg-slate-900 text-xs text-slate-600">
        <span className="flex items-center gap-3">
          {gitStatus?.isRepo && (
            <span className="flex items-center gap-1 cursor-pointer hover:text-slate-400" onClick={()=>setLeftPanel('git')}>
              <GitBranch size={10}/>
              <span className={totalGitChanges>0?'text-amber-500':'text-slate-500'}>{gitStatus.branch}</span>
              {totalGitChanges>0 && <span className="text-amber-500">{totalGitChanges}↕</span>}
            </span>
          )}
          {activeFile && <span>{activeFile.language} · {activeFile.path}</span>}
          {!activeFile && !gitDiff && <span>{flatTree.filter(n=>!n.entry.isDirectory).length} arquivos · /root</span>}
          {gitDiff && <span className="text-amber-400">{gitDiff.filePath}</span>}
        </span>
        <span className="flex items-center gap-3">
          {activeFile && isDirty(activeFile) && <span className="text-brand-400">● Ctrl+S salvar</span>}
          {activeFile && !gitDiff && <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>}
          {/* IDE-16/22: botão LSP dinâmico — muda conforme linguagem do arquivo ativo */}
          {!isLocal && (() => {
            const monacoLang = activeFile ? detectLang(activeFile.name) : null
            const lspKey = monacoLang ? monacoLangToLspKey(monacoLang) : null
            if (!lspKey) return null
            const cfg = LSP_CONFIGS[lspKey]
            const active = lspStates[lspKey] ?? false
            return (
              <button onClick={() => toggleLSP(lspKey)} disabled={lspLoading}
                title={active ? `${cfg.name} ativo — clique para desconectar` : `Ativar ${cfg.name} (túnel porta ${cfg.port})`}
                className={`flex items-center gap-1 transition-colors ${active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-slate-400'}`}>
                {lspLoading ? <Loader2 size={10} className="animate-spin"/> : <span className="text-[10px]">{cfg.label}</span>}
                {active ? ' LSP ✓' : ' LSP'}
              </button>
            )
          })()}
          {/* IDE-18: botão DAP debug remoto na status bar */}
          {!isLocal && (
            <button
              title="Debug remoto — abre Chrome DevTools conectado à VPS via túnel 9229"
              onClick={async () => {
                const url = `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=localhost:9229`
                await ipc.debug.openDevTools(url)
              }}
              className="flex items-center gap-1 text-slate-600 hover:text-orange-400 transition-colors text-[10px]">
              ⬡ DAP
            </button>
          )}
          {!isLocal && (
            <span className="flex items-center gap-1">
              <PanelBottom size={10}/> Ctrl+`
            </span>
          )}
          {activeTab && (
            <button
              onClick={handleLearnFile}
              disabled={aiLearning}
              title="Analisar arquivo com IA e salvar padrões na KB"
              className={`flex items-center gap-1 transition-colors text-[10px] ${aiLearning ? 'text-yellow-500' : 'text-slate-600 hover:text-yellow-400'}`}>
              {aiLearning ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />}
              {aiLearning ? ' Aprendendo…' : ' Aprender'}
            </button>
          )}
          {!isLocal && vpsId && (
            <button
              onClick={() => {
                const path = encodeURIComponent(activeDir || '/root')
                const name = encodeURIComponent(vpsName ?? '')
                navigate(`/workspace?vpsId=${encodeURIComponent(vpsId)}&path=${path}&name=${name}`)
              }}
              title="Workspace Intelligence — mapa de arquitetura do projeto"
              className="flex items-center gap-1 text-slate-600 hover:text-blue-400 transition-colors text-[10px]">
              <Network size={10} /> Workspace
            </button>
          )}
        </span>
      </div>

      {/* AI learn result modal */}
      {aiLearnResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <div className="w-full max-w-lg rounded-xl p-5 shadow-2xl"
            style={{ background: '#0F0C22', border: '1px solid rgba(217,164,65,0.2)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={14} style={{ color: '#D9A441' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#F2C879' }}>Padrão detectado pela IA</h3>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Título</p>
                <p className="text-sm text-slate-200">{aiLearnResult.title}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Conteúdo</p>
                <p className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-6">{aiLearnResult.content}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Categoria</p>
                  <p className="text-xs text-slate-300">{aiLearnResult.category}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Tags</p>
                  <p className="text-xs text-slate-300">{aiLearnResult.tags}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAiLearnResult(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Ignorar
              </button>
              <button
                onClick={() => handleSaveToKb(aiLearnResult)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'rgba(217,164,65,0.14)', border: '1px solid rgba(217,164,65,0.28)', color: '#F2C879' }}>
                Salvar na KB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* context menu */}
      {ctxMenu && (
        <div className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{left:ctxMenu.x,top:ctxMenu.y}} onMouseLeave={()=>setCtxMenu(null)}>
          <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            onClick={()=>{setRenaming(ctxMenu.entry);setRenameVal(ctxMenu.entry.name);setCtxMenu(null)}}>
            <Pencil size={11}/> Renomear
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            onClick={()=>{handleDuplicate(ctxMenu.entry);setCtxMenu(null)}}>
            <Files size={11}/> Duplicar
          </button>
          <div className="h-px bg-slate-700 my-0.5"/>
          <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700"
            onClick={()=>{handleCopyPath(ctxMenu.entry);setCtxMenu(null)}}>
            <Copy size={11}/> Copiar caminho
          </button>
          <div className="h-px bg-slate-700 my-0.5"/>
          <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700"
            onClick={()=>{handleDelete(ctxMenu.entry);setCtxMenu(null)}}>
            <Trash2 size={11}/> Excluir
          </button>
        </div>
      )}

      {/* ═══ MODAL — ToolExecutor: confirmação de comando perigoso ═══ */}
      {toolConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
          <div className="bg-slate-900 border border-red-800/60 rounded-2xl p-6 max-w-md w-full shadow-2xl mx-4">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert size={18} className="text-red-400 shrink-0"/>
              <h3 className="text-sm font-bold text-slate-100">Comando de alto risco detectado</h3>
            </div>
            <p className="text-xs text-slate-400 mb-2">O agente IA quer executar:</p>
            <code className="block text-xs font-mono bg-slate-800 text-red-300 px-3 py-2 rounded-lg mb-4 break-all">
              {toolConfirm.cmdSummary}
            </code>
            <p className="text-xs text-slate-400 mb-1">Digite <span className="text-red-400 font-bold">CONFIRMO</span> para autorizar:</p>
            <input
              autoFocus
              value={toolConfirmInput}
              onChange={e => setToolConfirmInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && toolConfirmInput === 'CONFIRMO') {
                  toolConfirm.resolve(true); setToolConfirm(null); setToolConfirmInput('')
                }
                if (e.key === 'Escape') {
                  toolConfirm.resolve(false); setToolConfirm(null); setToolConfirmInput('')
                }
              }}
              placeholder="CONFIRMO"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-red-500 mb-4 font-mono"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { toolConfirm.resolve(false); setToolConfirm(null); setToolConfirmInput('') }}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => { toolConfirm.resolve(true); setToolConfirm(null); setToolConfirmInput('') }}
                disabled={toolConfirmInput !== 'CONFIRMO'}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
              >
                Executar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── OutlineTree ────────────────────────────────────────────────────────

function OutlineTree({ symbols, onJump, depth=0, currentLine }: {
  symbols: OutlineSymbol[]; onJump:(line:number)=>void; depth?:number; currentLine:number
}) {
  return (
    <>
      {symbols.map((sym,i) => {
        const ki = SYMBOL_KIND[sym.kind] ?? { icon:'○', color:'text-slate-500' }
        const active = currentLine >= sym.line && currentLine <= sym.endLine
        return (
          <div key={i}>
            <div
              className={`flex items-center gap-1.5 py-[3px] text-xs cursor-pointer hover:bg-slate-800 transition-colors ${active ? 'bg-slate-800/70' : ''}`}
              style={{ paddingLeft: depth*12 + 8 }}
              onClick={() => onJump(sym.line)}
            >
              <span className={`shrink-0 text-[10px] font-mono ${ki.color}`}>{ki.icon}</span>
              <span className={`truncate ${active ? 'text-slate-100 font-medium' : 'text-slate-400 hover:text-slate-200'}`}>{sym.name}</span>
              {sym.detail && <span className="text-slate-700 text-[9px] truncate shrink-0 ml-auto pr-2">{sym.detail}</span>}
            </div>
            {sym.children && sym.children.length>0 && (
              <OutlineTree symbols={sym.children} onJump={onJump} depth={depth+1} currentLine={currentLine}/>
            )}
          </div>
        )
      })}
    </>
  )
}

// ── GitFileRow ─────────────────────────────────────────────────────────

function GitFileRow({ file, onAction, onDiff, actionIcon, actionTitle, busy }: {
  file:GitFileStatus; onAction:()=>void; onDiff:(()=>void)|null
  actionIcon:React.ReactNode; actionTitle:string; busy:boolean
}) {
  const color = GIT_STATUS_COLOR[file.status] ?? 'text-slate-400'
  const name = file.path.split('/').pop() ?? file.path
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 hover:bg-slate-800 group text-xs">
      <span className={`font-bold shrink-0 w-3 text-center ${color}`}>{file.status}</span>
      <span className="flex-1 text-slate-400 truncate cursor-pointer hover:text-slate-200"
        title={file.path} onClick={onDiff??undefined}>{name}</span>
      <button onClick={onAction} disabled={busy} title={actionTitle}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 disabled:opacity-30 transition-opacity">
        {busy?<Loader2 size={10} className="animate-spin"/>:actionIcon}
      </button>
    </div>
  )
}
