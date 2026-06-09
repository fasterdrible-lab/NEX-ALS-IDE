import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Rocket, Terminal, FolderOpen, Server,
  Loader2, CheckCircle, XCircle, User,
  BotMessageSquare, AlertTriangle, HelpCircle, HardDrive, Code2, FolderOpen as FolderOpenIcon,
  ExternalLink, Siren, Rocket as RocketIcon,
} from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { Project, VpsServer, ClaudeCheckResult } from '@cwm/config'

interface LaunchState {
  loading: boolean
  success?: boolean
  message?: string
}

type ClaudeStatus = ClaudeCheckResult | 'loading' | undefined

function ClaudeBadge({ status }: { status: ClaudeStatus }) {
  if (status === undefined) return null

  if (status === 'loading') {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <Loader2 size={11} className="animate-spin" /> Verificando Claude…
      </span>
    )
  }

  if (!status.installed) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-500">
        <AlertTriangle size={11} /> {status.message}
      </span>
    )
  }

  if (status.loggedIn === 'yes') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <BotMessageSquare size={11} /> {status.message}
      </span>
    )
  }

  if (status.loggedIn === 'no') {
    return (
      <span className="flex items-center gap-1 text-xs text-yellow-400">
        <BotMessageSquare size={11} /> {status.message}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <HelpCircle size={11} /> {status.message}
    </span>
  )
}

export default function Launcher() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [vps, setVps] = useState<VpsServer[]>([])
  const [loading, setLoading] = useState(true)
  const [launchStates, setLaunchStates] = useState<Record<string, LaunchState>>({})
  const [claudeStatuses, setClaudeStatuses] = useState<Record<string, ClaudeStatus>>({})

  useEffect(() => {
    Promise.all([ipc.projects.list(), ipc.vps.list()])
      .then(([p, v]) => {
        setProjects(p)
        setVps(v)
        // inicia verificação Claude para cada VPS em paralelo
        const initial: Record<string, ClaudeStatus> = {}
        v.forEach(vpsItem => { initial[vpsItem.id] = 'loading' })
        setClaudeStatuses(initial)
        v.forEach(vpsItem => {
          ipc.launcher.checkClaude(vpsItem.id)
            .then(result => setClaudeStatuses(s => ({ ...s, [vpsItem.id]: result })))
            .catch(() => setClaudeStatuses(s => ({ ...s, [vpsItem.id]: undefined })))
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleOpenProject = async (projectId: string) => {
    setLaunchStates(s => ({ ...s, [projectId]: { loading: true } }))
    try {
      const result = await ipc.launcher.openProject(projectId)
      setLaunchStates(s => ({ ...s, [projectId]: { loading: false, success: result.success, message: result.message } }))
      setTimeout(() => setLaunchStates(s => ({ ...s, [projectId]: { loading: false } })), 4000)
    } catch (e) {
      setLaunchStates(s => ({ ...s, [projectId]: { loading: false, success: false, message: String(e) } }))
    }
  }

  const handleOpenTerminal = (vpsId: string, vpsName: string) => {
    navigate(`/terminal/${vpsId}/${encodeURIComponent(vpsName)}`)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-slate-500">Carregando...</div></div>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Lançador</h1>
        <p className="text-slate-400 mt-1">Abra ambientes VS Code remotos com um clique</p>
        {/* IDE-20: botão para abrir pasta local no IDE */}
        <button
          onClick={() => navigate('/ide/local')}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/70 text-sm font-medium transition-colors"
          title="Abre uma pasta do seu PC (OneDrive, etc.) no NEX-ALS IDE — sem risco de alterar produção"
        >
          <FolderOpenIcon size={15}/> Abrir pasta local no IDE
        </button>
      </div>

      {/* VPS Terminals */}
      {vps.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Terminais SSH</h2>
          <div className="grid grid-cols-2 gap-3">
            {vps.map(v => {
              const claudeStatus = claudeStatuses[v.id]
              return (
                <div key={v.id} className="card flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-slate-800 rounded-lg shrink-0">
                      <Server size={16} className="text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100 text-sm">{v.name}</p>
                      <p className="text-xs text-slate-500">{v.username}@{v.host}:{v.port}</p>
                      <ClaudeBadge status={claudeStatus} />
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/ide/${v.id}/${encodeURIComponent(v.name)}`)}
                      className="btn-primary text-xs py-1.5 px-3"
                      title="IDE integrado — editor + terminal + explorer"
                    >
                      <Code2 size={13} /> IDE
                    </button>
                    <button
                      onClick={() => ipc.window.openIde(v.id, v.name)}
                      className="btn-secondary text-xs py-1.5 px-3"
                      title="Abrir IDE em nova janela independente"
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      onClick={() => ipc.window.openIncident(v.id, v.name)}
                      className="btn-secondary text-xs py-1.5 px-3 text-red-400 hover:text-red-300 border-red-800/40"
                      title="Abrir Incident Mode para esta VPS"
                    >
                      <Siren size={13} />
                    </button>
                    <button
                      onClick={() => ipc.window.openDeploy(v.id, v.name)}
                      className="btn-secondary text-xs py-1.5 px-3 text-emerald-400 hover:text-emerald-300 border-emerald-800/40"
                      title="Deploy Assistant — plano de deploy com aprovação"
                    >
                      <RocketIcon size={13} />
                    </button>
                    <button
                      onClick={() => navigate(`/explorer/${v.id}/${encodeURIComponent(v.name)}`)}
                      className="btn-secondary text-xs py-1.5 px-3"
                      title="Explorador de arquivos"
                    >
                      <HardDrive size={13} /> Explorer
                    </button>
                    <button
                      onClick={() => handleOpenTerminal(v.id, v.name)}
                      className="btn-secondary text-xs py-1.5 px-3"
                      title="Terminal SSH"
                    >
                      <Terminal size={13} /> Terminal
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Projects */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Projetos</h2>
        {projects.length === 0 ? (
          <div className="card text-center py-12">
            <FolderOpen size={36} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400">Nenhum projeto cadastrado</p>
            <p className="text-xs text-slate-600 mt-1">Vá para Projetos e crie seu primeiro projeto</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {projects.map(p => {
              const state = launchStates[p.id]
              const vpsId = p.vpsServerId
              const claudeStatus = vpsId ? claudeStatuses[vpsId] : undefined
              return (
                <div key={p.id} className="card flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-slate-800 rounded-lg shrink-0 mt-0.5">
                      <FolderOpen size={16} className="text-slate-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-100">{p.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{p.remotePath}</p>
                      {p.vpsServer && (
                        <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                          <Server size={10} /> {p.vpsServer.name}
                        </p>
                      )}
                      {p.claudeAccount && (
                        <p className="text-xs text-purple-500 mt-0.5 flex items-center gap-1">
                          <User size={10} /> {p.claudeAccount.name}
                        </p>
                      )}
                      {claudeStatus && claudeStatus !== 'loading' && (
                        <div className="mt-1">
                          <ClaudeBadge status={claudeStatus} />
                        </div>
                      )}
                    </div>
                  </div>

                  {state?.message && !state.loading && (
                    <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                      state.success
                        ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/30'
                        : 'bg-red-900/30 text-red-400 border border-red-800/30'
                    }`}>
                      {state.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {state.message}
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenProject(p.id)}
                    disabled={state?.loading}
                    className="btn-primary w-full"
                  >
                    {state?.loading
                      ? <><Loader2 size={14} className="animate-spin" /> Abrindo...</>
                      : <><Rocket size={14} /> Abrir no VS Code</>
                    }
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
