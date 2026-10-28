import { InMemorySessionRepository } from '@/adapters/memory/in-memory-session-repository'
import { openSupabaseSessionRepository } from '@/adapters/supabase/supabase-session-repository'
import {
  MEMORY_SESSION_STORE,
  SESSION_STORE_VARIABLE,
} from '@/adapters/supabase/session-store-mode'
import type { SessionRepository } from '@/application/session-repository'

let current: SessionRepository | null = null

export class MemoryRepositoryInactiveError extends Error {
  constructor() {
    super('Memory session repository is not active')
    this.name = 'MemoryRepositoryInactiveError'
  }
}

export function readSessionRepository(): SessionRepository {
  if (current !== null) {
    return current
  }
  return openCachedRepository()
}

export function readMemoryRepository(): InMemorySessionRepository {
  const repository = readSessionRepository()
  if (repository instanceof InMemorySessionRepository) {
    return repository
  }
  throw new MemoryRepositoryInactiveError()
}

export function closeSessionRepositories(): void {
  current = null
}

function openCachedRepository(): SessionRepository {
  const repository = openRepository()
  current = repository
  return repository
}

function openRepository(): SessionRepository {
  if (process.env[SESSION_STORE_VARIABLE] === MEMORY_SESSION_STORE) {
    return new InMemorySessionRepository()
  }
  return openSupabaseSessionRepository()
}
