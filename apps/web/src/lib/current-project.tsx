import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Project } from '@cwm/config'
import { ipc } from './ipc'

/**
 * Projeto atual (Project First, Fase 3): o que AI Hub, Squad, Planejar, Tarefas e Workspace usam
 * por padrão. Guardado no localStorage — vale para todas as janelas do Zeus (mesma origem) e o evento
 * `storage` mantém as janelas abertas iguais. Sem projeto escolhido = "Todos" (dados antigos sem
 * projeto continuam visíveis), mas trabalho novo pede um projeto.
 */

const KEY = 'zeus.currentProjectId'

function readStored(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

interface CurrentProjectValue {
  projects: Project[]
  /** null = nenhum escolhido, ou o projeto guardado não existe mais. */
  current: Project | null
  setCurrentId: (id: string | null) => void
  reload: () => void
}

const Ctx = createContext<CurrentProjectValue>({ projects: [], current: null, setCurrentId: () => {}, reload: () => {} })

export function CurrentProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentId, setId] = useState<string | null>(readStored)

  const reload = useCallback(() => { ipc.projects.list().then(setProjects).catch(() => {}) }, [])

  useEffect(() => {
    reload()
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setId(e.newValue) }
    window.addEventListener('focus', reload)
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('storage', onStorage) }
  }, [reload])

  const setCurrentId = useCallback((id: string | null) => {
    setId(id)
    try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY) } catch { /* sem storage: vale só nesta janela */ }
  }, [])

  const value = useMemo(() => ({
    projects,
    current: projects.find(p => p.id === currentId) ?? null,
    setCurrentId,
    reload,
  }), [projects, currentId, setCurrentId, reload])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCurrentProject(): CurrentProjectValue {
  return useContext(Ctx)
}

/** IDE do projeto numa janela própria: com VPS abre a pasta remota; só no PC, a IDE local na pasta dele. */
export function openProjectIde(p: Pick<Project, 'localPath' | 'remotePath' | 'vpsServerId' | 'vpsServer'>): Promise<unknown> {
  return p.vpsServerId
    ? ipc.window.openIde(p.vpsServerId, p.vpsServer?.name ?? p.vpsServerId, p.remotePath)
    : ipc.window.openIdeLocal(p.localPath)
}
