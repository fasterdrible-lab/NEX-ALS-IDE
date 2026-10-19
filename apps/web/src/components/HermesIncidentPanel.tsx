import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShieldAlert, Stethoscope, CheckCircle2, XCircle, Play, Wrench, AlertTriangle } from 'lucide-react'
import { ipc, type HermesIncident, type HermesRun, type IncidentStatus, type RepairAction } from '../lib/ipc'

/**
 * FASE 7 (ETAPAS 31/32) — incidentes da VPS e diagnóstico do Hermes, dentro do Incident Mode.
 * O diagnóstico roda no main (começa sozinho quando um alerta dispara, se o Hermes está rodando);
 * este painel só mostra e aciona. Reparo: só com confirmação, risco alto exige digitar CONFIRMO,
 * e o comando executado é o do diagnóstico guardado no main — a tela manda só o índice da ação.
 */

const STATUS_LABEL: Record<IncidentStatus, { label: string; cls: string }> = {
  open: { label: 'Aberto', cls: 'text-amber-300 bg-amber-950/40' },
  diagnosing: { label: 'Diagnosticando', cls: 'text-purple-300 bg-purple-950/40' },
  diagnosed: { label: 'Diagnosticado', cls: 'text-sky-300 bg-sky-950/40' },
  diagnosis_failed: { label: 'Diagnóstico falhou', cls: 'text-red-300 bg-red-950/40' },
  resolved: { label: 'Resolvido', cls: 'text-emerald-300 bg-emerald-950/40' },
}
const SEVERITY: Record<'ok' | 'degraded' | 'critical', { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'text-emerald-300' },
  degraded: { label: 'DEGRADADO', cls: 'text-amber-300' },
  critical: { label: 'CRÍTICO', cls: 'text-red-300' },
}
const RISK: Record<RepairAction['risk'], { label: string; cls: string }> = {
  low: { label: 'risco baixo', cls: 'text-emerald-400 bg-emerald-950/40' },
  medium: { label: 'risco médio', cls: 'text-amber-400 bg-amber-950/40' },
  high: { label: 'risco alto', cls: 'text-red-400 bg-red-950/40' },
}

export default function HermesIncidentPanel({ vpsId }: { vpsId: string }) {
  const [incidents, setIncidents] = useState<HermesIncident[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [run, setRun] = useState<HermesRun | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [runningAction, setRunningAction] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await ipc.hermes.incident.list(vpsId)
      setIncidents(list)
      setSelectedId(cur => cur && list.some(i => i.id === cur) ? cur : (list.find(i => i.status !== 'resolved') ?? list[0])?.id ?? null)
    } catch (e) { setMsg(`Erro ao carregar incidentes: ${String(e)}`) }
  }, [vpsId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const unsub = ipc.hermes.incident.onUpdated(e => { if (e.vpsId === vpsId) void load() })
    return () => { try { unsub() } catch { /* ignorar */ } }
  }, [vpsId, load])

  const sel = incidents.find(i => i.id === selectedId) ?? null

  // Diagnóstico em andamento: mostra o fim da saída do Hermes (log da execução, gravado pelo main).
  useEffect(() => {
    setRun(null)
    if (!sel?.runId || sel.status !== 'diagnosing') return
    let cancelled = false
    const runId = sel.runId
    const tick = () => ipc.hermes.runs.get(runId).then(r => { if (!cancelled) setRun(r) }).catch(() => {})
    void tick()
    const t = setInterval(tick, 3000)
    return () => { cancelled = true; clearInterval(t) }
  }, [sel?.runId, sel?.status])

  const diagnose = useCallback(async (incidentId?: string) => {
    setBusy(true); setMsg('')
    try {
      const inc = await ipc.hermes.incident.diagnose(vpsId, incidentId)
      if (inc) setSelectedId(inc.id)
      await load()
    } catch (e) { setMsg(String(e)) }
    setBusy(false)
  }, [vpsId, load])

  const resolve = useCallback(async () => {
    if (!sel) return
    setBusy(true); setMsg('')
    try { await ipc.hermes.incident.resolve(sel.id); await load() } catch (e) { setMsg(String(e)) }
    setBusy(false)
  }, [sel, load])

  const execute = useCallback(async (index: number) => {
    if (!sel) return
    setConfirming(null); setConfirmText(''); setRunningAction(index); setMsg('')
    try { await ipc.hermes.incident.runAction(sel.id, index); await load() } catch (e) { setMsg(String(e)) }
    setRunningAction(null)
  }, [sel, load])

  const d = sel?.diagnosis

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs">
      {/* Incidentes desta VPS */}
      <div className="shrink-0 border-b border-slate-800 px-2 py-1.5 flex items-center gap-1.5">
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value || null)}
          aria-label="Incidente"
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-purple-500"
        >
          {incidents.length === 0 && <option value="">Nenhum incidente registrado</option>}
          {incidents.map(i => (
            <option key={i.id} value={i.id}>
              {new Date(i.createdAt).toLocaleString('pt-BR')} · {i.title} · {STATUS_LABEL[i.status].label}
            </option>
          ))}
        </select>
        <button
          onClick={() => void diagnose()}
          disabled={busy || incidents.some(i => i.status === 'diagnosing')}
          title="Diagnóstico geral do servidor com o Hermes (somente leitura)"
          className="shrink-0 px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-30 text-[10px] flex items-center gap-1"
        >
          <Stethoscope size={11} /> Diagnóstico geral
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {!sel && (
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Quando o monitor detecta disco, CPU ou RAM acima do limite, o incidente aparece aqui e o Hermes começa o
            diagnóstico sozinho (se estiver rodando nesta VPS). Use "Diagnóstico geral" para investigar agora.
          </p>
        )}

        {sel && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${STATUS_LABEL[sel.status].cls}`}>{STATUS_LABEL[sel.status].label}</span>
              <span className="text-slate-300 font-medium">{sel.title}</span>
              {sel.type !== 'manual' && <span className="text-slate-500">{sel.value}% (limite {sel.threshold}%)</span>}
            </div>

            <div className="flex gap-1.5">
              {sel.status !== 'diagnosing' && (
                <button
                  onClick={() => void diagnose(sel.id)}
                  disabled={busy || incidents.some(i => i.status === 'diagnosing')}
                  className="px-2 py-1 rounded bg-purple-800 hover:bg-purple-700 disabled:opacity-30 text-[10px] flex items-center gap-1"
                >
                  <Stethoscope size={10} /> {sel.diagnosis || sel.status === 'diagnosis_failed' ? 'Diagnosticar de novo' : 'Diagnosticar com Hermes'}
                </button>
              )}
              {sel.status !== 'resolved' && sel.status !== 'diagnosing' && (
                <button onClick={() => void resolve()} disabled={busy}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-[10px] flex items-center gap-1">
                  <CheckCircle2 size={10} /> Marcar resolvido
                </button>
              )}
            </div>

            {sel.status === 'diagnosing' && (
              <div className="space-y-1">
                <p className="text-purple-300 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> O Hermes está investigando (somente leitura)…
                  {run && <span className="text-slate-500"> {run.toolCount} comando(s)</span>}
                </p>
                {run?.text && (
                  <pre className="text-[10px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800 rounded p-2 whitespace-pre-wrap max-h-40 overflow-auto">{run.text.slice(-3000)}</pre>
                )}
              </div>
            )}

            {sel.status === 'diagnosis_failed' && <p className="text-red-300 break-words">{sel.failure}</p>}

            {d && (
              <div className="space-y-2">
                <p><span className={`font-bold ${SEVERITY[d.status].cls}`}>{SEVERITY[d.status].label}</span>
                  <span className="text-slate-200"> — {d.summary || '(sem resumo)'}</span></p>
                {!d.parsed && <p className="text-amber-300/90 text-[10px]">O Hermes não respondeu no formato esperado, nem depois de um pedido de correção — acima está o texto bruto. Use "Diagnosticar de novo".</p>}
                {d.parsed && d.incomplete && <p className="text-amber-300/90 text-[10px]">As ações sugeridas não vieram no formato esperado, nem depois de um pedido de correção. Veja a resposta completa em Logs ou use "Diagnosticar de novo".</p>}
                {d.rootCause && <p className="text-slate-300"><span className="text-slate-500">Causa provável:</span> {d.rootCause}</p>}
                {d.evidence.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400">{d.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                )}

                {d.actions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1"><Wrench size={10} /> Ações sugeridas (você decide)</p>
                    {d.actions.map((a, i) => (
                      <div key={i} className="border border-slate-700/60 bg-slate-900/50 rounded p-2 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-200 font-medium">{a.title}</span>
                          <span className={`px-1 rounded text-[8px] font-semibold ${RISK[a.risk].cls}`}>{RISK[a.risk].label}</span>
                        </div>
                        <pre className="text-[10px] font-mono text-slate-100 bg-slate-950 border border-slate-800 rounded px-2 py-1 whitespace-pre-wrap break-all">{a.command}</pre>
                        {a.why && <p className="text-[10px] text-slate-400">{a.why}</p>}

                        {!a.allowed ? (
                          <p className="text-[10px] text-red-300 flex items-center gap-1"><ShieldAlert size={10} /> Recusado pela trava de segurança — comando destrutivo ou irreversível.</p>
                        ) : a.executed ? (
                          <div className="space-y-1">
                            <p className={`text-[10px] flex items-center gap-1 ${a.executed.success ? 'text-emerald-400' : 'text-red-400'}`}>
                              {a.executed.success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                              Executado em {new Date(a.executed.at).toLocaleString('pt-BR')} — {a.executed.success ? 'sucesso' : 'falhou'}
                            </p>
                            <pre className="text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded px-2 py-1 whitespace-pre-wrap max-h-32 overflow-auto">{a.executed.output.slice(-2000)}</pre>
                          </div>
                        ) : confirming === i ? (
                          <div className="space-y-1">
                            <p className="text-[10px] text-amber-300 flex items-center gap-1"><AlertTriangle size={10} />
                              Executar este comando na VPS?{a.risk === 'high' && ' Risco alto: digite CONFIRMO.'}</p>
                            <div className="flex gap-1.5">
                              {a.risk === 'high' && (
                                <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CONFIRMO" aria-label="Digite CONFIRMO"
                                  className="w-28 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:border-red-500" />
                              )}
                              <button onClick={() => void execute(i)} disabled={a.risk === 'high' && confirmText !== 'CONFIRMO'}
                                className="px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 disabled:opacity-30 text-[10px]">Executar</button>
                              <button onClick={() => { setConfirming(null); setConfirmText('') }}
                                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px]">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setConfirming(i); setConfirmText('') }} disabled={runningAction !== null || busy}
                            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-[10px] flex items-center gap-1">
                            {runningAction === i ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} Executar…
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {msg && <p className="text-red-300 text-[10px] break-words">{msg}</p>}
      </div>
    </div>
  )
}
