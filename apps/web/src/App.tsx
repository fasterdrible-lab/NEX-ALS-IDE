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

export default function App() {
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
      {/* IDE-20: modo local (sem VPS) */}
      <Route path="/ide/local" element={<IDEPage />} />
    </Routes>
  )
}
