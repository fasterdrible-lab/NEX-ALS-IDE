import { useEffect, useState } from 'react'
import { Server, Plus, Trash2, Pencil, Wifi, WifiOff, X, Loader2, KeyRound } from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { VpsServer, VpsServerInput, TestConnectionResult } from '@cwm/config'

type FormState = { mode: 'create' } | { mode: 'edit'; vps: VpsServer }

const emptyForm = (): VpsServerInput => ({
  name: '', host: '', port: 22, username: 'root', defaultPath: '/root', sshPassword: '',
})

export default function VpsList() {
  const [list, setList] = useState<VpsServer[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [formData, setFormData] = useState<VpsServerInput>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, TestConnectionResult & { testing?: boolean }>>({})
  const [error, setError] = useState<string | null>(null)

  const reload = () => ipc.vps.list().then(setList).catch(console.error).finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const openCreate = () => { setForm({ mode: 'create' }); setFormData(emptyForm()); setError(null) }
  const openEdit = (vps: VpsServer) => { setForm({ mode: 'edit', vps }); setFormData({ ...vps }); setError(null) }
  const closeModal = () => { setForm(null); setError(null) }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (form?.mode === 'edit') {
        // senha vazia em edição = manter a existente (não enviar o campo)
        const payload = { ...formData, id: form.vps.id }
        if (!payload.sshPassword) delete payload.sshPassword
        await ipc.vps.update(payload)
      } else {
        await ipc.vps.create(formData)
      }
      await reload()
      closeModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir VPS "${name}"? Projetos associados também serão removidos.`)) return
    await ipc.vps.delete(id).catch(console.error)
    reload()
  }

  const handleTest = async (id: string) => {
    setTestResults(r => ({ ...r, [id]: { testing: true, success: false, message: 'Testando...' } }))
    try {
      const result = await ipc.vps.test(id)
      setTestResults(r => ({ ...r, [id]: result }))
    } catch (e) {
      setTestResults(r => ({ ...r, [id]: { success: false, message: String(e) } }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">VPS</h1>
          <p className="text-slate-400 mt-1">Servidores remotos cadastrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={15} /> Nova VPS
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-16">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-16">
          <Server size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 mb-4">Nenhuma VPS cadastrada ainda</p>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={15} /> Adicionar VPS
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map(vps => {
            const test = testResults[vps.id]
            return (
              <div key={vps.id} className="card flex items-center gap-4">
                <div className="p-3 bg-slate-800 rounded-lg shrink-0">
                  <Server size={20} className="text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-100">{vps.name}</span>
                    {test && !test.testing && (
                      test.success
                        ? <span className="badge-green"><Wifi size={10} /> Conectado {test.latencyMs && `· ${test.latencyMs}ms`}</span>
                        : <span className="badge-red"><WifiOff size={10} /> Falhou</span>
                    )}
                    {test?.testing && <span className="badge-gray"><Loader2 size={10} className="animate-spin" /> Testando</span>}
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">{vps.username}@{vps.host}:{vps.port}</p>
                  {test && !test.success && !test.testing && (
                    <p className="text-xs text-red-400 mt-1">{test.message}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleTest(vps.id)} className="btn-secondary text-xs py-1.5 px-3" disabled={test?.testing}>
                    <Wifi size={13} /> Testar
                  </button>
                  <button onClick={() => openEdit(vps)} className="btn-ghost p-2">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(vps.id, vps.name)} className="btn-ghost p-2 text-red-400 hover:text-red-300">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {form && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">
                {form.mode === 'edit' ? 'Editar VPS' : 'Nova VPS'}
              </h2>
              <button onClick={closeModal} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-900/30 border border-red-800/50 text-red-300 text-sm rounded-lg px-3 py-2">{error}</div>
              )}
              <div>
                <label className="label">Nome *</label>
                <input className="input" placeholder="ex: VPS Principal" value={formData.name}
                  onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="label">Host / IP *</label>
                  <input className="input" placeholder="204.168.180.25" value={formData.host}
                    onChange={e => setFormData(d => ({ ...d, host: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Porta</label>
                  <input className="input" type="number" placeholder="22" value={formData.port}
                    onChange={e => setFormData(d => ({ ...d, port: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="label">Usuário SSH *</label>
                <input className="input" placeholder="root" value={formData.username}
                  onChange={e => setFormData(d => ({ ...d, username: e.target.value }))} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <KeyRound size={12} className="text-slate-400" /> Senha SSH
                  <span className="text-slate-600 font-normal">(opcional — use se não tiver chave)</span>
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder={form?.mode === 'edit' && (form.vps as { sshPassword?: string | null }).sshPassword ? '••••••••  (manter existente)' : 'Deixe vazio para usar chave SSH'}
                  value={formData.sshPassword ?? ''}
                  onChange={e => setFormData(d => ({ ...d, sshPassword: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label">Caminho padrão</label>
                <input className="input" placeholder="/root" value={formData.defaultPath ?? ''}
                  onChange={e => setFormData(d => ({ ...d, defaultPath: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-slate-800">
              <button onClick={closeModal} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !formData.name || !formData.host || !formData.username} className="btn-primary">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
