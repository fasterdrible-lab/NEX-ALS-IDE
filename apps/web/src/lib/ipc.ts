import type {
  VpsServer, VpsServerInput,
  Project, ProjectInput,
  ClaudeAccount, ClaudeAccountInput,
  Settings, SettingsInput,
  TestConnectionResult, DiagnosticResults, ClaudeCheckResult,
  GitStatus, GitCommit,
  AiProviderConfig, AiChatInput,
  KnowledgeEntry, KnowledgeEntryInput, KnowledgeCategory,
} from '@cwm/config'

export type { KnowledgeEntry, KnowledgeEntryInput, KnowledgeCategory }

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

export type HermesStatus = 'unknown' | 'not_installed' | 'installed' | 'running' | 'stopped' | 'error'

export interface HermesInstanceInfo {
  vpsServerId: string
  status: HermesStatus
  version: string
  installPath: string
  pid: number | null
  lastSeen: string | null
  lastError: string
}

export interface HermesInstallResult {
  success: boolean
  output: string
  version: string
  installPath: string
}

export interface HermesCommandResult {
  success: boolean
  output: string
}

export type HermesAgentStatus = 'idle' | 'running' | 'error'
export type HermesAutonomyLevel = 'manual' | 'autonomous'

export interface HermesProjectAgentInfo {
  projectId: string
  vpsId: string
  vpsName: string
  workspace: string
  status: HermesAgentStatus
  sessionStarted: boolean
  lastActivity: string | null
  lastError: string
  hermesStatus: HermesStatus
  objective: string
  autonomyLevel: HermesAutonomyLevel
}

export interface DodItem {
  id: string
  label: string
  auto: boolean
  done: boolean
}

export interface HermesSkillInfo {
  name: string
  description: string
  version: string
  path: string
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
    brave: {
      get: () => invoke<{ braveApiKey: string }>('settings:brave:get'),
      set: (key: string) => invoke<{ saved: boolean }>('settings:brave:set', key),
    },
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
  hermes: {
    status: (vpsId: string) =>
      invoke<HermesInstanceInfo>('hermes:status', vpsId),
    install: (vpsId: string) =>
      invoke<HermesInstallResult>('hermes:install', vpsId),
    update: (vpsId: string) =>
      invoke<HermesCommandResult>('hermes:update', vpsId),
    start: (vpsId: string) =>
      invoke<HermesCommandResult>('hermes:start', vpsId),
    stop: (vpsId: string) =>
      invoke<HermesCommandResult>('hermes:stop', vpsId),
    restart: (vpsId: string) =>
      invoke<HermesCommandResult>('hermes:restart', vpsId),
    exec: (vpsId: string, args: string) =>
      invoke<HermesCommandResult>('hermes:exec', { vpsId, args }),
    logs: (vpsId: string, lines?: number) =>
      invoke<HermesCommandResult>('hermes:logs', { vpsId, lines }),
    agent: {
      status: (projectId: string) =>
        invoke<HermesProjectAgentInfo>('hermes:agent:status', { projectId }),
      send: (projectId: string, objective: string) =>
        invoke<{ streamId: string }>('hermes:agent:send', { projectId, objective }),
      cancel: (streamId: string) =>
        invoke<{ success: boolean }>('hermes:agent:cancel', streamId),
      onChunk: (cb: (chunk: { type: string; delta?: string; error?: string; streamId: string }) => void) => {
        if (!window.electron) return () => {}
        return window.electron.on('hermes:agent:chunk', cb as (...args: unknown[]) => void)
      },
      setObjective: (projectId: string, objective: string) =>
        invoke<void>('hermes:agent:setObjective', { projectId, objective }),
      setAutonomy: (projectId: string, level: HermesAutonomyLevel) =>
        invoke<void>('hermes:agent:setAutonomy', { projectId, level }),
      syncContext: (projectId: string) =>
        invoke<{ written: boolean; path: string }>('hermes:agent:syncContext', { projectId }),
    },
    dod: {
      get: (projectId: string) =>
        invoke<DodItem[]>('hermes:dod:get', { projectId }),
      toggle: (projectId: string, itemId: string, done: boolean) =>
        invoke<DodItem[]>('hermes:dod:toggle', { projectId, itemId, done }),
      runChecks: (projectId: string) =>
        invoke<DodItem[]>('hermes:dod:runChecks', { projectId }),
    },
    parallel: {
      start: (projectId: string, taskId: string, objective: string) =>
        invoke<{ streamId: string; worktreePath: string; branch: string }>('hermes:parallel:start', { projectId, taskId, objective }),
      finish: (projectId: string, worktreePath: string, branch: string, merge: boolean) =>
        invoke<{ merged: boolean; output: string }>('hermes:parallel:finish', { projectId, worktreePath, branch, merge }),
    },
    skills: {
      list: (vpsId: string) =>
        invoke<HermesSkillInfo[]>('hermes:skills:list', { vpsId }),
    },
    sessions: {
      summary: (vpsId: string) =>
        invoke<HermesCommandResult>('hermes:sessions:summary', { vpsId }),
    },
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
    watch: (watchId: string, folderPath: string) =>
      invoke<{ success: boolean; error?: string }>('local:watch', { watchId, folderPath }),
    unwatch: (watchId: string) =>
      invoke<{ success: boolean }>('local:unwatch', { watchId }),
    onFsChange: (cb: (e: { watchId: string; eventType: string; filename: string; fullPath: string }) => void) => {
      if (!window.electron) return () => {}
      return window.electron.on('squad:fs:change', cb as (...args: unknown[]) => void)
    },
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
      clearAll: () => invoke<{ cleared: boolean }>('squad:session:clearAll'),
    },
    stream: {
      start: (data: { agent: string; message: string; history: Array<{ role: string; content: string }>; projectContext?: string; localPath?: string; providerOverride?: string; autonomous?: boolean }) =>
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
    shell: {
      onLine: (cb: (line: string) => void) => {
        if (!window.electron) return () => {}
        return window.electron.on('squad:shell:line', cb as (...args: unknown[]) => void)
      },
    },
    memory: {
      list: (projectKey: string) => invoke<SquadMemory[]>('squad:memory:list', projectKey),
      save: (data: { projectKey: string; content: string; category?: string; sessionId?: string; agentName?: string }) =>
        invoke<SquadMemory>('squad:memory:save', data),
      delete: (id: string) => invoke<{ deleted: boolean }>('squad:memory:delete', id),
      extract: (data: { sessionId: string; projectKey: string }) =>
        invoke<SquadMemory[]>('squad:memory:extract', data),
    },
  },
  search: {
    web: (data: { query: string; count?: number }) => invoke<{ output: string }>('search:web', data),
    global: (query: string) =>
      invoke<{ knowledge: KnowledgeEntry[]; skills: AgentSkill[]; conversations: ConversationResult[] }>('search:global', query),
  },
  shell: {
    openExternal: (url: string) => invoke<{ success: boolean; error?: string }>('shell:openExternal', url),
  },
  claude: {
    check: () => invoke<{ installed: boolean; version: string }>('claude:check'),
    usage: () => invoke<{
      email?: string; organization?: string; plan?: string
      usage?: {
        five_hour?: { utilization: number; resets_at: string }
        seven_day?: { utilization: number; resets_at: string }
      } | null
      error?: string
    }>('claude:usage'),
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
  knowledge: {
    list:    () => invoke<KnowledgeEntry[]>('knowledge:list'),
    create:  (data: KnowledgeEntryInput) => invoke<KnowledgeEntry>('knowledge:create', data),
    update:  (id: string, data: Partial<KnowledgeEntryInput>) => invoke<KnowledgeEntry>('knowledge:update', { id, ...data }),
    delete:  (id: string) => invoke<void>('knowledge:delete', id),
    context: () => invoke<string>('knowledge:context'),
    search:  (query: string) => invoke<KnowledgeEntry[]>('knowledge:search', query),
  },
  tasks: {
    list:   (filters?: { status?: TaskStatus; ownerAgent?: string; projectId?: string }) => invoke<AgentTask[]>('tasks:list', filters),
    get:    (id: string) => invoke<AgentTask | null>('tasks:get', id),
    create: (data: AgentTaskInput) => invoke<AgentTask>('tasks:create', data),
    update: (id: string, data: Partial<AgentTaskInput>) => invoke<AgentTask>('tasks:update', { id, ...data }),
    delete: (id: string) => invoke<void>('tasks:delete', id),
  },
  skills: {
    list:           () => invoke<AgentSkill[]>('skills:list'),
    get:            (id: string) => invoke<AgentSkill | null>('skills:get', id),
    create:         (data: AgentSkillInput) => invoke<AgentSkill>('skills:create', data),
    update:         (id: string, data: Partial<AgentSkillInput>) => invoke<AgentSkill>('skills:update', { id, ...data }),
    delete:         (id: string) => invoke<void>('skills:delete', id),
    search:         (query: string) => invoke<AgentSkill[]>('skills:search', query),
    match:          (text: string) => invoke<AgentSkill[]>('skills:match', text),
    incrementUsage: (id: string) => invoke<void>('skills:incrementUsage', id),
  },
  context: {
    build: (opts?: { query?: string; maxChars?: number }) =>
      invoke<{ text: string; knowledgeCount: number; skillCount: number }>('context:build', opts),
  },
  infra: {
    analyze: (report: string) => invoke<string>('infra:analyze', report),
  },
  learning: {
    analyzeFile: (data: { name: string; content: string; language: string }) =>
      invoke<{ title: string; content: string; category: string; tags: string }>('learning:analyzeFile', data),
  },
  workspace: {
    analyze: (data: { vpsId: string; projectPath: string }) =>
      invoke<WorkspaceReport>('workspace:analyze', data),
  },
  lsp: {
    start:  (workspacePath: string) => invoke<{ port: number }>('local:lsp:start', workspacePath),
    stop:   ()                       => invoke<{ ok: boolean }>('local:lsp:stop'),
    status: ()                       => invoke<{ running: boolean; port: number }>('local:lsp:status'),
  },
  jobs: {
    list:    ()                                                         => invoke<ScheduledJob[]>('jobs:list'),
    create:  (data: ScheduledJobInput)                                  => invoke<ScheduledJob>('jobs:create', data),
    update:  (id: string, data: Partial<ScheduledJobInput & { isActive: number }>) => invoke<ScheduledJob>('jobs:update', { id, ...data }),
    delete:  (id: string)                                               => invoke<void>('jobs:delete', id),
    toggle:  (id: string, isActive: boolean)                            => invoke<ScheduledJob>('jobs:toggle', { id, isActive }),
    runNow:  (id: string)                                               => invoke<string>('jobs:runNow', id),
  },
}

export interface ScheduledJob {
  id: string
  title: string
  instruction: string
  agentName: string
  schedule: string        // JSON-encoded JobSchedule
  isActive: number        // 0 | 1
  lastRunAt: string | null
  lastResult: string | null
  nextRunAt: string
  vpsId: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduledJobInput {
  instruction: string
  title?: string
  agentName?: string
  vpsId?: string
  /** Obrigatório quando agentName === 'hermes' — define qual projeto/workspace recebe o objetivo. */
  projectId?: string
}

export interface ConversationResult {
  id: string
  sessionId: string
  agentName: string
  role: string
  snippet: string
  createdAt: string
}

// Workspace Intelligence types
export interface WsArchLayer { name: string; description: string; files: string[] }
export interface WsModule { name: string; path: string; role: string; imports: string[]; risks: string[] }
export interface WsFlow { name: string; steps: string[] }
export interface WsRisk { severity: 'critical' | 'high' | 'medium' | 'low'; type: string; description: string; file?: string }
export interface WorkspaceReport {
  summary: string
  stack: string[]
  architecture: { layers: WsArchLayer[]; patterns: string[] }
  modules: WsModule[]
  flows: WsFlow[]
  risks: WsRisk[]
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
export type TaskPriority = 'low' | 'medium' | 'high'
export interface AgentTask {
  id: string; title: string; description: string; status: TaskStatus
  ownerAgent: string; priority: TaskPriority
  projectId: string | null; sessionId: string | null
  parallelizable: boolean
  createdAt: string; updatedAt: string
}
export interface AgentTaskInput {
  title: string; description?: string; status?: TaskStatus
  ownerAgent?: string; priority?: TaskPriority; projectId?: string; sessionId?: string
  parallelizable?: boolean
}

export interface SquadMemory {
  id: string
  projectKey: string
  content: string
  category: string
  sessionId: string | null
  agentName: string
  createdAt: string
}

export interface AgentSkill {
  id: string
  title: string
  description: string
  category: string
  triggers: string[]
  content: string
  examples: string[]
  usageCount: number
  autoGenerated: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentSkillInput {
  title: string
  description?: string
  category?: string
  triggers?: string[]
  content: string
  examples?: string[]
  autoGenerated?: boolean
}
