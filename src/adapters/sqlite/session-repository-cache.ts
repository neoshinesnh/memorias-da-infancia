import {
  MissingDatabasePathError,
  SqliteSessionRepository,
} from '@/adapters/sqlite/sqlite-session-repository'

const DATABASE_PATH_VARIABLE = 'DATABASE_PATH'
const EMPTY_LENGTH = 0

const repositoriesByPath = new Map<string, SqliteSessionRepository>()

export function readSessionRepository(): SqliteSessionRepository {
  const databasePath = readDatabasePath()
  const cached = repositoriesByPath.get(databasePath)
  if (cached !== undefined) {
    return cached
  }
  return openCachedRepository(databasePath)
}

export function closeSessionRepositories(): void {
  for (const repository of repositoriesByPath.values()) {
    repository.close()
  }
  repositoriesByPath.clear()
}

function openCachedRepository(databasePath: string): SqliteSessionRepository {
  const repository = new SqliteSessionRepository(databasePath)
  repositoriesByPath.set(databasePath, repository)
  return repository
}

function readDatabasePath(): string {
  const databasePath = process.env[DATABASE_PATH_VARIABLE]
  if (databasePath === undefined) {
    throw new MissingDatabasePathError()
  }
  if (databasePath.length === EMPTY_LENGTH) {
    throw new MissingDatabasePathError()
  }
  return databasePath
}
