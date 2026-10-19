import { describe, it, expect } from 'vitest'
import { extractJsonObject } from './json-loose'
import { parseDiagnosis } from './incident'
import { parseReview } from './delivery'

describe('extractJsonObject', () => {
  it('lê JSON válido dentro de ```json com texto em volta', () => {
    expect(extractJsonObject('ok\n```json\n{"a":1}\n```\nfim')).toEqual({ value: { a: 1 } })
  })
  it('conserta o parêntese sobrando depois de string (visto na VPS-1)', () => {
    const r = extractJsonObject('```json\n{"evidence":["Uptime de 207 dias (sem reinicição"),"Load 0.14"]}\n```')
    expect(r).toEqual({ value: { evidence: ['Uptime de 207 dias (sem reinicição', 'Load 0.14'] } })
  })
  it('conserta vírgula sobrando antes de ] ou }', () => {
    expect(extractJsonObject('{"a":[1,2,],"b":3,}')).toEqual({ value: { a: [1, 2], b: 3 } })
  })
  it('irreparável ou ausente → erro com o motivo', () => {
    expect('error' in extractJsonObject('{"a": [1 2]}')).toBe(true)
    expect(extractJsonObject('sem json aqui')).toEqual({ error: 'nenhum JSON na resposta' })
  })
})

describe('parsers usam a leitura tolerante', () => {
  it('parseDiagnosis lê o JSON com o defeito real e expõe parseError quando não dá', () => {
    expect(parseDiagnosis('```json\n{"status":"degraded","summary":"s","evidence":["a"),"b"],"actions":[]}\n```').parsed).toBe(true)
    const bad = parseDiagnosis('```json\n{"status": oops}\n```')
    expect(bad.parsed).toBe(false)
    expect(bad.parseError).toBeTruthy()
  })
  it('diagnóstico sem o campo "actions" é incompleto; "actions": [] não', () => {
    const sem = parseDiagnosis('{"status":"degraded","summary":"s","evidence":["a"]}')
    expect([sem.parsed, sem.incomplete]).toEqual([true, true])
    expect(sem.evidence).toEqual(['a'])
    expect(parseDiagnosis('{"status":"ok","summary":"s","actions":[]}').incomplete).toBeUndefined()
  })
  it('parseReview também', () => {
    expect(parseReview('{"build":{"result":"passed"},"findings":[],}').parsed).toBe(true)
  })
})
