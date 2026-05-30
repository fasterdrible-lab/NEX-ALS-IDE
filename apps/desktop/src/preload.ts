import { contextBridge, ipcRenderer } from 'electron'
// electron/renderer would also work; 'electron' is fine in preload context

const ALLOWED_CHANNELS = new Set([
  'vps:list', 'vps:create', 'vps:update', 'vps:delete', 'vps:test', 'vps:setupRemoteProject',
  'projects:list', 'projects:create', 'projects:update', 'projects:delete', 'projects:recent',
  'accounts:list', 'accounts:create', 'accounts:update', 'accounts:delete',
  'launcher:openProject', 'launcher:openTerminal', 'launcher:checkClaude',
  'settings:get', 'settings:update',
  'diagnostics:run',
])

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, data?: unknown): Promise<unknown> => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Canal IPC não autorizado: ${channel}`))
    }
    return ipcRenderer.invoke(channel, data)
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
