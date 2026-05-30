import type {
  VpsServer, VpsServerInput,
  Project, ProjectInput,
  ClaudeAccount, ClaudeAccountInput,
  Settings, SettingsInput,
  TestConnectionResult, DiagnosticResults, ClaudeCheckResult,
} from '@cwm/config'

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, data?: unknown) => Promise<unknown>
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
}
