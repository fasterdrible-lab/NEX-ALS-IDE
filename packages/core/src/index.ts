export { VpsService } from './vps/vps.service.js'
export { GitService } from './git/git.service.js'
export {
  LocalGitService, parsePorcelain, explainGitError, validateGitHubRepoName, suggestRepoName, isGitHubRemoteUrl,
} from './git/local-git.service.js'
export { TerminalService, TerminalSession, ExecStream } from './terminal/terminal.service.js'
export { SftpService, SftpSession, type FileEntry } from './sftp/sftp.service.js'
export { ProjectsService } from './projects/projects.service.js'
export { AccountsService } from './accounts/accounts.service.js'
export { LauncherService } from './launcher/launcher.service.js'
export { SettingsService } from './settings/settings.service.js'
export { DiagnosticsService } from './diagnostics/diagnostics.service.js'
export { TunnelService, type TunnelInfo } from './tunnel/tunnel.service.js'
export { AiService } from './ai/ai.service.js'
export { KeyStore } from './ai/key-store.js'
export { ProjectMemoryService, type MemoryBlock } from './ai/hub/project-memory.js'
export { NotificationMonitor, type NotificationAlert } from './notifications/notification-monitor.js'
export { AuthService, type AppUser, type UserRole } from './auth/auth.service.js'
export { SquadService, AGENTS, AGENT_NAMES, type AgentName, type AgentConfig } from './squad/index.js'
export { KnowledgeService } from './knowledge/knowledge.service.js'
export { SkillsService, SKILL_CATEGORIES, type AgentSkill, type AgentSkillInput } from './skills/skills.service.js'
export { ContextBuilder, type ContextBuildOptions, type BuiltContext } from './context/context-builder.js'
export { TasksService, type AgentTask, type AgentTaskInput, type TaskStatus, type TaskPriority } from './tasks/tasks.service.js'
export {
  ScheduledJobsService,
  parseSchedule, describeSchedule, computeNextRunAt,
  type ScheduledJob, type ScheduledJobInput, type JobSchedule,
} from './jobs/jobs.service.js'
export {
  HermesService,
  type HermesStatus, type HermesInstanceInfo, type HermesInstallResult, type HermesCommandResult,
  type HermesAgentStatus, type HermesProjectAgentInfo, type HermesAutonomyLevel, type DodItem,
  type HermesSkillInfo, HermesEventStream, type HermesEvent,
  HermesRunLog, runKindFromSession, type HermesRunKind, type HermesRunSummary, type HermesRun,
  HermesIncidentStore, buildIncidentPrompt, parseDiagnosis, buildJsonFixPrompt, type HermesIncident, type IncidentType,
  parseReview,
  HermesLocalSync, type LocalLink, type LocalSyncStatus, type LocalSyncApplyResult, type SyncChange,
  HermesAgentRunner, ensureHermesSchema, type RunnerEvent, type RunnerState, type RunnerSnapshot, type RunnerApproval,
} from './hermes/index.js'
export {
  EnvironmentsService, type ProjectEnvironment, type DeployRecord, type DeployStatus, type ProductionTarget,
} from './deploy/environments.service.js'
export { DeployService, type DeployOptions } from './deploy/deploy.service.js'
