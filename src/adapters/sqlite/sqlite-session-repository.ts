import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import SqliteDatabase from 'better-sqlite3'
import {
  DuplicateSessionError,
  SessionNotFoundError,
  type SaveAnswer,
  type SessionRepository,
} from '@/application/session-repository'
import type { QuestionCounts, ResultsSnapshot } from '@/domain/results'
import {
  COMPLETED_SESSION_STATUS,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
  isOptionPosition,
  recordAnswer,
  type Session,
  type SessionAnswer,
  type SessionStatus,
} from '@/domain/session'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type QuestionNumber,
} from '@/domain/survey-catalog'
import {
  InvalidSessionRowError,
  mapSessionRow,
  type AnswerTableRow,
  type SessionTableRow,
} from '@/adapters/sqlite/session-row'

const EMPTY_COUNT = 0
const EMPTY_LENGTH = 0
const DATABASE_PATH_VARIABLE = 'DATABASE_PATH'
const PRIMARY_KEY_CONSTRAINT = 'SQLITE_CONSTRAINT_PRIMARYKEY'
const WRITE_AHEAD_JOURNAL = 'WAL'
const BUSY_TIMEOUT_MILLISECONDS = 5000
const FOREIGN_KEYS_ENABLED = 'ON'

const SESSION_SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('${OPEN_SESSION_STATUS}', '${COMPLETED_SESSION_STATUS}')),
  current_question INTEGER NOT NULL CHECK (current_question BETWEEN ${FIRST_QUESTION_NUMBER} AND ${QUESTION_COUNT}),
  furthest_question INTEGER NOT NULL CHECK (furthest_question BETWEEN ${FIRST_QUESTION_NUMBER} AND ${QUESTION_COUNT}),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS answers (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL CHECK (question_number BETWEEN ${FIRST_QUESTION_NUMBER} AND ${QUESTION_COUNT}),
  option_number INTEGER NOT NULL CHECK (option_number BETWEEN ${FIRST_OPTION_POSITION} AND ${OPTION_COUNT}),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, question_number)
);
`

const SELECT_SESSION_SQL = `
SELECT
  id,
  status,
  current_question AS currentQuestion,
  furthest_question AS furthestQuestion,
  created_at AS createdAt
FROM sessions
WHERE id = ?
`

const SELECT_ANSWERS_SQL = `
SELECT
  question_number AS questionNumber,
  option_number AS optionNumber
FROM answers
WHERE session_id = ?
ORDER BY question_number
`

const INSERT_SESSION_SQL = `
INSERT INTO sessions (id, status, current_question, furthest_question, created_at)
VALUES (?, ?, ?, ?, ?)
`

const UPDATE_SESSION_SQL = `
UPDATE sessions
SET status = ?, current_question = ?, furthest_question = ?
WHERE id = ?
`

const UPSERT_ANSWER_SQL = `
INSERT INTO answers (session_id, question_number, option_number, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT (session_id, question_number)
DO UPDATE SET
  option_number = excluded.option_number,
  updated_at = excluded.updated_at
`

const PARTICIPATING_COUNT_SQL = `
SELECT COUNT(*) AS total
FROM sessions
WHERE status = ?
  AND EXISTS (
    SELECT 1
    FROM answers
    WHERE answers.session_id = sessions.id
  )
`

const FINISHED_COUNT_SQL = `
SELECT COUNT(*) AS total
FROM sessions
WHERE status = ?
`

const OPTION_COUNT_SQL = `
SELECT
  question_number AS questionNumber,
  option_number AS optionNumber,
  COUNT(*) AS total
FROM answers
GROUP BY question_number, option_number
`

const DELETE_SESSIONS_SQL = 'DELETE FROM sessions'

type SqliteConnection = SqliteDatabase.Database

type TotalRow = {
  total: number
}

type OptionCountRow = {
  questionNumber: number
  optionNumber: number
  total: number
}

export class MissingDatabasePathError extends Error {
  constructor() {
    super('DATABASE_PATH is required')
    this.name = 'MissingDatabasePathError'
  }
}

export class SqliteSessionRepository implements SessionRepository {
  private readonly database: SqliteConnection

  constructor(databasePath: string) {
    this.database = openSqliteDatabase(databasePath)
  }

  findById(id: string): Session | null {
    return readSession(this.database, id)
  }

  insert(session: Session): void {
    const write = this.database.transaction((value: Session) => {
      writeInsertedSession(this.database, value)
    })
    write(session)
  }

  saveAnswer(input: SaveAnswer): Session {
    const write = this.database.transaction((value: SaveAnswer) => {
      return commitSavedAnswer(this.database, value)
    })
    return write(input)
  }

  summarize(): ResultsSnapshot {
    return readResultsSnapshot(this.database)
  }

  deleteAll(): void {
    const clear = this.database.transaction(() => {
      deleteStoredSessions(this.database)
    })
    clear()
  }

  close(): void {
    if (!this.database.open) {
      return
    }
    this.database.close()
  }
}

export function openSqliteSessionRepository(): SqliteSessionRepository {
  return new SqliteSessionRepository(readDatabasePath())
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

function openSqliteDatabase(databasePath: string): SqliteConnection {
  ensureParentDirectory(databasePath)
  const database = new SqliteDatabase(databasePath)
  applyConnectionPragmas(database)
  database.exec(SESSION_SCHEMA)
  return database
}

function ensureParentDirectory(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true })
}

function applyConnectionPragmas(database: SqliteConnection): void {
  database.pragma(`journal_mode = ${WRITE_AHEAD_JOURNAL}`)
  database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`)
  database.pragma(`foreign_keys = ${FOREIGN_KEYS_ENABLED}`)
}

function writeInsertedSession(database: SqliteConnection, session: Session): void {
  insertSessionRow(database, session)
  for (const answer of session.answers) {
    storeAnswer(database, session.id, answer)
  }
}

function insertSessionRow(database: SqliteConnection, session: Session): void {
  try {
    database.prepare(INSERT_SESSION_SQL).run(
      session.id,
      session.status,
      session.currentQuestion,
      session.furthestQuestion,
      session.createdAt,
    )
  } catch (error) {
    if (isPrimaryKeyConflict(error)) {
      throw new DuplicateSessionError()
    }
    throw error
  }
}

function commitSavedAnswer(database: SqliteConnection, input: SaveAnswer): Session {
  const saved = reviseSession(database, input)
  storeSessionProgress(database, saved)
  storeAnswer(database, saved.id, readRevisedAnswer(saved, input.questionNumber))
  return saved
}

function reviseSession(database: SqliteConnection, input: SaveAnswer): Session {
  const existing = readSession(database, input.sessionId)
  if (existing === null) {
    throw new SessionNotFoundError()
  }
  return recordAnswer(existing, {
    questionNumber: input.questionNumber,
    optionNumber: input.optionNumber,
  })
}

function readRevisedAnswer(session: Session, questionNumber: QuestionNumber): SessionAnswer {
  const answer = session.answers.find((item) => item.questionNumber === questionNumber)
  if (answer === undefined) {
    throw new InvalidSessionRowError()
  }
  return answer
}

function storeSessionProgress(database: SqliteConnection, session: Session): void {
  database.prepare(UPDATE_SESSION_SQL).run(
    session.status,
    session.currentQuestion,
    session.furthestQuestion,
    session.id,
  )
}

function storeAnswer(database: SqliteConnection, sessionId: string, answer: SessionAnswer): void {
  database.prepare(UPSERT_ANSWER_SQL).run(
    sessionId,
    answer.questionNumber,
    answer.optionNumber,
    createTimestamp(),
  )
}

function readSession(database: SqliteConnection, id: string): Session | null {
  const row = database.prepare<[string], SessionTableRow>(SELECT_SESSION_SQL).get(id)
  if (row === undefined) {
    return null
  }
  return mapSessionRow(row, readAnswerRows(database, id))
}

function readAnswerRows(database: SqliteConnection, sessionId: string): readonly AnswerTableRow[] {
  return database.prepare<[string], AnswerTableRow>(SELECT_ANSWERS_SQL).all(sessionId)
}

function readResultsSnapshot(database: SqliteConnection): ResultsSnapshot {
  return {
    participating: readStatusTotal(database, PARTICIPATING_COUNT_SQL, OPEN_SESSION_STATUS),
    finished: readStatusTotal(database, FINISHED_COUNT_SQL, COMPLETED_SESSION_STATUS),
    questions: readQuestionCounts(database),
  }
}

function readStatusTotal(database: SqliteConnection, countQuery: string, status: SessionStatus): number {
  const row = database.prepare<[string], TotalRow>(countQuery).get(status)
  if (row === undefined) {
    return EMPTY_COUNT
  }
  return row.total
}

function readQuestionCounts(database: SqliteConnection): readonly QuestionCounts[] {
  const rows = database.prepare<[], OptionCountRow>(OPTION_COUNT_SQL).all()
  return surveyCatalog.map((question) => createQuestionCounts(rows, question.number))
}

function createQuestionCounts(rows: readonly OptionCountRow[], questionNumber: QuestionNumber): QuestionCounts {
  return {
    questionNumber,
    counts: collectOptionCounts(rows, questionNumber),
  }
}

function collectOptionCounts(rows: readonly OptionCountRow[], questionNumber: QuestionNumber): readonly number[] {
  const counts = Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
  for (const row of rows) {
    applyMatchingCount(counts, row, questionNumber)
  }
  return counts
}

function applyMatchingCount(counts: number[], row: OptionCountRow, questionNumber: QuestionNumber): void {
  if (row.questionNumber !== questionNumber) {
    return
  }
  if (!isOptionPosition(row.optionNumber)) {
    throw new InvalidSessionRowError()
  }
  const index = row.optionNumber - FIRST_OPTION_POSITION
  counts[index] = row.total
}

function deleteStoredSessions(database: SqliteConnection): void {
  database.prepare(DELETE_SESSIONS_SQL).run()
}

function isPrimaryKeyConflict(error: unknown): boolean {
  if (!(error instanceof SqliteDatabase.SqliteError)) {
    return false
  }
  return error.code === PRIMARY_KEY_CONSTRAINT
}

function createTimestamp(): string {
  return new Date().toISOString()
}
