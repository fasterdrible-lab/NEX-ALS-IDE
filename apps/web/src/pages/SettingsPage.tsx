import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, CheckCircle,
  Download, Upload, ChevronDown, ChevronUp, Eye, EyeOff,
  Trash2, Zap, Star, Check, AlertCircle, Bell, Users, Plus, ShieldCheck, Shield,
  Terminal, RefreshCw, Copy, MessageSquare,
} from 'lucide-react'
import { ipc, type AppUser } from '../lib/ipc'
import type { AiProviderConfig } from '@cwm/config'
import { useAuth } from '../contexts/AuthContext'

// ── Metadados estáticos dos provedores ──────────────────────────────────────

interface ProviderMeta {
  id: string
  name: string
  description: string
  badge?: string
  badgeColor?: string
  apiKeyPlaceholder: string
  keyUrl: string
  models: { id: string; name: string }[]
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude — excelente para código e raciocínio',
    badge: 'Recomendado',
    badgeColor: 'text-brand-300 bg-brand-600/20',
    apiKeyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com/api-keys',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (rápido/barato)' },
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8 (poderoso)' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Ótimo para código, custo muito baixo',
    badge: 'Mais barato',
    badgeColor: 'text-emerald-300 bg-emerald-600/20',
    apiKeyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (recomendado)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (raciocínio)' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, o1-mini — alto desempenho geral',
    apiKeyPlaceholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (rápido)' },
      { id: 'o1-mini', name: 'o1-mini (raciocínio)' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Contexto longo, rápido e preciso',
    apiKeyPlaceholder: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (rápido)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (poderoso)' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Llama, DeepSeek R1 — plano gratuito disponível',
    badge: 'Tem plano grátis',
    badgeColor: 'text-yellow-300 bg-yellow-600/20',
    apiKeyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B' },
      { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B (raciocínio)' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral / Codestral',
    description: 'Especializado em código, eficiente',
    apiKeyPlaceholder: '...',
    keyUrl: 'https://console.mistral.ai/api-keys/',
    models: [
      { id: 'codestral-latest', name: 'Codestral (especializado em código)' },
      { id: 'mistral-large-latest', name: 'Mistral Large' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    description: 'Grok — modelos da xAI',
    apiKeyPlaceholder: 'xai-...',
    keyUrl: 'https://console.x.ai',
    models: [
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-3-mini', name: 'Grok 3 Mini (rápido)' },
    ],
  },
]

// ── ClaudeCodeCard ───────────────────────────────────────────────────────────

type ClaudeAccount = { id: string; name: string; configDir: string; isActive: number; createdAt: string }
type AccountStatus = 'idle' | 'checking' | 'ok' | 'not_found'

function ClaudeCodeCard({ configs, onRefresh }: { configs: AiProviderConfig[]; onRefresh: () => void }) {
  const [accounts, setAccounts] = useState<ClaudeAccount[]>([])
  const [accountStatuses, setAccountStatuses] = useState<Record<string, { status: AccountStatus; version: string }>>({})
  const [newName, setNewName] = useState('')
  const [useDefault, setUseDefault] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const config = configs.find(c => c.provider === 'claude-code')
  const isDefault = config?.isDefault ?? false

  const loadAccounts = useCallback(async () => {
    try {
      const list = await ipc.claude.accounts.list()
      setAccounts(list)
      for (const acc of list) {
        setAccountStatuses(prev => ({ ...prev, [acc.id]: { status: 'checking', version: '' } }))
        ipc.claude.accounts.check(acc.configDir).then(res => {
          setAccountStatuses(prev => ({ ...prev, [acc.id]: { status: res.authenticated ? 'ok' : 'not_found', version: res.version } }))
        }).catch(() => {
          setAccountStatuses(prev => ({ ...prev, [acc.id]: { status: 'not_found', version: '' } }))
        })
      }
    } catch { /* ignora */ }
  }, [])

  useEffect(() => { void loadAccounts() }, [loadAccounts])

  const addAccount = async () => {
    if (!newName.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await ipc.claude.accounts.add(newName.trim(), useDefault) as unknown as { error?: string; id?: string }
      if (res?.error) {
        setAddError(res.error)
        return
      }
      setNewName('')
      setUseDefault(false)
      setShowAdd(false)
      await loadAccounts()
    } catch (err) {
      setAddError(String(err))
    } finally { setAdding(false) }
  }

  const setActive = async (id: string) => {
    await ipc.claude.accounts.setActive(id)
    await loadAccounts()
  }

  const deleteAccount = async (id: string) => {
    await ipc.claude.accounts.delete(id)
    await loadAccounts()
  }

  const setAsDefault = async () => {
    setSaving(true)
    try {
      await ipc.ai.save({ provider: 'claude-code', apiKey: '', model: 'claude-code', enabled: true, isDefault: true })
      onRefresh()
    } finally { setSaving(false) }
  }

  const removeDefault = async () => {
    setSaving(true)
    try {
      await ipc.ai.delete('claude-code')
      onRefresh()
    } finally { setSaving(false) }
  }

  const activeAcc = accounts.find(a => a.isActive === 1)
  const activeStatus = activeAcc ? accountStatuses[activeAcc.id] : undefined

  return (
    <div className={`border rounded-xl transition-colors ${isDefault ? 'border-brand-600/60 bg-brand-950/20' : 'border-slate-700 bg-slate-900'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="p-2 rounded-lg bg-brand-600/20">
          <Terminal size={15} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-100">Claude Code</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium text-brand-300 bg-brand-600/20">Conta — sem API Key</span>
            {isDefault && <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium text-yellow-300 bg-yellow-600/20"><Star size={10} /> Padrão</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Alterne entre contas Claude Pro para contornar o limite de 5h</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeStatus?.status === 'checking' && <Loader2 size={13} className="animate-spin text-slate-500" />}
          {activeStatus?.status === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={11} /> Ativa</span>}
          {activeStatus?.status === 'not_found' && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={11} /> Auth pendente</span>}
          <button onClick={loadAccounts} title="Atualizar" className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
        {/* Lista de contas */}
        {accounts.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma conta cadastrada. Adicione uma abaixo.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map(acc => {
              const st = accountStatuses[acc.id]
              const isAcc = acc.isActive === 1
              return (
                <div key={acc.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isAcc ? 'border-brand-600/40 bg-brand-950/20' : 'border-slate-700/50 bg-slate-800/40'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200 truncate">{acc.name}</span>
                      {isAcc && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-600/30 text-brand-300 font-medium">ativa</span>}
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">{acc.configDir}</p>
                    {st?.status === 'ok' && <p className="text-[10px] text-emerald-400 mt-0.5">✓ {st.version} — autenticada</p>}
                    {st?.status === 'not_found' && (() => {
                      const cmd = `$env:CLAUDE_CONFIG_DIR="${acc.configDir}"; claude`
                      return (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-[10px] text-amber-400">Não autenticada — rode no PowerShell:</p>
                          <div className="flex items-center gap-1">
                            <code className="text-[10px] text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono break-all">{cmd}</code>
                            <button onClick={() => void navigator.clipboard.writeText(cmd)}
                              title="Copiar"
                              className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors">
                              <Copy size={10} />
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                    {st?.status === 'checking' && <p className="text-[10px] text-slate-500 mt-0.5">verificando…</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isAcc && (
                      <button onClick={() => void setActive(acc.id)}
                        className="text-[10px] px-2 py-1 rounded bg-brand-600/20 border border-brand-600/30 text-brand-300 hover:bg-brand-600/40 transition-colors font-medium">
                        Usar esta
                      </button>
                    )}
                    <button onClick={() => void deleteAccount(acc.id)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Adicionar conta */}
        {showAdd ? (
          <div className="space-y-2 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void addAccount(); if (e.key === 'Escape') { setShowAdd(false); setAddError('') } }}
              placeholder="Nome da conta (ex: fasterdrible@gmail.com)"
              autoFocus
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-600/60"
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={useDefault} onChange={e => setUseDefault(e.target.checked)}
                className="accent-brand-500 w-3 h-3" />
              <span className="text-[11px] text-slate-400">
                Conta já autenticada no PC
                <span className="ml-1 text-slate-600 font-mono">(~/.claude)</span>
              </span>
            </label>
            {!useDefault && (
              <p className="text-[10px] text-amber-400/80">
                Nova conta — após adicionar, autentique no terminal com o comando exibido na lista.
              </p>
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => void addAccount()} disabled={adding || !newName.trim()}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-600/30 border border-brand-600/50 text-brand-300 hover:bg-brand-600/50 disabled:opacity-40 transition-colors font-medium">
                {adding ? <Loader2 size={11} className="animate-spin" /> : 'Adicionar'}
              </button>
              <button onClick={() => { setShowAdd(false); setAddError(''); setUseDefault(false) }}
                className="text-xs px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors">Cancelar</button>
            </div>
            {addError && (
              <p className="text-[10px] text-red-400 bg-red-900/20 border border-red-800/30 rounded px-2 py-1 font-mono break-all">{addError}</p>
            )}
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <Plus size={12} /> Adicionar conta
          </button>
        )}

        {/* Usar como padrão */}
        <div className="flex items-center gap-3 pt-1 border-t border-slate-800">
          {!isDefault ? (
            <button onClick={() => void setAsDefault()} disabled={saving || accounts.length === 0}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-600/30 border border-brand-600/50 text-brand-300 hover:bg-brand-600/50 disabled:opacity-40 transition-colors font-medium">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />} Usar como padrão
            </button>
          ) : (
            <button onClick={() => void removeDefault()} disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-700/40 border border-slate-600/50 text-slate-400 hover:bg-slate-700/60 disabled:opacity-40 transition-colors">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Remover como padrão
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ProviderCard ─────────────────────────────────────────────────────────────

interface ProviderCardProps {
  meta: ProviderMeta
  config?: AiProviderConfig
  onRefresh: () => void
}

function ProviderCard({ meta, config, onRefresh }: ProviderCardProps) {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState(meta.models[0].id)
  const [enabled, setEnabled] = useState(false)
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (config) {
      setModel(config.model || meta.models[0].id)
      setEnabled(config.enabled)
      setIsDefault(config.isDefault)
      setApiKey('')
    }
  }, [config, meta.models])

  const handleSave = async () => {
    setSaving(true); setTestResult(null)
    try {
      await ipc.ai.save({ provider: meta.id, apiKey, model, enabled, isDefault })
      onRefresh()
      setApiKey('')
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      if (apiKey && !apiKey.startsWith('••')) {
        await ipc.ai.save({ provider: meta.id, apiKey, model, enabled: true, isDefault })
        onRefresh()
        setApiKey('')
      }
      const r = await ipc.ai.test(meta.id)
      setTestResult({ ok: r.success, msg: r.message })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally { setTesting(false) }
  }

  const handleDelete = async () => {
    if (!config?.hasKey) return
    setDeleting(true)
    try {
      await ipc.ai.delete(meta.id)
      onRefresh()
      setApiKey('')
      setOpen(false)
    } finally { setDeleting(false) }
  }

  const isConfigured = config?.hasKey ?? false

  return (
    <div className={`border rounded-xl transition-colors ${
      isConfigured
        ? 'border-slate-700 bg-slate-900'
        : 'border-slate-800 bg-slate-900/50'
    }`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${isConfigured ? 'text-slate-100' : 'text-slate-400'}`}>
              {meta.name}
            </span>
            {meta.badge && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.badgeColor}`}>
                {meta.badge}
              </span>
            )}
            {config?.isDefault && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium text-yellow-300 bg-yellow-600/20">
                <Star size={10} /> Padrão
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isConfigured ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check size={11} /> Configurado
            </span>
          ) : (
            <span className="text-xs text-slate-600">Não configurado</span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {/* Expandido */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
          <div className="pt-3 space-y-3">
            {/* API Key */}
            <div>
              <label className="label">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="input pr-10 font-mono text-xs"
                  placeholder={config?.hasKey ? config.keyPreview : meta.apiKeyPlaceholder}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Obtenha sua chave em{' '}
                <span className="text-slate-400">{meta.keyUrl}</span>
                {config?.hasKey && ' · Deixe vazio para manter a chave existente'}
              </p>
            </div>

            {/* Modelo */}
            <div>
              <label className="label">Modelo</label>
              <select
                className="input"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                {meta.models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                />
                Habilitado
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                />
                <Star size={12} className="text-yellow-400" /> Definir como padrão
              </label>
            </div>

            {/* Feedback de teste */}
            {testResult && (
              <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${
                testResult.ok ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'
              }`}>
                {testResult.ok ? <Check size={12} className="mt-0.5 shrink-0" /> : <AlertCircle size={12} className="mt-0.5 shrink-0" />}
                {testResult.msg}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Salvar
              </button>
              <button
                onClick={handleTest}
                disabled={testing || (!isConfigured && !apiKey)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                Testar conexão
              </button>
              {isConfigured && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="ml-auto btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-red-400 hover:text-red-300 border-red-900/40"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SettingsPage ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user: currentUser, sessionRequired } = useAuth()
  const isAdmin = !sessionRequired || currentUser?.role === 'admin'

  const [loading, setLoading] = useState(true)
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [clearingSquad, setClearingSquad] = useState(false)
  const [clearSquadMsg, setClearSquadMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [aiProviders, setAiProviders] = useState<AiProviderConfig[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Gestão de usuários (admin only)
  const [users, setUsers] = useState<AppUser[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer')
  const [userSaving, setUserSaving] = useState(false)
  const [userMsg, setUserMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadAiProviders = useCallback(async () => {
    try { setAiProviders(await ipc.ai.list()) } catch { /* ignora */ }
  }, [])

  const loadUsers = useCallback(async () => {
    if (!isAdmin || !sessionRequired) return
    try { setUsers(await ipc.auth.users.list()) } catch { /* ignora */ }
  }, [isAdmin, sessionRequired])

  useEffect(() => {
    Promise.all([
      loadAiProviders(),
      ipc.notifications.getEnabled()
        .then(r => setNotificationsEnabled(r.enabled))
        .catch(() => {}),
      loadUsers(),
    ]).finally(() => setLoading(false))
  }, [loadAiProviders, loadUsers])

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    try { await ipc.notifications.setEnabled(enabled) } catch { /* ignora */ }
  }

  const handleExport = async () => {
    const r = await ipc.config.export()
    if (r.canceled) return
    setBackupMsg(r.success
      ? { ok: true, text: `Backup salvo em ${r.filePath?.split(/[\\/]/).pop()}` }
      : { ok: false, text: r.error ?? 'Erro ao exportar' })
    setTimeout(() => setBackupMsg(null), 4000)
  }

  const handleImport = async () => {
    const r = await ipc.config.import()
    if (r.canceled) return
    if (r.success && r.imported) {
      const { vps, projects, accounts } = r.imported
      setBackupMsg({ ok: true, text: `Importados: ${vps} VPS, ${projects} projetos, ${accounts} contas` })
    } else {
      setBackupMsg({ ok: false, text: r.error ?? 'Erro ao importar' })
    }
    setTimeout(() => setBackupMsg(null), 5000)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500">Carregando...</div>
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Configurações</h1>
        <p className="text-slate-400 mt-1">Preferências e provedores de IA</p>
      </div>

      {/* Notificações */}
      <div className="card space-y-6">
        <Section icon={<Bell size={16} />} title="Notificações">
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-slate-200">Alertas de sistema</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Notificações nativas quando disco ≥ 85%, CPU ≥ 90%, RAM ≥ 90% ou erro no AI Hub
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={() => handleToggleNotifications(!notificationsEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                notificationsEnabled ? 'bg-brand-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Section>

      </div>

      {/* Provedores de IA */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-1">
            <Zap size={14} className="text-brand-400" /> Provedores de IA
          </h2>
          <p className="text-xs text-slate-500">
            Configure as APIs para usar no chat do IDE. O provedor padrão é usado automaticamente.
            API Keys são armazenadas criptografadas (AES-256).
          </p>
        </div>

        <div className="space-y-2">
          {/* Claude Code — conta, sem API Key */}
          <ClaudeCodeCard configs={aiProviders} onRefresh={loadAiProviders} />

          {PROVIDERS.map(meta => (
            <ProviderCard
              key={meta.id}
              meta={meta}
              config={aiProviders.find(p => p.provider === meta.id)}
              onRefresh={loadAiProviders}
            />
          ))}
        </div>

        <p className="text-xs text-slate-600">
          Dica: Claude Code usa sua conta Pro sem cobrar por token. Groq tem plano gratuito.
          DeepSeek é o mais barato para código via API.
        </p>
      </div>

      {/* Usuários — admin only, somente quando sessionRequired */}
      {isAdmin && sessionRequired && (
        <div className="card space-y-4">
          <Section icon={<Users size={16} />} title="Usuários">
            {userMsg && (
              <div className={`text-sm px-3 py-2 rounded-lg ${userMsg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                {userMsg.text}
              </div>
            )}

            {/* Lista */}
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.role === 'admin'
                      ? <ShieldCheck size={14} className="text-brand-400 shrink-0" />
                      : <Shield size={14} className="text-slate-500 shrink-0" />}
                    <span className="text-sm text-slate-200 truncate">{u.username}</span>
                    <span className="text-xs text-slate-500">{u.role === 'admin' ? 'admin' : 'viewer'}</span>
                  </div>
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Excluir usuário "${u.username}"?`)) return
                        try {
                          await ipc.auth.users.delete(u.id)
                          await loadUsers()
                          setUserMsg({ ok: true, text: `Usuário "${u.username}" excluído.` })
                        } catch (e) {
                          setUserMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
                        }
                      }}
                      className="btn-ghost p-1 text-red-400 hover:text-red-300 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="text-sm text-slate-500">Nenhum usuário cadastrado.</p>}
            </div>

            {/* Criar novo */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <p className="text-xs font-medium text-slate-400">Novo usuário</p>
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-sm" placeholder="Username" value={newUsername}
                  onChange={e => setNewUsername(e.target.value)} />
                <input className="input text-sm" type="password" placeholder="Senha (min 6)" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <select className="input text-sm flex-1" value={newRole}
                  onChange={e => setNewRole(e.target.value as 'admin' | 'viewer')}>
                  <option value="viewer">Visualizador (viewer)</option>
                  <option value="admin">Administrador (admin)</option>
                </select>
                <button
                  disabled={userSaving || !newUsername || !newPassword}
                  onClick={async () => {
                    setUserSaving(true); setUserMsg(null)
                    try {
                      await ipc.auth.users.create(newUsername, newPassword, newRole)
                      setNewUsername(''); setNewPassword(''); setNewRole('viewer')
                      await loadUsers()
                      setUserMsg({ ok: true, text: 'Usuário criado com sucesso.' })
                    } catch (e) {
                      setUserMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
                    } finally { setUserSaving(false) }
                  }}
                  className="btn-primary text-sm shrink-0"
                >
                  {userSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Criar
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Squad — limpar histórico */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-1">
            <MessageSquare size={14} className="text-slate-400" /> Squad
          </h2>
          <p className="text-xs text-slate-500">
            Gerenciamento do histórico de conversas dos agentes. O banco persiste entre versões — limpe manualmente quando necessário.
          </p>
        </div>

        {clearSquadMsg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${clearSquadMsg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
            {clearSquadMsg.text}
          </div>
        )}

        <button
          onClick={async () => {
            if (!confirm('Apagar TODO o histórico de conversas do Squad? Esta ação não pode ser desfeita.')) return
            setClearingSquad(true)
            setClearSquadMsg(null)
            try {
              await ipc.squad.session.clearAll()
              setClearSquadMsg({ ok: true, text: 'Histórico do Squad apagado com sucesso.' })
            } catch (e) {
              setClearSquadMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
            } finally {
              setClearingSquad(false)
              setTimeout(() => setClearSquadMsg(null), 4000)
            }
          }}
          disabled={clearingSquad}
          className="btn-secondary flex items-center gap-2 text-sm text-red-400 hover:text-red-300 border-red-900/40 disabled:opacity-40"
        >
          {clearingSquad ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Limpar histórico do Squad
        </button>
      </div>

      {/* Backup / Restore */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-1">
            <Download size={14} className="text-slate-400" /> Backup e Restauração
          </h2>
          <p className="text-xs text-slate-500">Exporta e importa todas as VPS, projetos e contas cadastradas. Senhas SSH e API Keys não fazem parte do backup.</p>
        </div>

        {backupMsg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${backupMsg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
            {backupMsg.text}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Exportar backup (.json)
          </button>
          <button onClick={handleImport} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} /> Importar backup
          </button>
        </div>
      </div>

    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
