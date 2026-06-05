import React, { useState } from 'react'
import { Activity, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { ipc } from '../lib/ipc'
import type { DiagnosticResults, DiagnosticItem } from '@cwm/config'

export default function Diagnostics() {
  const [results, setResults] = useState<DiagnosticResults | null>(null)
  const [running, setRunning] = useState(false)
  const [ran, setRan] = useState(false)

  const runDiagnostics = async () => {
    setRunning(true)
    try {
      const data = await ipc.diagnostics.run()
      setResults(data)
      setRan(true)
    } catch (e) {
      console.error(e)
    } finally {
      setRunning(false)
    }
  }

  const allOk = results && Object.values(results).every(r => (r as DiagnosticItem).status === 'ok')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Diagnóstico</h1>
          <p className="text-slate-400 mt-1">Verifique se todas as ferramentas necessárias estão disponíveis</p>
        </div>
        <button onClick={runDiagnostics} disabled={running} className="btn-primary">
          {running
            ? <><Loader2 size={15} className="animate-spin" /> Verificando...</>
            : <><RefreshCw size={15} /> {ran ? 'Verificar novamente' : 'Iniciar diagnóstico'}</>
          }
        </button>
      </div>

      {!ran && !running && (
        <div className="card text-center py-16">
          <Activity size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 mb-2">Clique em "Iniciar diagnóstico" para verificar o ambiente</p>
          <p className="text-xs text-slate-600">Verifica: VS Code, VS Code Insiders, SSH, Git, Node.js</p>
        </div>
      )}

      {running && (
        <div className="card text-center py-12">
          <Loader2 size={32} className="mx-auto text-brand-400 mb-3 animate-spin" />
          <p className="text-slate-400">Verificando ferramentas...</p>
        </div>
      )}

      {results && !running && (
        <>
          {allOk ? (
            <div className="card mb-6 flex items-center gap-3 border-emerald-800/40 bg-emerald-950/20">
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300 font-medium">Ambiente configurado corretamente — tudo pronto!</p>
            </div>
          ) : (
            <div className="card mb-6 flex items-center gap-3 border-yellow-800/40 bg-yellow-950/20">
              <AlertCircle size={18} className="text-yellow-400 shrink-0" />
              <p className="text-sm text-yellow-300">Algumas ferramentas não foram encontradas. Veja os detalhes abaixo.</p>
            </div>
          )}

          <div className="grid gap-3">
            {(Object.entries(results) as [string, DiagnosticItem][]).map(([key, item]) => (
              <DiagnosticRow key={key} item={item} />
            ))}
          </div>

          <div className="mt-8 card">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Como corrigir problemas</p>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><span className="text-slate-300">VS Code não encontrado:</span> Instale VS Code ou configure o caminho em Configurações → "Caminho do VS Code"</li>
              <li><span className="text-slate-300">SSH não encontrado (Windows):</span> Ative o OpenSSH em Configurações do Windows → Apps → Recursos opcionais → OpenSSH Client</li>
              <li><span className="text-slate-300">Git não encontrado:</span> Instale Git em git-scm.com (Git Bash também fornece SSH)</li>
              <li><span className="text-slate-300">Node.js não encontrado:</span> Instale Node.js 22 LTS em nodejs.org</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function DiagnosticRow({ item }: { item: DiagnosticItem }) {
  const iconMap: Record<string, React.ReactElement> = {
    ok: <CheckCircle size={16} className="text-emerald-400" />,
    error: <XCircle size={16} className="text-red-400" />,
    warning: <AlertCircle size={16} className="text-yellow-400" />,
  }

  return (
    <div className="card flex items-center gap-4">
      <div className="shrink-0">{iconMap[item.status]}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-100 text-sm">{item.label}</span>
          {item.version && (
            <span className="text-xs text-slate-500 font-mono">{item.version}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{item.message}</p>
      </div>
      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
        item.status === 'ok' ? 'bg-emerald-900/40 text-emerald-400'
        : item.status === 'error' ? 'bg-red-900/40 text-red-400'
        : 'bg-yellow-900/40 text-yellow-400'
      }`}>
        {item.status === 'ok' ? 'OK' : item.status === 'error' ? 'Não encontrado' : 'Aviso'}
      </span>
    </div>
  )
}
