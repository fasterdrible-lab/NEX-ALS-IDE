export type ActionType = 'shell' | 'write_file' | 'read_file' | 'read_dir'

export interface ActionBlock {
  id: string
  type: ActionType
  cwd?: string
  path?: string
  content: string
}

export function parseActions(text: string): ActionBlock[] {
  const blocks: ActionBlock[] = []
  const re = /\[ACTION:(\w+)([^\]]*)\]([\s\S]*?)\[\/ACTION\]/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const type = m[1].toLowerCase() as ActionType
    const params: Record<string, string> = {}
    const pr = /(\w+)="([^"]*)"/g
    let pm: RegExpExecArray | null
    while ((pm = pr.exec(m[2])) !== null) params[pm[1]] = pm[2]
    blocks.push({
      id: `act-${Math.random().toString(36).slice(2)}`,
      type,
      cwd: params['cwd'],
      path: params['path'],
      content: m[3].trim(),
    })
  }
  return blocks
}

export function stripActions(text: string): string {
  return text.replace(/\[ACTION:[^\]]*\][\s\S]*?\[\/ACTION\]/gi, '').trim()
}
