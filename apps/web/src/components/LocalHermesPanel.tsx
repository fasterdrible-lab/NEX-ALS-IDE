import { useEffect, useState } from 'react'
import { AlertTriangle, Download, Link2, Loader2, Upload, UploadCloud, X } from 'lucide-react'
import type { VpsServer } from '@cwm/config'
import { ipc, type HermesLocalLink, type HermesSyncChange } from '../lib/ipc'
import HermesAgentPanel from './HermesAgentPanel'

/** Mesmas pastas que o core deixa de fora (SYNC_EXCLUDE_DIRS) — só para mostrar no formulário. */
const EXCLUDED_LABEL = 'node_modules, .next, .nuxt, dist, .turbo, .cache, coverage, .venv, __pycache__'

function slug(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'projeto'
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86400) return `há ${Math.round(s / 3600)} h`
  return `há ${Math.round(s / 86400)} d`
}

const KIND_BADGE: Record<HermesSyncChange['kind'], { letter: string; cls: string; label: string }> = {
  added:    { letter: 'A', cls: 'text-emerald-400', label: 'novo' },
  modified: { letter: 'M', cls: 'text-amber-300',   label: 'alterado' },
  deleted:  { letter: 'D', cls: 'text-red-400',     label: 'apagado' },
}

/**
 * Hermes para um projeto que começa numa pasta local (OneDrive). O Hermes só roda na VPS:
 * sem ligação, oferece enviar a pasta; com ligação, mostra o painel do Hermes do projeto
 * enviado + "Trazer alterações" (VPS → PC) e "Enviar alterações" (PC → VPS).
 */
export default function LocalHermesPanel({ localPath, onPulled }: { localPath: string; onPulled: () => void }) {
  const folderName = localPath.split(/[\\/]/).filter(Boolean).pop() ?? 'projeto'
  const [link, setLink] = useState<HermesLocalLink | null | undefined>(undefined)
  const [vpsList, setVpsList] = useState<VpsServer[]>([])
  const [vpsId, setVpsId] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [name, setName] = useState(folderName)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; details?: string[] } | null>(null)
  const [sync, setSync] = useState<{ dir: 'pull' | 'push'; changes: HermesSyncChange[]; selected: Set<string> } | null>(null)
  const [remoteChanged, setRemoteChanged] = useState(0)
  /** Pasta da VPS que o envio recusou por já existir — oferece ligar a ela. */
  const [existsAt, setExistsAt] = useState<string | null>(null)

  useEffect(() => {
    ipc.hermes.local.link(localPath).then(setLink).catch(e => { setLink(null); setMsg({ kind: 'err', text: String(e instanceof Error ? e.message : e) }) })
  }, [localPath])

  useEffect(() => {
    if (link !== null) return
    ipc.vps.list().then(vs => {
      setVpsList(vs)
      const first = vs[0]
      if (first && !vpsId) {
        setVpsId(first.id)
        setRemotePath(`${(first.defaultPath || '/root').replace(/\/+$/, '')}/${slug(folderName)}`)
      }
    }).catch(() => {})
  }, [link]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ao terminar uma execução do Hermes, conta o que mudou na VPS para lembrar de trazer.
  useEffect(() => {
    if (!link) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = ipc.hermes.agent.onChunk(chunk => {
      if (chunk.type !== 'done' && chunk.type !== 'error') return
      clearTimeout(timer)
      timer = setTimeout(() => {
        ipc.hermes.local.status(localPath).then(s => setRemoteChanged(s.pull.length)).catch(() => {})
      }, 1500)
    })
    return () => { clearTimeout(timer); try { unsub() } catch { /* ignorar */ } }
  }, [link, localPath])

  const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

  const publish = async () => {
    setBusy('publish'); setMsg(null); setExistsAt(null)
    try {
      const l = await ipc.hermes.local.publish({ localPath, vpsId, remotePath, name })
      setLink(l)
      setMsg({ kind: 'ok', text: `Pasta enviada para ${l.vpsName}:${l.remotePath} e projeto "${l.projectName}" cadastrado.` })
    } catch (e) {
      const text = errText(e)
      // Pasta já existe na VPS: em vez de só recusar, oferece ligar a ela (projeto enviado antes).
      if (text.includes('já existe na VPS')) setExistsAt(remotePath.trim())
      else setMsg({ kind: 'err', text })
    }
    setBusy(null)
  }

  const relink = async () => {
    setBusy('relink'); setMsg(null)
    try {
      const l = await ipc.hermes.local.relink({ localPath, vpsId, remotePath, name })
      setLink(l); setExistsAt(null)
      setMsg({ kind: 'ok', text: `Pasta ligada a ${l.vpsName}:${l.remotePath} (projeto "${l.projectName}"). Use Trazer/Enviar alterações para igualar os dois lados.` })
    } catch (e) { setMsg({ kind: 'err', text: errText(e) }) }
    setBusy(null)
  }

  const openSync = async (dir: 'pull' | 'push') => {
    setBusy(dir); setMsg(null)
    try {
      const s = await ipc.hermes.local.status(localPath)
      setLink(s.link)
      const changes = dir === 'pull' ? s.pull : s.push
      if (dir === 'pull') setRemoteChanged(0)
      if (changes.length === 0) setMsg({ kind: 'ok', text: dir === 'pull' ? 'Nada mudou na VPS desde a última sincronização.' : 'Nada mudou no PC desde a última sincronização.' })
      // Conflito começa desmarcado: aplicar substitui a versão do outro lado.
      else setSync({ dir, changes, selected: new Set(changes.filter(c => !c.conflict).map(c => c.path)) })
    } catch (e) { setMsg({ kind: 'err', text: errText(e) }) }
    setBusy(null)
  }

  const applySync = async () => {
    if (!sync) return
    const { dir } = sync
    setBusy(dir)
    try {
      const paths = [...sync.selected]
      const r = dir === 'pull' ? await ipc.hermes.local.pull(localPath, paths) : await ipc.hermes.local.push(localPath, paths)
      setSync(null)
      setMsg({
        kind: r.skipped.length ? 'err' : 'ok',
        text: `${r.applied} arquivo(s) ${dir === 'pull' ? 'trazido(s) para o PC' : 'enviado(s) à VPS'}${r.skipped.length ? `; ${r.skipped.length} não aplicado(s)` : ''}.`,
        details: r.skipped.map(s => `${s.path} — ${s.reason}`),
      })
      if (dir === 'pull') onPulled()
      setLink(await ipc.hermes.local.link(localPath))
    } catch (e) { setMsg({ kind: 'err', text: errText(e) }) }
    setBusy(null)
  }

  const toggle = (p: string) => setSync(s => {
    if (!s) return s
    const sel = new Set(s.selected)
    if (sel.has(p)) sel.delete(p); else sel.add(p)
    return { ...s, selected: sel }
  })

  const message = msg && (
    <div className={`mx-3 mt-2 px-2 py-1.5 rounded text-[11px] border shrink-0 ${msg.kind === 'ok' ? 'text-emerald-300 bg-emerald-950/30 border-emerald-900/40' : 'text-amber-300 bg-amber-950/30 border-amber-900/40'}`}>
      <div className="flex gap-2">
        <span className="flex-1">{msg.text}</span>
        <button onClick={() => setMsg(null)} className="text-slate-500 hover:text-slate-300 shrink-0"><X size={11}/></button>
      </div>
      {msg.details && msg.details.length > 0 && (
        <ul className="mt-1 max-h-24 overflow-y-auto font-mono text-[10px] text-slate-400">{msg.details.map(d => <li key={d}>{d}</li>)}</ul>
      )}
    </div>
  )

  if (link === undefined) return <div className="p-4"><Loader2 size={14} className="animate-spin text-slate-500"/></div>

  // ── Sem ligação: enviar a pasta à VPS ──
  if (link === null) {
    const selVps = vpsList.find(v => v.id === vpsId)
    return (
      <div className="flex-1 overflow-y-auto">
        {message}
        <div className="p-3 space-y-3 text-xs">
          <div>
            <p className="text-slate-200 font-semibold">Trabalhar nesta pasta com o Hermes</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              O Hermes roda na VPS. A pasta <span className="font-mono text-slate-400">{folderName}</span> é copiada para lá e vira um projeto cadastrado;
              depois, <b className="text-slate-400">Trazer alterações</b> devolve ao OneDrive o que o Hermes mudar.
            </p>
          </div>
          {vpsList.length === 0 ? (
            <p className="text-amber-300 text-[11px]">Nenhuma VPS cadastrada — cadastre uma em VPS.</p>
          ) : (
            <>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">VPS</span>
                <select value={vpsId} onChange={e => {
                  const v = vpsList.find(x => x.id === e.target.value)
                  setVpsId(e.target.value)
                  if (v) setRemotePath(`${(v.defaultPath || '/root').replace(/\/+$/, '')}/${slug(folderName)}`)
                }} className="input w-full mt-1 text-xs py-1">
                  {vpsList.map(v => <option key={v.id} value={v.id}>{v.name} ({v.host})</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Pasta na VPS (nova ou vazia)</span>
                <input value={remotePath} onChange={e => setRemotePath(e.target.value)} className="input w-full mt-1 text-xs py-1 font-mono"/>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Nome do projeto</span>
                <input value={name} onChange={e => setName(e.target.value)} className="input w-full mt-1 text-xs py-1"/>
              </label>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Não vão: <span className="font-mono">{EXCLUDED_LABEL}</span> (o Hermes reinstala).
                Vão junto: o histórico <span className="font-mono">.git</span> e arquivos como <span className="font-mono">.env</span>.
                Sem <span className="font-mono">.git</span>, um repositório é criado na VPS com o primeiro commit.
              </p>
              <button onClick={publish} disabled={!!busy || !vpsId || !remotePath.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 text-xs py-1.5 disabled:opacity-50">
                {busy === 'publish' ? <Loader2 size={13} className="animate-spin"/> : <UploadCloud size={13}/>}
                {busy === 'publish' ? 'Enviando…' : `Enviar para ${selVps?.name ?? 'a VPS'} e abrir o Hermes`}
              </button>
              {existsAt && existsAt === remotePath.trim() && (
                <div className="rounded border border-amber-900/50 bg-amber-950/30 p-2 space-y-2">
                  <p className="text-[11px] text-amber-200 leading-relaxed">
                    <span className="font-mono">{existsAt}</span> já existe na {selVps?.name ?? 'VPS'} e não está vazia.
                    Se é esta pasta enviada antes, ligue a ela sem copiar nada: os arquivos iguais ficam sincronizados,
                    os diferentes aparecem em Trazer/Enviar alterações, e o histórico do Hermes nessa pasta volta.
                    Senão, escolha outra pasta acima.
                  </p>
                  <button onClick={relink} disabled={!!busy}
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-xs py-1.5 disabled:opacity-50">
                    {busy === 'relink' ? <Loader2 size={13} className="animate-spin"/> : <Link2 size={13}/>}
                    {busy === 'relink' ? 'Comparando arquivos…' : 'Ligar a esta pasta existente'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Ligado: barra de sincronização + painel do Hermes ──
  return (
    <>
      <div className="px-3 py-2 border-b border-slate-800 shrink-0 space-y-1.5">
        <p className="text-[10px] text-slate-500 truncate" title={`${link.vpsName}:${link.remotePath}`}>
          Na VPS: <span className="text-slate-300">{link.vpsName}</span>:<span className="font-mono text-slate-400">{link.remotePath}</span> · sincronizado {ago(link.lastSyncAt)}
        </p>
        <div className="flex gap-1.5">
          <button onClick={() => openSync('pull')} disabled={!!busy}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors disabled:opacity-50 ${remoteChanged ? 'bg-brand-600/30 text-brand-200 border-brand-500/50' : 'text-slate-300 border-slate-700 hover:bg-slate-800'}`}>
            {busy === 'pull' ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>}
            Trazer alterações{remoteChanged ? ` (${remoteChanged})` : ''}
          </button>
          <button onClick={() => openSync('push')} disabled={!!busy}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors disabled:opacity-50">
            {busy === 'push' ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
            Enviar alterações
          </button>
        </div>
      </div>
      {message}
      {sync ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-2 pb-1 shrink-0">
            <p className="text-xs font-semibold text-slate-200">
              {sync.dir === 'pull' ? 'Trazer da VPS para o PC' : 'Enviar do PC para a VPS'} — {sync.changes.length} arquivo(s)
            </p>
            {sync.changes.some(c => c.conflict) && (
              <p className="mt-1 text-[10px] text-amber-300 flex gap-1">
                <AlertTriangle size={11} className="shrink-0 mt-px"/>
                Arquivos em conflito mudaram nos dois lados e começam desmarcados. Marcar substitui a versão {sync.dir === 'pull' ? 'do PC pela da VPS' : 'da VPS pela do PC'}.
              </p>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
            {sync.changes.map(c => {
              const b = KIND_BADGE[c.kind]
              return (
                <li key={c.path}>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-slate-800/60 rounded px-1 py-0.5">
                    <input type="checkbox" checked={sync.selected.has(c.path)} onChange={() => toggle(c.path)}/>
                    <span className={`font-mono font-bold w-3 ${b.cls}`} title={b.label}>{b.letter}</span>
                    <span className="font-mono text-slate-300 truncate flex-1" title={c.path}>{c.path}</span>
                    {c.conflict && <span className="text-[9px] px-1 rounded bg-amber-900/40 text-amber-300 shrink-0">conflito</span>}
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2 px-3 py-2 border-t border-slate-800 shrink-0">
            <button onClick={() => setSync(null)} disabled={!!busy} className="btn-secondary flex-1 text-xs py-1">Cancelar</button>
            <button onClick={applySync} disabled={!!busy || sync.selected.size === 0}
              className="btn-primary flex-1 text-xs py-1 flex items-center justify-center gap-1 disabled:opacity-50">
              {busy && <Loader2 size={12} className="animate-spin"/>}
              {sync.dir === 'pull' ? 'Trazer' : 'Enviar'} {sync.selected.size}
            </button>
          </div>
        </div>
      ) : (
        <HermesAgentPanel key={link.projectId} compact vpsId={link.vpsId} initialProjectId={link.projectId}/>
      )}
    </>
  )
}
