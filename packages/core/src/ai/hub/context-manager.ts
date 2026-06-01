export interface ContextSelection {
  activeFile?:    { path: string; content: string; language: string }
  selection?:     { text: string; startLine: number; endLine: number }
  projectTree?:   string
  projectFiles?:  Array<{ path: string; content: string }>
  logs?:          string
  terminal?:      string
  docker?:        string
  pm2?:           string
  vpsStats?:      string
  gitDiff?:       string
  projectMemory?: string
}

// Ordem de corte quando estoura o limite (índice 0 = cortado primeiro)
const CUT_PRIORITY: (keyof ContextSelection)[] = [
  'projectFiles',
  'projectTree',
  'logs',
  'terminal',
  'docker',
  'pm2',
  'vpsStats',
  'gitDiff',
  // selection, activeFile e projectMemory nunca são cortados
]

const SECTION_LABELS: Record<keyof ContextSelection, string> = {
  activeFile:    '## Arquivo ativo no editor',
  selection:     '## Seleção atual',
  projectTree:   '## Estrutura do projeto',
  projectFiles:  '## Código-fonte',
  logs:          '## Logs do sistema',
  terminal:      '## Histórico do terminal',
  docker:        '## Docker',
  pm2:           '## PM2',
  vpsStats:      '## Métricas da VPS',
  gitDiff:       '## Git Diff',
  projectMemory: '## Memória do projeto',
}

export class ContextManager {
  /**
   * Monta o bloco de contexto enviado como system prompt complementar.
   * maxChars: tamanho máximo em caracteres (default 80_000 ≈ 20K tokens).
   */
  build(sel: ContextSelection, maxChars = 80_000): string {
    const blocks: Array<{ key: keyof ContextSelection; text: string }> = []

    if (sel.projectMemory) blocks.push({ key: 'projectMemory', text: this.section('projectMemory', sel.projectMemory) })
    if (sel.activeFile)    blocks.push({ key: 'activeFile', text: this.section('activeFile', `### ${sel.activeFile.path} (${sel.activeFile.language})\n\`\`\`${sel.activeFile.language}\n${sel.activeFile.content}\n\`\`\``) })
    if (sel.selection)     blocks.push({ key: 'selection', text: this.section('selection', `Linhas ${sel.selection.startLine}–${sel.selection.endLine}:\n\`\`\`\n${sel.selection.text}\n\`\`\``) })
    if (sel.gitDiff)       blocks.push({ key: 'gitDiff', text: this.section('gitDiff', `\`\`\`diff\n${sel.gitDiff}\n\`\`\``) })
    if (sel.projectFiles?.length) {
      const txt = sel.projectFiles.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n---\n\n')
      blocks.push({ key: 'projectFiles', text: this.section('projectFiles', txt) })
    }
    if (sel.projectTree)   blocks.push({ key: 'projectTree', text: this.section('projectTree', `\`\`\`\n${sel.projectTree}\n\`\`\``) })
    if (sel.logs)          blocks.push({ key: 'logs', text: this.section('logs', `\`\`\`\n${sel.logs}\n\`\`\``) })
    if (sel.terminal)      blocks.push({ key: 'terminal', text: this.section('terminal', `\`\`\`\n${sel.terminal}\n\`\`\``) })
    if (sel.docker)        blocks.push({ key: 'docker', text: this.section('docker', `\`\`\`\n${sel.docker}\n\`\`\``) })
    if (sel.pm2)           blocks.push({ key: 'pm2', text: this.section('pm2', `\`\`\`json\n${sel.pm2}\n\`\`\``) })
    if (sel.vpsStats)      blocks.push({ key: 'vpsStats', text: this.section('vpsStats', sel.vpsStats) })

    // Verifica se cabe inteiro
    const full = blocks.map(b => b.text).join('\n\n')
    if (full.length <= maxChars) return full

    // Corta progressivamente blocos de menor prioridade
    const mutable = [...blocks]
    for (const cutKey of CUT_PRIORITY) {
      const idx = mutable.findIndex(b => b.key === cutKey)
      if (idx !== -1) {
        mutable.splice(idx, 1)
        const attempt = mutable.map(b => b.text).join('\n\n')
        if (attempt.length <= maxChars) return attempt
      }
    }

    // Trunca o primeiro bloco restante se ainda estourar
    const result = mutable.map(b => b.text).join('\n\n')
    return result.slice(0, maxChars)
  }

  private section(key: keyof ContextSelection, content: string): string {
    return `${SECTION_LABELS[key]}\n\n${content}`
  }
}
