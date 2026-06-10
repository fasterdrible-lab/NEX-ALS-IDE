import type {
  VpsServer, VpsServerInput,
  Project, ProjectInput,
  ClaudeAccount, ClaudeAccountInput,
  Settings, SettingsInput,
  TestConnectionResult, DiagnosticResults, ClaudeCheckResult,
  GitStatus, GitCommit,
  AiProviderConfig, AiChatInput,
} from '@cwm/config'

export type { GitStatus, GitCommit }
export type { GitFileStatus } from '@cwm/config'

export interface AppUser {
  id: string
  username: string
  role: 'admin' | 'viewer'
  createdAt: string
}

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
    clearFingerprint: (id: string) => invoke<void>('vps:clearFingerprint', id),
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
    exec: (vpsId: string, cmd: string, timeout?: number) =>
      invoke<{ success: boolean; output: string; error?: string }>('terminal:exec', { vpsId, cmd, timeout }),
  },
  clipboard: {
    readImage: () =>
      invoke<{ filePath: string } | null>('clipboard:readImage'),
  },
  debug: {
    openDevTools: (wsUrl: string) =>
      invoke<{ success: boolean }>('debug:openDevTools', { wsUrl }),
  },
  tunnel: {
    open: (vpsId: string, localPort: number, remotePort: number, remoteHost?: string) =>
      invoke<{ success: boolean; tunnel?: { id: string; localPort: number; remotePort: number; status: string }; error?: string }>('tunnel:open', { vpsId, localPort, remotePort, remoteHost }),
    close: (tunnelId: string) =>
      invoke<{ success: boolean }>('tunnel:close', tunnelId),
    list: () =>
      invoke<{ tunnels: { id: string; vpsId: string; localPort: number; remoteHost: string; remotePort: number; status: string }[] }>('tunnel:list'),
  },
  config: {
    export: () =>
      invoke<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>('config:export'),
    import: () =>
      invoke<{ success: boolean; imported?: { vps: number; projects: number; accounts: number }; canceled?: boolean; error?: string }>('config:import'),
  },
  history: {
    list: (filters?: { vpsId?: string; projectId?: string; success?: boolean; limit?: number }) =>
      invoke<{ success: boolean; history: Array<{
        id: string; projectId: string; launchedAt: string; success: boolean; errorMsg?: string;
        project: { id: string; name: string; vpsServer: { id: string; name: string; host: string } }
      }>; error?: string }>('history:list', filters),
  },
  pm2: {
    list: (vpsId: string) =>
      invoke<{ success: boolean; processes: Array<{id:number;name:string;status:string;cpu:number;memory:number;restarts:number;uptime:number}>; error?: string }>('pm2:list', vpsId),
    restart: (vpsId: string, name: string) => invoke<{ success: boolean; output?: string; error?: string }>('pm2:restart', { vpsId, name }),
    stop: (vpsId: string, name: string) => invoke<{ success: boolean; output?: string; error?: string }>('pm2:stop', { vpsId, name }),
    logs: (vpsId: string, name: string) => invoke<{ success: boolean; logs: string; error?: string }>('pm2:logs', { vpsId, name }),
    delete: (vpsId: string, name: string) => invoke<{ success: boolean; error?: string }>('pm2:delete', { vpsId, name }),
  },
  monitor: {
    getStats: (vpsId: string) =>
      invoke<{ success: boolean; stats?: unknown; error?: string }>('monitor:getStats', vpsId),
    diskUsage: (vpsId: string) =>
      invoke<{ success: boolean; top?: string; docker?: string; pm2logs?: string; varlog?: string; error?: string }>('monitor:diskUsage', vpsId),
  },
  docker: {
    list: (vpsId: string) =>
      invoke<{ success: boolean; containers: Array<{id:string;name:string;image:string;status:string;state:string;ports:string}>; error?: string }>('docker:list', vpsId),
    start: (vpsId: string, id: string) => invoke<{ success: boolean; error?: string }>('docker:start', { vpsId, id }),
    stop: (vpsId: string, id: string) => invoke<{ success: boolean; error?: string }>('docker:stop', { vpsId, id }),
    logs: (vpsId: string, id: string) => invoke<{ success: boolean; logs: string; error?: string }>('docker:logs', { vpsId, id }),
    remove: (vpsId: string, id: string) => invoke<{ success: boolean; error?: string }>('docker:remove', { vpsId, id }),
  },
  ai: {
    list: () => invoke<AiProviderConfig[]>('ai:list'),
    save: (data: { provider: string; apiKey: string; model: string; enabled: boolean; isDefault: boolean }) =>
      invoke<{ provider: string }>('ai:save', data),
    delete: (provider: string) => invoke<void>('ai:delete', provider),
    test: (provider: string) => invoke<{ success: boolean; message: string }>('ai:test', provider),
    chat: (data: AiChatInput) => invoke<string>('ai:chat', data),
    models: (provider: string) => invoke<Array<{id:string;name:string;contextWindow:number;supportsTools:boolean;supportsVision:boolean}>>('ai:models', provider),
    chatCtx: (data: {
      message: string
      mode?: string
      provider?: string
      context?: Record<string, unknown>
      projectRoot?: string
      vpsName?: string
      isProduction?: boolean
      conversationId?: string
      maxTokens?: number
      history?: Array<{role:string;content:string}>
    }) => invoke<string>('ai:chatCtx', data),
    stream: {
      start: (data: unknown) => invoke<{ streamId: string }>('ai:stream:start', data),
      cancel: (streamId: string) => invoke<{ success: boolean }>('ai:stream:cancel', streamId),
      onChunk: (cb: (chunk: { type: string; delta?: string; streamId: string }) => void) =>
        window.electron.on('ai:stream:chunk', cb as (...args: unknown[]) => void),
    },
    conv: {
      list: () => invoke<Array<{id:string;title:string;provider:string;model:string;isPinned:boolean;totalTokens:number;createdAt:string;updatedAt:string}>>('ai:conv:list'),
      get: (id: string) => invoke<{id:string;title:string;provider:string;model:string} | null>('ai:conv:get', id),
      create: (data: {provider:string;model:string;title?:string;vpsId?:string}) => invoke<{id:string;title:string}>('ai:conv:create', data),
      updateTitle: (id: string, title: string) => invoke<void>('ai:conv:updateTitle', { id, title }),
      pin: (id: string) => invoke<void>('ai:conv:pin', id),
      delete: (id: string) => invoke<void>('ai:conv:delete', id),
      messages: (id: string, limit?: number) => invoke<Array<{id:string;role:string;content:string;createdAt:string}>>('ai:conv:messages', { id, limit }),
      addMsg: (data: {conversationId:string;role:string;content:string}) => invoke<{id:string}>('ai:conv:addMsg', data),
    },
    chatAgent: (data: {
      provider?: string
      messages: Array<{role: string; content: unknown}>
      systemPrompt?: string
      tools: Array<{name: string; description: string; input_schema: {type: string; properties: Record<string, {type: string; description?: string}>; required: string[]}}>
      maxTokens?: number
    }) => invoke<
      | { type: 'text'; content: string }
      | { type: 'tool_use'; calls: Array<{id: string; name: string; input: Record<string, unknown>}>; text?: string; assistantMessage: unknown; format: 'anthropic' | 'openai' }
    >('ai:chatAgent', data),
  },
  memory: {
    list: (data?: { vpsId?: string | null; projectId?: string | null }) =>
      invoke<Array<{ id: string; vpsId: string | null; projectId: string | null; key: string; value: string; updatedAt: string }>>('memory:list', data ?? {}),
    save: (data: { vpsId?: string | null; projectId?: string | null; key: string; value: string }) =>
      invoke<{ id: string; key: string; value: string }>('memory:save', data),
    delete: (id: string) => invoke<void>('memory:delete', id),
    build: (data?: { vpsId?: string | null; projectId?: string | null }) =>
      invoke<string>('memory:build', data ?? {}),
  },
  tool: {
    onConfirmRequest: (cb: (data: { toolName: string; summary: string; requestId: string }) => void) =>
      window.electron.on('tool:confirmRequest', cb as (...args: unknown[]) => void),
    confirmResponse: (data: { requestId: string; confirmed: boolean }) =>
      invoke<void>('tool:confirmResponse', data),
  },
  window: {
    openIde: (vpsId: string, vpsName: string) =>
      invoke<{ success: boolean }>('window:openIde', { vpsId, vpsName }),
    openIncident: (vpsId: string, vpsName: string) =>
      invoke<{ success: boolean }>('window:openIncident', { vpsId, vpsName }),
    openDeploy: (vpsId: string, vpsName: string) =>
      invoke<{ success: boolean }>('window:openDeploy', { vpsId, vpsName }),
  },
  local: {
    openFolder: () =>
      invoke<string | null>('local:openFolder'),
    readdir: (dirPath: string) =>
      invoke<{ name: string; path: string; isDirectory: boolean }[]>('local:readdir', dirPath),
    readFile: (filePath: string) =>
      invoke<string>('local:readFile', filePath),
    readFileBase64: (filePath: string) =>
      invoke<string>('local:readFileBase64', filePath),
    writeFile: (filePath: string, content: string) =>
      invoke<{ success: boolean }>('local:writeFile', { filePath, content }),
    mkdir: (dirPath: string) =>
      invoke<{ success: boolean }>('local:mkdir', dirPath),
    delete: (filePath: string) =>
      invoke<{ success: boolean }>('local:delete', filePath),
    rename: (oldPath: string, newPath: string) =>
      invoke<{ success: boolean }>('local:rename', { oldPath, newPath }),
    touch: (filePath: string) =>
      invoke<{ success: boolean }>('local:touch', filePath),
    exec: (cmd: string, cwd?: string) =>
      invoke<{ success: boolean; output: string }>('local:exec', { cmd, cwd }),
  },
  notifications: {
    getEnabled: () => invoke<{ enabled: boolean }>('notifications:getEnabled'),
    setEnabled: (enabled: boolean) => invoke<{ success: boolean }>('notifications:setEnabled', { enabled }),
  },
  squad: {
    session: {
      list: () => invoke<Array<{
        id: string; title: string; agentName: string
        projectId: string | null; vpsId: string | null
        createdAt: string; updatedAt: string
      }>>('squad:session:list'),
      create: (data: { agentName: string; title: string }) =>
        invoke<{ id: string; title: string; agentName: string; createdAt: string; updatedAt: string }>('squad:session:create', data),
      messages: (id: string) =>
        invoke<Array<{
          id: string; sessionId: string; agentName: string
          role: string; content: string; delegatedBy: string | null; createdAt: string
        }>>('squad:session:messages', { id }),
      addMsg: (data: { sessionId: string; agentName: string; role: string; content: string; delegatedBy: string | null }) =>
        invoke<{ id: string }>('squad:session:addMsg', data),
      delete: (id: string) => invoke<void>('squad:session:delete', id),
    },
    stream: {
      start: (data: { agent: string; message: string; history: Array<{ role: string; content: string }>; projectContext?: string; localPath?: string; providerOverride?: string }) =>
        invoke<{ streamId: string }>('squad:stream:start', data),
      cancel: (streamId: string) => invoke<{ success: boolean }>('squad:stream:cancel', streamId),
      onChunk: (cb: (chunk: { type: string; delta?: string; error?: string; streamId: string }) => void) => {
        if (!window.electron) return () => {}
        return window.electron.on('squad:stream:chunk', cb as (...args: unknown[]) => void)
      },
    },
    action: {
      execute: (data: { type: string; content: string; cwd?: string; path?: string; vpsId: string }) =>
        invoke<{ output: string }>('squad:action:execute', data),
    },
  },
  claude: {
    check: () => invoke<{ installed: boolean; version: string }>('claude:check'),
    accounts: {
      list:      () => invoke<Array<{ id: string; name: string; configDir: string; isActive: number; createdAt: string }>>('claude:accounts:list'),
      add:       (name: string, useDefault?: boolean) => invoke<{ id: string; name: string; configDir: string; isActive: number }>('claude:accounts:add', { name, useDefault }),
      setActive: (id: string) => invoke<{ success: boolean }>('claude:accounts:setActive', id),
      delete:    (id: string) => invoke<{ success: boolean }>('claude:accounts:delete', id),
      check:     (configDir: string) => invoke<{ installed: boolean; version: string; authenticated: boolean }>('claude:accounts:check', configDir),
    },
  },
  auth: {
    status: () => invoke<{ user: AppUser | null; needsSetup: boolean; sessionRequired: boolean }>('auth:status'),
    setup: (username: string, password: string) => invoke<{ user: AppUser }>('auth:setup', { username, password }),
    login: (username: string, password: string) => invoke<{ user: AppUser }>('auth:login', { username, password }),
    logout: () => invoke<{ success: boolean }>('auth:logout'),
    currentUser: () => invoke<{ user: AppUser | null }>('auth:currentUser'),
    users: {
      list: () => invoke<AppUser[]>('auth:users:list'),
      create: (username: string, password: string, role: 'admin' | 'viewer') =>
        invoke<AppUser>('auth:users:create', { username, password, role }),
      delete: (id: string) => invoke<void>('auth:users:delete', { id }),
      changePassword: (id: string, newPassword: string) =>
        invoke<void>('auth:users:changePassword', { id, newPassword }),
    },
  },
}
