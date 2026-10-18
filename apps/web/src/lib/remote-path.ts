/**
 * Caminho remoto vindo da URL (`?path=` / `?cwd=`), usado para abrir IDE, Explorer e Terminal
 * direto na pasta de um projeto. Só aceita caminho absoluto, sem `..`, aspas ou caracteres de
 * controle — no Terminal ele vira um `cd '<path>'`, então nada que quebre a citação passa.
 */
export function safeRemotePath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const p = raw.trim().replace(/\/+$/, '') || '/'
  if (!p.startsWith('/')) return null
  if (p.split('/').includes('..')) return null
  if (!/^[A-Za-z0-9_./@+~ -]+$/.test(p)) return null
  return p
}
