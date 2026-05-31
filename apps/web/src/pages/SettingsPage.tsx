import { useEffect, useState } from 'react'
import { Settings, Loader2, CheckCircle, FolderSearch, Key, Download, Upload } from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { SettingsInput } from '@cwm/config'

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

  useEffect(() => {
    ipc.settings.get()
      .then(s => setForm({ vscodePath: s.vscodePath, vscodeInsidersPath: s.vscodeInsidersPath, sshKeyPath: s.sshKeyPath ?? '' }))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Configurações</h1>
        <p className="text-slate-400 mt-1">Caminhos e preferências do ambiente local</p>
      </div>

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

      {/* Backup / Restore */}
      <div className="mt-6 card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-1">
            <Download size={14} className="text-slate-400"/> Backup e Restauração
          </h2>
          <p className="text-xs text-slate-500">Exporta e importa todas as VPS, projetos e contas cadastradas. Senhas SSH não são armazenadas e não fazem parte do backup.</p>
        </div>

        {backupMsg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${backupMsg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
            {backupMsg.text}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14}/> Exportar backup (.json)
          </button>
          <button onClick={handleImport} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14}/> Importar backup
          </button>
        </div>
        <p className="text-xs text-slate-600">O backup pode ser usado para migrar configurações para outro PC ou como cópia de segurança.</p>
      </div>

      <div className="mt-6 card border-slate-800/50">
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
