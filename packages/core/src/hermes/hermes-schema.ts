import { getPrismaClient } from '@cwm/db'

/**
 * Tabelas do Hermes que não são criadas pelo `initializeDatabase` do @cwm/db (compatibilidade sem
 * `pnpm db:push` em instalações existentes) + migrações incrementais. Usado pelo Zeus (main) e pelo
 * serviço zeus-hermes na VPS. Antes vivia em apps/desktop/src/ipc/handlers.ts.
 *
 * Colunas de data são DATETIME, como nas demais tabelas: o Prisma grava DateTime como inteiro (ms)
 * e, numa coluna TEXT, o SQLite converte para texto ('1786651509353') que o Prisma não lê de volta
 * ("Could not convert value … to type DateTime") — bug das v3.52.0–v3.59.1.
 */

const HERMES_TABLES: Record<string, { ddl: string; dateCols: string[] }> = {
  hermes_instances: {
    dateCols: ['lastSeen', 'createdAt', 'updatedAt'],
    ddl: `
      CREATE TABLE IF NOT EXISTS hermes_instances (
        id TEXT PRIMARY KEY,
        vpsServerId TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'unknown',
        version TEXT NOT NULL DEFAULT '',
        installPath TEXT NOT NULL DEFAULT '',
        pid INTEGER,
        lastSeen DATETIME,
        lastError TEXT NOT NULL DEFAULT '',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
  },
  hermes_project_agents: {
    dateCols: ['lastActivity', 'createdAt', 'updatedAt'],
    ddl: `
      CREATE TABLE IF NOT EXISTS hermes_project_agents (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL UNIQUE,
        hermesInstanceId TEXT NOT NULL,
        workspace TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        sessionStarted INTEGER NOT NULL DEFAULT 0,
        lastActivity DATETIME,
        lastError TEXT NOT NULL DEFAULT '',
        objective TEXT NOT NULL DEFAULT '',
        autonomyLevel TEXT NOT NULL DEFAULT 'manual',
        dodChecklist TEXT NOT NULL DEFAULT '[]',
        devRules TEXT NOT NULL DEFAULT '',
        baseCommit TEXT NOT NULL DEFAULT '',
        delivery TEXT NOT NULL DEFAULT '{}',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
  },
}

/** Reconstrói a tabela se alguma coluna de data ainda for TEXT, convertendo os valores para ms. */
async function migrateDateColumns(table: string, ddl: string, dateCols: string[]): Promise<void> {
  const db = getPrismaClient()
  const cols = (await db.$queryRawUnsafe(`PRAGMA table_info(${table})`)) as { name: string; type: string }[]
  if (!cols.some(c => dateCols.includes(c.name) && c.type.toUpperCase() === 'TEXT')) return
  // Texto só com dígitos = ms gravado pelo Prisma; senão é datetime('now') ('YYYY-MM-DD HH:MM:SS').
  const toMs = (c: string) =>
    `CASE WHEN "${c}" IS NULL THEN NULL WHEN "${c}" NOT GLOB '*[^0-9]*' THEN CAST("${c}" AS INTEGER) `
    + `ELSE CAST(strftime('%s', "${c}") AS INTEGER) * 1000 END`
  const select = cols.map(c => (dateCols.includes(c.name) ? `${toMs(c.name)} AS "${c.name}"` : `"${c.name}"`)).join(', ')
  const names = cols.map(c => `"${c.name}"`).join(', ')
  await db.$transaction([
    db.$executeRawUnsafe(`ALTER TABLE ${table} RENAME TO ${table}__old_text_dates`),
    db.$executeRawUnsafe(ddl),
    db.$executeRawUnsafe(`INSERT INTO ${table} (${names}) SELECT ${select} FROM ${table}__old_text_dates`),
    db.$executeRawUnsafe(`DROP TABLE ${table}__old_text_dates`),
  ])
  console.log(`[DB] ${table}: colunas de data migradas de TEXT para DATETIME`)
}

/** Sequencial de propósito: tem de terminar antes do recovery do boot ler hermes_project_agents. */
export async function ensureHermesSchema(): Promise<void> {
  const db = getPrismaClient()
  for (const { ddl } of Object.values(HERMES_TABLES)) await db.$executeRawUnsafe(ddl).catch(() => {})
  const alters = [
    // FASE 3 (v3.53.0)
    `ALTER TABLE hermes_project_agents ADD COLUMN objective TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE hermes_project_agents ADD COLUMN autonomyLevel TEXT NOT NULL DEFAULT 'manual'`,
    `ALTER TABLE hermes_project_agents ADD COLUMN dodChecklist TEXT NOT NULL DEFAULT '[]'`,
    // Development Rules (v3.62.0)
    `ALTER TABLE hermes_project_agents ADD COLUMN devRules TEXT NOT NULL DEFAULT ''`,
    // Fechamento da entrega (v3.66.0)
    `ALTER TABLE hermes_project_agents ADD COLUMN baseCommit TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE hermes_project_agents ADD COLUMN delivery TEXT NOT NULL DEFAULT '{}'`,
    // agent_tasks: FASE 4 (v3.55.0) e risco por tarefa da AutonomyPolicy (v3.62.0)
    `ALTER TABLE agent_tasks ADD COLUMN parallelizable INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE agent_tasks ADD COLUMN risk TEXT NOT NULL DEFAULT 'low'`,
    // scheduled_jobs: FASE 6 (v3.57.0)
    `ALTER TABLE scheduled_jobs ADD COLUMN projectId TEXT`,
  ]
  for (const sql of alters) await db.$executeRawUnsafe(sql).catch(() => { /* coluna já existe */ })
  for (const [table, { ddl, dateCols }] of Object.entries(HERMES_TABLES)) {
    await migrateDateColumns(table, ddl, dateCols)
      .catch((e: unknown) => console.error(`[DB] falha ao migrar datas de ${table}:`, e))
  }
}
