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

/**
 * Project First (v3.84.0): o projeto vive no PC (localPath), na VPS (vpsServerId + remotePath) ou
 * nos dois. "" / null = não tem. A regra "pelo menos um dos dois" está em `projectLocationError`,
 * fora do objeto, para o `.partial()` do update continuar funcionando.
 */
export const ProjectFieldsSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  description: z.string().optional().default(''),
  localPath: z.string().trim().max(1024).optional().default('')
    .refine(p => p === '' || /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(p), 'A pasta local precisa ser um caminho completo'),
  remotePath: z.string().trim().max(512).optional().default('')
    .refine(p => p === '' || p.startsWith('/'), 'O caminho na VPS começa com /'),
  gitRepo: z.string().optional().default(''),
  vpsServerId: z.string().min(1).optional().nullable(),
  claudeAccountId: z.string().optional().nullable(),
})

/** Mensagem de erro se o projeto não tem onde morar, ou tem VPS sem caminho (e vice-versa). */
export function projectLocationError(p: { localPath?: string | null; remotePath?: string | null; vpsServerId?: string | null }): string | null {
  const hasVps = !!p.vpsServerId
  const hasRemote = !!p.remotePath
  if (hasVps !== hasRemote) return hasVps ? 'Informe o caminho do projeto na VPS' : 'Escolha a VPS do caminho remoto'
  if (!p.localPath && !hasVps) return 'Escolha a pasta do projeto no PC ou uma VPS'
  return null
}

export const ProjectSchema = ProjectFieldsSchema.superRefine((p, ctx) => {
  const error = projectLocationError(p)
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
})

const AbsoluteLocalPath = z.string().trim().min(3).max(1024)
  .refine(p => /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(p), 'Use um caminho completo de pasta do PC')

/**
 * Endereço de repositório para clonar: só https:// ou SSH (git@host:caminho / ssh://). Nada de
 * file://, ext:: ou algo começando com "-" (o git trataria como opção).
 */
export const GitCloneUrlSchema = z.string().trim().min(8).max(500)
  .refine(u => /^https:\/\/[\w.-]+(:\d+)?\/[\w./~%-]+$/.test(u)
    || /^ssh:\/\/[\w.-]+@[\w.-]+(:\d+)?\/[\w./~%-]+$/.test(u)
    || /^[\w.-]+@[\w.-]+:[\w./~%-]+$/.test(u), 'Use o endereço https://… ou git@… do repositório')

/** Fase 2 do Project First — os 3 jeitos de começar um projeto no PC. A VPS é opcional e vem depois. */
export const LocalProjectCreateSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('new'), parent: AbsoluteLocalPath, name: z.string().trim().min(1).max(100), git: z.boolean().default(true) }),
  z.object({ mode: z.literal('clone'), parent: AbsoluteLocalPath, url: GitCloneUrlSchema, name: z.string().trim().max(100).optional() }),
  z.object({ mode: z.literal('existing'), folder: AbsoluteLocalPath, name: z.string().trim().max(120).optional() }),
])
export type LocalProjectCreateInput = z.input<typeof LocalProjectCreateSchema>

/** local = só no PC; remote = só na VPS; hybrid = pasta no PC ligada a uma pasta na VPS. */
export type ProjectWorkspaceMode = 'local' | 'remote' | 'hybrid'

export function projectWorkspaceMode(p: { localPath?: string | null; vpsServerId?: string | null }): ProjectWorkspaceMode {
  if (p.localPath && p.vpsServerId) return 'hybrid'
  return p.localPath ? 'local' : 'remote'
}

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
export const LocalGitPublishSchema = z.object({
  cwd: z.string().min(3).max(1024),
  name: z.string().max(100).optional(),
  isPrivate: z.boolean().optional(),
  url: z.string().max(300).optional(),
})
export const HermesLocalSyncApplySchema = z.object({
  localPath: HermesLocalPathSchema,
  paths: z.array(z.string().min(1).max(1024)).max(5000, 'Arquivos demais de uma vez'),
})

// Ligar um projeto do serviço zeus-hermes ao GitHub: cria o repositório (name) ou usa um existente (url)
export const HermesGithubLinkSchema = z.object({
  projectId: z.string().min(1).max(64),
  name: z.string().trim().max(100).optional(),
  url: z.string().trim().max(300).optional(),
  isPrivate: z.boolean().optional(),
}).refine(d => !!(d.name || d.url), 'Informe o nome do repositório novo ou o endereço de um existente')

// Hermes — loop no main process: comandos do painel validados antes de chegar ao HermesAgentRunner
export const HermesProjectIdSchema = z.string().min(1).max(64)
export const HermesRunnerTextSchema = z.string().trim().min(1, 'Texto vazio').max(50_000, 'Texto grande demais')

// ── Project First, Fase 4b: ambientes do projeto (staging / produção) e deploy por git ──────────
export const EnvironmentKindSchema = z.enum(['staging', 'production'])
export type EnvironmentKind = z.infer<typeof EnvironmentKindSchema>

/** Pasta na VPS de um ambiente: vai entre aspas simples num comando SSH — mesmo assim, só caracteres seguros. */
export const EnvironmentRemotePathSchema = z.string().trim().min(2).max(512)
  .refine(p => p.startsWith('/') && p !== '/', 'A pasta na VPS começa com / (e não pode ser a raiz)')
  .refine(p => !p.split('/').includes('..') && /^[\w./@+-]+$/.test(p), 'Pasta na VPS: só letras, números e . _ - / @ +, sem ..')

export const GitBranchSchema = z.string().trim().min(1).max(100)
  .refine(b => /^[\w][\w./-]*$/.test(b) && !b.includes('..') && !b.endsWith('.lock') && !b.endsWith('/'), 'Nome de branch inválido')

/** Endereço do smoke test (o Zeus faz um GET do PC depois do deploy). Vazio = sem smoke test. */
export const SmokeUrlSchema = z.string().trim().max(500)
  .refine(u => u === '' || /^https?:\/\/[^\s"'`\\]+$/.test(u), 'Use um endereço http:// ou https://')

/**
 * Comandos do deploy, um por linha, rodados na pasta do ambiente depois do checkout (ex.: `npm ci`,
 * `npm run build`, `pm2 restart app`). São escritos pelo admin e mostrados na confirmação — o Zeus não
 * os monta a partir de nada que venha de fora.
 */
export const DeployCommandsSchema = z.string().max(4000, 'Comandos: máximo 4000 caracteres')
  .refine(s => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s), 'Comandos com caractere de controle')

export const ProjectEnvironmentSchema = z.object({
  projectId: z.string().min(1).max(64),
  kind: EnvironmentKindSchema,
  vpsServerId: z.string().min(1, 'Escolha a VPS').max(64),
  remotePath: EnvironmentRemotePathSchema,
  branch: GitBranchSchema.default('main'),
  url: SmokeUrlSchema.default(''),
  deployCommands: DeployCommandsSchema.default(''),
})
export type ProjectEnvironmentInput = z.input<typeof ProjectEnvironmentSchema>

export const DeployRunSchema = z.object({
  envId: z.string().min(1).max(64),
  /** Produção: o nome do projeto digitado (conferido no main). */
  confirm: z.string().max(200).optional(),
})

/** Caminho POSIX absoluto resolvido (`.`, `..`, barras repetidas) — sem node:path, este pacote também roda na tela. */
export function normalizeRemotePath(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') out.pop(); else out.push(seg)
  }
  return '/' + out.join('/')
}

/** `p` está em `root` ou dentro dela (caminhos POSIX da VPS; relativos contam como fora). */
export function isUnderRemotePath(p: string, root: string): boolean {
  if (!p.startsWith('/')) return false
  const a = normalizeRemotePath(p), r = normalizeRemotePath(root)
  return a === r || a.startsWith(r === '/' ? '/' : r + '/')
}

// Nomes explícitos: o Rollup do apps/web lê o dist em CommonJS e não enxerga os nomes de um `export *`.
export {
  AUTONOMY_POLICIES, AUTONOMY_LEVELS, getAutonomyPolicy, toTaskRisk, classifyTaskRisk, needsRiskGate,
  type AutonomyLevel, type AutonomyTaskRisk, type AutonomyPolicy,
} from './autonomy-policy.js'

export type VpsServer = z.infer<typeof VpsServerSchema> & { id: string; createdAt: Date; updatedAt: Date; sshHostFingerprint?: string | null }
export type VpsServerInput = z.infer<typeof VpsServerSchema>

export type Project = z.infer<typeof ProjectSchema> & {
  id: string
  createdAt: Date
  updatedAt: Date
  vpsServer?: VpsServer | null
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
  /** IDE local: URL do `origin` ('' = sem remoto → oferece "Publicar no GitHub"). */
  remote?: string
  /** IDE local: já existe ao menos um commit (publicar exige). */
  hasCommits?: boolean
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
