import { contextBridge, ipcRenderer } from 'electron'
// electron/renderer would also work; 'electron' is fine in preload context

const ALLOWED_CHANNELS = new Set([
  'vps:list', 'vps:create', 'vps:update', 'vps:delete', 'vps:test', 'vps:clearFingerprint', 'vps:setupRemoteProject',
  'projects:list', 'projects:create', 'projects:update', 'projects:delete', 'projects:recent',
  'accounts:list', 'accounts:create', 'accounts:update', 'accounts:delete',
  'launcher:openProject', 'launcher:openTerminal', 'launcher:checkClaude',
  'settings:get', 'settings:update',
  'diagnostics:run',
  'terminal:open', 'terminal:input', 'terminal:resize', 'terminal:close', 'terminal:exec',
  'terminal:data', 'terminal:exit',
  'sftp:open', 'sftp:readdir', 'sftp:readFile', 'sftp:writeFile',
  'sftp:mkdir', 'sftp:delete', 'sftp:rename', 'sftp:close', 'sftp:touch', 'sftp:readFileBase64',
  'git:status', 'git:diff', 'git:add', 'git:restore', 'git:commit',
  'git:push', 'git:pull', 'git:log',
  'local:openFolder', 'local:readdir', 'local:readFile', 'local:readFileBase64',
  'local:writeFile', 'local:mkdir', 'local:delete', 'local:rename', 'local:touch', 'local:exec',
  'clipboard:readImage',
  'config:export', 'config:import',
  'tunnel:open', 'tunnel:close', 'tunnel:list',
  'debug:openDevTools',
  'history:list',
  'monitor:getStats', 'monitor:diskUsage',
  'docker:list', 'docker:start', 'docker:stop', 'docker:logs', 'docker:remove',
  'pm2:list', 'pm2:restart', 'pm2:stop', 'pm2:logs', 'pm2:delete',
  'ai:list', 'ai:save', 'ai:delete', 'ai:test', 'ai:chat', 'ai:chatAgent',
  'ai:models', 'ai:chatCtx',
  'ai:stream:start', 'ai:stream:cancel', 'ai:stream:chunk',
  'ai:conv:list', 'ai:conv:get', 'ai:conv:create', 'ai:conv:updateTitle',
  'ai:conv:pin', 'ai:conv:delete', 'ai:conv:messages', 'ai:conv:addMsg',
  'window:openIde', 'window:openIncident', 'window:openDeploy',
  'memory:list', 'memory:save', 'memory:delete', 'memory:build',
  'tool:confirmRequest', 'tool:confirmResponse',
  'notifications:getEnabled', 'notifications:setEnabled',
  'auth:status', 'auth:setup', 'auth:login', 'auth:logout', 'auth:currentUser',
  'auth:users:list', 'auth:users:create', 'auth:users:delete', 'auth:users:changePassword',
  'squad:session:list', 'squad:session:create', 'squad:session:messages', 'squad:session:addMsg', 'squad:session:delete',
  'squad:memory:list', 'squad:memory:save', 'squad:memory:delete', 'squad:memory:extract',
  'squad:stream:start', 'squad:stream:cancel', 'squad:stream:chunk', 'squad:action:execute', 'squad:shell:line',
  'local:watch', 'local:unwatch', 'squad:fs:change',
  'claude:check', 'claude:usage',
  'claude:accounts:list', 'claude:accounts:add', 'claude:accounts:setActive',
  'claude:accounts:delete', 'claude:accounts:check',
  'shell:openExternal',
  'knowledge:list', 'knowledge:create', 'knowledge:update', 'knowledge:delete', 'knowledge:context', 'knowledge:search',
  'skills:list', 'skills:get', 'skills:create', 'skills:update', 'skills:delete',
  'skills:search', 'skills:match', 'skills:incrementUsage',
  'tasks:list', 'tasks:get', 'tasks:create', 'tasks:update', 'tasks:delete',
  'jobs:list', 'jobs:create', 'jobs:update', 'jobs:delete', 'jobs:toggle', 'jobs:runNow',
  'infra:analyze',
  'learning:analyzeFile',
  'workspace:analyze',
  'local:lsp:start', 'local:lsp:stop', 'local:lsp:status',
  'context:build', 'search:global',
  'search:web',
  'settings:brave:get', 'settings:brave:set',
])

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, data?: unknown): Promise<unknown> => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Canal IPC não autorizado: ${channel}`))
    }
    return ipcRenderer.invoke(channel, data)
  },
  send: (channel: string, data?: unknown): void => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.warn(`Canal IPC não autorizado: ${channel}`)
      return
    }
    ipcRenderer.send(channel, data)
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.warn(`Canal IPC não autorizado: ${channel}`)
      return () => {}
    }
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
