import { Component, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
          <div className="max-w-lg text-center space-y-4">
            <p className="text-red-400 font-semibold">Algo deu errado nesta página.</p>
            <pre className="text-xs text-slate-500 text-left bg-slate-900 p-4 rounded overflow-auto max-h-48">
              {(this.state.error as Error).message}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 text-sm bg-brand-600/30 border border-brand-600/50 text-brand-300 rounded-lg hover:bg-brand-600/50 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import VpsList from './pages/VpsList'
import ProjectsList from './pages/ProjectsList'
import Launcher from './pages/Launcher'
import SettingsPage from './pages/SettingsPage'
import Diagnostics from './pages/Diagnostics'
import Help from './pages/Help'
import TerminalPage from './pages/TerminalPage'
import FileExplorerPage from './pages/FileExplorerPage'
import IDEPage from './pages/IDEPage'
import MonitorPage from './pages/MonitorPage'
import HistoryPage from './pages/HistoryPage'
import AIHubPage from './pages/AIHubPage'
import SquadPage from './pages/SquadPage'
import IncidentModePage from './pages/IncidentModePage'
import DeployAssistantPage from './pages/DeployAssistantPage'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'

function AppRoutes() {
  const { user, needsSetup, sessionRequired, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (sessionRequired && needsSetup) return <SetupPage />
  if (sessionRequired && !user) return <LoginPage />

  return (
    <Routes>
      {/* Páginas com sidebar */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="vps" element={<VpsList />} />
        <Route path="projects" element={<ProjectsList />} />
        <Route path="launcher" element={<Launcher />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="diagnostics" element={<Diagnostics />} />
        <Route path="monitor" element={<MonitorPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* Ferramentas fullscreen — sem sidebar */}
      <Route path="/ai-hub" element={<AIHubPage />} />
      <Route path="/squad" element={<SquadPage />} />
      <Route path="/incident/:vpsId/:vpsName" element={<IncidentModePage />} />
      <Route path="/deploy/:vpsId/:vpsName" element={<DeployAssistantPage />} />
      <Route path="/terminal/:vpsId/:vpsName" element={<TerminalPage />} />
      <Route path="/explorer/:vpsId/:vpsName" element={<FileExplorerPage />} />
      <Route path="/ide/:vpsId/:vpsName" element={<IDEPage />} />
      <Route path="/ide/local" element={<IDEPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  )
}
