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
/** manual = Assistido (usuário libera cada tarefa) · semi = Semi-autônomo (para antes de tarefa de risco alto) · autonomous = Autônomo */
export type HermesAutonomyLevel = 'manual' | 'semi' | 'autonomous'

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
  devRules: string
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
