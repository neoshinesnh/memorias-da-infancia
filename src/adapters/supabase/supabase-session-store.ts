import type { SupabaseClient } from '@supabase/supabase-js'
import { DuplicateSessionError, SessionNotFoundError } from '@/application/session-repository'
import { raiseStoreFailure } from '@/adapters/supabase/supabase-config'
import {
  createAnswerArguments,
  createSessionInsert,
  mapStoredSession,
  mapStoredSessions,
  type SessionWrite,
} from '@/adapters/supabase/stored-session'
import type { Session } from '@/domain/session'

const SESSIONS_TABLE = 'sessions'
const SAVE_ANSWER_FUNCTION = 'save_session_answer'
const SESSION_COLUMNS = 'id, status, current_question, furthest_question, created_at, answers(question_number, option_number)'
const UNIQUE_VIOLATION = '23505'
const MISSING_SESSION = 'P0002'
const MISSING_SESSION_MESSAGE = 'session_not_found'
const EMPTY_ID = ''

export type SessionStore = {
  findSession(id: string): Promise<Session | null>
  listSessions(): Promise<readonly Session[]>
  insertSession(session: Session): Promise<void>
  writeAnswer(write: SessionWrite): Promise<void>
  deleteSessions(): Promise<void>
}

type StoreResult = {
  data: unknown
  error: { code?: string; message?: string } | null
}

export class SupabaseSessionStore implements SessionStore {
  constructor(private readonly client: SupabaseClient) {}

  async findSession(id: string): Promise<Session | null> {
    const result = await this.client
      .from(SESSIONS_TABLE)
      .select(SESSION_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    return readOptionalSession(result)
  }

  async listSessions(): Promise<readonly Session[]> {
    const result = await this.client.from(SESSIONS_TABLE).select(SESSION_COLUMNS)
    raiseOnFailure(result.error)
    return mapStoredSessions(result.data)
  }

  async insertSession(session: Session): Promise<void> {
    const row = createSessionInsert(session)
    const result = await this.client.from(SESSIONS_TABLE).insert({
      id: row.id,
      status: row.status,
      current_question: row.currentQuestion,
      furthest_question: row.furthestQuestion,
      created_at: row.createdAt,
    })
    raiseOnInsert(result.error)
  }

  async writeAnswer(write: SessionWrite): Promise<void> {
    const result = await this.client.rpc(SAVE_ANSWER_FUNCTION, createAnswerArguments(write))
    raiseOnWrite(result.error)
  }

  async deleteSessions(): Promise<void> {
    const result = await this.client.from(SESSIONS_TABLE).delete().neq('id', EMPTY_ID)
    raiseOnFailure(result.error)
  }
}

export function createSupabaseSessionStore(client: SupabaseClient): SessionStore {
  return new SupabaseSessionStore(client)
}

function readOptionalSession(result: StoreResult): Session | null {
  raiseOnFailure(result.error)
  if (result.data === null) {
    return null
  }
  return mapStoredSession(result.data)
}

function raiseOnInsert(error: StoreResult['error']): void {
  if (error === null) {
    return
  }
  if (error.code === UNIQUE_VIOLATION) {
    throw new DuplicateSessionError()
  }
  raiseStoreFailure(error)
}

function raiseOnWrite(error: StoreResult['error']): void {
  if (error === null) {
    return
  }
  if (isMissingSession(error)) {
    throw new SessionNotFoundError()
  }
  raiseStoreFailure(error)
}

function raiseOnFailure(error: StoreResult['error']): void {
  if (error === null) {
    return
  }
  raiseStoreFailure(error)
}

function isMissingSession(error: { code?: string; message?: string }): boolean {
  if (error.code === MISSING_SESSION) {
    return true
  }
  if (error.message === undefined) {
    return false
  }
  return error.message.includes(MISSING_SESSION_MESSAGE)
}
