import { describe, it, expect } from 'vitest'
import { diffSides, isSafeRelPath, isSyncExcluded, parseSha1sumOutput, validatePublishPath } from './local-sync'

const H = (c: string) => c.repeat(40)

describe('diffSides', () => {
  it('sem mudança nos dois lados → nada', () => {
    expect(diffSides({ a: H('1') }, { a: H('1') }, { a: H('1') })).toEqual({ pull: [], push: [], settled: {} })
  })
  it('mudou só na VPS → pull (adicionado, modificado, apagado)', () => {
    const d = diffSides({ m: H('1'), x: H('2') }, { m: H('1'), x: H('2') }, { m: H('3'), n: H('4') })
    expect(d.pull).toEqual([
      { path: 'm', kind: 'modified', conflict: false },
      { path: 'n', kind: 'added', conflict: false },
      { path: 'x', kind: 'deleted', conflict: false },
    ])
    expect(d.push).toEqual([])
  })
  it('mudou só no PC → push', () => {
    const d = diffSides({ m: H('1') }, { m: H('2'), n: H('3') }, { m: H('1') })
    expect(d.push).toEqual([
      { path: 'm', kind: 'modified', conflict: false },
      { path: 'n', kind: 'added', conflict: false },
    ])
    expect(d.pull).toEqual([])
  })
  it('mudou diferente nos dois → conflito nas duas listas', () => {
    const d = diffSides({ m: H('1') }, { m: H('2') }, { m: H('3') })
    expect(d.pull).toEqual([{ path: 'm', kind: 'modified', conflict: true }])
    expect(d.push).toEqual([{ path: 'm', kind: 'modified', conflict: true }])
  })
  it('apagado no PC e modificado na VPS → conflito: pull recria, push apaga', () => {
    const d = diffSides({ m: H('1') }, {}, { m: H('3') })
    expect(d.pull).toEqual([{ path: 'm', kind: 'added', conflict: true }])
    expect(d.push).toEqual([{ path: 'm', kind: 'deleted', conflict: true }])
  })
  it('mudou igual nos dois → só atualiza a base', () => {
    const d = diffSides({ m: H('1'), g: H('2') }, { m: H('5'), n: H('6') }, { m: H('5'), n: H('6') })
    expect(d.pull).toEqual([])
    expect(d.push).toEqual([])
    expect(d.settled).toEqual({ g: null, m: H('5'), n: H('6') })
  })
})

describe('validatePublishPath', () => {
  it('aceita subpasta comum', () => {
    expect(validatePublishPath('/root/meu-projeto')).toBeNull()
    expect(validatePublishPath('/var/www/site_2.0/')).toBeNull()
  })
  it('recusa pasta de sistema, relativo, .., espaço e metacaracteres', () => {
    for (const p of ['/', '/root', '/var', '/etc/', 'root/x', '/root/../etc', '/root/meu projeto', "/root/x';rm", '/root/$(id)', '/root/ação']) {
      expect(validatePublishPath(p), p).not.toBeNull()
    }
  })
})

describe('isSafeRelPath', () => {
  it('aceita caminho relativo normal', () => {
    expect(isSafeRelPath('src/app/page.tsx')).toBe(true)
    expect(isSafeRelPath('.env.example')).toBe(true)
  })
  it('recusa fuga da pasta e nomes inválidos no Windows', () => {
    for (const p of ['../x', 'a/../../x', '/etc/passwd', 'a\\b', 'c:x', 'a/b?', 'a/con.', 'a//b', '']) {
      expect(isSafeRelPath(p), p).toBe(false)
    }
  })
})

describe('isSyncExcluded / parseSha1sumOutput', () => {
  it('pastas geradas, .git e .hermes.md ficam fora', () => {
    expect(isSyncExcluded('node_modules/x/i.js')).toBe(true)
    expect(isSyncExcluded('apps/web/dist/b.js')).toBe(true)
    expect(isSyncExcluded('.git/HEAD')).toBe(true)
    expect(isSyncExcluded('.hermes.md')).toBe(true)
    expect(isSyncExcluded('docs/.hermes.md')).toBe(false)
    expect(isSyncExcluded('build/icon.png')).toBe(false)
  })
  it('lê a saída do sha1sum e ignora linhas escapadas e excluídas', () => {
    const out = [
      `${H('a')}  ./src/a.ts`,
      `${H('b')}  ./com espaço.txt`,
      `\\${H('c')}  ./nome\\nquebrado`,
      `${H('d')}  ./.hermes.md`,
      'NEX_DONE',
    ].join('\n')
    expect(parseSha1sumOutput(out)).toEqual({ 'src/a.ts': H('a'), 'com espaço.txt': H('b') })
  })
})
