import { Routes, Route, Navigate } from 'react-router-dom'
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
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
