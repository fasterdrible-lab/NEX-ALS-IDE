import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import VpsList from './pages/VpsList'
import ProjectsList from './pages/ProjectsList'
import Accounts from './pages/Accounts'
import Launcher from './pages/Launcher'
import SettingsPage from './pages/SettingsPage'
import Diagnostics from './pages/Diagnostics'
import Help from './pages/Help'
import TerminalPage from './pages/TerminalPage'
import FileExplorerPage from './pages/FileExplorerPage'
import IDEPage from './pages/IDEPage'

export default function App() {
  return (
    <Routes>
      {/* Páginas com sidebar */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="vps" element={<VpsList />} />
        <Route path="projects" element={<ProjectsList />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="launcher" element={<Launcher />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="diagnostics" element={<Diagnostics />} />
        <Route path="help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* Ferramentas fullscreen — sem sidebar */}
      <Route path="/terminal/:vpsId/:vpsName" element={<TerminalPage />} />
      <Route path="/explorer/:vpsId/:vpsName" element={<FileExplorerPage />} />
      <Route path="/ide/:vpsId/:vpsName" element={<IDEPage />} />
    </Routes>
  )
}
