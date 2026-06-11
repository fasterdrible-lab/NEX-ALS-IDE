import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Server, FolderOpen, Rocket,
  Settings, Activity, BotMessageSquare, BookOpen, BarChart3, History, Sparkles, Users, LogOut, User, BookMarked,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/vps', label: 'VPS', icon: Server },
  { to: '/projects', label: 'Projetos', icon: FolderOpen },
  { to: '/launcher', label: 'Lançador', icon: Rocket },
  { to: '/monitor', label: 'Monitor', icon: BarChart3 },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/settings', label: 'Configurações', icon: Settings },
  { to: '/diagnostics', label: 'Diagnóstico', icon: Activity },
  { to: '/knowledge', label: 'Conhecimento', icon: BookMarked },
  { to: '/help', label: 'Manual', icon: BookOpen },
]

export default function Layout() {
  const navigate = useNavigate()
  const { user, logout, sessionRequired } = useAuth()
  return (
    <div className="flex h-full">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
          <BotMessageSquare size={22} className="text-brand-400 shrink-0" />
          <div className="leading-tight">
            <span className="font-bold text-sm text-slate-100 tracking-wide">NEX-ALS IDE</span>
            <p className="text-slate-500 text-xs font-normal">Multi-conta IA</p>
          </div>
        </div>

        {/* AI HUB + SQUAD — destaques */}
        <div className="px-2 pt-2 space-y-1">
          <button
            onClick={() => navigate('/ai-hub')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-purple-900/30 border border-purple-700/40 text-purple-300 hover:bg-purple-900/60 transition-colors"
          >
            <Sparkles size={15} className="shrink-0"/>
            AI HUB
          </button>
          <button
            onClick={() => navigate('/squad')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-brand-900/30 border border-brand-700/40 text-brand-300 hover:bg-brand-900/60 transition-colors"
          >
            <Users size={15} className="shrink-0"/>
            SQUAD
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

        <div className="px-3 py-3 border-t border-slate-800 space-y-2">
          {sessionRequired && user && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-brand-600/30 flex items-center justify-center shrink-0">
                  <User size={12} className="text-brand-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">{user.username}</p>
                  <p className="text-[10px] text-slate-600">{user.role === 'admin' ? 'Administrador' : 'Visualizador'}</p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                title="Sair"
                className="shrink-0 p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-600">v3.16.1</p>
            <p className="text-xs text-slate-700 mt-0.5">NEX-ALS</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  )
}
