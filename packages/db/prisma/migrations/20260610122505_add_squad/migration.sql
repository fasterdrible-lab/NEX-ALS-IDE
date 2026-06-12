-- CreateTable
CREATE TABLE "vps_servers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT NOT NULL,
    "defaultPath" TEXT NOT NULL DEFAULT '/root',
    "sshPassword" TEXT,
    "sshHostFingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "remotePath" TEXT NOT NULL,
    "gitRepo" TEXT NOT NULL DEFAULT '',
    "vpsServerId" TEXT NOT NULL,
    "claudeAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "projects_vpsServerId_fkey" FOREIGN KEY ("vpsServerId") REFERENCES "vps_servers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_claudeAccountId_fkey" FOREIGN KEY ("claudeAccountId") REFERENCES "claude_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "claude_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "vpsServerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "claude_accounts_vpsServerId_fkey" FOREIGN KEY ("vpsServerId") REFERENCES "vps_servers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "vscodePath" TEXT NOT NULL DEFAULT 'code',
    "vscodeInsidersPath" TEXT NOT NULL DEFAULT 'code-insiders',
    "sshKeyPath" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "launch_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "launchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "errorMsg" TEXT,
    CONSTRAINT "launch_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "squad_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Nova sessão',
    "agentName" TEXT NOT NULL,
    "projectId" TEXT,
    "vpsId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "squad_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "delegatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "squad_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "squad_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
