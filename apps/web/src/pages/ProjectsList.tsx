import { useEffect, useState } from 'react'
import { FolderOpen, Plus, Trash2, Pencil, X, Loader2, GitBranch, Server, FolderPlus, CheckCircle, AlertCircle } from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { Project, ProjectInput, VpsServer, ClaudeAccount } from '@cwm/config'

const emptyForm = (): ProjectInput => ({
  name: '', description: '', remotePath: '', gitRepo: '', vpsServerId: '', claudeAccountId: null,
})

export default function ProjectsList() {
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

  const reload = async () => {
    const [p, v, a] = await Promise.all([ipc.projects.list(), ipc.vps.list(), ipc.accounts.list()])
    setList(p); setVpsList(v); setAccounts(a)
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  const openCreate = () => {
    setFormData(emptyForm()); setEditingId(null); setFormOpen(true); setError(null); setSetupState(null)
  }
  const openEdit = (p: Project) => {
    setFormData({ name: p.name, description: p.description ?? '', remotePath: p.remotePath, gitRepo: p.gitRepo ?? '', vpsServerId: p.vpsServerId, claudeAccountId: p.claudeAccountId ?? null })
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
          <p className="text-slate-400 mt-1">Projetos remotos cadastrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={15} /> Novo Projeto
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-16">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-16">
          <FolderOpen size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 mb-4">Nenhum projeto cadastrado ainda</p>
          <button onClick={openCreate} className="btn-primary" disabled={vpsList.length === 0}>
            <Plus size={15} /> {vpsList.length === 0 ? 'Cadastre uma VPS primeiro' : 'Criar Projeto'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map(p => (
            <div key={p.id} className="card flex items-center gap-4">
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
                <p className="text-sm text-slate-400 mt-0.5 font-mono">{p.remotePath}</p>
                {p.gitRepo && (
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <GitBranch size={10} /> {p.gitRepo}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(p)} className="btn-ghost p-2"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(p.id, p.name)} className="btn-ghost p-2 text-red-400 hover:text-red-300">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">{editingId ? 'Editar Projeto' : 'Novo Projeto'}</h2>
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
                <select className="input" value={formData.vpsServerId}
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
    </div>
  )
}
