import { useState } from 'react'
import { Code2, FolderOpen } from 'lucide-react'
import { useCurrentProject, openProjectIde } from '../lib/current-project'

/**
 * Seletor do projeto atual — na barra lateral e no topo das telas cheias (AI Hub, Squad, Planejar,
 * Workspace). `withIde`: botão ao lado que abre a IDE do projeto escolhido (PC ou VPS) na janela própria.
 */
export default function ProjectSwitcher({ className = '', withIde = false }: { className?: string; withIde?: boolean }) {
  const { projects, current, setCurrentId } = useCurrentProject()
  const [ideError, setIdeError] = useState('')
  const where = (p: { localPath: string; vpsServer?: { name: string } | null }) =>
    [p.localPath && 'PC', p.vpsServer?.name].filter(Boolean).join(' + ')

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <label className="flex items-center gap-1.5 min-w-0 flex-1" title="Projeto atual — as telas de desenvolvimento trabalham nele">
          <FolderOpen size={13} className={current ? 'text-blue-300 shrink-0' : 'text-slate-500 shrink-0'} />
          <select
            value={current?.id ?? ''}
            onChange={e => { setCurrentId(e.target.value || null); setIdeError('') }}
            className="min-w-0 flex-1 bg-slate-900/70 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os projetos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}{where(p) ? ` — ${where(p)}` : ''}</option>)}
          </select>
        </label>
        {withIde && (
          <button
            type="button"
            disabled={!current}
            onClick={() => { if (current) void openProjectIde(current).catch(e => setIdeError(e instanceof Error ? e.message : String(e))) }}
            title={current ? `Abrir a IDE em ${current.name} (${where(current) || 'sem pasta'}), numa janela própria` : 'Escolha um projeto para abrir a IDE'}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border border-amber-700/50 text-amber-300 text-[11px] hover:bg-amber-950/40 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Code2 size={12} /> IDE
          </button>
        )}
      </div>
      {ideError && <p className="text-[10px] text-red-400 mt-1">{ideError}</p>}
    </div>
  )
}
