import type { Terminal } from '@xterm/xterm'
import { ipc } from './ipc'

/**
 * Copiar/colar nos terminais do Zeus (xterm), como no Windows Terminal:
 * - Ctrl+V / Ctrl+Shift+V / Shift+Insert → cola
 * - Ctrl+C com texto selecionado / Ctrl+Shift+C / Ctrl+Insert → copia (Ctrl+C sem seleção segue
 *   mandando o "interromper" para o terminal)
 * - botão direito → copia se houver seleção, senão cola
 * O texto passa pelo processo principal (clipboard do Electron): antes o terminal do Lançador
 * não colava nada e o da IDE dependia da permissão de clipboard do renderer.
 * Devolve uma função que desfaz o listener do botão direito.
 */
export function attachTerminalClipboard(term: Terminal, container: HTMLElement): () => void {
  const paste = () => {
    ipc.clipboard.readText()
      .then(text => { if (text) term.paste(text) })
      .catch(() => {})
  }
  const copy = () => {
    const sel = term.getSelection()
    if (!sel) return false
    void ipc.clipboard.writeText(sel).catch(() => {})
    term.clearSelection()
    return true
  }

  term.attachCustomKeyEventHandler(e => {
    if (e.type !== 'keydown') return true
    const k = e.key.toLowerCase()
    const ctrl = e.ctrlKey || e.metaKey
    if ((ctrl && k === 'v') || (e.shiftKey && e.key === 'Insert')) {
      e.preventDefault()
      paste()
      return false
    }
    if ((ctrl && e.shiftKey && k === 'c') || (ctrl && e.key === 'Insert')) {
      e.preventDefault()
      copy()
      return false
    }
    // Ctrl+C só copia quando há seleção — sem seleção é o Ctrl+C de interromper do terminal.
    if (ctrl && !e.shiftKey && k === 'c' && term.hasSelection()) {
      e.preventDefault()
      copy()
      return false
    }
    return true
  })

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    if (!copy()) paste()
  }
  container.addEventListener('contextmenu', onContextMenu)
  return () => container.removeEventListener('contextmenu', onContextMenu)
}
