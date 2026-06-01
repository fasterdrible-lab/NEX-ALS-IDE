import { useEffect, useState, useCallback } from 'react'
import {
  Settings, Loader2, CheckCircle, FolderSearch, Key,
  Download, Upload, ChevronDown, ChevronUp, Eye, EyeOff,
  Trash2, Zap, Star, Check, AlertCircle,
} from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { SettingsInput, AiProviderConfig } from '@cwm/config'

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
  const [form, setForm] = useState<SettingsInput>({
    vscodePath: 'code',
    vscodeInsidersPath: 'code-insiders',
    sshKeyPath: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [aiProviders, setAiProviders] = useState<AiProviderConfig[]>([])

  const loadAiProviders = useCallback(async () => {
    try { setAiProviders(await ipc.ai.list()) } catch { /* ignora */ }
  }, [])

  useEffect(() => {
    Promise.all([
      ipc.settings.get()
        .then(s => setForm({ vscodePath: s.vscodePath, vscodeInsidersPath: s.vscodeInsidersPath, sshKeyPath: s.sshKeyPath ?? '' }))
        .catch(console.error),
      loadAiProviders(),
    ]).finally(() => setLoading(false))
  }, [loadAiProviders])

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await ipc.settings.update(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setSaving(false) }
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
        <p className="text-slate-400 mt-1">Caminhos, preferências e provedores de IA</p>
      </div>

      {/* VS Code + SSH */}
      <div className="card space-y-6">
        <Section icon={<Settings size={16} />} title="VS Code">
          <Field label="Caminho do VS Code" hint='Comando ou caminho completo do executável. Padrão: "code"'>
            <input
              className="input font-mono"
              value={form.vscodePath}
              onChange={e => setForm(d => ({ ...d, vscodePath: e.target.value }))}
              placeholder="code"
            />
          </Field>
          <Field label="Caminho do VS Code Insiders" hint='Para projetos que usam VS Code Insiders. Padrão: "code-insiders"'>
            <input
              className="input font-mono"
              value={form.vscodeInsidersPath}
              onChange={e => setForm(d => ({ ...d, vscodeInsidersPath: e.target.value }))}
              placeholder="code-insiders"
            />
          </Field>
        </Section>

        <div className="border-t border-slate-800" />

        <Section icon={<Key size={16} />} title="SSH">
          <Field
            label="Caminho da chave SSH privada"
            hint="Deixe vazio para usar a chave padrão (~/.ssh/id_rsa). O app nunca lê o conteúdo da chave."
          >
            <input
              className="input font-mono"
              value={form.sshKeyPath ?? ''}
              onChange={e => setForm(d => ({ ...d, sshKeyPath: e.target.value }))}
              placeholder="C:\Users\usuario\.ssh\id_rsa"
            />
          </Field>
        </Section>

        <div className="border-t border-slate-800" />

        <div className="flex items-center gap-3">
          {error && <p className="flex-1 text-sm text-red-400">{error}</p>}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle size={14} /> Configurações salvas
            </div>
          )}
          <div className="ml-auto">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar configurações'}
            </button>
          </div>
        </div>
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
          Dica: Groq tem plano gratuito. DeepSeek é o mais barato para código.
          Configure pelo menos um provedor para usar o chat sem VPS.
        </p>
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

      {/* Onde encontrar caminhos */}
      <div className="card border-slate-800/50">
        <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide flex items-center gap-2">
          <FolderSearch size={13} /> Onde encontrar os caminhos
        </p>
        <ul className="space-y-2 text-xs text-slate-500">
          <li><span className="text-slate-300">VS Code (Windows):</span> C:\Users\{'{usuario}'}\AppData\Local\Programs\Microsoft VS Code\bin\code</li>
          <li><span className="text-slate-300">VS Code (se no PATH):</span> code</li>
          <li><span className="text-slate-300">SSH key (Windows):</span> C:\Users\{'{usuario}'}\.ssh\id_rsa</li>
          <li><span className="text-slate-300">Para verificar:</span> Abra PowerShell → <code className="text-slate-400">where.exe code</code></li>
        </ul>
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
