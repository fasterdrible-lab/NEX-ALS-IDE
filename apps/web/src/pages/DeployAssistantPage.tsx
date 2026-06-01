import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  X, Rocket, Send, Loader2, Play, SkipForward, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, Globe, ChevronDown, ChevronRight,
  RotateCcw, Terminal,
} from 'lucide-react'
import { ipc } from '../lib/ipc'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Risk = 'low' | 'medium' | 'high'
type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

interface DeployStep {
  id: string
  order: number
  title: string
  cmd: string
  cwd: string | null
  risk: Risk
  status: StepStatus
  output: string
  expanded: boolean
}

interface SmokeResult { code: string; ok: boolean; latencyMs: number }

// ── Parser do plano gerado pela IA ─────────────────────────────────────────

function parsePlan(raw: string, projectPath: string): DeployStep[] {
  // Tenta extrair JSON de um bloco ```json ... ```
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[1]) as Array<{
        order?: number; title: string; cmd: string; cwd?: string | null; risk?: string
      }>
      if (Array.isArray(arr)) {
        return arr.map((s, i) => ({
          id: `step-${i}`,
          order: s.order ?? i + 1,
          title: s.title,
          cmd: s.cmd,
          cwd: s.cwd ?? projectPath,
          risk: (s.risk === 'high' || s.risk === 'medium' ? s.risk : 'low') as Risk,
          status: 'pending',
          output: '',
          expanded: false,
        }))
      }
    } catch { /* fallback para parsing textual */ }
  }

  // Fallback: parsing linha a linha (### Passo N ou **N.**)
  const steps: DeployStep[] = []
  const lines = raw.split('\n')
  let current: Partial<DeployStep> | null = null
  let order = 1

  const flush = () => {
    if (current?.title && current?.cmd) {
      steps.push({
        id: `step-${order}`,
        order,
        title: current.title,
        cmd: current.cmd,
        cwd: current.cwd ?? projectPath,
        risk: (current.risk ?? 'low') as Risk,
        status: 'pending',
        output: '',
        expanded: false,
      })
      order++
    }
    current = null
  }

  for (const line of lines) {
    const stepMatch = line.match(/^(?:#{1,3}\s*)?(?:Passo\s+\d+[:.]\s*|Step\s+\d+[:.]\s*|\d+[.)]\s*)(.+)/i)
    if (stepMatch) { flush(); current = { title: stepMatch[1].trim() }; continue }
    if (!current) continue
    const cmdMatch = line.match(/^\*\*Comando[:\s]*\*\*\s*`?(.+?)`?$/i) ?? line.match(/^`(.+)`$/)
    if (cmdMatch) { current.cmd = cmdMatch[1].trim(); continue }
    const cwdMatch = line.match(/^\*\*Diretório[:\s]*\*\*\s*`?(.+?)`?$/i)
    if (cwdMatch && cwdMatch[1] !== 'N/A') { current.cwd = cwdMatch[1].trim(); continue }
    const riskMatch = line.match(/^\*\*Risco[:\s]*\*\*\s*(.+)/i)
    if (riskMatch) {
      const r = riskMatch[1].toLowerCase()
      current.risk = r.includes('alto') || r.includes('high') ? 'high' : r.includes('médio') || r.includes('medium') ? 'medium' : 'low'
    }
  }
  flush()
  return steps
}

// ── Componente principal ──────────────────────────────────────────────────

export default function DeployAssistantPage() {
  const { vpsId = '', vpsName: encodedName = '' } = useParams()
  const vpsName = decodeURIComponent(encodedName)
  const navigate = useNavigate()

  const [description, setDescription] = useState('')
  const [projectPath, setProjectPath] = useState('/root')
  const [generating, setGenerating] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [streamId, setStreamId] = useState<string | null>(null)
  const [steps, setSteps] = useState<DeployStep[]>([])
  const [execLog, setExecLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState<number | null>(null)
  const [deployDone, setDeployDone] = useState(false)
  const [deployFailed, setDeployFailed] = useState(false)
  const [smokeUrl, setSmokeUrl] = useState('')
  const [smokeResult, setSmokeResult] = useState<SmokeResult | null>(null)
  const [smokeRunning, setSmokeRunning] = useState(false)
  const [rollbackPlan, setRollbackPlan] = useState<DeployStep[]>([])
  const [showRollback, setShowRollback] = useState(false)
  const [rollbackGenerating, setRollbackGenerating] = useState(false)
  const [confirmStep, setConfirmStep] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const appendLog = useCallback((line: string) => {
    setExecLog(l => [...l, line])
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [])

  // ── Gerar plano ──────────────────────────────────────────────────────────

  const generatePlan = async () => {
    if (!description.trim() || generating) return
    setGenerating(true)
    setStreamContent('')
    setSteps([])
    setExecLog([])
    setDeployDone(false)
    setDeployFailed(false)
    setRollbackPlan([])
    setShowRollback(false)

    const systemPrompt = `Você é um Deploy Assistant especialista.
Gere um plano de deploy detalhado em JSON.
Responda APENAS com um bloco de código json contendo um array de passos.
Formato exato de cada passo:
{
  "order": <número>,
  "title": "<título curto>",
  "cmd": "<comando shell completo>",
  "cwd": "<diretório absoluto ou null>",
  "risk": "low" | "medium" | "high"
}
Use risk "high" para: docker stop/rm, pm2 delete, git reset, rm -rf, DROP TABLE.
Use risk "medium" para: docker restart, pm2 restart, git push.
Use risk "low" para todo o resto.
Diretório do projeto: ${projectPath}
VPS: ${vpsName}`

    try {
      const res = await ipc.ai.stream.start({
        messages: [{ role: 'user', content: `Crie um plano de deploy para: ${description}` }],
        systemPrompt,
        maxTokens: 2048,
      })
      setStreamId(res.streamId)

      // Coleta via listener existente — aguarda done
      await new Promise<void>((resolve) => {
        const unsub = ipc.ai.stream.onChunk((chunk) => {
          if (chunk.streamId !== res.streamId) return
          if (chunk.type === 'text_delta' && chunk.delta) setStreamContent(s => s + chunk.delta!)
          if (chunk.type === 'done' || chunk.type === 'error') {
            try { unsub() } catch { /* ignorar */ }
            resolve()
          }
        })
      })
    } catch (e) {
      appendLog(`❌ Erro ao gerar plano: ${String(e)}`)
    }

    setStreamId(null)
    setGenerating(false)
  }

  // Quando streamContent termina, parseia o plano
  const applyStream = useCallback(() => {
    if (!streamContent || generating) return
    const parsed = parsePlan(streamContent, projectPath)
    if (parsed.length) {
      setSteps(parsed)
      setStreamContent('')
    }
  }, [streamContent, generating, projectPath])

  // Aplica o plano assim que a geração termina
  if (!generating && streamContent && steps.length === 0) applyStream()

  // ── Executar passo ───────────────────────────────────────────────────────

  const execStep = useCallback(async (step: DeployStep): Promise<boolean> => {
    setCurrentStep(step.order)
    setSteps(s => s.map(x => x.id === step.id ? { ...x, status: 'running' } : x))

    const fullCmd = step.cwd ? `cd "${step.cwd}" && ${step.cmd}` : step.cmd
    appendLog(`\n[Passo ${step.order}] ${step.title}`)
    appendLog(`$ ${step.cmd}`)

    const timeout = /docker build|npm install|pnpm install|yarn install|gradle|maven/i.test(step.cmd) ? 300000 : 60000

    try {
      const r = await ipc.terminal.exec(vpsId, fullCmd, timeout)
      const out = r.success ? (r.output?.trim() || '(sem output)') : `ERRO: ${r.error}`
      appendLog(out)

      const ok = r.success
      setSteps(s => s.map(x => x.id === step.id
        ? { ...x, status: ok ? 'done' : 'failed', output: out }
        : x
      ))
      return ok
    } catch (e) {
      const msg = `EXCEÇÃO: ${String(e)}`
      appendLog(msg)
      setSteps(s => s.map(x => x.id === step.id ? { ...x, status: 'failed', output: msg } : x))
      return false
    }
  }, [vpsId, appendLog])

  // ── Executar tudo ────────────────────────────────────────────────────────

  const runAll = useCallback(async () => {
    if (running) return
    setRunning(true)
    setDeployDone(false)
    setDeployFailed(false)
    appendLog('═══ Iniciando deploy ═══')

    for (const step of steps) {
      if (step.status === 'done' || step.status === 'skipped') continue

      // Passo de alto risco → pede confirmação
      if (step.risk === 'high') {
        setConfirmStep(step.id)
        const confirmed = await new Promise<boolean>(resolve => {
          const handler = (e: Event) => {
            const { detail } = e as CustomEvent<{ id: string; ok: boolean }>
            if (detail.id === step.id) { document.removeEventListener('deploy-confirm', handler); resolve(detail.ok) }
          }
          document.addEventListener('deploy-confirm', handler)
        })
        setConfirmStep(null)
        if (!confirmed) {
          setSteps(s => s.map(x => x.id === step.id ? { ...x, status: 'skipped' } : x))
          appendLog(`[Passo ${step.order}] PULADO pelo usuário`)
          continue
        }
      }

      const ok = await execStep(step)
      if (!ok) {
        appendLog('\n⚠️ Deploy interrompido por falha. Gerando sugestão de rollback…')
        setDeployFailed(true)
        setRunning(false)
        setCurrentStep(null)
        generateRollback(step)
        return
      }
    }

    appendLog('\n✅ Deploy concluído com sucesso!')
    setDeployDone(true)
    setRunning(false)
    setCurrentStep(null)
  }, [running, steps, execStep, appendLog])

  // ── Executar passo único ─────────────────────────────────────────────────

  const runSingle = useCallback(async (stepId: string) => {
    const step = steps.find(s => s.id === stepId)
    if (!step || running) return
    setRunning(true)
    await execStep(step)
    setRunning(false)
    setCurrentStep(null)
  }, [steps, running, execStep])

  // ── Disparar confirmação via evento DOM ───────────────────────────────────

  const handleConfirm = (id: string, ok: boolean) => {
    document.dispatchEvent(new CustomEvent('deploy-confirm', { detail: { id, ok } }))
  }

  // ── Smoke test ───────────────────────────────────────────────────────────

  const runSmokeTest = async () => {
    if (!smokeUrl || smokeRunning) return
    setSmokeRunning(true)
    setSmokeResult(null)
    const t0 = Date.now()
    try {
      const r = await ipc.terminal.exec(
        vpsId,
        `curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${smokeUrl}"`,
        15000
      )
      const code = r.success ? r.output?.trim() ?? '000' : '000'
      const ok = code.startsWith('2') || code.startsWith('3')
      setSmokeResult({ code, ok, latencyMs: Date.now() - t0 })
    } catch { setSmokeResult({ code: 'ERR', ok: false, latencyMs: Date.now() - t0 }) }
    setSmokeRunning(false)
  }

  // ── Gerar plano de rollback ───────────────────────────────────────────────

  const generateRollback = async (failedStep: DeployStep) => {
    setRollbackGenerating(true)
    const executedSteps = steps
      .filter(s => s.status === 'done')
      .map(s => `- ${s.title}: ${s.cmd}`)
      .join('\n')

    const systemPrompt = `Você é um Deploy Assistant. Gere um plano de rollback em JSON (mesmo formato do plano de deploy).
VPS: ${vpsName} | Diretório: ${projectPath}`
    const userMsg = `O passo "${failedStep.title}" falhou com: ${failedStep.output?.slice(0, 500) ?? 'erro desconhecido'}.\nPassos já executados:\n${executedSteps || 'nenhum'}\nGere o plano de rollback para desfazer o que foi feito.`

    let raw = ''
    try {
      const res = await ipc.ai.stream.start({ messages: [{ role: 'user', content: userMsg }], systemPrompt, maxTokens: 1024 })
      await new Promise<void>((resolve) => {
        const unsub = ipc.ai.stream.onChunk((chunk) => {
          if (chunk.streamId !== res.streamId) return
          if (chunk.type === 'text_delta' && chunk.delta) raw += chunk.delta
          if (chunk.type === 'done' || chunk.type === 'error') { try { unsub() } catch { /* ignorar */ } resolve() }
        })
      })
    } catch { /* silencioso */ }

    const parsed = parsePlan(raw, projectPath)
    setRollbackPlan(parsed)
    setShowRollback(true)
    setRollbackGenerating(false)
  }

  // ── Executar rollback ────────────────────────────────────────────────────

  const runRollback = async () => {
    if (running) return
    setRunning(true)
    appendLog('\n═══ Iniciando rollback ═══')
    for (const step of rollbackPlan) {
      if (step.status === 'done') continue
      await execStep(step)
    }
    appendLog('\n↩ Rollback concluído.')
    setRunning(false)
    setCurrentStep(null)
  }

  // ── Helpers visuais ───────────────────────────────────────────────────────

  const riskBadge = (risk: Risk) => {
    if (risk === 'high')   return <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/40 font-semibold">🔴 ALTO</span>
    if (risk === 'medium') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/40">⚠ MÉDIO</span>
    return <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">baixo</span>
  }

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case 'running': return <Loader2 size={13} className="animate-spin text-blue-400"/>
      case 'done':    return <CheckCircle2 size={13} className="text-emerald-400"/>
      case 'failed':  return <XCircle size={13} className="text-red-400"/>
      case 'skipped': return <SkipForward size={13} className="text-slate-500"/>
      default:        return <div className="w-3 h-3 rounded-full border border-slate-600"/>
    }
  }

  const canRun = steps.length > 0 && !running && !generating
  const doneCount = steps.filter(s => s.status === 'done').length

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Rocket size={15} className="text-emerald-400"/>
          <span className="text-sm font-bold text-slate-100">Deploy Assistant</span>
          <span className="text-slate-600">—</span>
          <span className="text-slate-300 text-sm">{vpsName}</span>
        </div>
        <div className="flex items-center gap-2">
          {steps.length > 0 && (
            <span className="text-[11px] text-slate-500">{doneCount}/{steps.length} passos</span>
          )}
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-100">
            <X size={13}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-[1fr_400px]">

        {/* ═══ COLUNA ESQUERDA — plano + log ═══ */}
        <div className="flex flex-col overflow-hidden border-r border-slate-800">

          {/* Formulário de descrição */}
          <div className="p-4 border-b border-slate-800 space-y-3 shrink-0">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wide mb-1 block">Descreva o deploy</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) generatePlan() }}
                placeholder="Ex: fazer deploy da v2.1.0 — git pull, pnpm build, docker restart api-prod…"
                rows={2}
                disabled={generating || running}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-600 resize-none disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-slate-500 mb-1 block">Diretório do projeto</label>
                <input
                  value={projectPath}
                  onChange={e => setProjectPath(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-slate-500 font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={generatePlan}
                  disabled={!description.trim() || generating || running}
                  className="flex items-center gap-2 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  {generating ? <><Loader2 size={13} className="animate-spin"/> Gerando…</> : <><Send size={13}/> Gerar Plano</>}
                </button>
              </div>
            </div>
          </div>

          {/* Streaming da geração */}
          {generating && streamContent && (
            <div className="mx-4 my-2 p-3 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto shrink-0">
              {streamContent}<span className="animate-pulse text-emerald-400">▌</span>
            </div>
          )}

          {/* Plano de passos */}
          {steps.length > 0 && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-200">Plano de Deploy — {steps.length} passos</h2>
                <div className="flex gap-2">
                  <button
                    onClick={runAll}
                    disabled={!canRun}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Play size={11}/> Executar Tudo
                  </button>
                  <button
                    onClick={() => setSteps(s => s.map(x => ({ ...x, status: 'pending', output: '' })))}
                    disabled={running || generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-xs"
                    title="Resetar status de todos os passos"
                  >
                    <RefreshCw size={11}/>
                  </button>
                </div>
              </div>

              {steps.map(step => (
                <div key={step.id} className={`border rounded-xl overflow-hidden transition-all ${
                  step.status === 'running'  ? 'border-blue-700/50 bg-blue-950/20' :
                  step.status === 'done'     ? 'border-emerald-800/40 bg-emerald-950/10' :
                  step.status === 'failed'   ? 'border-red-800/50 bg-red-950/20' :
                  step.status === 'skipped'  ? 'border-slate-800 opacity-50' :
                  'border-slate-800 bg-slate-900/30'
                }`}>
                  {/* Step header */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="shrink-0">{statusIcon(step.status)}</span>
                    <span className="text-[11px] text-slate-500 shrink-0 w-5 text-right">{step.order}.</span>
                    <span className="text-sm font-medium text-slate-200 flex-1">{step.title}</span>
                    {riskBadge(step.risk)}
                    <button
                      onClick={() => setSteps(s => s.map(x => x.id === step.id ? { ...x, expanded: !x.expanded } : x))}
                      className="p-0.5 text-slate-600 hover:text-slate-300"
                    >
                      {step.expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </button>
                    {step.status === 'pending' && (
                      <button
                        onClick={() => runSingle(step.id)}
                        disabled={running}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded transition-colors"
                      >
                        <Play size={9}/> Executar
                      </button>
                    )}
                  </div>

                  {/* Comando (sempre visível) */}
                  <div className="px-3 pb-2">
                    <code className="text-[10px] font-mono text-emerald-400/80 bg-slate-900/60 px-2 py-0.5 rounded">
                      {step.cwd ? `${step.cwd} $ ` : '$ '}{step.cmd}
                    </code>
                  </div>

                  {/* Output expansível */}
                  {step.expanded && step.output && (
                    <pre className="mx-3 mb-2 p-2 bg-slate-900 rounded text-[10px] font-mono text-slate-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {step.output}
                    </pre>
                  )}
                </div>
              ))}

              {/* Rollback */}
              {showRollback && (
                <div className="mt-4 border border-amber-800/50 bg-amber-950/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <RotateCcw size={13} className="text-amber-400"/>
                      <span className="text-sm font-semibold text-amber-300">Plano de Rollback</span>
                    </div>
                    <button
                      onClick={runRollback}
                      disabled={running || rollbackPlan.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700/60 hover:bg-amber-700 disabled:opacity-40 rounded-lg text-xs font-medium"
                    >
                      <RotateCcw size={11}/> Executar Rollback
                    </button>
                  </div>
                  {rollbackGenerating ? (
                    <div className="flex items-center gap-2 text-xs text-amber-500"><Loader2 size={11} className="animate-spin"/> Gerando rollback…</div>
                  ) : rollbackPlan.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum passo de rollback necessário.</p>
                  ) : (
                    <div className="space-y-1">
                      {rollbackPlan.map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-xs">
                          <span>{statusIcon(s.status)}</span>
                          <span className="text-slate-300">{s.order}. {s.title}</span>
                          <code className="text-[10px] font-mono text-amber-400/70 ml-1">{s.cmd}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {steps.length === 0 && !generating && (
            <div className="flex-1 flex items-center justify-center text-slate-600">
              <div className="text-center space-y-2">
                <Rocket size={32} className="mx-auto"/>
                <p className="text-sm">Descreva o deploy e clique em <strong>Gerar Plano</strong></p>
              </div>
            </div>
          )}
        </div>

        {/* ═══ COLUNA DIREITA — log + smoke test ═══ */}
        <div className="flex flex-col overflow-hidden">

          {/* Log de execução */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/40 shrink-0">
              <Terminal size={11} className="text-slate-500"/>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Log de execução</span>
              {running && <Loader2 size={10} className="animate-spin text-blue-400 ml-auto"/>}
              {deployDone && <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10}/> Sucesso</span>}
              {deployFailed && <span className="ml-auto text-[10px] text-red-400 flex items-center gap-1"><XCircle size={10}/> Falhou</span>}
            </div>
            <pre className="flex-1 overflow-y-auto p-3 text-[10px] font-mono text-slate-400 whitespace-pre-wrap bg-slate-900/30">
              {execLog.length === 0 ? <span className="text-slate-700">Aguardando execução…</span> : execLog.join('\n')}
              <div ref={logEndRef}/>
            </pre>
          </div>

          {/* Smoke test */}
          <div className="border-t border-slate-800 p-3 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <Globe size={11} className="text-slate-500"/>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Smoke Test</span>
            </div>
            <div className="flex gap-2">
              <input
                value={smokeUrl}
                onChange={e => setSmokeUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSmokeTest()}
                placeholder="https://api.exemplo.com/health"
                className="flex-1 text-[11px] bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 font-mono"
              />
              <button
                onClick={runSmokeTest}
                disabled={!smokeUrl || smokeRunning}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded text-xs flex items-center gap-1"
              >
                {smokeRunning ? <Loader2 size={10} className="animate-spin"/> : <Play size={10}/>}
              </button>
            </div>
            {smokeResult && (
              <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${
                smokeResult.ok ? 'bg-emerald-950/30 border border-emerald-800/40 text-emerald-300' : 'bg-red-950/30 border border-red-800/40 text-red-300'
              }`}>
                {smokeResult.ok ? <CheckCircle2 size={11}/> : <XCircle size={11}/>}
                <span>HTTP {smokeResult.code}</span>
                <span className="text-slate-500">{smokeResult.latencyMs}ms</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MODAL DE CONFIRMAÇÃO (passo alto risco) ═══ */}
      {confirmStep && (() => {
        const step = steps.find(s => s.id === confirmStep)
        if (!step) return null
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-red-800/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={20} className="text-red-400 shrink-0"/>
                <h3 className="text-base font-bold text-slate-100">Ação de alto risco</h3>
              </div>
              <p className="text-sm text-slate-300 mb-2">{step.title}</p>
              <code className="block text-xs font-mono bg-slate-800 text-red-300 px-3 py-2 rounded-lg mb-4">{step.cmd}</code>
              <p className="text-xs text-slate-500 mb-5">Esta ação pode ser irreversível ou afetar o ambiente de produção.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => handleConfirm(step.id, false)} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">
                  Pular passo
                </button>
                <button onClick={() => handleConfirm(step.id, true)} className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-medium">
                  Confirmar execução
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
