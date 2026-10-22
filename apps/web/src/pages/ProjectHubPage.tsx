import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bot, Code2, HardDrive, Terminal, Server, FolderOpen, GitBranch,
  GitCommit as GitCommitIcon, ListChecks, Loader2,
} from 'lucide-react'
import type { Project, GitCommit, GitStatus } from '@cwm/config'
import { ipc, type HermesProjectAgentInfo, type AgentTask } from '../lib/ipc'

/**
 * Página de um projeto: ponto único para abrir o que é dele já na pasta certa — Agent (Hermes),
 * IDE, Explorer e Terminal — com um resumo do estado (Hermes, tarefas, git).
 */
export default function ProjectHubPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const [agent, setAgent] = useState<HermesProjectAgentInfo | null>(null)
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [git, setGit] = useState<GitStatus | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [launchMsg, setLaunchMsg] = useState('')

  useEffect(() => {
    if (!projectId) return
    ipc.projects.list().then(list => {
      const p = list.find(x => x.id === projectId) ?? null
      setProject(p)
      if (!p) return
      // Resumo é best-effort: cada parte falha sozinha sem derrubar a página.
      ipc.hermes.agent.status(p.id).then(setAgent).catch(() => setAgent(null))
      ipc.tasks.list({ projectId: p.id, ownerAgent: 'hermes' }).then(setTasks).catch(() => setTasks([]))
      if (p.vpsServerId) {
        ipc.git.status(p.vpsServerId, p.remotePath).then(setGit).catch(() => setGit(null))
        ipc.git.log(p.vpsServerId, p.remotePath, 5).then(setCommits).catch(() => setCommits([]))
      } else if (p.localPath) {
        // Projeto só no PC (Project First): Git do Windows na pasta local
        ipc.git.local.status(p.localPath).then(setGit).catch(() => setGit(null))
      }
    }).catch(() => setProject(null))
  }, [projectId])

  if (project === undefined) {
    return <div className="p-8 text-slate-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
  }
  if (project === null) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Projeto não encontrado.</p>
        <button onClick={() => navigate('/projects')} className="btn-secondary mt-4"><ArrowLeft size={14} /> Projetos</button>
      </div>
    )
  }

  const vpsId = project.vpsServerId ?? ''
  const vpsName = encodeURIComponent(project.vpsServer?.name ?? vpsId)
  const path = encodeURIComponent(project.remotePath)
  const openIde = () => {
    const opened = vpsId
      ? ipc.window.openIde(vpsId, project.vpsServer?.name ?? vpsId, project.remotePath)
      : ipc.window.openIdeLocal(project.localPath)
    void opened.catch(e => setLaunchMsg(String(e instanceof Error ? e.message : e)))
  }
  const done = tasks.filter(t => t.status === 'DONE').length
  const running = tasks.find(t => t.status === 'IN_PROGRESS')
  const dirty = git ? git.staged.length + git.unstaged.length + git.untracked.length : 0

  const shortcuts = [
    { label: 'Agent', hint: 'Hermes — desenvolvimento autônomo', icon: Bot, accent: 'text-purple-300 border-purple-700/50 hover:bg-purple-950/40',
      go: () => navigate(`/ai-hub?mode=agent&project=${project.id}`) },
    // Janela própria: a principal fica livre para abrir outro projeto ao mesmo tempo
    { label: 'IDE', hint: 'Editor + terminal na pasta do projeto, em nova janela', icon: Code2, accent: 'text-amber-300 border-amber-700/50 hover:bg-amber-950/30',
      go: openIde },
    // Explorer e Terminal SSH só existem com VPS; no projeto local o terminal fica dentro da IDE
    ...(vpsId ? [
      { label: 'Explorer', hint: 'Arquivos do projeto', icon: HardDrive, accent: 'text-sky-300 border-sky-700/50 hover:bg-sky-950/30',
        go: () => navigate(`/explorer/${vpsId}/${vpsName}?path=${path}`) },
      { label: 'Terminal', hint: 'SSH já dentro da pasta', icon: Terminal, accent: 'text-emerald-300 border-emerald-700/50 hover:bg-emerald-950/30',
        go: () => navigate(`/terminal/${vpsId}/${vpsName}?cwd=${path}`) },
    ] : []),
  ]

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 mb-6">
        <ArrowLeft size={14} /> Projetos
      </button>

      <div className="flex items-start gap-4 mb-8">
        <div className="p-3 bg-slate-800 rounded-lg shrink-0"><FolderOpen size={22} className="text-slate-300" /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {project.vpsServer && <span className="badge-gray"><Server size={10} /> {project.vpsServer.name}</span>}
            {project.remotePath && <span className="text-sm text-slate-400 font-mono">{project.remotePath}</span>}
            {project.localPath && <span className="badge-gray" title={project.localPath}><HardDrive size={10} /> PC</span>}
            {project.localPath && <span className="text-sm text-slate-400 font-mono truncate">{project.localPath}</span>}
          </div>
          {project.description && <p className="text-sm text-slate-500 mt-1">{project.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {shortcuts.map(s => (
          <button key={s.label} onClick={s.go}
            className={`card text-left flex items-center gap-3 border transition-colors ${s.accent}`}>
            <s.icon size={20} className="shrink-0" />
            <div>
              <p className="font-semibold text-slate-100">{s.label}</p>
              <p className="text-xs text-slate-500">{s.hint}</p>
            </div>
          </button>
        ))}
      </div>
      {vpsId ? (
        <button onClick={() => navigate(`/ide/${vpsId}/${vpsName}?path=${path}`)} className="btn-secondary text-xs mb-8"
          title="Abre a IDE aqui mesmo, no lugar desta tela">
          <Code2 size={13} /> IDE nesta janela
        </button>
      ) : <div className="mb-8" />}
      {launchMsg && <p className="text-xs text-red-400 -mt-6 mb-8">{launchMsg}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="card space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><ListChecks size={12} /> Agent</p>
          {agent ? (
            <>
              <p className="text-sm text-slate-300">
                Hermes: <span className={agent.hermesStatus === 'running' ? 'text-emerald-400' : 'text-slate-400'}>{agent.hermesStatus === 'running' ? 'Rodando' : agent.hermesStatus}</span>
                {' · '}{agent.status === 'running' ? <span className="text-purple-300">Executando</span> : agent.status === 'error' ? <span className="text-red-400">Erro</span> : 'Ocioso'}
              </p>
              {tasks.length > 0 && (
                <>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600" style={{ width: `${Math.round((done / tasks.length) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{done}/{tasks.length} tarefas concluídas</p>
                  {running && <p className="text-xs text-slate-500 truncate">Em andamento: {running.title}</p>}
                </>
              )}
            </>
          ) : <p className="text-xs text-slate-500">Hermes ainda não usado neste projeto.</p>}
        </div>

        <div className="card space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><GitBranch size={12} /> Git</p>
          {git?.isRepo ? (
            <>
              <p className="text-sm text-slate-300">
                <span className="font-mono">{git.branch}</span>
                {' · '}{dirty === 0 ? <span className="text-emerald-400">sem alterações pendentes</span> : <span className="text-amber-400">{dirty} alteração(ões) sem commit</span>}
              </p>
              {commits.map(c => (
                <p key={c.hash} className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                  <GitCommitIcon size={11} className="shrink-0 text-slate-600" />
                  <span className="font-mono text-slate-600">{c.hash.slice(0, 7)}</span> {c.message}
                </p>
              ))}
            </>
          ) : <p className="text-xs text-slate-500">{git ? 'A pasta não é um repositório git.' : 'Não foi possível ler o git da pasta.'}</p>}
        </div>
      </div>
    </div>
  )
}
