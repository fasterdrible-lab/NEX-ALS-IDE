import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import {
  ArrowLeft, Folder, FolderOpen, File, FileCode, FileText, FileJson,
  FileImage, Loader2, RefreshCw, FolderPlus, Trash2, Pencil,
  ChevronRight, AlertCircle, HardDrive, Save, X, Circle,
} from 'lucide-react'
import { ipc, type FileEntry } from '../lib/ipc'

// ── language map ──────────────────────────────────────────────

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust', java: 'java', rb: 'ruby', php: 'php',
  c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', swift: 'swift', kt: 'kotlin',
  json: 'json', jsonc: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  sql: 'sql', xml: 'xml', svg: 'xml', dockerfile: 'dockerfile',
  env: 'plaintext', gitignore: 'plaintext', txt: 'plaintext', log: 'plaintext',
}

function detectLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (name.toLowerCase() === 'dockerfile') return 'dockerfile'
  return LANG_MAP[ext] ?? 'plaintext'
}

// ── file icon ────────────────────────────────────────────────

const CODE_EXT = new Set(['ts','tsx','js','jsx','py','go','rs','java','c','cpp','h','sh','php','rb','swift','kt','cs'])
const TEXT_EXT = new Set(['md','txt','log','csv','env','gitignore','dockerfile','toml','ini','conf','yaml','yml'])
const JSON_EXT = new Set(['json','jsonc','lock'])
const IMAGE_EXT = new Set(['png','jpg','jpeg','gif','svg','webp','ico'])

function FileIcon({ name, isDir, open = false, size = 14 }: { name: string; isDir: boolean; open?: boolean; size?: number }) {
  if (isDir) {
    const C = open ? FolderOpen : Folder
    return <C size={size} className="text-yellow-400 shrink-0" />
  }
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (CODE_EXT.has(ext))  return <FileCode  size={size} className="text-blue-400  shrink-0" />
  if (TEXT_EXT.has(ext))  return <FileText  size={size} className="text-slate-300 shrink-0" />
  if (JSON_EXT.has(ext))  return <FileJson  size={size} className="text-green-400 shrink-0" />
  if (IMAGE_EXT.has(ext)) return <FileImage size={size} className="text-pink-400  shrink-0" />
  return <File size={size} className="text-slate-400 shrink-0" />
}

// ── helpers ───────────────────────────────────────────────────

function formatSize(b: number) {
  if (!b) return '—'
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b/1024).toFixed(1)}KB`
  return `${(b/1048576).toFixed(1)}MB`
}

const BINARY_EXT = new Set(['png','jpg','jpeg','gif','webp','ico','bmp','pdf','zip','tar','gz','exe','bin','node'])

// ── open file tabs ────────────────────────────────────────────

interface OpenFile {
  path: string
  name: string
  content: string
  savedContent: string
  language: string
  loading: boolean
}

// ── context menu ──────────────────────────────────────────────

interface CtxMenu { x: number; y: number; entry: FileEntry }

function ContextMenu({ menu, onDelete, onRename, onClose }: {
  menu: CtxMenu
  onDelete: (e: FileEntry) => void
  onRename: (e: FileEntry) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]"
      style={{ left: menu.x, top: menu.y }}
    >
      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
        onClick={() => { onRename(menu.entry); onClose() }}>
        <Pencil size={12} /> Renomear
      </button>
      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700"
        onClick={() => { onDelete(menu.entry); onClose() }}>
        <Trash2 size={12} /> Excluir
      </button>
    </div>
  )
}

// ── breadcrumb ────────────────────────────────────────────────

function Breadcrumb({ path, onNav }: { path: string; onNav: (p: string) => void }) {
  const parts = path.replace(/\/$/, '').split('/').filter(Boolean)
  const crumbs = [
    { label: '/', path: '/' },
    ...parts.map((p, i) => ({ label: p, path: '/' + parts.slice(0, i + 1).join('/') })),
  ]
  return (
    <div className="flex items-center gap-0.5 text-xs overflow-x-auto min-w-0">
      {crumbs.map((c, i) => (
        <span key={c.path} className="flex items-center gap-0.5 shrink-0">
          {i > 0 && <ChevronRight size={10} className="text-slate-700" />}
          <button onClick={() => onNav(c.path)}
            className={`px-1 py-0.5 rounded hover:bg-slate-700 transition-colors ${
              i === crumbs.length - 1 ? 'text-slate-300 font-medium' : 'text-slate-500'
            }`}>
            {c.label}
          </button>
        </span>
      ))}
    </div>
  )
}

// ── main IDE page ─────────────────────────────────────────────

export default function FileExplorerPage() {
  const { vpsId, vpsName } = useParams<{ vpsId: string; vpsName: string }>()
  const navigate = useNavigate()

  const sessionRef = useRef<string | null>(null)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  const [currentPath, setCurrentPath] = useState('/root')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [treeStatus, setTreeStatus] = useState<'connecting' | 'ready' | 'loading' | 'error'>('connecting')
  const [treeError, setTreeError] = useState('')

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const [renaming, setRenaming] = useState<FileEntry | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 3000)
  }

  // ── load directory ──────────────────────────────────────────

  const loadDir = useCallback(async (path: string, sid: string) => {
    setTreeStatus('loading')
    const r = await ipc.sftp.readdir(sid, path)
    if (r.success) {
      setEntries(r.entries)
      setCurrentPath(path)
      setTreeStatus('ready')
    } else {
      setTreeError(r.error ?? 'Erro ao listar pasta')
      setTreeStatus('error')
    }
  }, [])

  // ── connect SFTP ────────────────────────────────────────────

  useEffect(() => {
    if (!vpsId) return
    let sid: string | null = null
    ipc.sftp.open(vpsId).then(async r => {
      if (!r.success || !r.sessionId) {
        setTreeError(r.error ?? 'Falha ao conectar')
        setTreeStatus('error')
        return
      }
      sid = r.sessionId
      sessionRef.current = sid
      await loadDir('/root', sid)
    })
    return () => { if (sid) ipc.sftp.close(sid) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vpsId])

  // ── keyboard shortcut Ctrl+S ────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (activeTab) handleSave(activeTab)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, openFiles])

  // ── open file ───────────────────────────────────────────────

  const openFile = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      if (sessionRef.current) loadDir(entry.path, sessionRef.current)
      return
    }
    const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
    if (BINARY_EXT.has(ext)) {
      showToast(false, `Arquivos binários (.${ext}) não são suportados no editor`)
      return
    }
    // Se já está aberto, apenas foca
    const existing = openFiles.find(f => f.path === entry.path)
    if (existing) { setActiveTab(entry.path); return }

    // Adiciona tab com loading
    const newFile: OpenFile = {
      path: entry.path, name: entry.name,
      content: '', savedContent: '',
      language: detectLanguage(entry.name),
      loading: true,
    }
    setOpenFiles(f => [...f, newFile])
    setActiveTab(entry.path)

    // Carrega conteúdo via SFTP
    if (!sessionRef.current) return
    const r = await ipc.sftp.readFile(sessionRef.current, entry.path)
    setOpenFiles(f => f.map(file =>
      file.path === entry.path
        ? { ...file, content: r.success ? r.content : `// Erro: ${r.error}`, savedContent: r.success ? r.content : '', loading: false }
        : file
    ))
  }

  // ── save file ───────────────────────────────────────────────

  const handleSave = async (path: string) => {
    if (!sessionRef.current) return
    const file = openFiles.find(f => f.path === path)
    if (!file || !isDirty(file)) return
    const r = await ipc.sftp.writeFile(sessionRef.current, path, file.content)
    if (r.success) {
      setOpenFiles(f => f.map(fl => fl.path === path ? { ...fl, savedContent: fl.content } : fl))
      showToast(true, `${file.name} salvo`)
    } else {
      showToast(false, r.error ?? 'Erro ao salvar')
    }
  }

  // ── close tab ──────────────────────────────────────────────

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const file = openFiles.find(f => f.path === path)
    if (file && isDirty(file) && !confirm(`"${file.name}" tem alterações não salvas. Fechar mesmo assim?`)) return
    const idx = openFiles.findIndex(f => f.path === path)
    const next = openFiles[idx + 1]?.path ?? openFiles[idx - 1]?.path ?? null
    setOpenFiles(f => f.filter(fl => fl.path !== path))
    setActiveTab(next)
  }

  // ── file operations ────────────────────────────────────────

  const handleDelete = async (e: FileEntry) => {
    if (!sessionRef.current) return
    if (!confirm(`Excluir "${e.name}"?`)) return
    const r = await ipc.sftp.delete(sessionRef.current, e.path, e.isDirectory)
    if (r.success) {
      showToast(true, `"${e.name}" excluído`)
      // Fecha tab se estiver aberta
      setOpenFiles(f => f.filter(fl => fl.path !== e.path))
      if (activeTab === e.path) setActiveTab(null)
      await loadDir(currentPath, sessionRef.current)
    } else {
      showToast(false, r.error ?? 'Erro ao excluir')
    }
  }

  const handleRename = async () => {
    if (!sessionRef.current || !renaming || !renameVal.trim()) return
    const newPath = currentPath.replace(/\/$/, '') + '/' + renameVal.trim()
    const r = await ipc.sftp.rename(sessionRef.current, renaming.path, newPath)
    if (r.success) {
      showToast(true, `Renomeado para "${renameVal.trim()}"`)
      // Atualiza tab se estiver aberta
      setOpenFiles(f => f.map(fl =>
        fl.path === renaming.path ? { ...fl, path: newPath, name: renameVal.trim() } : fl
      ))
      if (activeTab === renaming.path) setActiveTab(newPath)
      await loadDir(currentPath, sessionRef.current)
    } else {
      showToast(false, r.error ?? 'Erro ao renomear')
    }
    setRenaming(null)
  }

  const handleMkdir = async () => {
    if (!sessionRef.current || !newFolderName.trim()) return
    const path = currentPath.replace(/\/$/, '') + '/' + newFolderName.trim()
    const r = await ipc.sftp.mkdir(sessionRef.current, path)
    if (r.success) {
      showToast(true, `Pasta "${newFolderName.trim()}" criada`)
      await loadDir(currentPath, sessionRef.current)
    } else {
      showToast(false, r.error ?? 'Erro ao criar pasta')
    }
    setNewFolderMode(false); setNewFolderName('')
  }

  // ── derived ────────────────────────────────────────────────

  const parentPath = currentPath !== '/' ? currentPath.split('/').slice(0, -1).join('/') || '/' : null
  const isDirty = (f: OpenFile) => f.content !== f.savedContent && !f.loading
  const activeFile = openFiles.find(f => f.path === activeTab)
  const openFilesWithDirty = openFiles.map(f => ({ ...f, isDirty: isDirty(f) }))

  // ── editor mount ───────────────────────────────────────────

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.focus()
  }

  // ── render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100 shrink-0">
          <ArrowLeft size={13} /> Voltar
        </button>
        <div className="w-px h-4 bg-slate-700" />
        <HardDrive size={13} className="text-brand-400 shrink-0" />
        <span className="text-xs text-slate-300 font-medium shrink-0">
          {vpsName ? decodeURIComponent(vpsName) : ''}
        </span>

        {/* File tabs */}
        <div className="flex items-center gap-0 flex-1 min-w-0 overflow-x-auto ml-2">
          {openFilesWithDirty.map(f => (
            <div
              key={f.path}
              onClick={() => setActiveTab(f.path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-slate-800 shrink-0 group transition-colors ${
                f.path === activeTab
                  ? 'bg-slate-950 text-slate-100 border-t border-t-brand-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <FileIcon name={f.name} isDir={false} size={12} />
              <span className="max-w-[100px] truncate">{f.name}</span>
              {f.isDirty && <Circle size={6} className="text-brand-400 fill-brand-400 shrink-0" />}
              <button
                onClick={e => closeTab(f.path, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 ml-0.5 transition-opacity"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Save button */}
        {activeFile && isDirty(activeFile) && (
          <button
            onClick={() => handleSave(activeTab!)}
            className="btn-primary text-xs py-1 px-2.5 shrink-0"
            title="Salvar (Ctrl+S)"
          >
            <Save size={12} /> Salvar
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`shrink-0 px-4 py-1.5 text-xs flex items-center gap-2 ${
          toast.ok ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'
        }`}>
          {toast.ok ? '✓' : '✗'} {toast.text}
        </div>
      )}

      {/* ── Main split panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: File Tree ── */}
        <div className="w-52 shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col overflow-hidden">

          {/* Tree header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Explorer</span>
            <div className="flex gap-0.5">
              <button title="Nova pasta" onClick={() => { setNewFolderMode(true); setNewFolderName('') }}
                className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700">
                <FolderPlus size={12} />
              </button>
              <button title="Atualizar" onClick={() => sessionRef.current && loadDir(currentPath, sessionRef.current)}
                className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700">
                <RefreshCw size={12} className={treeStatus === 'loading' ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="px-2 py-1 border-b border-slate-800/50">
            <Breadcrumb path={currentPath} onNav={p => sessionRef.current && loadDir(p, sessionRef.current)} />
          </div>

          {/* New folder input */}
          {newFolderMode && (
            <div className="px-2 py-1.5 border-b border-slate-800 flex items-center gap-1">
              <input autoFocus className="input text-xs py-0.5 flex-1" placeholder="Nome da pasta"
                value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleMkdir(); if (e.key === 'Escape') { setNewFolderMode(false); setNewFolderName('') } }} />
              <button onClick={handleMkdir} className="text-emerald-400 hover:text-emerald-300"><Save size={12} /></button>
              <button onClick={() => { setNewFolderMode(false); setNewFolderName('') }} className="text-slate-500"><X size={12} /></button>
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto">
            {treeStatus === 'connecting' && (
              <div className="flex items-center justify-center py-8 gap-1.5 text-slate-600 text-xs">
                <Loader2 size={13} className="animate-spin" /> Conectando…
              </div>
            )}
            {treeStatus === 'error' && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-red-400 text-xs px-2 text-center">
                <AlertCircle size={18} /> {treeError}
              </div>
            )}
            {(treeStatus === 'ready' || treeStatus === 'loading') && (
              <div className="py-1">
                {parentPath && (
                  <button className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                    onClick={() => sessionRef.current && loadDir(parentPath, sessionRef.current)}>
                    <ChevronRight size={11} className="rotate-180" /> ..
                  </button>
                )}
                {entries.map(e => (
                  <div key={e.path}
                    className={`flex items-center group cursor-pointer text-xs hover:bg-slate-800 ${
                      activeTab === e.path ? 'bg-slate-800/80 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    onClick={() => openFile(e)}
                    onContextMenu={ev => { ev.preventDefault(); setCtxMenu({ x: ev.clientX, y: ev.clientY, entry: e }) }}
                  >
                    {renaming?.path === e.path ? (
                      <div className="flex items-center gap-1 px-2 py-1 flex-1" onClick={ev => ev.stopPropagation()}>
                        <input autoFocus className="input text-xs py-0 flex-1" value={renameVal}
                          onChange={ev => setRenameVal(ev.target.value)}
                          onKeyDown={ev => { if (ev.key === 'Enter') handleRename(); if (ev.key === 'Escape') setRenaming(null) }} />
                        <button onClick={handleRename}><Save size={11} className="text-emerald-400" /></button>
                        <button onClick={() => setRenaming(null)}><X size={11} /></button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2 py-1 flex-1 min-w-0 truncate">
                        <FileIcon name={e.name} isDir={e.isDirectory} />
                        <span className="truncate">{e.name}</span>
                      </span>
                    )}
                  </div>
                ))}
                {entries.length === 0 && treeStatus === 'ready' && (
                  <p className="text-xs text-slate-700 px-3 py-4 text-center">Pasta vazia</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Editor ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!activeFile ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-700">
              <FileCode size={40} />
              <p className="text-sm">Clique em um arquivo para editar</p>
              <p className="text-xs text-slate-800">Clique direito para opções de arquivo</p>
            </div>
          ) : activeFile.loading ? (
            <div className="flex items-center justify-center h-full gap-2 text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Carregando {activeFile.name}…
            </div>
          ) : (
            <Editor
              height="100%"
              theme="vs-dark"
              language={activeFile.language}
              value={activeFile.content}
              path={activeFile.path}
              onMount={handleEditorMount}
              onChange={val => {
                setOpenFiles(f => f.map(fl =>
                  fl.path === activeTab ? { ...fl, content: val ?? '' } : fl
                ))
              }}
              options={{
                fontSize: 14,
                fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
                fontLigatures: true,
                lineHeight: 1.6,
                minimap: { enabled: true, scale: 1 },
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderLineHighlight: 'gutter',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                padding: { top: 12, bottom: 12 },
                tabSize: 2,
              }}
            />
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1 border-t border-slate-800 bg-slate-900 text-xs text-slate-600">
        <span>
          {activeFile
            ? `${activeFile.language} · ${activeFile.path}`
            : `${entries.length} item${entries.length !== 1 ? 's' : ''} em ${currentPath}`}
        </span>
        <span className="flex items-center gap-3">
          {activeFile && isDirty(activeFile) && (
            <span className="text-brand-400">● Não salvo · Ctrl+S para salvar</span>
          )}
          <span>{vpsName ? decodeURIComponent(vpsName) : ''}</span>
        </span>
      </div>

      {ctxMenu && (
        <ContextMenu menu={ctxMenu}
          onDelete={handleDelete}
          onRename={e => { setRenaming(e); setRenameVal(e.name); setCtxMenu(null) }}
          onClose={() => setCtxMenu(null)} />
      )}
    </div>
  )
}
