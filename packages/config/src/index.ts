import { z } from 'zod'
import crypto from 'node:crypto'

// Chave derivada do app — não é plain text no banco; aceitável para app single-user local
const _KEY = crypto.createHash('sha256').update('cwm-v1-ssh-password-key').digest()

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', _KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${enc.toString('hex')}`
}

export function decryptPassword(stored: string): string {
  try {
    const [ivHex, encHex] = stored.split(':')
    const decipher = crypto.createDecipheriv('aes-256-cbc', _KEY, Buffer.from(ivHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}

export const VpsServerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  host: z.string().min(1, 'Host é obrigatório'),
  port: z.coerce.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, 'Usuário SSH é obrigatório'),
  defaultPath: z.string().optional().default('/root'),
  sshPassword: z.string().optional().nullable(),
})

export const ProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional().default(''),
  remotePath: z.string().min(1, 'Caminho remoto é obrigatório'),
  gitRepo: z.string().optional().default(''),
  vpsServerId: z.string().min(1, 'VPS é obrigatória'),
  claudeAccountId: z.string().optional().nullable(),
})

export const ClaudeAccountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  vpsServerId: z.string().optional().nullable(),
})

export const SettingsSchema = z.object({
  vscodePath: z.string().default('code'),
  vscodeInsidersPath: z.string().default('code-insiders'),
  sshKeyPath: z.string().optional().default(''),
})

export const LaunchHistorySchema = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  success: z.boolean(),
  errorMsg: z.string().optional().nullable(),
})

// Hermes — AutonomyPolicy (ETAPAS 22/23): 'manual' = Assistido, 'semi' = Semi-autônomo, 'autonomous' = Autônomo
export const HermesAutonomyLevelSchema = z.enum(['manual', 'semi', 'autonomous'])
export const HERMES_DEV_RULES_MAX = 20_000
// Hermes — Development Rules (ETAPA 21): texto livre por projeto, escrito no .hermes.md
export const HermesDevRulesSchema = z.string().max(HERMES_DEV_RULES_MAX, `Regras de desenvolvimento: máximo ${HERMES_DEV_RULES_MAX} caracteres`)
// Texto da revisão de entrega devolvido pelo Hermes (vem do renderer → validar tamanho no main)
export const HermesReviewTextSchema = z.string().max(200_000, 'Revisão grande demais')
// Projeto local (OneDrive) enviado à VPS para o Hermes — o caminho remoto é validado de novo no core (validatePublishPath)
export const HermesLocalPathSchema = z.string().min(3, 'Pasta local inválida').max(1024)
export const HermesLocalPublishSchema = z.object({
  localPath: HermesLocalPathSchema,
  vpsId: z.string().min(1, 'VPS é obrigatória'),
  remotePath: z.string().min(2, 'Caminho na VPS é obrigatório').max(512),
  name: z.string().max(200).default(''),
})
// Git da IDE local — caminhos de arquivo vão depois de `--` (execFile, sem shell); cwd é conferido no core
export const LocalGitRequestSchema = z.object({
  cwd: z.string().min(3).max(1024),
  files: z.array(z.string().min(1).max(1024)).max(5000).optional(),
  filePath: z.string().min(1).max(1024).optional(),
  staged: z.boolean().optional(),
  message: z.string().max(5000).optional(),
})
export const HermesLocalSyncApplySchema = z.object({
  localPath: HermesLocalPathSchema,
  paths: z.array(z.string().min(1).max(1024)).max(5000, 'Arquivos demais de uma vez'),
})

export type VpsServer = z.infer<typeof VpsServerSchema> & { id: string; createdAt: Date; updatedAt: Date; sshHostFingerprint?: string | null }
export type VpsServerInput = z.infer<typeof VpsServerSchema>

export type Project = z.infer<typeof ProjectSchema> & {
  id: string
  createdAt: Date
  updatedAt: Date
  vpsServer?: VpsServer
  claudeAccount?: ClaudeAccount | null
}
export type ProjectInput = z.infer<typeof ProjectSchema>

export type ClaudeAccount = z.infer<typeof ClaudeAccountSchema> & {
  id: string
  createdAt: Date
  updatedAt: Date
  vpsServer?: VpsServer | null
}
export type ClaudeAccountInput = z.infer<typeof ClaudeAccountSchema>

export type Settings = z.infer<typeof SettingsSchema> & { id: string; updatedAt: Date }
export type SettingsInput = z.infer<typeof SettingsSchema>

export type LaunchHistory = z.infer<typeof LaunchHistorySchema> & {
  id: string
  launchedAt: Date
  project?: Project
}

export const KNOWLEDGE_CATEGORIES = ['geral', 'arquitetura', 'padrões', 'bibliotecas', 'convenções', 'snippets', 'regras', 'stack'] as const
export type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number]

export const KnowledgeEntrySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Título é obrigatório'),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  category: z.enum(KNOWLEDGE_CATEGORIES).default('geral'),
  tags: z.string().default(''),
  isActive: z.boolean().default(true),
})

export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema> & {
  id: string
  createdAt: Date
  updatedAt: Date
}
export type KnowledgeEntryInput = z.infer<typeof KnowledgeEntrySchema>

export interface TestConnectionResult {
  success: boolean
  message: string
  latencyMs?: number
}

export interface ClaudeCheckResult {
  installed: boolean
  version?: string
  loggedIn: 'yes' | 'no' | 'unknown'
  message: string
}

export interface DiagnosticItem {
  status: 'ok' | 'error' | 'warning'
  label: string
  version?: string
  message: string
}

export interface DiagnosticResults {
  vscode: DiagnosticItem
  vscodeInsiders: DiagnosticItem
  ssh: DiagnosticItem
  git: DiagnosticItem
  node: DiagnosticItem
}

export interface LaunchProjectInput {
  projectId: string
}

export interface OpenTerminalInput {
  vpsId: string
}

export interface GitFileStatus {
  path: string
  status: string
  type: 'staged' | 'unstaged' | 'untracked'
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  isRepo: boolean
  /** IDE local: a pasta não tem git próprio e está dentro do repositório da pasta pessoal do usuário — ignorado. */
  outerRepo?: string
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

export interface AiProviderConfig {
  provider: string
  model: string
  enabled: boolean
  isDefault: boolean
  hasKey: boolean
  keyPreview: string
}

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatInput {
  provider?: string
  messages: AiChatMessage[]
  systemPrompt?: string
  maxTokens?: number
}
