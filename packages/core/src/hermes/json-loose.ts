/**
 * Extrai o objeto JSON de uma resposta do Hermes (bloco ```json, ou o primeiro {...}) tolerando os
 * deslizes mais comuns do modelo gratuito — visto na VPS-1: `"…reinicição"),"Load…"` (parêntese
 * sobrando depois de uma string) e vírgula antes de ] ou }. Só tenta consertar se o JSON original
 * falhar; o que não for consertável devolve o erro para o chamador pedir a resposta de novo.
 */
export function extractJsonObject(text: string): { value: Record<string, unknown> } | { error: string } {
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : (text.match(/\{[\s\S]*\}/)?.[0] ?? null)
  if (!raw) return { error: 'nenhum JSON na resposta' }
  let firstError = ''
  for (const candidate of [raw, repairJson(raw)]) {
    try {
      const v: unknown = JSON.parse(candidate)
      if (v && typeof v === 'object' && !Array.isArray(v)) return { value: v as Record<string, unknown> }
      return { error: 'o JSON não é um objeto' }
    } catch (e) {
      if (!firstError) firstError = e instanceof Error ? e.message : String(e)
    }
  }
  return { error: firstError }
}

export function repairJson(raw: string): string {
  return raw
    .replace(/"\s*\)+(?=\s*[,\]}])/g, '"')   // "texto"),  →  "texto",
    .replace(/,\s*([\]}])/g, '$1')            // [a, b,]    →  [a, b]
}
