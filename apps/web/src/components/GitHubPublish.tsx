import { useState } from 'react'
import { Github, Loader2, Lock, Globe } from 'lucide-react'
import { ipc } from '../lib/ipc'

/** Mesma regra de `suggestRepoName` do core: sem acentos, espaços viram hífen. */
function suggest(folder: string): string {
  return folder.normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'projeto'
}

/**
 * Projeto local sem remoto: cria o repositório no GitHub (conta logada no PC) ou liga um existente,
 * e faz o primeiro push. Aparece na aba Git da IDE local.
 */
export default function GitHubPublish({ cwd, folderName, hasCommits, onDone }: {
  cwd: string; folderName: string; hasCommits: boolean; onDone: (ok: boolean, text: string) => void
}) {
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [name, setName] = useState(suggest(folderName))
  const [isPrivate, setIsPrivate] = useState(true)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const publish = async () => {
    setBusy(true); setError('')
    try {
      const r = await ipc.git.local.publish(cwd, mode === 'create' ? { name: name.trim(), isPrivate } : { url: url.trim() })
      onDone(true, `${r.created ? 'Repositório criado e enviado' : 'Enviado'}: ${r.url}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  return (
    <div className="mx-2 my-2 rounded-lg border border-slate-700 bg-slate-800/40 p-2.5 space-y-2 text-xs">
      <p className="font-semibold text-slate-200 flex items-center gap-1.5"><Github size={13} /> Publicar no GitHub</p>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Hoje os commits ficam só no PC. Publicar cria o repositório na sua conta do GitHub (login já salvo no Windows) e envia tudo; depois disso, o <b className="text-slate-400">Push</b> funciona.
      </p>
      {!hasCommits ? (
        <p className="text-[10px] text-amber-300">Faça o primeiro commit antes de publicar.</p>
      ) : (
        <>
          <div className="flex gap-1">
            {(['create', 'link'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 px-2 py-1 rounded text-[10px] border ${mode === m ? 'border-brand-500/50 bg-brand-600/20 text-brand-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                {m === 'create' ? 'Criar repositório' : 'Já tenho o repositório'}
              </button>
            ))}
          </div>
          {mode === 'create' ? (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="nome-do-repositorio"
                className="input w-full text-xs py-1 font-mono" />
              <div className="flex gap-3 text-[11px] text-slate-300">
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} /><Lock size={10} /> Privado</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} /><Globe size={10} /> Público</label>
              </div>
            </>
          ) : (
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/dono/repositorio.git"
              className="input w-full text-xs py-1 font-mono" />
          )}
          {error && <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>}
          <button onClick={() => void publish()} disabled={busy || (mode === 'create' ? !name.trim() : !url.trim())}
            className="btn-primary w-full text-xs py-1 flex items-center justify-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Github size={12} />}
            {busy ? 'Publicando…' : mode === 'create' ? 'Criar no GitHub e enviar' : 'Ligar e enviar'}
          </button>
        </>
      )}
    </div>
  )
}
