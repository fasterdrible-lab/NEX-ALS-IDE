export type ActionType = 'shell' | 'write_file' | 'read_file' | 'read_dir'

export interface ActionBlock {
  id: string
  type: ActionType
  cwd?: string
  path?: string
  content: string
}

function extractParams(paramStr: string): Record<string, string> {
  const params: Record<string, string> = {}
  const pr = /(\w+)="([^"]*)"/g
  let pm: RegExpExecArray | null
  while ((pm = pr.exec(paramStr)) !== null) params[pm[1]] = pm[2]
  return params
}

function makeBlock(typeStr: string, paramStr: string, content: string): ActionBlock {
  const params = extractParams(paramStr)
  return {
    id: `act-${Math.random().toString(36).slice(2)}`,
    type: typeStr.toLowerCase() as ActionType,
    cwd: params['cwd'],
    path: params['path'],
    content: content.trim(),
  }
}

export function parseActions(text: string): ActionBlock[] {
  const blocks: ActionBlock[] = []
  const matched = new Set<number>()

  // Pass 1: closed blocks — [/ACTION] or [/ACTION (closing ] optional)
  const re1 = /\[ACTION:(\w+)([^\]]*)\]([\s\S]*?)\[\/ACTION\]?/gi
  let m: RegExpExecArray | null
  while ((m = re1.exec(text)) !== null) {
    matched.add(m.index)
    blocks.push(makeBlock(m[1], m[2], m[3]))
  }

  // Pass 2: unclosed blocks — model output truncated before [/ACTION
  const re2 = /\[ACTION:(\w+)([^\]]*)\]([\s\S]*?)(?=\[ACTION:|$)/gi
  while ((m = re2.exec(text)) !== null) {
    if (matched.has(m.index)) continue
    const content = m[3].trim()
    if (content) blocks.push(makeBlock(m[1], m[2], m[3]))
  }

  return blocks
}

export function stripActions(text: string): string {
  // Remove closed blocks (closing ] optional)
  let result = text.replace(/\[ACTION:[^\]]*\][\s\S]*?\[\/ACTION\]?/gi, '')
  // Remove any remaining unclosed block and trailing content (truncated output)
  result = result.replace(/\[ACTION:[^\]]*\][\s\S]*/gi, '')
  return result.trim()
}
