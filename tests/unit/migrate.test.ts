import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  InvalidDatabaseUrlError,
  MissingDatabaseUrlError,
  TransactionPoolerUrlError,
  readConnectionSettings,
  readDatabaseUrl,
  readMigrationFilenames,
  selectPendingMigrations,
  sortMigrationFilenames,
} from '../../scripts/migrate.mts'

const SESSIONS_MIGRATION = '20261028143000_sessions.sql'
const LATER_MIGRATION = '20261028150000_next.sql'
const NOTES_FILE = 'README.md'
const DIRECT_URL = 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres'
const POOLER_URL = 'postgresql://postgres:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
const LOCAL_URL = 'postgresql://postgres:secret@localhost:5432/postgres'
const DEFAULT_PORT_URL = 'postgresql://postgres:secret@db.example.supabase.co/postgres'
const EMPTY_URL = ''
const MIGRATIONS_DIRECTORY = join(process.cwd(), 'supabase', 'migrations')

describe('migration runner', () => {
  it('requires a database url', () => {
    expect(() => readDatabaseUrl(undefined)).toThrow(MissingDatabaseUrlError)
    expect(() => readDatabaseUrl(EMPTY_URL)).toThrow(MissingDatabaseUrlError)
  })

  it('rejects a url that is not a connection string', () => {
    expect(() => readConnectionSettings('not a url')).toThrow(InvalidDatabaseUrlError)
  })

  it('rejects the transaction pooler port', () => {
    expect(() => readConnectionSettings(POOLER_URL)).toThrow(TransactionPoolerUrlError)
  })

  it('uses ssl for a remote database', () => {
    expect(readConnectionSettings(DIRECT_URL)).toEqual({
      connectionString: DIRECT_URL,
      ssl: { rejectUnauthorized: false },
    })
    expect(readConnectionSettings(DEFAULT_PORT_URL).ssl).toEqual({ rejectUnauthorized: false })
  })

  it('skips ssl on the local database', () => {
    expect(readConnectionSettings(LOCAL_URL)).toEqual({ connectionString: LOCAL_URL })
  })

  it('sorts sql files and ignores other names', () => {
    expect(sortMigrationFilenames([LATER_MIGRATION, NOTES_FILE, SESSIONS_MIGRATION])).toEqual([
      SESSIONS_MIGRATION,
      LATER_MIGRATION,
    ])
  })

  it('keeps only migrations that are not recorded yet', () => {
    expect(selectPendingMigrations([SESSIONS_MIGRATION, LATER_MIGRATION], [SESSIONS_MIGRATION])).toEqual([
      LATER_MIGRATION,
    ])
  })

  it('reads the sessions migration from the project', async () => {
    const filenames = await readMigrationFilenames(MIGRATIONS_DIRECTORY)
    expect(filenames).toContain(SESSIONS_MIGRATION)
  })
})
