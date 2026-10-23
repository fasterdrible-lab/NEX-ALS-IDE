import { useCallback, useEffect, useRef, useState } from 'react'
import { Rocket, ShieldAlert, FlaskConical, Pencil, Trash2, Loader2, CheckCircle2, XCircle, Undo2, ScrollText, X } from 'lucide-react'
import type { Project } from '@cwm/config'
import { ipc, type ProjectEnvironment, type EnvironmentKind, type DeployRecord } from '../lib/ipc'

/**
 * Ambientes do projeto (Project First, Fase 4b): staging e produção, cada um numa VPS + pasta, com deploy
 * por git (commit exato). O gate da produção é conferido no main — aqui só se mostra o estado e se pede
 * a confirmação (nome do projeto digitado).
 */

const KIND: Record<EnvironmentKind, { label: string; icon: typeof Rocket; accent: string }> = {
  staging: { label: 'Staging', icon: FlaskConical, accent: 'text-sky-300' },
  production: { label: 'Produção', icon: ShieldAlert, accent: 'text-red-300' },
}

const STATUS: Record<DeployRecord['status'], { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  running: { label: 'rodando', cls: 'text-slate-300', icon: Loader2 },
  ok: { label: 'ok', cls: 'text-emerald-400', icon: CheckCircle2 },
  failed: { label: 'falhou', cls: 'text-red-400', icon: XCircle },
  rolled_back: { label: 'falhou e voltou ao anterior', cls: 'text-amber-400', icon: Undo2 },
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')

interface FormState { vpsServerId: string; remotePath: string; branch: string; url: string; deployCommands: string }

export default function ProjectEnvironments({ project }: { project: Project }) {
  const [envs, setEnvs] = useState<ProjectEnvironment[]>([])
  const [vpsList, setVpsList] = useState<{ id: string; name: string }[]>([])
  const [editing, setEditing] = useState<EnvironmentKind | null>(null)
  const [form, setForm] = useState<FormState>({ vpsServerId: '', remotePath: '', branch: 'main', url: '', deployCommands: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useState<{ envId: string; lines: string[] } | null>(null)
  const [promote, setPromote] = useState<ProjectEnvironment | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const logRef = useRef<HTMLPreElement>(null)

  const load = useCallback(() => {
    ipc.env.list(project.id).then(setEnvs).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [project.id])

  useEffect(() => {
    load()
    ipc.vps.list().then(l => setVpsList(l.map(v => ({ id: v.id, name: v.name })))).catch(() => {})
  }, [load])

  useEffect(() => ipc.deploy.onLog(e => {
    setLog(l => (l && l.envId === e.envId ? { envId: e.envId, lines: [...l.lines, e.line] } : l))
  }), [])
  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight) }, [log])

  const byKind = (k: EnvironmentKind) => envs.find(e => e.kind === k) ?? null
  const staging = byKind('staging')

  const openForm = (k: EnvironmentKind) => {
    const e = byKind(k)
    setForm(e
      ? { vpsServerId: e.vpsServerId ?? '', remotePath: e.remotePath, branch: e.branch, url: e.url, deployCommands: e.deployCommands }
      : { vpsServerId: '', remotePath: '', branch: 'main', url: '', deployCommands: '' })
    setError(''); setEditing(k)
  }

  const save = async () => {
    if (!editing) return
    setBusy('save'); setError('')
    try {
      await ipc.env.save({ projectId: project.id, kind: editing, ...form })
      setEditing(null); load()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setBusy(null)
  }

  const remove = async (e: ProjectEnvironment) => {
    if (!window.confirm(`Tirar o ambiente ${KIND[e.kind].label} do Zeus? Nada é apagado na VPS (${e.vpsName}:${e.remotePath}).`)) return
    try { await ipc.env.remove(e.id); load() } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }

  const run = async (e: ProjectEnvironment, confirm?: string) => {
    setBusy(e.id); setError(''); setLog({ envId: e.id, lines: [] }); setPromote(null); setConfirmText('')
    try {
      const r = await ipc.deploy.run(e.id, confirm)
      setLog({ envId: e.id, lines: r.log.split('\n').filter(Boolean) })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLog(null)
    }
    setBusy(null); load()
  }

  const showLast = (e: ProjectEnvironment) => {
    if (e.lastDeploy) setLog({ envId: e.id, lines: e.lastDeploy.log.split('\n').filter(Boolean) })
  }

  // O que a produção vai receber e se o gate deixa — o main confere de novo
  const gate = (): { ok: boolean; what: string } => {
    if (!staging) return { ok: true, what: `o último commit de ${byKind('production')?.branch ?? 'main'} (sem staging cadastrado)` }
    const last = staging.lastDeploy
    if (!last || last.status !== 'ok') return { ok: false, what: 'nada — o último deploy de staging não terminou bem' }
    if (staging.url && last.smoke !== 'ok') return { ok: false, what: 'nada — staging não passou no smoke test' }
    return { ok: true, what: `o commit ${last.commitSha.slice(0, 8)} que passou em staging (${when(last.finishedAt)})` }
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2"><Rocket size={15} /> Ambientes</h2>
      <p className="text-xs text-slate-500 mb-3">
        O agente (Hermes) trabalha em {project.vpsServer ? `${project.vpsServer.name}:${project.remotePath}` : 'nenhuma VPS ainda'}.
        Deploy por git, commit exato: staging recebe o último commit do branch; produção só recebe o que passou em staging.
        {!project.gitRepo && ' Para clonar numa pasta vazia, o projeto precisa do endereço do repositório (Projetos → editar).'}
      </p>

      {error && <p className="text-xs text-red-400 mb-3 whitespace-pre-wrap">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        {(['staging', 'production'] as const).map(k => {
          const e = byKind(k)
          const K = KIND[k]
          const last = e?.lastDeploy
          const S = last ? STATUS[last.status] : null
          return (
            <div key={k} className={`card space-y-2 ${k === 'production' ? 'border border-red-900/50' : ''}`}>
              <div className="flex items-center gap-2">
                <K.icon size={14} className={K.accent} />
                <p className={`text-sm font-semibold ${K.accent} flex-1`}>{K.label}</p>
                {e && (
                  <>
                    <button onClick={() => openForm(k)} title="Editar" className="p-1 text-slate-500 hover:text-slate-200"><Pencil size={12} /></button>
                    <button onClick={() => void remove(e)} title="Tirar do Zeus" className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                  </>
                )}
              </div>
              {!e ? (
                <button onClick={() => openForm(k)} className="btn-secondary text-xs">Configurar {K.label.toLowerCase()}</button>
              ) : (
                <>
                  <p className="text-xs text-slate-400 font-mono truncate" title={`${e.vpsName}:${e.remotePath}`}>{e.vpsName || '(VPS apagada)'}:{e.remotePath}</p>
                  <p className="text-xs text-slate-500">branch <span className="font-mono">{e.branch}</span>{e.url ? <> · <span className="truncate">{e.url}</span></> : ' · sem smoke test'}</p>
                  {last && S ? (
                    <button onClick={() => showLast(e)} className={`text-xs flex items-center gap-1.5 ${S.cls} hover:underline`} title="Ver o log deste deploy">
                      <S.icon size={12} className={last.status === 'running' ? 'animate-spin' : ''} />
                      {last.commitSha ? <span className="font-mono">{last.commitSha.slice(0, 8)}</span> : null} {S.label} · {when(last.finishedAt ?? last.startedAt)}
                      {last.smoke === 'ok' ? ' · smoke ok' : ''}
                    </button>
                  ) : <p className="text-xs text-slate-600">Nenhum deploy ainda.</p>}
                  {k === 'staging' ? (
                    <button onClick={() => void run(e)} disabled={busy !== null || !e.vpsServerId} className="btn-primary text-xs disabled:opacity-40">
                      {busy === e.id ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} Deploy em staging
                    </button>
                  ) : (
                    <button onClick={() => { setPromote(e); setConfirmText('') }} disabled={busy !== null || !e.vpsServerId || !gate().ok}
                      title={gate().ok ? `Publica ${gate().what}` : `Bloqueado: ${gate().what}`}
                      className="text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700/60 text-red-200 hover:bg-red-900/60 disabled:opacity-40 disabled:cursor-not-allowed">
                      {busy === e.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />} {staging ? 'Promover para produção' : 'Publicar em produção'}
                    </button>
                  )}
                  {k === 'production' && !gate().ok && <p className="text-[11px] text-amber-400/80">Bloqueado: {gate().what}.</p>}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Formulário do ambiente */}
      {editing && (
        <div className="card mt-3 space-y-2 border border-slate-700">
          <p className="text-sm font-semibold text-slate-200">{KIND[editing].label} — {project.name}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">VPS
              <select className="input mt-1 w-full" value={form.vpsServerId} onChange={e => setForm(f => ({ ...f, vpsServerId: e.target.value }))}>
                <option value="">Escolha…</option>
                {vpsList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">Pasta na VPS
              <input className="input mt-1 w-full font-mono" placeholder="/srv/meu-app" value={form.remotePath} onChange={e => setForm(f => ({ ...f, remotePath: e.target.value }))} />
            </label>
            <label className="text-xs text-slate-400">Branch
              <input className="input mt-1 w-full font-mono" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} />
            </label>
            <label className="text-xs text-slate-400">URL do smoke test (opcional)
              <input className="input mt-1 w-full" placeholder="https://staging.meuapp.com/health" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </label>
          </div>
          <label className="text-xs text-slate-400 block">Comandos do deploy (um por linha, rodados na pasta depois do checkout)
            <textarea className="input mt-1 w-full font-mono text-xs h-24" placeholder={'npm ci\nnpm run build\npm2 restart meu-app'}
              value={form.deployCommands} onChange={e => setForm(f => ({ ...f, deployCommands: e.target.value }))} />
          </label>
          <p className="text-[11px] text-slate-500">
            Pasta vazia: o Zeus clona o repositório nela. Pasta com alteração feita direto na VPS: o deploy para, sem passar por cima.
            {editing === 'production' && ' Produção fica só leitura na IDE, o terminal pede confirmação e Hermes/Squad não entram na VPS dela.'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => void save()} disabled={busy !== null} className="btn-primary text-xs">{busy === 'save' ? <Loader2 size={12} className="animate-spin" /> : null} Salvar</button>
            <button onClick={() => setEditing(null)} className="btn-secondary text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {/* Confirmação da produção */}
      {promote && (
        <div className="card mt-3 space-y-2 border border-red-700/70 bg-red-950/20">
          <p className="text-sm font-semibold text-red-200 flex items-center gap-2"><ShieldAlert size={14} /> Publicar em produção — {project.name}</p>
          <p className="text-xs text-slate-300">Vai para <span className="font-mono">{promote.vpsName}:{promote.remotePath}</span>: {gate().what}.</p>
          {promote.deployCommands.trim() && (
            <pre className="text-[11px] font-mono bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 whitespace-pre-wrap">{promote.deployCommands.trim()}</pre>
          )}
          <p className="text-xs text-slate-400">Se um comando ou o smoke test falhar, a produção volta sozinha para o commit de antes.</p>
          <label className="text-xs text-slate-400 block">Digite <span className="font-mono text-slate-200">{project.name}</span> para confirmar
            <input className="input mt-1 w-full" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoFocus />
          </label>
          <div className="flex gap-2">
            <button onClick={() => void run(promote, confirmText)} disabled={confirmText.trim() !== project.name.trim()}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
              <Rocket size={12} /> Publicar
            </button>
            <button onClick={() => setPromote(null)} className="btn-secondary text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {/* Log do deploy (ao vivo ou o último) */}
      {log && (
        <div className="card mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <ScrollText size={13} className="text-slate-400" />
            <p className="text-xs text-slate-300 flex-1">Log — {KIND[envs.find(e => e.id === log.envId)?.kind ?? 'staging'].label}{busy === log.envId ? ' (rodando…)' : ''}</p>
            {busy !== log.envId && <button onClick={() => setLog(null)} className="p-1 text-slate-500 hover:text-slate-200"><X size={12} /></button>}
          </div>
          <pre ref={logRef} className="text-[11px] font-mono bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 whitespace-pre-wrap max-h-72 overflow-y-auto">
            {log.lines.length ? log.lines.join('\n') : 'Começando…'}
          </pre>
        </div>
      )}
    </div>
  )
}
