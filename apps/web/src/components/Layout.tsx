import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Server, FolderOpen, Rocket,
  Settings, Activity, BookOpen, BarChart3, History,
  Sparkles, Users, LogOut, User, BookMarked, BookOpenCheck, ClipboardList, Search, Timer, Shield, Network, CalendarClock,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoUrl from '/logo-zeus.png'

const navItems = [
  { to: '/',            label: 'Dashboard',     icon: LayoutDashboard, end: true },
  { to: '/vps',         label: 'VPS',           icon: Server },
  { to: '/projects',    label: 'Projetos',       icon: FolderOpen },
  { to: '/launcher',    label: 'Lançador',       icon: Rocket },
  { to: '/monitor',     label: 'Monitor',        icon: BarChart3 },
  { to: '/history',     label: 'Histórico',      icon: History },
  { to: '/settings',    label: 'Configurações',  icon: Settings },
  { to: '/diagnostics', label: 'Diagnóstico',    icon: Activity },
  { to: '/knowledge',   label: 'Conhecimento',   icon: BookMarked },
  { to: '/skills',      label: 'Skills',         icon: BookOpenCheck },
  { to: '/tasks',       label: 'Tarefas',        icon: ClipboardList },
  { to: '/search',      label: 'Busca',          icon: Search },
  { to: '/automations', label: 'Automações',     icon: Timer },
  { to: '/help',        label: 'Manual',         icon: BookOpen },
]

export default function Layout() {
  const navigate = useNavigate()
  const { user, logout, sessionRequired } = useAuth()
  const [logoError, setLogoError] = useState(false)

  return (
    <div className="flex h-full">
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className="w-56 flex flex-col shrink-0 relative"
        style={{
          background: 'linear-gradient(180deg, #08111F 0%, #050B16 100%)',
          borderRight: '1px solid rgba(26,140,255,0.12)',
        }}
      >
        {/* Subtle left gold accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px]"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, #1A8CFF 30%, #7CC0FF 60%, transparent 100%)',
            opacity: 0.4,
          }}
        />

        {/* ── Logo + Brand ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Logo */}
          <div className="shrink-0">
            {!logoError ? (
              <img
                src={logoUrl}
                alt="Zeus"
                className="w-9 h-9 rounded-lg object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #0B6FE0, #7CC0FF)',
                  color: '#050B16',
                }}
              >
                ⬡
              </div>
            )}
          </div>

          <div className="leading-tight min-w-0">
            <div className="font-bold text-sm tracking-wider uppercase">
              <span style={{ color: '#E6ECF5' }}>Zeus</span>{' '}
              <span style={{ color: '#3FA2FF' }}>IDE</span>
            </div>
            <div
              className="text-[8px] font-light tracking-wider uppercase leading-snug"
              style={{ color: 'rgba(247,249,252,0.45)' }}
            >
              Intelligent Development Environment
            </div>
          </div>
        </div>

        {/* ── AI HUB + SQUAD destacados ────────────────────────────── */}
        <div className="px-3 pt-3 space-y-1.5">
          <button
            onClick={() => navigate('/ai-hub')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group"
            style={{
              background: 'rgba(183,141,255,0.08)',
              border: '1px solid rgba(183,141,255,0.18)',
              color: '#B78DFF',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(183,141,255,0.15)'
              t.style.borderColor = 'rgba(183,141,255,0.35)'
              t.style.boxShadow = '0 0 16px rgba(183,141,255,0.15)'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(183,141,255,0.08)'
              t.style.borderColor = 'rgba(183,141,255,0.18)'
              t.style.boxShadow = 'none'
            }}
          >
            <Sparkles size={13} className="shrink-0" />
            AI HUB
          </button>

          <button
            onClick={() => navigate('/planning')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
              color: '#fcd34d',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(245,158,11,0.14)'
              t.style.borderColor = 'rgba(245,158,11,0.4)'
              t.style.boxShadow = '0 0 16px rgba(245,158,11,0.12)'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(245,158,11,0.07)'
              t.style.borderColor = 'rgba(245,158,11,0.2)'
              t.style.boxShadow = 'none'
            }}
          >
            <CalendarClock size={13} className="shrink-0" />
            PLANEJAR
          </button>

          <button
            onClick={() => navigate('/workspace')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: 'rgba(96,165,250,0.07)',
              border: '1px solid rgba(96,165,250,0.18)',
              color: '#93c5fd',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(96,165,250,0.14)'
              t.style.borderColor = 'rgba(96,165,250,0.35)'
              t.style.boxShadow = '0 0 16px rgba(96,165,250,0.1)'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(96,165,250,0.07)'
              t.style.borderColor = 'rgba(96,165,250,0.18)'
              t.style.boxShadow = 'none'
            }}
          >
            <Network size={13} className="shrink-0" />
            WORKSPACE
          </button>

          <button
            onClick={() => navigate('/operator')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: 'rgba(248,113,113,0.07)',
              border: '1px solid rgba(248,113,113,0.18)',
              color: '#f87171',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(248,113,113,0.14)'
              t.style.borderColor = 'rgba(248,113,113,0.35)'
              t.style.boxShadow = '0 0 16px rgba(248,113,113,0.1)'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(248,113,113,0.07)'
              t.style.borderColor = 'rgba(248,113,113,0.18)'
              t.style.boxShadow = 'none'
            }}
          >
            <Shield size={13} className="shrink-0" />
            OPERADOR
          </button>

          <button
            onClick={() => navigate('/squad')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: 'rgba(26,140,255,0.08)',
              border: '1px solid rgba(26,140,255,0.2)',
              color: '#7CC0FF',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(26,140,255,0.15)'
              t.style.borderColor = 'rgba(26,140,255,0.4)'
              t.style.boxShadow = '0 0 16px rgba(26,140,255,0.15)'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(26,140,255,0.08)'
              t.style.borderColor = 'rgba(26,140,255,0.2)'
              t.style.boxShadow = 'none'
            }}
          >
            <Users size={13} className="shrink-0" />
            SQUAD
          </button>
        </div>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div className="mx-3 my-2" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

        {/* ── Nav items ────────────────────────────────────────────── */}
        <nav className="flex-1 py-1 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-200 ${
                  isActive ? 'nav-active' : 'nav-idle'
                }`
              }
              style={({ isActive }) => isActive
                ? {
                    background: 'rgba(26,140,255,0.1)',
                    color: '#7CC0FF',
                    borderLeft: '2px solid #1A8CFF',
                    paddingLeft: '10px',
                  }
                : {
                    color: 'rgba(247,249,252,0.5)',
                    borderLeft: '2px solid transparent',
                    paddingLeft: '10px',
                  }
              }
            >
              <Icon size={14} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div
          className="px-3 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {sessionRequired && user && (
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(26,140,255,0.12)', border: '1px solid rgba(26,140,255,0.2)' }}
                >
                  <User size={11} style={{ color: '#1A8CFF' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'rgba(247,249,252,0.85)' }}>
                    {user.username}
                  </p>
                  <p className="text-[10px]" style={{ color: 'rgba(247,249,252,0.35)' }}>
                    {user.role === 'admin' ? 'Admin' : 'Viewer'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                title="Sair"
                className="shrink-0 p-1.5 rounded transition-colors"
                style={{ color: 'rgba(247,249,252,0.3)' }}
                onMouseEnter={e => { (e.currentTarget).style.color = '#f87171' }}
                onMouseLeave={e => { (e.currentTarget).style.color = 'rgba(247,249,252,0.3)' }}
              >
                <LogOut size={12} />
              </button>
            </div>
          )}

          <div>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(26,140,255,0.6)' }}>
              v3.75.0
            </p>
            <p
              className="text-[9px] tracking-widest uppercase font-light"
              style={{ color: 'rgba(247,249,252,0.2)' }}
            >
              Inteligência que conecta o futuro
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto" style={{ background: '#050B16' }}>
        <Outlet />
      </main>
    </div>
  )
}