import { useState, useEffect, useRef } from 'react'
import { BookMarked, Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, Search, Tag } from 'lucide-react'
import { ipc, type KnowledgeEntry, type KnowledgeEntryInput, type KnowledgeCategory } from '../lib/ipc'

const CATEGORIES: { value: KnowledgeCategory; label: string; color: string }[] = [
  { value: 'geral',        label: 'Geral',        color: 'bg-slate-700 text-slate-200' },
  { value: 'arquitetura',  label: 'Arquitetura',  color: 'bg-blue-900/60 text-blue-300' },
  { value: 'padrões',      label: 'Padrões',      color: 'bg-purple-900/60 text-purple-300' },
  { value: 'bibliotecas',  label: 'Bibliotecas',  color: 'bg-green-900/60 text-green-300' },
  { value: 'convenções',   label: 'Convenções',   color: 'bg-yellow-900/60 text-yellow-300' },
  { value: 'snippets',     label: 'Snippets',     color: 'bg-pink-900/60 text-pink-300' },
  { value: 'regras',       label: 'Regras',       color: 'bg-red-900/60 text-red-300' },
  { value: 'stack',        label: 'Stack',        color: 'bg-cyan-900/60 text-cyan-300' },
]

const EMPTY_FORM: KnowledgeEntryInput = { title: '', content: '', category: 'geral', tags: '', isActive: true }

function categoryMeta(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[0]
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('__all__')
  const [editing, setEditing] = useState<string | null>(null) // id or 'new'
  const [form, setForm] = useState<KnowledgeEntryInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => { if (editing) titleRef.current?.focus() }, [editing])

  async function load() {
    setLoading(true)
    try {
      const data = await ipc.knowledge.list()
      setEntries(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function startNew() {
    setForm(EMPTY_FORM)
    setEditing('new')
    setError(null)
  }

  function startEdit(entry: KnowledgeEntry) {
    setForm({ title: entry.title, content: entry.content, category: entry.category as KnowledgeCategory, tags: entry.tags, isActive: entry.isActive })
    setEditing(entry.id)
    setError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Título e conteúdo são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editing === 'new') {
        const created = await ipc.knowledge.create(form)
        setEntries(prev => [created, ...prev])
      } else if (editing) {
        const updated = await ipc.knowledge.update(editing, form)
        setEntries(prev => prev.map(e => e.id === editing ? updated : e))
      }
      setEditing(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(entry: KnowledgeEntry) {
    try {
      const updated = await ipc.knowledge.update(entry.id, { isActive: !entry.isActive })
      setEntries(prev => prev.map(e => e.id === entry.id ? updated : e))
    } catch (e) {
      setError(String(e))
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir este item da base de conhecimento?')) return
    try {
      await ipc.knowledge.delete(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      if (editing === id) setEditing(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const visible = entries.filter(e => {
    const matchCat = filterCat === '__all__' || e.category === filterCat
    const q = search.toLowerCase()
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || e.tags.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const activeCount = entries.filter(e => e.isActive).length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookMarked size={20} className="text-brand-400" />
          <div>
            <h1 className="font-semibold text-slate-100 text-sm">Base de Conhecimento</h1>
            <p className="text-xs text-slate-500">{activeCount} item(ns) ativo(s) injetado(s) nos agentes IA</p>
          </div>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600/30 border border-brand-600/50 text-brand-300 rounded-lg hover:bg-brand-600/50 transition-colors"
        >
          <Plus size={13} />
          Novo item
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filtros */}
          <div className="px-6 py-3 border-b border-slate-800 flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterCat('__all__')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filterCat === '__all__' ? 'bg-brand-600/40 text-brand-300 border border-brand-600/50' : 'text-slate-400 hover:text-slate-200 border border-slate-700'}`}
              >
                Todos ({entries.length})
              </button>
              {CATEGORIES.map(c => {
                const count = entries.filter(e => e.category === c.value).length
                if (count === 0) return null
                return (
                  <button
                    key={c.value}
                    onClick={() => setFilterCat(c.value)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filterCat === c.value ? 'bg-brand-600/40 text-brand-300 border border-brand-600/50' : 'text-slate-400 hover:text-slate-200 border border-slate-700'}`}
                  >
                    {c.label} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Itens */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-sm">
                {search || filterCat !== '__all__' ? 'Nenhum resultado.' : 'Nenhum item cadastrado. Clique em "Novo item" para começar.'}
              </div>
            )}
            {visible.map(entry => {
              const meta = categoryMeta(entry.category)
              const isEditing = editing === entry.id
              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border transition-colors ${isEditing ? 'border-brand-500/50 bg-slate-900' : entry.isActive ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700' : 'border-slate-800/50 bg-slate-900/30 opacity-60'}`}
                >
                  {isEditing ? (
                    <EntryForm
                      form={form}
                      setForm={setForm}
                      onSave={save}
                      onCancel={cancelEdit}
                      saving={saving}
                      error={error}
                      titleRef={titleRef}
                    />
                  ) : (
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>
                            <span className="font-medium text-sm text-slate-200">{entry.title}</span>
                            {entry.tags && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Tag size={9} />{entry.tags}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2 whitespace-pre-wrap">{entry.content}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleActive(entry)}
                            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                            title={entry.isActive ? 'Desativar' : 'Ativar'}
                          >
                            {entry.isActive ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-1.5 text-slate-500 hover:text-brand-400 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => remove(entry.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Painel novo item (flutuante à direita quando editing='new') */}
        {editing === 'new' && (
          <div className="w-96 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">Novo item</span>
              <button onClick={cancelEdit} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <EntryForm
                form={form}
                setForm={setForm}
                onSave={save}
                onCancel={cancelEdit}
                saving={saving}
                error={error}
                titleRef={titleRef}
                vertical
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface EntryFormProps {
  form: KnowledgeEntryInput
  setForm: (f: KnowledgeEntryInput) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
  titleRef: React.RefObject<HTMLInputElement>
  vertical?: boolean
}

function EntryForm({ form, setForm, onSave, onCancel, saving, error, titleRef, vertical }: EntryFormProps) {
  const upd = (k: keyof KnowledgeEntryInput, v: unknown) => setForm({ ...form, [k]: v })

  return (
    <div className={`space-y-3 ${vertical ? '' : 'p-4'}`}>
      <div className={`${vertical ? 'flex flex-col gap-3' : 'flex gap-3 flex-wrap'}`}>
        <input
          ref={titleRef}
          value={form.title}
          onChange={e => upd('title', e.target.value)}
          placeholder="Título *"
          className="flex-1 min-w-40 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
        />
        <select
          value={form.category}
          onChange={e => upd('category', e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand-500"
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          value={form.tags}
          onChange={e => upd('tags', e.target.value)}
          placeholder="Tags (separadas por vírgula)"
          className="flex-1 min-w-32 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
        />
      </div>
      <textarea
        value={form.content}
        onChange={e => upd('content', e.target.value)}
        placeholder="Conteúdo — descreva o padrão, regra, biblioteca ou convenção *"
        rows={vertical ? 10 : 4}
        className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 resize-y font-mono"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => upd('isActive', e.target.checked)}
            className="accent-brand-500"
          />
          Ativo (injetado nos agentes)
        </label>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600/40 border border-brand-600/60 text-brand-300 rounded-lg hover:bg-brand-600/60 transition-colors disabled:opacity-50"
          >
            {saving ? <div className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
