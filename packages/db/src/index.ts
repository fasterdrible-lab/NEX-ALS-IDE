// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../generated/client')

declare global {
  // eslint-disable-next-line no-var
  var __prisma: InstanceType<typeof PrismaClient> | undefined
}

export function getPrismaClient(): InstanceType<typeof PrismaClient> {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
    })
  }
  return global.__prisma
}

export async function disconnectPrisma(): Promise<void> {
  if (global.__prisma) {
    await global.__prisma.$disconnect()
    global.__prisma = undefined
  }
}

/** Cria as tabelas se não existirem (primeiro launch). */
export async function initializeDatabase(): Promise<void> {
  const db = getPrismaClient()

  const ddl = [
    `CREATE TABLE IF NOT EXISTS "vps_servers" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "host" TEXT NOT NULL,
      "port" INTEGER NOT NULL DEFAULT 22,
      "username" TEXT NOT NULL,
      "defaultPath" TEXT NOT NULL DEFAULT '/root',
      "sshPassword" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "claude_accounts" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL DEFAULT '',
      "vpsServerId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "claude_accounts_vpsServerId_fkey"
        FOREIGN KEY ("vpsServerId") REFERENCES "vps_servers"("id") ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "projects" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "remotePath" TEXT NOT NULL,
      "gitRepo" TEXT NOT NULL DEFAULT '',
      "vpsServerId" TEXT NOT NULL,
      "claudeAccountId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "projects_vpsServerId_fkey"
        FOREIGN KEY ("vpsServerId") REFERENCES "vps_servers"("id") ON DELETE CASCADE,
      CONSTRAINT "projects_claudeAccountId_fkey"
        FOREIGN KEY ("claudeAccountId") REFERENCES "claude_accounts"("id") ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "settings" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
      "vscodePath" TEXT NOT NULL DEFAULT 'code',
      "vscodeInsidersPath" TEXT NOT NULL DEFAULT 'code-insiders',
      "sshKeyPath" TEXT NOT NULL DEFAULT '',
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "launch_history" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "launchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "success" INTEGER NOT NULL,
      "errorMsg" TEXT,
      CONSTRAINT "launch_history_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "ai_providers" (
      "provider" TEXT NOT NULL PRIMARY KEY,
      "apiKey" TEXT NOT NULL DEFAULT '',
      "model" TEXT NOT NULL DEFAULT '',
      "enabled" INTEGER NOT NULL DEFAULT 0,
      "isDefault" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ai_conversations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL DEFAULT 'Nova conversa',
      "provider" TEXT NOT NULL DEFAULT '',
      "model" TEXT NOT NULL DEFAULT '',
      "vpsId" TEXT,
      "projectId" TEXT,
      "isPinned" INTEGER NOT NULL DEFAULT 0,
      "totalTokens" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ai_messages" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "toolCallId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "project_memory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vpsId" TEXT,
      "projectId" TEXT,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "tool_execution_log" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT,
      "toolName" TEXT NOT NULL,
      "input" TEXT,
      "output" TEXT,
      "tier" TEXT,
      "confirmed" INTEGER NOT NULL DEFAULT 0,
      "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "app_users" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'viewer',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "squad_sessions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL DEFAULT 'Nova sessão',
      "agentName" TEXT NOT NULL,
      "projectId" TEXT,
      "vpsId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "squad_messages" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "agentName" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "delegatedBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("sessionId") REFERENCES "squad_sessions"("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "claude_code_accounts" (
      "id"        TEXT PRIMARY KEY,
      "name"      TEXT NOT NULL,
      "configDir" TEXT NOT NULL UNIQUE,
      "isActive"  INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]

  for (const sql of ddl) {
    await db.$executeRawUnsafe(sql)
  }

  // Migrações incrementais — ignoram erro se coluna já existe
  const migrations = [
    `ALTER TABLE "vps_servers" ADD COLUMN "sshPassword" TEXT`,
    `ALTER TABLE "vps_servers" ADD COLUMN "sshHostFingerprint" TEXT`,
    `ALTER TABLE "settings" ADD COLUMN "notificationsEnabled" INTEGER NOT NULL DEFAULT 1`,
  ]
  for (const sql of migrations) {
    try { await db.$executeRawUnsafe(sql) } catch { /* coluna já existe */ }
  }
}

export { PrismaClient }
