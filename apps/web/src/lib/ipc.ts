import type {
  VpsServer, VpsServerInput,
  Project, ProjectInput,
  ClaudeAccount, ClaudeAccountInput,
  Settings, SettingsInput,
  TestConnectionResult, DiagnosticResults, ClaudeCheckResult,
  GitStatus, GitCommit,
} from '@cwm/config'

export type { GitStatus, GitCommit }
export type { GitFileStatus } from '@cwm/config'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
  permissions: string
}

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, data?: unknown) => Promise<unknown>
      send: (channel: string, data?: unknown) => void
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
    }
  }
}

async function invoke<T>(channel: string, data?: unknown): Promise<T> {
  if (typeof window === 'undefined' || !window.electron) {
    throw new Error('Electron não disponível — execute no ambiente desktop')
  }
  const result = await window.electron.invoke(channel, data)
  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error((result as { error: string }).error)
  }
  return result as T
}

export const ipc = {
  vps: {
    list: () => invoke<VpsServer[]>('vps:list'),
    create: (data: VpsServerInput) => invoke<VpsServer>('vps:create', data),
    update: (data: Partial<VpsServerInput> & { id: string }) => invoke<VpsServer>('vps:update', data),
    delete: (id: string) => invoke<void>('vps:delete', id),
    test: (id: string) => invoke<TestConnectionResult>('vps:test', id),
    setupRemoteProject: (id: string, remotePath: string, gitRepo?: string) =>
      invoke<{ success: boolean; message: string }>('vps:setupRemoteProject', { id, remotePath, gitRepo }),
  },
  projects: {
    list: () => invoke<Project[]>('projects:list'),
    create: (data: ProjectInput) => invoke<Project>('projects:create', data),
    update: (data: Partial<ProjectInput> & { id: string }) => invoke<Project>('projects:update', data),
    delete: (id: string) => invoke<void>('projects:delete', id),
    recent: () => invoke<Array<{ project: Project; launchedAt: string }>>('projects:recent'),
  },
  accounts: {
    list: () => invoke<ClaudeAccount[]>('accounts:list'),
    create: (data: ClaudeAccountInput) => invoke<ClaudeAccount>('accounts:create', data),
    update: (data: Partial<ClaudeAccountInput> & { id: string }) => invoke<ClaudeAccount>('accounts:update', data),
    delete: (id: string) => invoke<void>('accounts:delete', id),
  },
  launcher: {
    openProject: (projectId: string) => invoke<{ success: boolean; message: string }>('launcher:openProject', projectId),
    openTerminal: (vpsId: string) => invoke<{ success: boolean; message: string }>('launcher:openTerminal', vpsId),
    checkClaude: (vpsId: string) => invoke<ClaudeCheckResult>('launcher:checkClaude', vpsId),
  },
  settings: {
    get: () => invoke<Settings>('settings:get'),
    update: (data: Partial<SettingsInput>) => invoke<Settings>('settings:update', data),
  },
  diagnostics: {
    run: () => invoke<DiagnosticResults>('diagnostics:run'),
  },
  sftp: {
    open: (vpsId: string) =>
      invoke<{ success: boolean; sessionId: string; error?: string }>('sftp:open', vpsId),
    readdir: (sessionId: string, path: string) =>
      invoke<{ success: boolean; entries: FileEntry[]; error?: string }>('sftp:readdir', { sessionId, path }),
    readFile: (sessionId: string, path: string) =>
      invoke<{ success: boolean; content: string; error?: string }>('sftp:readFile', { sessionId, path }),
    writeFile: (sessionId: string, path: string, content: string) =>
      invoke<{ success: boolean; error?: string }>('sftp:writeFile', { sessionId, path, content }),
    mkdir: (sessionId: string, path: string) =>
      invoke<{ success: boolean; error?: string }>('sftp:mkdir', { sessionId, path }),
    delete: (sessionId: string, path: string, isDirectory: boolean) =>
      invoke<{ success: boolean; error?: string }>('sftp:delete', { sessionId, path, isDirectory }),
    rename: (sessionId: string, oldPath: string, newPath: string) =>
      invoke<{ success: boolean; error?: string }>('sftp:rename', { sessionId, oldPath, newPath }),
    touch: (sessionId: string, path: string) =>
      invoke<{ success: boolean; error?: string }>('sftp:touch', { sessionId, path }),
    readFileBase64: (sessionId: string, path: string) =>
      invoke<{ success: boolean; data: string; error?: string }>('sftp:readFileBase64', { sessionId, path }),
    close: (sessionId: string) =>
      invoke<{ success: boolean }>('sftp:close', sessionId),
  },
  git: {
    status: (vpsId: string, cwd: string) =>
      invoke<GitStatus>('git:status', { vpsId, cwd }),
    diff: (vpsId: string, cwd: string, filePath: string, staged: boolean) =>
      invoke<string>('git:diff', { vpsId, cwd, filePath, staged }),
    add: (vpsId: string, cwd: string, files: string[]) =>
      invoke<void>('git:add', { vpsId, cwd, files }),
    restore: (vpsId: string, cwd: string, files: string[], staged: boolean) =>
      invoke<void>('git:restore', { vpsId, cwd, files, staged }),
    commit: (vpsId: string, cwd: string, message: string) =>
      invoke<void>('git:commit', { vpsId, cwd, message }),
    push: (vpsId: string, cwd: string) =>
      invoke<string>('git:push', { vpsId, cwd }),
    pull: (vpsId: string, cwd: string) =>
      invoke<string>('git:pull', { vpsId, cwd }),
    log: (vpsId: string, cwd: string, n?: number) =>
      invoke<GitCommit[]>('git:log', { vpsId, cwd, n }),
  },
  terminal: {
    open: (vpsId: string) =>
      invoke<{ success: boolean; sessionId: string; error?: string }>('terminal:open', vpsId),
    input: (sessionId: string, data: string): void =>
      window.electron?.send('terminal:input', { sessionId, data }),
    resize: (sessionId: string, cols: number, rows: number): void =>
      window.electron?.send('terminal:resize', { sessionId, cols, rows }),
    close: (sessionId: string) =>
      invoke<{ success: boolean }>('terminal:close', sessionId),
    exec: (vpsId: string, cmd: string) =>
      invoke<{ success: boolean; output: string; error?: string }>('terminal:exec', { vpsId, cmd }),
  },
}
