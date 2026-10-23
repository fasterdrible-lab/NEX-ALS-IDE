import { ipc } from './ipc'

/** Mesmo critério do main (`isUnderRemotePath` do @cwm/config, que não entra no bundle da tela). */
export function productionFor(p: string, prodPaths: { projectName: string; remotePath: string }[]): string | null {
  const norm = (s: string) => {
    const out: string[] = []
    for (const seg of s.split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg) }
    return '/' + out.join('/')
  }
  if (!prodPaths.length) return null
  if (!p.startsWith('/')) return prodPaths[0].projectName
  const a = norm(p)
  const hit = prodPaths.find(t => { const r = norm(t.remotePath); return a === r || a.startsWith(r + '/') })
  return hit?.projectName ?? null
}

/**
 * Terminal SSH numa VPS que hospeda produção (Project First, Fase 4b): o main só abre com a confirmação
 * explícita; aqui a pergunta é feita uma vez. `production` volta preenchido para a tela mostrar a faixa vermelha.
 */
export async function openTerminalGuarded(vpsId: string) {
  const first = await ipc.terminal.open(vpsId)
  if (!first.needsProductionConfirm) return first
  const names = (first.production ?? []).join(', ')
  const ok = window.confirm(
    `Esta VPS hospeda PRODUÇÃO (${names}).\n\n` +
    'Comandos aqui afetam o sistema em uso. Para publicar uma versão nova, use o deploy na página do projeto (Ambientes).\n\n' +
    'Abrir o terminal mesmo assim?',
  )
  if (!ok) return { success: false, sessionId: '', error: 'Terminal de produção não aberto', production: first.production }
  return ipc.terminal.open(vpsId, true)
}
