import { useEffect, useState } from 'react'
import { User, Plus, Trash2, Pencil, X, Loader2, Info, Terminal, AlertTriangle, Copy, ShieldAlert } from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { ClaudeAccount, ClaudeAccountInput, VpsServer } from '@cwm/config'

const emptyForm = (): ClaudeAccountInput => ({ name: '', email: '', vpsServerId: null })

export default function Accounts() {
  const [list, setList] = useState<ClaudeAccount[]>([])
  const [vpsList, setVpsList] = useState<VpsServer[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ClaudeAccountInput>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instructionsFor, setInstructionsFor] = useState<ClaudeAccount | null>(null)

  const reload = async () => {
    const [a, v] = await Promise.all([ipc.accounts.list(), ipc.vps.list()])
    setList(a); setVpsList(v)
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  const openCreate = () => { setFormData(emptyForm()); setEditingId(null); setFormOpen(true); setError(null) }
  const openEdit = (a: ClaudeAccount) => {
    setFormData({ name: a.name, email: a.email ?? '', vpsServerId: a.vpsServerId ?? null })
    setEditingId(a.id); setFormOpen(true); setError(null)
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      if (editingId) {
        await ipc.accounts.update({ ...formData, id: editingId })
      } else {
        await ipc.accounts.create(formData)
      }
      await reload(); setFormOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover conta "${name}"?`)) return
    await ipc.accounts.delete(id).catch(console.error); reload()
  }

  const getVpsName = (id?: string | null) => vpsList.find(v => v.id === id)?.name ?? '—'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Contas Claude</h1>
          <p className="text-slate-400 mt-1">Identidades lógicas para cada ambiente</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={15} /> Nova Conta</button>
      </div>

      <div className="card mb-6 flex items-start gap-3 border-brand-800/40 bg-brand-950/20">
        <Info size={16} className="text-brand-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-400">
          Contas Claude são apenas <strong className="text-slate-300">nomes amigáveis</strong> — o app nunca
          armazena senha, token ou credencial. A autenticação real acontece dentro de cada VPS
          executando <code className="text-brand-300 text-xs">claude</code> no terminal.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-16">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-16">
          <User size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 mb-4">Nenhuma conta cadastrada</p>
          <button onClick={openCreate} className="btn-primary"><Plus size={15} /> Criar Conta</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map(account => (
            <div key={account.id} className="card flex items-center gap-4">
              <div className="p-3 bg-slate-800 rounded-lg shrink-0">
                <User size={20} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-100">{account.name}</p>
                <p className="text-sm text-slate-500">
                  {account.email || 'Sem e-mail registrado'} · VPS: {getVpsName(account.vpsServerId)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setInstructionsFor(account)} className="btn-secondary text-xs py-1.5 px-3">
                  <Terminal size={13} /> Login
                </button>
                <button onClick={() => openEdit(account)} className="btn-ghost p-2"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(account.id, account.name)} className="btn-ghost p-2 text-red-400 hover:text-red-300">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal form */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">{editingId ? 'Editar Conta' : 'Nova Conta Claude'}</h2>
              <button onClick={() => setFormOpen(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-900/30 border border-red-800/50 text-red-300 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="label">Nome amigável *</label>
                <input className="input" placeholder="ex: Claude Conta A" value={formData.name}
                  onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">E-mail (opcional)</label>
                <input className="input" type="email" placeholder="conta@exemplo.com" value={formData.email ?? ''}
                  onChange={e => setFormData(d => ({ ...d, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">VPS associada</label>
                <select className="input" value={formData.vpsServerId ?? ''}
                  onChange={e => setFormData(d => ({ ...d, vpsServerId: e.target.value || null }))}>
                  <option value="">Nenhuma</option>
                  {vpsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-slate-800">
              <button onClick={() => setFormOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !formData.name} className="btn-primary">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal instruções de login */}
      {instructionsFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-lg font-semibold text-slate-100">Autenticar Claude Code — {instructionsFor.name}</h2>
              <button onClick={() => setInstructionsFor(null)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-5">

              {/* Aviso principal */}
              <div className="flex gap-3 bg-amber-900/25 border border-amber-700/40 rounded-xl px-4 py-3">
                <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="text-amber-200 font-semibold">Problema comum: conta errada abre no browser</p>
                  <p className="text-amber-300/80 text-xs">O browser usa automaticamente a conta já logada. Para autenticar com uma conta diferente, <strong>abra a URL de autenticação em uma janela anônima/privada</strong>.</p>
                </div>
              </div>

              {/* Passo a passo */}
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Passo a passo</p>

                {[
                  {
                    n: 1,
                    title: 'Abra o terminal SSH da VPS',
                    body: <>Vá em <strong className="text-slate-100">Lançador</strong> → clique em <strong className="text-slate-100">Terminal</strong> na VPS desta conta. Um PowerShell vai abrir já conectado.</>,
                  },
                  {
                    n: 2,
                    title: 'Execute o Claude no terminal',
                    body: (
                      <div className="space-y-2">
                        <p className="text-slate-400 text-xs">No terminal SSH que abriu, digite:</p>
                        <div className="bg-slate-800 rounded-lg px-4 py-2.5 font-mono text-sm text-emerald-400">claude</div>
                        <p className="text-slate-500 text-xs">Uma URL de autenticação vai aparecer na tela.</p>
                      </div>
                    ),
                  },
                  {
                    n: 3,
                    title: 'Copie a URL de autenticação',
                    body: (
                      <div className="space-y-2">
                        <p className="text-slate-400 text-xs">A URL terá este formato:</p>
                        <div className="bg-slate-800 rounded-lg px-4 py-2 font-mono text-xs text-brand-300 break-all">https://claude.ai/auth/...</div>
                        <div className="flex gap-2 items-start bg-slate-800/50 rounded-lg px-3 py-2">
                          <Copy size={12} className="text-brand-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-slate-400"><strong className="text-slate-200">Selecione toda a URL</strong> e copie (Ctrl+C ou clique com botão direito → Copiar).</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    n: 4,
                    title: 'Abra a URL em janela ANÔNIMA',
                    body: (
                      <div className="space-y-2">
                        <p className="text-slate-400 text-xs">Isso evita que o browser use a conta já logada:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ['Chrome', 'Ctrl+Shift+N'],
                            ['Firefox', 'Ctrl+Shift+P'],
                            ['Edge', 'Ctrl+Shift+N'],
                            ['Safari', 'Cmd+Shift+N'],
                          ].map(([b, k]) => (
                            <div key={b} className="flex justify-between bg-slate-800 rounded px-3 py-1.5 text-xs">
                              <span className="text-slate-300">{b}</span>
                              <span className="text-brand-300 font-mono">{k}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">Cole a URL na janela anônima e pressione Enter.</p>
                      </div>
                    ),
                  },
                  {
                    n: 5,
                    title: 'Faça login com a conta correta',
                    body: <p className="text-slate-400 text-xs">Na janela anônima, faça login com o e-mail da conta Claude que deseja usar <strong className="text-slate-200">nesta VPS</strong>{instructionsFor.email ? ` (${instructionsFor.email})` : ''}. Confirme a autorização.</p>,
                  },
                  {
                    n: 6,
                    title: 'Autenticação concluída',
                    body: <p className="text-slate-400 text-xs">O terminal na VPS confirmará o login. Feche e reabra o app — o badge no Lançador vai mostrar <span className="text-emerald-400">● Logado</span>.</p>,
                  },
                ].map(({ n, title, body }) => (
                  <div key={n} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 bg-brand-600/30 text-brand-300 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{n}</span>
                    <div className="flex-1 space-y-1.5">
                      <p className="text-slate-100 text-sm font-medium">{title}</p>
                      <div className="text-sm text-slate-300">{body}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Nota de segurança */}
              <div className="flex gap-2 text-xs text-slate-500 border-t border-slate-800 pt-4">
                <AlertTriangle size={12} className="shrink-0 mt-0.5 text-slate-600" />
                O app nunca armazena sua senha ou token Claude. A autenticação ocorre exclusivamente dentro da VPS.
              </div>
            </div>

            <div className="flex justify-end p-5 border-t border-slate-800">
              <button onClick={() => setInstructionsFor(null)} className="btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
