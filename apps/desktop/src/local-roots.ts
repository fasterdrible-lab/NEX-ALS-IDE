import path from 'node:path'

/**
 * Pastas do PC que a tela pode tocar pelos canais `local:*` (e terminal/git local). Sem isto o
 * renderer lia, gravava e apagava qualquer caminho absoluto do PC (Project First, Fase 4).
 *
 * Entram: pasta aberta em janela própria (inclusive as reabertas no início), as recentes, a escolhida
 * no diálogo "Abrir pasta" e a `localPath` de qualquer projeto cadastrado (lida do banco quando o
 * caminho não bate com as já conhecidas — projeto criado/ligado agora vale sem reiniciar).
 * Caminho aceito: absoluto, sem `..`, sem caractere nulo e dentro de uma dessas pastas.
 * Limite consciente: não segue atalhos/junções (comparação pelo texto do caminho).
 */

const roots = new Map<string, string>()
let projectRoots: () => Promise<string[]> = async () => []

const key = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p)

export function allowLocalRoot(dir: string | null | undefined): void {
  if (!dir || typeof dir !== 'string' || !path.isAbsolute(dir)) return
  const resolved = path.resolve(dir)
  roots.set(key(resolved), resolved)
}

/** Fonte das pastas dos projetos cadastrados (o banco); consultada só quando o caminho não bate. */
export function setProjectRootsProvider(fn: () => Promise<string[]>): void {
  projectRoots = fn
}

function rootOf(resolved: string): string | null {
  const k = key(resolved)
  for (const [rk, r] of roots) {
    if (k === rk || k.startsWith(rk.endsWith(path.sep) ? rk : rk + path.sep)) return r
  }
  return null
}

/**
 * Devolve o caminho resolvido ou lança "Caminho fora das pastas abertas". `notRoot`: a operação não
 * pode ser na própria pasta raiz (apagar/renomear o projeto inteiro pela árvore).
 */
export async function checkLocalPath(p: unknown, opts: { notRoot?: boolean } = {}): Promise<string> {
  if (typeof p !== 'string' || !p || p.length > 4096 || p.includes('\0')) throw new Error('Caminho inválido')
  if (!path.isAbsolute(p)) throw new Error('Caminho inválido (precisa ser absoluto)')
  if (p.split(/[\\/]+/).includes('..')) throw new Error('Caminho inválido (".." não é aceito)')
  const resolved = path.resolve(p)
  let root = rootOf(resolved)
  if (!root) {
    for (const r of await projectRoots().catch(() => [] as string[])) allowLocalRoot(r)
    root = rootOf(resolved)
  }
  if (!root) {
    console.warn('[local-roots] recusado fora das pastas abertas:', resolved)
    throw new Error('Caminho fora das pastas abertas no Zeus')
  }
  if (opts.notRoot && roots.has(key(resolved))) throw new Error('A pasta do projeto não pode ser apagada ou renomeada por aqui')
  return resolved
}
