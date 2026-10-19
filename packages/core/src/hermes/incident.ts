/**
 * FASE 7 — incidentes de VPS diagnosticados pelo Hermes (ETAPAS 31/32). Módulo puro (sem SSH nem
 * banco): prompt de diagnóstico, leitura do JSON devolvido e a trava de reparos destrutivos.
 *
 * "Auto-repair seguro" aqui significa: o Hermes só investiga (leitura) e SUGERE ações; cada ação
 * só roda com confirmação do usuário, o comando vem do diagnóstico guardado no main (nunca da
 * tela) e o que é destrutivo/irreversível é recusado sempre (isForbiddenRepair).
 */

export type IncidentType = 'disk' | 'cpu' | 'ram' | 'manual'
export type IncidentStatus = 'open' | 'diagnosing' | 'diagnosed' | 'diagnosis_failed' | 'resolved'
export type IncidentSeverity = 'ok' | 'degraded' | 'critical'
export type RepairRisk = 'low' | 'medium' | 'high'

export interface RepairAction {
  title: string
  command: string
  risk: RepairRisk
  why: string
  /** false = recusado pela trava (isForbiddenRepair) — aparece, mas não pode ser executado. */
  allowed: boolean
  /** Preenchido quando o usuário confirma e o NEX executa. */
  executed?: { at: number; success: boolean; output: string }
}

export interface IncidentDiagnosis {
  parsed: boolean
  status: IncidentSeverity
  summary: string
  rootCause: string
  evidence: string[]
  actions: RepairAction[]
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const TYPE_LABEL: Record<IncidentType, string> = {
  disk: 'disco quase cheio', cpu: 'CPU alta', ram: 'memória (RAM) alta', manual: 'investigação manual',
}

export function buildIncidentPrompt(i: { vpsName: string; type: IncidentType; value: number; threshold: number }): string {
  const alert = i.type === 'manual'
    ? 'O usuário abriu o Incident Mode e pediu um diagnóstico geral do servidor.'
    : `Alerta: ${TYPE_LABEL[i.type]} — ${i.value}% (limite ${i.threshold}%).`
  return [
    `DIAGNÓSTICO DE INCIDENTE no servidor "${i.vpsName}". ${alert}`,
    '',
    'Regras (obrigatórias):',
    '- SOMENTE LEITURA: não altere, apague, reinicie, pare, instale nem limpe nada. Não delegue a outro agente.',
    '- Use comandos de inspeção: df -h, du -xh --max-depth=1 <dir> | sort -h | tail, free -m, uptime, ps aux --sort=-%cpu | head,',
    '  ps aux --sort=-%mem | head, docker ps -a, docker system df, journalctl -p err -n 50 --no-pager, systemctl --failed,',
    '  ls -lh de logs grandes em /var/log. Seja objetivo: poucos comandos, focados no alerta.',
    '- Depois, sugira ações de correção (o usuário decide e executa). Prefira ações reversíveis e específicas',
    '  (ex.: limpar um cache conhecido, rotacionar um log, reiniciar UM serviço identificado). Nunca sugira rm -rf amplo,',
    '  formatar, desligar o servidor, mexer em firewall ou apagar volumes/bancos.',
    '',
    'Responda APENAS com um bloco ```json neste formato, sem texto antes ou depois, com todos os textos em português:',
    '{"status":"ok|degraded|critical","summary":"o que está acontecendo, 1-3 frases",',
    ' "rootCause":"causa mais provável","evidence":["fato observado com número", "..."],',
    ' "actions":[{"title":"...","command":"um comando shell","risk":"low|medium|high","why":"por que resolve e o que pode afetar"}]}',
  ].join('\n')
}

export function parseDiagnosis(text: string): IncidentDiagnosis {
  const empty: IncidentDiagnosis = { parsed: false, status: 'degraded', summary: text.trim().slice(0, 1500), rootCause: '', evidence: [], actions: [] }
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : (text.match(/\{[\s\S]*\}/)?.[0] ?? null)
  if (!raw) return empty
  let o: Record<string, unknown>
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return empty
    o = v as Record<string, unknown>
  } catch { return empty }
  const status = (['ok', 'degraded', 'critical'] as const).find(s => s === o['status']) ?? 'degraded'
  const evidence = (Array.isArray(o['evidence']) ? o['evidence'] : []).map(e => str(e, 400)).filter(Boolean).slice(0, 20)
  const actions = (Array.isArray(o['actions']) ? o['actions'] : [])
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map(a => {
      const command = str(a['command'], 500)
      const risk = (['low', 'medium', 'high'] as const).find(r => r === a['risk']) ?? 'high'
      return { title: str(a['title'], 200) || command, command, risk, why: str(a['why'], 800), allowed: !!command && !isForbiddenRepair(command) }
    })
    .slice(0, 10)
  return { parsed: true, status, summary: str(o['summary'], 1500), rootCause: str(o['rootCause'], 1000), evidence, actions }
}

// Recusado sempre, mesmo com confirmação: apaga em massa, formata, derruba o servidor, mexe em
// firewall/usuários, apaga volumes/bancos ou baixa e executa código. Mesma linha da deny list do
// managed-settings do Claude Code na VPS (v3.59.0).
const FORBIDDEN: RegExp[] = [
  /\brm\s+(?:-[a-z]*[rf][a-z]*\s+)+(?:\/|~|\*|\.\s*$|\/\*|\$HOME)(?:\s|$)/i,  // rm -rf / ~ * .
  /\brm\s+(?:-[a-z]*r[a-z]*\s+)+\/(?:etc|usr|bin|sbin|lib|boot|var|home|root|opt|srv)(?:\/?\s|\/?$)/i,
  /\bmkfs\b|\bwipefs\b|\bfdisk\b|\bparted\b|\bdd\s+[^|]*\bof=\/dev\//i,
  /\b(?:shutdown|reboot|halt|poweroff|init\s+[06])\b/i,
  /\b(?:iptables|ip6tables|nft|ufw|firewall-cmd)\b/i,
  /\b(?:userdel|usermod|passwd|chpasswd|visudo)\b/i,
  /\bchmod\s+(?:-R\s+)?[0-7]*777\s+\/|\bchown\s+-R\s+\S+\s+\/(?:\s|$)/i,
  /\bdocker\s+(?:system|volume)\s+prune\b[^|]*(?:--volumes|-a\b|--all)|\bdocker\s+volume\s+rm\b|\bdocker\s+compose\s+down\b[^|]*-v\b/i,
  /\b(?:dropdb|DROP\s+(?:DATABASE|TABLE|SCHEMA))\b/i,
  /\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/i,
  /\bgit\s+(?:reset\s+--hard|clean\s+-[a-z]*f|push\s+[^|]*--force)/i,
  /\bkill\s+-9\s+1\b|\bkillall\b|\bpkill\s+-9\b/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,  // fork bomb
  />\s*\/dev\/sd[a-z]/i,
]

export function isForbiddenRepair(cmd: string): boolean {
  const c = cmd.trim()
  if (!c) return true
  return FORBIDDEN.some(r => r.test(c))
}
