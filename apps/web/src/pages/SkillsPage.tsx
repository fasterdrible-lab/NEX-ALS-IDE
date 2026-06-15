import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, BookOpenCheck, Tag, Zap, Search, ChevronDown, ChevronUp, X, Save } from 'lucide-react'
import { ipc, type AgentSkill, type AgentSkillInput } from '../lib/ipc'

const CATEGORIES = ['geral', 'desenvolvimento', 'devops', 'debug', 'arquitetura', 'snippets'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_COLORS: Record<Category, string> = {
  geral:          'rgba(148,163,184,0.15)',
  desenvolvimento:'rgba(74,222,128,0.15)',
  devops:         'rgba(96,165,250,0.15)',
  debug:          'rgba(251,113,133,0.15)',
  arquitetura:    'rgba(251,191,36,0.15)',
  snippets:       'rgba(167,139,250,0.15)',
}

const EMPTY_FORM: AgentSkillInput = {
  title: '', description: '', category: 'geral',
  triggers: [], content: '', examples: [],
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AgentSkillInput>(EMPTY_FORM)
  const [triggersInput, setTriggersInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<AgentSkill[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await ipc.skills.list()
      setSkills(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Busca FTS5 debounced (400ms)
  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return }
    setSearchLoading(true)
    const t = setTimeout(async () => {
      try { setSearchResults(await ipc.skills.search(search)) }
      catch { setSearchResults(null) }
      finally { setSearchLoading(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const baseList = searchResults !== null
    ? searchResults
    : search.trim()
      ? skills.filter(s => {
          const q = search.toLowerCase()
          return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        })
      : skills
  const filtered = baseList

  function openCreate() {
    setForm(EMPTY_FORM)
    setTriggersInput('')
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(skill: AgentSkill) {
    setForm({
      title: skill.title,
      description: skill.description,
      category: skill.category,
      triggers: skill.triggers,
      content: skill.content,
      examples: skill.examples,
    })
    setTriggersInput(skill.triggers.join(', '))
    setEditId(skill.id)
    setShowForm(true)
    setExpanded(null)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const triggers = triggersInput.split(',').map(t => t.trim()).filter(Boolean)
      const data = { ...form, triggers }
      if (editId) {
        await ipc.skills.update(editId, data)
      } else {
        await ipc.skills.create(data)
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
      setTriggersInput('')
      setEditId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await ipc.skills.delete(id)
      setDeleteId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#080612', color: 'rgba(248,248,252,0.9)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck size={20} style={{ color: '#B78DFF' }} />
            <h1 className="text-lg font-semibold" style={{ color: '#F2C879' }}>Skills do Squad</h1>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(248,248,252,0.4)' }}>
            Procedimentos reutilizáveis que o Squad detecta automaticamente por gatilhos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'rgba(183,141,255,0.12)',
            border: '1px solid rgba(183,141,255,0.3)',
            color: '#B78DFF',
          }}
        >
          <Plus size={14} />
          Nova Skill
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        {searchLoading
          ? <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(183,141,255,0.4)', borderTopColor: '#B78DFF' }} />
          : <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(248,248,252,0.3)' }} />
        }
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar skills com FTS5 (prefix match automático)…"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(248,248,252,0.85)',
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(183,141,255,0.2)', borderTopColor: '#B78DFF' }} />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <BookOpenCheck size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm" style={{ color: 'rgba(248,248,252,0.3)' }}>
            {search ? 'Nenhuma skill encontrada para esta busca.' : 'Nenhuma skill cadastrada ainda.'}
          </p>
          {!search && (
            <button onClick={openCreate} className="mt-4 text-sm underline" style={{ color: '#B78DFF' }}>
              Criar primeira skill
            </button>
          )}
        </div>
      )}

      {/* Skill list */}
      <div className="space-y-2">
        {filtered.map(skill => (
          <div
            key={skill.id}
            className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="shrink-0 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
                style={{ background: CATEGORY_COLORS[skill.category as Category] ?? CATEGORY_COLORS.geral, color: 'rgba(248,248,252,0.7)' }}
              >
                {skill.category}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'rgba(248,248,252,0.9)' }}>
                  {skill.title}
                </p>
                {skill.description && (
                  <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(248,248,252,0.4)' }}>
                    {skill.description}
                  </p>
                )}
              </div>

              {/* Triggers */}
              {skill.triggers.length > 0 && (
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  <Tag size={10} style={{ color: 'rgba(248,248,252,0.25)' }} />
                  <span className="text-[10px]" style={{ color: 'rgba(248,248,252,0.35)' }}>
                    {skill.triggers.slice(0, 3).join(', ')}{skill.triggers.length > 3 ? ' …' : ''}
                  </span>
                </div>
              )}

              {/* Usage */}
              <div className="flex items-center gap-1 shrink-0" title="Usos">
                <Zap size={10} style={{ color: 'rgba(248,248,252,0.25)' }} />
                <span className="text-[10px]" style={{ color: 'rgba(248,248,252,0.3)' }}>{skill.usageCount}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(skill)}
                  className="p-1.5 rounded transition-colors text-xs"
                  style={{ color: 'rgba(248,248,252,0.3)' }}
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setDeleteId(skill.id)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'rgba(248,248,252,0.3)' }}
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  onClick={() => setExpanded(expanded === skill.id ? null : skill.id)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'rgba(248,248,252,0.3)' }}
                >
                  {expanded === skill.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {expanded === skill.id && (
              <div
                className="px-4 pb-4 pt-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                {skill.triggers.length > 0 && (
                  <div className="mt-3 mb-3 flex flex-wrap gap-1.5">
                    {skill.triggers.map(t => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full text-[10px]"
                        style={{ background: 'rgba(183,141,255,0.12)', color: '#B78DFF', border: '1px solid rgba(183,141,255,0.2)' }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <pre
                  className="text-xs whitespace-pre-wrap rounded-lg p-3 mt-2 overflow-auto max-h-64"
                  style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(248,248,252,0.7)', fontFamily: 'monospace' }}
                >
                  {skill.content}
                </pre>
                {skill.examples.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-medium mb-1.5" style={{ color: 'rgba(248,248,252,0.35)' }}>EXEMPLOS</p>
                    <ul className="space-y-1">
                      {skill.examples.map((ex, i) => (
                        <li key={i} className="text-xs pl-3 border-l-2" style={{ borderColor: 'rgba(183,141,255,0.3)', color: 'rgba(248,248,252,0.55)' }}>
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Create/Edit Form modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: '#0D0A24', border: '1px solid rgba(183,141,255,0.2)' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#F2C879' }}>
                {editId ? 'Editar Skill' : 'Nova Skill'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null) }} style={{ color: 'rgba(248,248,252,0.35)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <div className="overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(248,248,252,0.5)' }}>Título *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Criar componente React com Tailwind"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(248,248,252,0.85)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(248,248,252,0.5)' }}>Categoria</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(248,248,252,0.85)' }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(248,248,252,0.5)' }}>
                    Gatilhos <span style={{ color: 'rgba(248,248,252,0.3)' }}>(separados por vírgula)</span>
                  </label>
                  <input
                    value={triggersInput}
                    onChange={e => setTriggersInput(e.target.value)}
                    placeholder="componente, tailwind, ui, react"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(248,248,252,0.85)' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(248,248,252,0.5)' }}>Descrição</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Breve descrição do que essa skill faz"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(248,248,252,0.85)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(248,248,252,0.5)' }}>
                  Conteúdo * <span style={{ color: 'rgba(248,248,252,0.3)' }}>(instruções passo-a-passo para o agente)</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="1. Identifique os props do componente&#10;2. Crie o arquivo em src/components/&#10;3. Use className com Tailwind&#10;4. Export default ao final"
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none font-mono"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(248,248,252,0.85)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(248,248,252,0.5)' }}>
                  Exemplos <span style={{ color: 'rgba(248,248,252,0.3)' }}>(um por linha)</span>
                </label>
                <textarea
                  value={(form.examples ?? []).join('\n')}
                  onChange={e => setForm(f => ({ ...f, examples: e.target.value.split('\n').filter(Boolean) }))}
                  placeholder="Crie um Button com variantes primary e secondary&#10;Crie um Card com imagem e título"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(248,248,252,0.85)' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => { setShowForm(false); setEditId(null) }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'rgba(248,248,252,0.5)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'rgba(183,141,255,0.18)', border: '1px solid rgba(183,141,255,0.35)', color: '#B78DFF' }}
              >
                {saving ? <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(183,141,255,0.3)', borderTopColor: '#B78DFF' }} /> : <Save size={13} />}
                {editId ? 'Salvar alterações' : 'Criar Skill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#0D0A24', border: '1px solid rgba(239,68,68,0.2)' }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: '#f87171' }}>Excluir skill?</h3>
            <p className="text-xs mb-5" style={{ color: 'rgba(248,248,252,0.5)' }}>Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'rgba(248,248,252,0.5)' }}>
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
