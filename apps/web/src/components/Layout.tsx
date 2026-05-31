import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Server, FolderOpen, User, Rocket,
  Settings, Activity, BotMessageSquare, BookOpen,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/vps', label: 'VPS', icon: Server },
  { to: '/projects', label: 'Projetos', icon: FolderOpen },
  { to: '/accounts', label: 'Contas Claude', icon: User },
  { to: '/launcher', label: 'Lançador', icon: Rocket },
  { to: '/settings', label: 'Configurações', icon: Settings },
  { to: '/diagnostics', label: 'Diagnóstico', icon: Activity },
  { to: '/help', label: 'Manual', icon: BookOpen },
]

export default function Layout() {
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

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
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
          <p className="text-xs text-slate-600">v1.4.0</p>
          <p className="text-xs text-slate-700 mt-0.5">HEXAGON TECNOLOGIA</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  )
}
