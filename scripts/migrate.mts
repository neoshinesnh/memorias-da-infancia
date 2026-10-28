import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const DATABASE_URL_VARIABLE = 'DATABASE_URL'
const MIGRATIONS_DIRECTORY = 'supabase/migrations'
const SCHEMA_MIGRATIONS_TABLE = 'public.schema_migrations'
const SQL_EXTENSION = '.sql'
const TRANSACTION_POOLER_PORT = '6543'
const LOCAL_HOST = 'localhost'
const LOOPBACK_HOST = '127.0.0.1'
const LOOPBACK_V6_HOST = '::1'
const EMPTY_LENGTH = 0
const CONNECTION_TIMEOUT_MS = 10_000
const APPLIED_LABEL = 'applied'
const NONE_PENDING_MESSAGE = 'no pending migrations'
const ENSURE_MIGRATIONS_TABLE = `
  create table if not exists ${SCHEMA_MIGRATIONS_TABLE} (
    filename text primary key,
    applied_at timestamptz not null default now()
  );
  alter table ${SCHEMA_MIGRATIONS_TABLE} enable row level security;
  alter table ${SCHEMA_MIGRATIONS_TABLE} force row level security;
  revoke all on table ${SCHEMA_MIGRATIONS_TABLE} from public, anon, authenticated;
`
const READ_APPLIED_MIGRATIONS = `select filename from ${SCHEMA_MIGRATIONS_TABLE} order by filename`
const RECORD_MIGRATION = `insert into ${SCHEMA_MIGRATIONS_TABLE} (filename) values ($1)`
const BEGIN_TRANSACTION = 'begin'
const COMMIT_TRANSACTION = 'commit'
const ROLLBACK_TRANSACTION = 'rollback'
const RELOAD_SCHEMA = `notify pgrst, 'reload schema'`

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super('DATABASE_URL is required')
    this.name = 'MissingDatabaseUrlError'
  }
}

export class InvalidDatabaseUrlError extends Error {
  constructor() {
    super('DATABASE_URL must be a postgres connection string')
    this.name = 'InvalidDatabaseUrlError'
  }
}

export class TransactionPoolerUrlError extends Error {
  constructor() {
    super('DATABASE_URL must use the direct connection on port 5432')
    this.name = 'TransactionPoolerUrlError'
  }
}

export class MigrationApplyError extends Error {
  constructor(filename: string, cause: unknown) {
    super(`Migration ${filename} failed: ${readCauseMessage(cause)}`)
    this.name = 'MigrationApplyError'
  }
}

export type DatabaseConnection = {
  connectionString: string
  ssl?: { rejectUnauthorized: false }
}

type MigrationRow = {
  filename: string
}

export function readDatabaseUrl(value: string | undefined): string {
  if (value === undefined) {
    throw new MissingDatabaseUrlError()
  }
  if (value.length === EMPTY_LENGTH) {
    throw new MissingDatabaseUrlError()
  }
  return value
}

export function readConnectionSettings(databaseUrl: string): DatabaseConnection {
  const url = parseDatabaseUrl(databaseUrl)
  if (url.port === TRANSACTION_POOLER_PORT) {
    throw new TransactionPoolerUrlError()
  }
  if (isLoopbackHost(url.hostname)) {
    return { connectionString: databaseUrl }
  }
  return {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  }
}

export function sortMigrationFilenames(filenames: readonly string[]): readonly string[] {
  return filenames.filter(isSqlFilename).sort(compareFilenames)
}

export function selectPendingMigrations(
  filenames: readonly string[],
  applied: readonly string[],
): readonly string[] {
  const appliedNames = new Set(applied)
  return filenames.filter((filename) => !appliedNames.has(filename))
}

export async function readMigrationFilenames(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory)
  return sortMigrationFilenames(entries)
}

if (isMainModule()) {
  runMigrations().catch(reportFailure)
}

async function runMigrations(): Promise<void> {
  const databaseUrl = readDatabaseUrl(process.env[DATABASE_URL_VARIABLE])
  const directory = resolveMigrationsDirectory()
  const applied = await applyPendingMigrations(databaseUrl, directory)
  writeResult(applied)
}

async function applyPendingMigrations(databaseUrl: string, directory: string): Promise<readonly string[]> {
  const settings = readConnectionSettings(databaseUrl)
  const client = createClient(settings)
  await client.connect()
  try {
    await client.query(ENSURE_MIGRATIONS_TABLE)
    const pending = selectPendingMigrations(
      await readMigrationFilenames(directory),
      await readAppliedFilenames(client),
    )
    for (const filename of pending) {
      await applyMigration(client, directory, filename)
    }
    if (pending.length > EMPTY_LENGTH) {
      await client.query(RELOAD_SCHEMA)
    }
    return pending
  } finally {
    await client.end()
  }
}

async function applyMigration(client: pg.Client, directory: string, filename: string): Promise<void> {
  const sql = await readFile(join(directory, filename), 'utf8')
  await client.query(BEGIN_TRANSACTION)
  try {
    await client.query(sql)
    await client.query(RECORD_MIGRATION, [filename])
    await client.query(COMMIT_TRANSACTION)
  } catch (error) {
    await client.query(ROLLBACK_TRANSACTION)
    throw new MigrationApplyError(filename, error)
  }
}

async function readAppliedFilenames(client: pg.Client): Promise<readonly string[]> {
  const result = await client.query<MigrationRow>(READ_APPLIED_MIGRATIONS)
  return result.rows.map(readFilename)
}

function createClient(settings: DatabaseConnection): pg.Client {
  if (settings.ssl === undefined) {
    return new pg.Client({
      connectionString: settings.connectionString,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    })
  }
  return new pg.Client({
    connectionString: settings.connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    ssl: settings.ssl,
  })
}

function resolveMigrationsDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', MIGRATIONS_DIRECTORY)
}

function writeResult(applied: readonly string[]): void {
  if (applied.length === EMPTY_LENGTH) {
    process.stdout.write(`${NONE_PENDING_MESSAGE}\n`)
    return
  }
  for (const filename of applied) {
    process.stdout.write(`${APPLIED_LABEL} ${filename}\n`)
  }
}

function reportFailure(error: unknown): void {
  process.stderr.write(`${readCauseMessage(error)}\n`)
  process.exitCode = 1
}

function parseDatabaseUrl(databaseUrl: string): URL {
  try {
    return new URL(databaseUrl)
  } catch {
    throw new InvalidDatabaseUrlError()
  }
}

function isSqlFilename(filename: string): boolean {
  return filename.endsWith(SQL_EXTENSION)
}

function compareFilenames(left: string, right: string): number {
  return left.localeCompare(right)
}

function isLoopbackHost(hostname: string): boolean {
  if (hostname === LOCAL_HOST) {
    return true
  }
  if (hostname === LOOPBACK_HOST) {
    return true
  }
  return hostname === LOOPBACK_V6_HOST
}

function readFilename(row: MigrationRow): string {
  return row.filename
}

function readCauseMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message
  }
  return 'Unknown migration failure'
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  if (entry === undefined) {
    return false
  }
  return import.meta.url === pathToFileURL(entry).href
}
