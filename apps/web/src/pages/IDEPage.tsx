import { useEffect, useRef, useState, useCallback } from 'react'
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
  MessageSquare, Send, Bot,
} from 'lucide-react'
import { ipc, type FileEntry, type GitStatus, type GitFileStatus } from '../lib/ipc'

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
  const [leftPanel,   setLeftPanel]   = useState<'files'|'search'|'git'>('files')
  const [bottomPanel, setBottomPanel] = useState<'terminal'|'problems'>('terminal')
  const [problems,    setProblems]    = useState<Problem[]>([])
  const markerDisposableRef = useRef<{ dispose(): void } | null>(null)

  // IDE-21: Chat Claude via SSH (disponível em ambos os modos)
  const [showChat,    setShowChat]    = useState(false)
  const [chatMessages, setChatMessages] = useState<{role:'user'|'assistant'; text:string}[]>([])
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatElapsed, setChatElapsed] = useState(0)
  const [chatVpsId,   setChatVpsId]   = useState<string>(vpsId ?? '')
  const [chatVpsList, setChatVpsList] = useState<{id:string;name:string}[]>([])
  const chatEndRef  = useRef<HTMLDivElement>(null)
  const chatTimerRef = useRef<ReturnType<typeof setInterval>|null>(null)

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
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeTab, setActiveTab] = useState<string|null>(null)
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
  const [toast,     setToast]     = useState<{ok:boolean;text:string}|null>(null)

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

  // Refit on show
  useEffect(() => {
    if (!showTerm || !activeTermId) return
    setTimeout(() => {
      const inst = termInstancesRef.current.get(activeTermId)
      if (inst) inst.fit.fit()
    }, 50)
  }, [showTerm, activeTermId])

  // Cleanup all terminals + marker subscription on unmount
  useEffect(() => {
    return () => {
      termInstancesRef.current.forEach(inst => {
        inst.unsubs.forEach(u => u()); inst.ro?.disconnect(); inst.term.dispose()
        if (inst.sessionId) ipc.terminal.close(inst.sessionId).catch(() => {})
      })
      markerDisposableRef.current?.dispose()
    }
  }, [])

  const switchTermTab = (tabId:string) => {
    setActiveTermId(tabId)
    setTimeout(() => {
      const inst = termInstancesRef.current.get(tabId)
      if (inst) inst.fit.fit()
    }, 50)
  }

  // ── keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const h = (e:KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key==='s') { e.preventDefault(); if (activeTab) handleSave(activeTab) }
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
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, openFiles])

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

  // ── file operations ───────────────────────────────────────────────────

  const openFile = async (entry:FileEntry, revealLine?:number) => {
    if (entry.isDirectory) { handleToggleFolder(entry); return }
    const ext = entry.name.split('.').pop()?.toLowerCase()??''

    // IDE-11: preview de imagem via base64
    if (IMG_PREVIEW.has(ext)) {
      const existing = openFiles.find(f=>f.path===entry.path)
      if (existing) { setActiveTab(entry.path); setGitDiff(null); return }
      const nf:OpenFile = { path:entry.path, name:entry.name, content:'', savedContent:'', language:'plaintext', loading:true }
      setOpenFiles(f=>[...f,nf]); setActiveTab(entry.path); setGitDiff(null)
      const r = await fsReadFileBase64(entry.path)
      const mime = ext==='svg' ? 'image/svg+xml' : `image/${ext==='jpg'?'jpeg':ext}`
      const dataUrl = r.success ? `data:${mime};base64,${r.data}` : ''
      setOpenFiles(f=>f.map(fl=>fl.path===entry.path ? {...fl, loading:false, imageDataUrl:dataUrl} : fl))
      return
    }

    if (BIN_EXT.has(ext)) { showToast(false, `Arquivos .${ext} não suportados`); return }
    const existing = openFiles.find(f=>f.path===entry.path)
    if (existing) {
      setActiveTab(entry.path); setGitDiff(null)
      if (revealLine) pendingRevealLine.current = revealLine
      return
    }
    const nf:OpenFile = { path:entry.path, name:entry.name, content:'', savedContent:'', language:detectLang(entry.name), loading:true }
    setOpenFiles(f=>[...f,nf]); setActiveTab(entry.path); setGitDiff(null)
    if (revealLine) pendingRevealLine.current = revealLine
    const r = await fsReadFile(entry.path)
    setOpenFiles(f=>f.map(fl=>fl.path===entry.path ? {...fl, content:r.success?r.content:`// Erro: ${r.error}`, savedContent:r.success?r.content:'', loading:false} : fl))
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
    const idx = openFiles.findIndex(f=>f.path===path)
    const next = openFiles[idx+1]?.path ?? openFiles[idx-1]?.path ?? null
    setOpenFiles(f=>f.filter(fl=>fl.path!==path)); setActiveTab(next)
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
    if (!vpsId || !searchQuery.trim()) return
    setSearchLoading(true); setSearchResults([]); setSearchDone(false)
    try {
      const flags = ['-r', '-n', '--color=never', '-m 50']
      if (!searchCase) flags.push('-i')
      const globs = searchGlob.trim()
        ? searchGlob.split(',').map(g => `--include="${g.trim()}"`).join(' ')
        : ''
      const pattern = searchQuery.replace(/'/g, "'\\''")
      const cmd = `grep ${flags.join(' ')} ${globs} '${pattern}' /root 2>/dev/null | head -200`
      const res = await ipc.terminal.exec(vpsId, cmd)
      const results: SearchResult[] = []
      if (res.success) {
        for (const line of res.output.split('\n')) {
          if (!line.trim()) continue
          const m = line.match(/^(.+?):(\d+):(.*)$/)
          if (m) results.push({ file:m[1], line:parseInt(m[2]), preview:m[3].trim() })
        }
      }
      setSearchResults(results)
    } finally {
      setSearchLoading(false); setSearchDone(true)
    }
  }

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
  const totalGitChanges = gitStatus ? gitStatus.staged.length+gitStatus.unstaged.length+gitStatus.untracked.length : 0
  const flatTree = flattenTree(rootEntries, 0, expandedFolders, folderChildren, loadingFolders)
  const errCount  = problems.filter(p=>p.severity==='error').length
  const warnCount = problems.filter(p=>p.severity==='warning').length

  // Search results grouped by file
  const searchByFile = searchResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.file]) acc[r.file] = []
    acc[r.file].push(r)
    return acc
  }, {})

  const handleEditorMount: OnMount = (ed, mon: Monaco) => {
    editorRef.current = ed
    ed.focus()
    ed.onDidChangeCursorPosition(e => {
      setCursorPos({ line:e.position.lineNumber, col:e.position.column })
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

  // IDE-21: enviar mensagem ao Claude via arquivo temporário na VPS
  const handleChatSend = async () => {
    if (!chatVpsId || !chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(m => [...m, { role:'user', text:userMsg }])
    setChatLoading(true)
    setChatElapsed(0)
    chatTimerRef.current = setInterval(() => setChatElapsed(s => s + 1), 1000)
    try {
      // Contexto: arquivo ativo aberto no editor
      let ctx = activeFile && activeFile.content
        ? `## Arquivo aberto no editor: ${activeFile.name}\n\`\`\`\n${activeFile.content.slice(0, 6000)}\n\`\`\`\n\n`
        : ''

      // Modo local: ler automaticamente arquivos-chave do projeto local
      // para que Claude conheça o projeto sem precisar acessar a VPS
      if (isLocal && localRootRef.current) {
        const root = localRootRef.current
        const KEY_FILES = [
          'CLAUDE.md', 'README.md', 'AGENTE.md',
          'docs/TASKS.md', 'docs/CURRENT_STATE.md', 'docs/ARCHITECTURE.md',
          'TASKS.md', 'CHANGELOG.md',
        ]
        const included: string[] = []
        for (const rel of KEY_FILES) {
          // não duplicar com o arquivo já aberto no editor
          const fullPath = root + '/' + rel
          if (activeFile && (activeFile.path === fullPath || activeFile.name === rel)) continue
          try {
            const content = await ipc.local.readFile(fullPath)
            if (content) included.push(`## ${rel}\n${content.slice(0, 3000)}`)
          } catch { /* arquivo não existe, ignora */ }
        }
        if (included.length > 0) {
          ctx = `# Projeto local: ${root.split('/').pop() || root}\n\n${included.join('\n\n---\n\n')}\n\n---\n\n` + ctx
        }
      }

      const prompt = `${ctx}${userMsg}`

      // Escreve prompt em arquivo temporário na VPS via SFTP para evitar
      // problemas de escaping e limite de tamanho da linha de comando
      const tmpFile = `/tmp/hexagon_chat_${Date.now()}.txt`
      let reply = ''
      const sftp = await ipc.sftp.open(chatVpsId)
      if (sftp.success && sftp.sessionId) {
        await ipc.sftp.writeFile(sftp.sessionId, tmpFile, prompt)
        await ipc.sftp.close(sftp.sessionId)
        const r = await ipc.terminal.exec(
          chatVpsId,
          `cd /tmp && claude -p "$(cat ${tmpFile})" --allowedTools '' < /dev/null 2>&1; rm -f ${tmpFile}`,
          120000
        )
        reply = r.success ? (r.output?.trim() || '(sem resposta)') : `Erro: ${r.error}`
      } else {
        reply = 'Erro ao conectar SFTP para enviar prompt. Verifique a VPS selecionada.'
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
          {/* IDE-21: botão chat Claude — disponível em ambos os modos */}
          <button onClick={()=>setShowChat(v=>!v)} title="Chat com Claude (executa claude -p na VPS)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${showChat?'bg-purple-600/40 text-purple-200 border border-purple-500/40':'text-purple-400 hover:text-purple-200 hover:bg-purple-900/40 border border-transparent'}`}>
            <Bot size={13}/> Claude
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
              { id:'files', icon:<Folder size={11}/>, label:'Arquivos' },
              { id:'search', icon:<Search size={11}/>, label:'Busca' },
              ...(!isLocal ? [{ id:'git', icon:<GitBranch size={11}/>, label:'Git', badge: totalGitChanges }] : []),
            ] as const).map(p => (
              <button key={p.id}
                onClick={()=>{ setLeftPanel(p.id as 'files'|'search'|'git'); if(p.id==='git'&&!gitStatus&&!gitLoading) loadGitStatus() }}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors relative ${leftPanel===p.id?'text-slate-200 border-b-2 border-brand-500':'text-slate-500 hover:text-slate-300'}`}>
                {p.icon} {p.label}
                {'badge' in p && p.badge > 0 && (
                  <span className="absolute top-1 right-1 text-[9px] bg-brand-600 text-white rounded-full px-1 min-w-[14px] text-center leading-[14px]">
                    {p.badge > 99 ? '99+' : p.badge}
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
                    {flatTree.map(({ entry, depth, childLoading }) => (
                      <div key={entry.path}
                        className={`flex items-center group cursor-pointer text-xs hover:bg-slate-800 ${activeTab===entry.path?'bg-slate-800/80 text-slate-100':'text-slate-400 hover:text-slate-200'}`}
                        style={{ paddingLeft: depth * 12 + 4 }}
                        onClick={()=> entry.isDirectory ? handleToggleFolder(entry) : openFile(entry)}
                        onContextMenu={ev=>{ev.preventDefault();setCtxMenu({x:ev.clientX,y:ev.clientY,entry})}}
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
                          <span className="flex items-center gap-1 py-0.5 flex-1 min-w-0 truncate">
                            <FileIcon name={entry.name} isDir={entry.isDirectory} open={expandedFolders.has(entry.path)} sz={13}/>
                            <span className="truncate text-xs">{entry.name}</span>
                            {childLoading && <Loader2 size={9} className="animate-spin text-slate-600 ml-auto mr-1"/>}
                          </span>
                        )}
                      </div>
                    ))}
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
                      {file.replace('/root/', '')}
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
        </div>

        {/* ─── resize handle ─── */}
        <div className="w-1 bg-slate-800 hover:bg-brand-600/50 cursor-col-resize shrink-0 transition-colors active:bg-brand-500" onMouseDown={startResizeLeft}/>

        {/* ─── RIGHT: editor + terminal ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* editor area */}
          <div className="flex-1 overflow-hidden">
            {gitDiff ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border-b border-slate-800 shrink-0">
                  <GitCommitIcon size={11} className="text-amber-400"/>
                  <span className="text-xs text-amber-300">{gitDiff.filePath}</span>
                  <span className="text-xs text-slate-600">({gitDiff.staged?'staged':'unstaged'})</span>
                  <button onClick={()=>setGitDiff(null)} className="ml-auto text-slate-600 hover:text-slate-400"><X size={11}/></button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Editor height="100%" theme="vs-dark" language="diff"
                    value={gitDiff.content||'(sem diferenças)'}
                    options={{ readOnly:true, fontSize:13, fontFamily:'"Cascadia Code",Consolas,monospace', lineNumbers:'off', minimap:{enabled:false}, scrollBeyondLastLine:false, wordWrap:'on', padding:{top:8} }}/>
                </div>
              </div>
            ) : activeFile?.imageDataUrl ? (
              /* IDE-11: preview de imagem */
              <div className="flex flex-col items-center justify-center h-full bg-[#0a0f1a] gap-3 p-6">
                <img
                  src={activeFile.imageDataUrl}
                  alt={activeFile.name}
                  className="max-h-[75%] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800/50"
                />
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
              <Editor height="100%" theme="vs-dark"
                language={activeFile.language} value={activeFile.content} path={activeFile.path}
                onMount={handleEditorMount}
                onChange={val=>setOpenFiles(f=>f.map(fl=>fl.path===activeTab?{...fl,content:val??''}:fl))}
                options={{
                  fontSize:14, fontFamily:'"Cascadia Code","Fira Code",Consolas,"Courier New",monospace',
                  fontLigatures:true, lineHeight:1.6, minimap:{enabled:true}, wordWrap:'on',
                  automaticLayout:true, scrollBeyondLastLine:false, renderLineHighlight:'gutter',
                  bracketPairColorization:{enabled:true}, smoothScrolling:true,
                  cursorBlinking:'smooth', cursorSmoothCaretAnimation:'on',
                  padding:{top:10,bottom:10}, tabSize:2,
                }}/>
            )}
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
                  <span className="text-xs font-semibold text-slate-300 flex-1">Claude</span>
                  <span className="text-[10px] text-slate-600">claude -p</span>
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
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700 text-xs text-center px-4">
                    <Bot size={24}/>
                    <p>Pergunte ao Claude sobre o arquivo aberto. O contexto do arquivo é enviado automaticamente.</p>
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex flex-col gap-1 ${m.role==='user'?'items-end':'items-start'}`}>
                    <span className="text-[10px] text-slate-600">{m.role==='user'?'Você':'Claude'}</span>
                    <div className={`text-xs rounded-lg px-3 py-2 max-w-full whitespace-pre-wrap break-words ${
                      m.role==='user'
                        ? 'bg-purple-900/50 text-purple-100 border border-purple-700/30'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/50'
                    }`}>{m.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs bg-slate-800/50 rounded-lg px-3 py-2">
                    <Loader2 size={12} className="animate-spin text-purple-400"/>
                    <span>Claude pensando… <span className="text-slate-600">{chatElapsed}s</span></span>
                    <span className="text-slate-700 text-[10px]">(pode levar 15-30s)</span>
                  </div>
                )}
                <div ref={chatEndRef}/>
              </div>
              {/* input */}
              <div className="px-3 py-2 border-t border-slate-800 shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleChatSend()} }}
                    placeholder="Pergunte algo… (Enter para enviar)"
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
          {!isLocal && (
            <span className="flex items-center gap-1">
              <PanelBottom size={10}/> Ctrl+`
            </span>
          )}
        </span>
      </div>

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
    </div>
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
