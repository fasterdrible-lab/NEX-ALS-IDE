import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, FolderPlus, Laptop, X } from 'lucide-react'
import { ipc, type LocalRecentFolder } from '../lib/ipc'

function ago(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  if (m < 1440) return `há ${Math.round(m / 60)} h`
  return `há ${Math.round(m / 1440)} d`
}

/**
 * Projetos locais à moda do VS Code: cada pasta abre na sua janela; reabrir uma pasta já aberta
 * só traz a janela dela para frente. A VPS só entra quando o projeto é publicado (Agent → Hermes).
 */
export default function LocalProjects() {
  const [items, setItems] = useState<LocalRecentFolder[]>([])
  const [msg, setMsg] = useState('')

  const load = useCallback(() => { ipc.local.recent.list().then(setItems).catch(() => {}) }, [])
  useEffect(() => {
    load()
    // Atualiza o "aberta" quando o usuário volta para esta janela
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  const run = (p: Promise<unknown>) => { setMsg(''); p.then(load).catch(e => setMsg(e instanceof Error ? e.message : String(e))) }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Laptop size={14} /> Projetos locais
        </h2>
        <button onClick={() => run(ipc.local.openFolderWindow())}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/70 text-xs font-medium transition-colors"
          title="Abre uma pasta do PC (OneDrive…) numa janela própria — sem tocar na VPS (Ctrl+O)">
          <FolderPlus size={14} /> Abrir pasta…
        </button>
      </div>
      {msg && <p className="text-xs text-red-400 mb-2">{msg}</p>}
      {items.length === 0 ? (
        <div className="card text-sm text-slate-500">
          Nenhuma pasta aberta ainda. Use <b className="text-slate-300">Abrir pasta…</b> (ou Ctrl+O): cada projeto abre na sua própria janela, como no VS Code,
          e volta aberto quando você reabrir o Zeus. Para levar à VPS, use o botão <b className="text-slate-300">Agent</b> dentro do projeto.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(f => (
            <div key={f.path} className={`card !p-0 flex items-stretch ${f.exists ? '' : 'opacity-50'}`}>
              <button disabled={!f.exists} onClick={() => run(ipc.local.recent.open(f.path))}
                className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 rounded-l-xl transition-colors disabled:cursor-not-allowed"
                title={f.exists ? (f.open ? 'Já está aberta — traz a janela para frente' : 'Abrir numa janela própria') : 'Pasta não encontrada'}>
                <FolderOpen size={16} className={f.open ? 'text-emerald-400 shrink-0' : 'text-slate-400 shrink-0'} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate flex items-center gap-2">
                    {f.name}
                    {f.open && <span className="text-[9px] px-1.5 py-px rounded bg-emerald-900/50 text-emerald-300 font-normal">aberta</span>}
                    {!f.exists && <span className="text-[9px] px-1.5 py-px rounded bg-red-900/40 text-red-300 font-normal">não encontrada</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono truncate" title={f.path}>{f.path}</p>
                </div>
                <span className="ml-auto text-[10px] text-slate-600 shrink-0">{ago(f.lastOpened)}</span>
              </button>
              <button onClick={() => run(ipc.local.recent.remove(f.path))} title="Tirar da lista (não apaga a pasta)"
                className="px-2 text-slate-600 hover:text-slate-300 shrink-0"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
