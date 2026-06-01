import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Server, FolderOpen, Rocket,
  Settings, Activity, BotMessageSquare, BookOpen, BarChart3, History, Sparkles,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/vps', label: 'VPS', icon: Server },
  { to: '/projects', label: 'Projetos', icon: FolderOpen },
  { to: '/launcher', label: 'Lançador', icon: Rocket },
  { to: '/monitor', label: 'Monitor', icon: BarChart3 },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/settings', label: 'Configurações', icon: Settings },
  { to: '/diagnostics', label: 'Diagnóstico', icon: Activity },
  { to: '/help', label: 'Manual', icon: BookOpen },
]

export default function Layout() {
  const navigate = useNavigate()
  return (
    <div className="flex h-full">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
          <BotMessageSquare size={22} className="text-brand-400 shrink-0" />
          <div className="leading-tight">
            <span className="font-bold text-sm text-slate-100 tracking-wide">HEXAGON IDE</span>
            <p className="text-slate-500 text-xs font-normal">Multi-conta IA</p>
          </div>
        </div>

        {/* AI HUB — destaque */}
        <div className="px-2 pt-2">
          <button
            onClick={() => navigate('/ai-hub')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-purple-900/30 border border-purple-700/40 text-purple-300 hover:bg-purple-900/60 transition-colors"
          >
            <Sparkles size={15} className="shrink-0"/>
            AI HUB
          </button>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-300 font-medium'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800">
          <p className="text-xs text-slate-600">v3.0.0</p>
          <p className="text-xs text-slate-700 mt-0.5">HEXAGON TECNOLOGIA</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  )
}
