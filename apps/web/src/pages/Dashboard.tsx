import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LucideIcon, Server, FolderOpen, Rocket, ArrowRight, Plus } from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { VpsServer, Project } from '@cwm/config'

export default function Dashboard() {
  const [vps, setVps] = useState<VpsServer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([ipc.vps.list(), ipc.projects.list()])
      .then(([v, p]) => { setVps(v); setProjects(p) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-slate-500">Carregando...</div>
      </div>
    )
  }

  const isEmpty = vps.length === 0 && projects.length === 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 mt-1">Gerencie seus ambientes VPS</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Server} label="VPS cadastradas" value={vps.length} color="blue" />
        <StatCard icon={FolderOpen} label="Projetos" value={projects.length} color="purple" />
        <StatCard icon={Rocket} label="Lançamentos" value={0} color="green" />
      </div>

      {isEmpty && (
        <div className="card mb-8 text-center py-10">
          <Rocket size={40} className="mx-auto text-slate-600 mb-3" />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">Comece agora</h2>
          <p className="text-slate-500 mb-5 max-w-sm mx-auto text-sm">
            Cadastre suas VPS e projetos para abrir ambientes VS Code remotos com um clique.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/vps" className="btn-primary">
              <Plus size={15} /> Adicionar VPS
            </Link>
            <Link to="/projects" className="btn-secondary">
              <FolderOpen size={15} /> Novo Projeto
            </Link>
          </div>
        </div>
      )}

      {/* VPS Cards */}
      {vps.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-200">Suas VPS</h2>
            <Link to="/vps" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {vps.slice(0, 4).map(v => (
              <VpsCard key={v.id} vps={v} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Projects */}
      {projects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-200">Projetos recentes</h2>
            <Link to="/launcher" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Abrir lançador <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {projects.slice(0, 4).map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: LucideIcon
  label: string
  value: number
  color: 'blue' | 'purple' | 'green'
}) {
  const colorMap = {
    blue: 'text-blue-400 bg-blue-900/30',
    purple: 'text-purple-400 bg-purple-900/30',
    green: 'text-emerald-400 bg-emerald-900/30',
  }
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
        <Icon size={20} className={colorMap[color].split(' ')[0]} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

function VpsCard({ vps }: { vps: VpsServer }) {
  return (
    <div className="card flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-slate-800 rounded-lg shrink-0">
          <Server size={16} className="text-slate-300" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-100 text-sm truncate">{vps.name}</p>
          <p className="text-xs text-slate-500 truncate">{vps.username}@{vps.host}</p>
        </div>
      </div>
      <Link to="/vps" className="btn-ghost text-xs shrink-0 ml-2">
        <ArrowRight size={14} />
      </Link>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/launcher"
      className="card flex items-center justify-between hover:border-slate-600 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-slate-800 rounded-lg shrink-0">
          <FolderOpen size={16} className="text-slate-300" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-100 text-sm truncate">{project.name}</p>
          <p className="text-xs text-slate-500 truncate">{project.remotePath}</p>
        </div>
      </div>
      <Rocket size={14} className="text-slate-600 group-hover:text-brand-400 transition-colors shrink-0 ml-2" />
    </Link>
  )
}
