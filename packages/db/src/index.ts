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
    `CREATE TABLE IF NOT EXISTS "knowledge_entries" (
      "id"             TEXT NOT NULL PRIMARY KEY,
      "title"          TEXT NOT NULL,
      "content"        TEXT NOT NULL,
      "category"       TEXT NOT NULL DEFAULT 'geral',
      "tags"           TEXT NOT NULL DEFAULT '',
      "isActive"       INTEGER NOT NULL DEFAULT 1,
      "source"         TEXT NOT NULL DEFAULT 'manual',
      "projectId"      TEXT,
      "relevanceScore" REAL NOT NULL DEFAULT 0,
      "autoGenerated"  INTEGER NOT NULL DEFAULT 0,
      "usageCount"     INTEGER NOT NULL DEFAULT 0,
      "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "agent_skills" (
      "id"            TEXT NOT NULL PRIMARY KEY,
      "title"         TEXT NOT NULL,
      "description"   TEXT NOT NULL DEFAULT '',
      "category"      TEXT NOT NULL DEFAULT 'geral',
      "triggers"      TEXT NOT NULL DEFAULT '[]',
      "content"       TEXT NOT NULL DEFAULT '',
      "examples"      TEXT NOT NULL DEFAULT '[]',
      "usageCount"    INTEGER NOT NULL DEFAULT 0,
      "autoGenerated" INTEGER NOT NULL DEFAULT 0,
      "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "agent_tasks" (
      "id"          TEXT NOT NULL PRIMARY KEY,
      "title"       TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "status"      TEXT NOT NULL DEFAULT 'TODO',
      "ownerAgent"  TEXT NOT NULL DEFAULT 'jarvis',
      "priority"    TEXT NOT NULL DEFAULT 'medium',
      "projectId"   TEXT,
      "sessionId"   TEXT,
      "parallelizable" INTEGER NOT NULL DEFAULT 0,
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    // ── FTS5 virtual tables ─────────────────────────────────────────────────
    // content_rowid="rowid" usa o rowid inteiro implícito do SQLite (existe mesmo em tabelas com PK TEXT)
    `CREATE VIRTUAL TABLE IF NOT EXISTS "knowledge_fts" USING fts5(
      title, content, tags, category,
      content="knowledge_entries",
      content_rowid="rowid"
    )`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS "skills_fts" USING fts5(
      title, description, content, triggers, category,
      content="agent_skills",
      content_rowid="rowid"
    )`,
    `CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
      "id"          TEXT NOT NULL PRIMARY KEY,
      "title"       TEXT NOT NULL,
      "instruction" TEXT NOT NULL,
      "agentName"   TEXT NOT NULL DEFAULT 'jarvis',
      "schedule"    TEXT NOT NULL,
      "isActive"    INTEGER NOT NULL DEFAULT 1,
      "lastRunAt"   TEXT,
      "lastResult"  TEXT,
      "nextRunAt"   TEXT NOT NULL DEFAULT (datetime('now')),
      "vpsId"       TEXT,
      "projectId"   TEXT,
      "createdAt"   TEXT NOT NULL DEFAULT (datetime('now')),
      "updatedAt"   TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS "squad_messages_fts" USING fts5(
      content, agentName,
      content="squad_messages",
      content_rowid="rowid"
    )`,
  ]

  for (const sql of ddl) {
    await db.$executeRawUnsafe(sql)
  }

  // ── Triggers FTS5 — mantêm índice sincronizado com tabelas de conteúdo ──────
  // Split AFTER UPDATE em dois triggers separados (del + ins) para evitar
  // BEGIN...END multi-statement que alguns drivers SQLite processam diferente.
  const triggers = [
    // knowledge_entries → knowledge_fts
    `CREATE TRIGGER IF NOT EXISTS knowledge_ai
     AFTER INSERT ON knowledge_entries BEGIN
       INSERT INTO knowledge_fts(rowid, title, content, tags, category)
       VALUES (new.rowid, new.title, new.content, new.tags, new.category);
     END`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_ad
     AFTER DELETE ON knowledge_entries BEGIN
       INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, tags, category)
       VALUES ('delete', old.rowid, old.title, old.content, old.tags, old.category);
     END`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_au_del
     AFTER UPDATE ON knowledge_entries BEGIN
       INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, tags, category)
       VALUES ('delete', old.rowid, old.title, old.content, old.tags, old.category);
     END`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_au_ins
     AFTER UPDATE ON knowledge_entries BEGIN
       INSERT INTO knowledge_fts(rowid, title, content, tags, category)
       VALUES (new.rowid, new.title, new.content, new.tags, new.category);
     END`,
    // agent_skills → skills_fts
    `CREATE TRIGGER IF NOT EXISTS skills_ai
     AFTER INSERT ON agent_skills BEGIN
       INSERT INTO skills_fts(rowid, title, description, content, triggers, category)
       VALUES (new.rowid, new.title, new.description, new.content, new.triggers, new.category);
     END`,
    `CREATE TRIGGER IF NOT EXISTS skills_ad
     AFTER DELETE ON agent_skills BEGIN
       INSERT INTO skills_fts(skills_fts, rowid, title, description, content, triggers, category)
       VALUES ('delete', old.rowid, old.title, old.description, old.content, old.triggers, old.category);
     END`,
    `CREATE TRIGGER IF NOT EXISTS skills_au_del
     AFTER UPDATE ON agent_skills BEGIN
       INSERT INTO skills_fts(skills_fts, rowid, title, description, content, triggers, category)
       VALUES ('delete', old.rowid, old.title, old.description, old.content, old.triggers, old.category);
     END`,
    `CREATE TRIGGER IF NOT EXISTS skills_au_ins
     AFTER UPDATE ON agent_skills BEGIN
       INSERT INTO skills_fts(rowid, title, description, content, triggers, category)
       VALUES (new.rowid, new.title, new.description, new.content, new.triggers, new.category);
     END`,
    // squad_messages → squad_messages_fts
    `CREATE TRIGGER IF NOT EXISTS smsg_ai
     AFTER INSERT ON squad_messages BEGIN
       INSERT INTO squad_messages_fts(rowid, content, agentName)
       VALUES (new.rowid, new.content, new.agentName);
     END`,
    `CREATE TRIGGER IF NOT EXISTS smsg_ad
     AFTER DELETE ON squad_messages BEGIN
       INSERT INTO squad_messages_fts(squad_messages_fts, rowid, content, agentName)
       VALUES ('delete', old.rowid, old.content, old.agentName);
     END`,
    `CREATE TRIGGER IF NOT EXISTS smsg_au_del
     AFTER UPDATE ON squad_messages BEGIN
       INSERT INTO squad_messages_fts(squad_messages_fts, rowid, content, agentName)
       VALUES ('delete', old.rowid, old.content, old.agentName);
     END`,
    `CREATE TRIGGER IF NOT EXISTS smsg_au_ins
     AFTER UPDATE ON squad_messages BEGIN
       INSERT INTO squad_messages_fts(rowid, content, agentName)
       VALUES (new.rowid, new.content, new.agentName);
     END`,
  ]
  for (const sql of triggers) {
    try { await db.$executeRawUnsafe(sql) } catch { /* trigger já existe */ }
  }

  // ── Migrações incrementais — ignoram erro se coluna já existe ───────────────
  const migrations = [
    `ALTER TABLE "vps_servers" ADD COLUMN "sshPassword" TEXT`,
    `ALTER TABLE "vps_servers" ADD COLUMN "sshHostFingerprint" TEXT`,
    `ALTER TABLE "settings" ADD COLUMN "notificationsEnabled" INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE "knowledge_entries" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual'`,
    `ALTER TABLE "knowledge_entries" ADD COLUMN "projectId" TEXT`,
    `ALTER TABLE "knowledge_entries" ADD COLUMN "relevanceScore" REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE "knowledge_entries" ADD COLUMN "autoGenerated" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "knowledge_entries" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0`,
    // Rebuild inicial dos índices FTS5 a partir das tabelas de conteúdo existentes.
    // 'rebuild' é idempotente: limpa o índice e repopula do zero.
    `INSERT INTO knowledge_fts(knowledge_fts) VALUES ('rebuild')`,
    `INSERT INTO skills_fts(skills_fts) VALUES ('rebuild')`,
    `INSERT INTO squad_messages_fts(squad_messages_fts) VALUES ('rebuild')`,
  ]
  for (const sql of migrations) {
    try { await db.$executeRawUnsafe(sql) } catch { /* coluna ou estado já existe */ }
  }
}

export { PrismaClient }
