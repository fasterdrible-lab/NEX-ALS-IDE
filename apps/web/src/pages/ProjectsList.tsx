import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Trash2, Pencil, X, Loader2, GitBranch, Server, FolderPlus, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { ipc } from '../lib/ipc'
import LocalProjects from '../components/LocalProjects'
import type { Project, ProjectInput, VpsServer, ClaudeAccount } from '@cwm/config'

const emptyForm = (): ProjectInput => ({
  name: '', description: '', localPath: '', remotePath: '', gitRepo: '', vpsServerId: '', claudeAccountId: null,
})

export default function ProjectsList() {
  const navigate = useNavigate()
  const [list, setList] = useState<Project[]>([])
  const [vpsList, setVpsList] = useState<VpsServer[]>([])
  const [accounts, setAccounts] = useState<ClaudeAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ProjectInput>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupState, setSetupState] = useState<null | 'loading' | { success: boolean; message: string }>(null)
  const [localOpen, setLocalOpen] = useState(false)
  const [localReload, setLocalReload] = useState(0)

  const reload = async () => {
    const [p, v, a] = await Promise.all([ipc.projects.list(), ipc.vps.list(), ipc.accounts.list()])
    setList(p); setVpsList(v); setAccounts(a)
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  const openCreate = () => {
    setFormData(emptyForm()); setEditingId(null); setFormOpen(true); setError(null); setSetupState(null)
  }
  const openEdit = (p: Project) => {
    setFormData({ name: p.name, description: p.description ?? '', localPath: p.localPath, remotePath: p.remotePath, gitRepo: p.gitRepo ?? '', vpsServerId: p.vpsServerId ?? '', claudeAccountId: p.claudeAccountId ?? null })
    setEditingId(p.id); setFormOpen(true); setError(null)
  }

  const handleSetup = async () => {
    if (!formData.vpsServerId || !formData.remotePath) return
    setSetupState('loading')
    try {
      const result = await ipc.vps.setupRemoteProject(formData.vpsServerId, formData.remotePath, formData.gitRepo || undefined)
      setSetupState(result)
    } catch (e) {
      setSetupState({ success: false, message: e instanceof Error ? e.message : String(e) })
    }
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      if (editingId) {
        await ipc.projects.update({ ...formData, id: editingId })
      } else {
        await ipc.projects.create(formData)
      }
      await reload(); setFormOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir projeto "${name}"?`)) return
    await ipc.projects.delete(id).catch(console.error); reload()
  }

  const canSave = formData.name && formData.remotePath && formData.vpsServerId

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projetos</h1>
          <p className="text-slate-400 mt-1">Projetos começam no PC, cada um na sua janela; a VPS entra quando for publicar (Agent)</p>
        </div>
        <button onClick={() => setLocalOpen(true)} className="btn-primary" title="Cria a pasta do projeto no PC (OneDrive) e abre numa janela própria">
          <Plus size={15} /> Novo projeto
        </button>
      </div>

      <LocalProjects reloadToken={localReload} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2"><Server size={14} /> Projetos na VPS</h2>
        <button onClick={openCreate} className="btn-secondary text-xs py-1.5 px-3" disabled={vpsList.length === 0}
          title={vpsList.length === 0 ? 'Cadastre uma VPS primeiro' : 'Cadastrar um projeto que já existe numa VPS'}>
          <Plus size={13} /> Cadastrar projeto da VPS
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-16">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="card text-sm text-slate-500">
          Nenhum projeto na VPS. Projetos locais vão para a VPS pelo botão <b className="text-slate-300">Agent</b> dentro da IDE do projeto (envia a pasta e cadastra aqui).
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              onKeyDown={e => { if (e.key === 'Enter') navigate(`/projects/${p.id}`) }}
              role="button"
              tabIndex={0}
              title="Abrir o projeto"
              className="card flex items-center gap-4 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <div className="p-3 bg-slate-800 rounded-lg shrink-0">
                <FolderOpen size={20} className="text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-100">{p.name}</span>
                  {p.vpsServer && (
                    <span className="badge-gray"><Server size={10} /> {p.vpsServer.name}</span>
                  )}
                  {p.claudeAccount && (
                    <span className="badge-gray" style={{ color: '#a78bfa' }}>🤖 {p.claudeAccount.name}</span>
                  )}
                </div>
                {p.remotePath && <p className="text-sm text-slate-400 mt-0.5 font-mono">{p.remotePath}</p>}
                {p.localPath && <p className="text-xs text-slate-500 mt-0.5 font-mono truncate" title={p.localPath}>PC: {p.localPath}</p>}
                {p.gitRepo && (
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <GitBranch size={10} /> {p.gitRepo}
                  </p>
                )}
              </div>
              {/* stopPropagation: editar/excluir não podem abrir a página do projeto. */}
              <div className="flex gap-2 shrink-0 items-center" onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(p)} className="btn-ghost p-2" title="Editar"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(p.id, p.name)} className="btn-ghost p-2 text-red-400 hover:text-red-300" title="Excluir">
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} className="text-slate-600" />
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">{editingId ? 'Editar projeto da VPS' : 'Cadastrar projeto da VPS'}</h2>
              <button onClick={() => setFormOpen(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-900/30 border border-red-800/50 text-red-300 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="label">Nome *</label>
                <input className="input" placeholder="Meu Projeto" value={formData.name}
                  onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Caminho remoto *</label>
                <input className="input" placeholder="/root/meu-projeto" value={formData.remotePath}
                  onChange={e => { setFormData(d => ({ ...d, remotePath: e.target.value })); setSetupState(null) }} />
              </div>

              {/* Botão criar/clonar na VPS */}
              {formData.vpsServerId && formData.remotePath && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 space-y-2">
                  <p className="text-xs text-slate-400">
                    {formData.gitRepo
                      ? '📦 Quer clonar o repositório Git direto na VPS?'
                      : '📁 A pasta ainda não existe na VPS?'}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSetup}
                      disabled={setupState === 'loading'}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      {setupState === 'loading'
                        ? <><Loader2 size={12} className="animate-spin" /> Aguarde...</>
                        : formData.gitRepo
                          ? <><GitBranch size={12} /> Clonar repositório na VPS</>
                          : <><FolderPlus size={12} /> Criar pasta na VPS</>
                      }
                    </button>
                    {setupState && setupState !== 'loading' && (
                      <span className={`flex items-center gap-1.5 text-xs ${setupState.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {setupState.success
                          ? <CheckCircle size={12} />
                          : <AlertCircle size={12} />}
                        {setupState.message}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="label">VPS *</label>
                <select className="input" value={formData.vpsServerId ?? ''}
                  onChange={e => setFormData(d => ({ ...d, vpsServerId: e.target.value }))}>
                  <option value="">Selecione uma VPS</option>
                  {vpsList.map(v => <option key={v.id} value={v.id}>{v.name} ({v.host})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Conta Claude</label>
                <select className="input" value={formData.claudeAccountId ?? ''}
                  onChange={e => setFormData(d => ({ ...d, claudeAccountId: e.target.value || null }))}>
                  <option value="">Nenhuma</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Repositório Git</label>
                <input className="input" placeholder="https://github.com/..." value={formData.gitRepo ?? ''}
                  onChange={e => setFormData(d => ({ ...d, gitRepo: e.target.value }))} />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input className="input" placeholder="Descrição opcional" value={formData.description ?? ''}
                  onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-slate-800">
              <button onClick={() => setFormOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !canSave} className="btn-primary">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {localOpen && <NewLocalProjectModal onClose={() => setLocalOpen(false)} onCreated={() => { setLocalOpen(false); setLocalReload(n => n + 1) }} />}
    </div>
  )
}

/** Novo projeto local: pasta nova no OneDrive (ou onde escolher), git opcional, abre na janela própria. */
function NewLocalProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const [git, setGit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { ipc.local.project.defaults().then(d => setParent(p => p || d.parent)).catch(() => {}) }, [])

  const sep = parent.includes('/') && !parent.includes('\\') ? '/' : '\\'
  const target = parent && name.trim() ? `${parent.replace(/[\\/]+$/, '')}${sep}${name.trim()}` : ''

  const pickParent = async () => {
    const f = await ipc.local.openFolder().catch(() => null)
    if (f) setParent(f)
  }

  const create = async () => {
    setBusy(true); setError(null)
    try {
      const r = await ipc.local.project.create(parent, name, git)
      if (r.git === 'missing') alert('Projeto criado, mas o git não foi encontrado no PC — o repositório não foi iniciado.')
      onCreated()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">Novo projeto</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-800/50 text-red-300 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="label">Nome *</label>
            <input className="input" placeholder="meu-projeto" value={name} autoFocus
              onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim() && parent && !busy) void create() }} />
          </div>
          <div>
            <label className="label">Criar dentro de</label>
            <div className="flex gap-2">
              <input className="input font-mono text-xs" value={parent} onChange={e => setParent(e.target.value)} />
              <button type="button" onClick={pickParent} className="btn-secondary text-xs shrink-0"><FolderOpen size={13} /> Escolher…</button>
            </div>
            {target && <p className="text-[11px] text-slate-500 mt-1 font-mono break-all">Pasta: {target}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={git} onChange={e => setGit(e.target.checked)} />
            Iniciar repositório git (com .gitignore para node_modules, .next, dist, .env)
          </label>
          <p className="text-xs text-slate-500">Nada é criado na VPS. Para publicar depois, abra o projeto e use o botão <b className="text-slate-300">Agent</b>.</p>
        </div>
        <div className="flex gap-3 justify-end p-5 border-t border-slate-800">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => void create()} disabled={busy || !name.trim() || !parent} className="btn-primary">
            {busy ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : <><FolderPlus size={14} /> Criar e abrir</>}
          </button>
        </div>
      </div>
    </div>
  )
}
