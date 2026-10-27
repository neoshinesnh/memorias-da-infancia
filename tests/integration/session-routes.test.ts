import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SqliteDatabase from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeParticipantRepositories } from '@/adapters/http/participant-session'
import { SqliteSessionRepository } from '@/adapters/sqlite/sqlite-session-repository'
import {
  BAD_REQUEST_ERROR,
  CONFLICT_ERROR,
  COOKIE_HEADER,
  FORBIDDEN_ERROR,
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_SERVER_ERROR,
  NOT_FOUND_ERROR,
  ORIGIN_HEADER,
  SERVER_ERROR,
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  readSessionId,
} from '@/application/session-http'
import { GET } from '@/app/api/sessoes/atual/route'
import { PUT } from '@/app/api/sessoes/atual/respostas/[questionNumber]/route'
import { POST } from '@/app/api/sessoes/route'
import {
  COMPLETED_SESSION_STATUS,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
  type Session,
} from '@/domain/session'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'

const PUBLIC_URL = 'https://evento.test/'
const PUBLIC_ORIGIN = 'https://evento.test'
const FOREIGN_ORIGIN = 'https://outro.test'
const PANEL_PASSWORD = 'SenhaUnicaDoPainel'
const PERSON_NAME = 'PessoaUnicaMemorias'
const CONTACT_EMAIL = 'pessoa-unica@memorias.test'
const USER_AGENT = 'AgenteUnicoMemorias'
const FORWARDED_ADDRESS = '203.0.113.44'
const TEMP_DIRECTORY_PREFIX = 'memorias-session-routes-'
const JSON_CONTENT_TYPE = 'application/json'
const CONTENT_TYPE_HEADER = 'content-type'
const USER_AGENT_HEADER = 'user-agent'
const FORWARDED_HEADER = 'x-forwarded-for'
const CACHE_CONTROL_HEADER = 'cache-control'
const NO_STORE_DIRECTIVE = 'no-store'
const SET_COOKIE_HEADER = 'set-cookie'
const BUSY_TIMEOUT_MILLISECONDS = 5000
const EMPTY_COUNT = 0
const ONE_SESSION = 1
const TWO_SESSIONS = 2
const INFO_LOG_LEVEL = 'info'
const SESSION_CREATED_EVENT = 'session_created'
const ANSWER_SAVED_EVENT = 'answer_saved'
const UNKNOWN_SESSION_ID = 'missing-session'
const FIRST_OPTION: OptionPosition = 1
const FOURTH_OPTION: OptionPosition = 4
const SECOND_QUESTION: QuestionNumber = 2

type RequestOptions = {
  method: string
  origin?: string | null
  cookie?: string
  body?: string
  userAgent?: string
  forwardedFor?: string
}

type TotalRow = {
  total: number
}

let directoryPath: string
let databasePath: string
let previousDatabasePath: string | undefined
let previousPublicUrl: string | undefined
let previousPanelPassword: string | undefined

function restoreEnv(name: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = previous
}

function createRequest(path: string, options: RequestOptions): Request {
  const headers = new Headers()
  headers.set(CONTENT_TYPE_HEADER, JSON_CONTENT_TYPE)
  if (options.origin !== undefined && options.origin !== null) {
    headers.set(ORIGIN_HEADER, options.origin)
  }
  if (options.cookie !== undefined) {
    headers.set(COOKIE_HEADER, options.cookie)
  }
  if (options.userAgent !== undefined) {
    headers.set(USER_AGENT_HEADER, options.userAgent)
  }
  if (options.forwardedFor !== undefined) {
    headers.set(FORWARDED_HEADER, options.forwardedFor)
  }
  return new Request(`${PUBLIC_ORIGIN}${path}`, {
    method: options.method,
    headers,
    body: options.body,
  })
}

function postSession(origin: string | null = PUBLIC_ORIGIN): Response {
  return POST(createRequest('/api/sessoes', { method: 'POST', origin }))
}

function getSession(sessionId: string | null, origin: string | null = null): Response {
  const cookie = sessionId === null ? undefined : `${SESSION_COOKIE_NAME}=${sessionId}`
  return GET(createRequest('/api/sessoes/atual', { method: 'GET', origin, cookie }))
}

type PutAnswerInput = {
  sessionId: string
  questionNumber: QuestionNumber
  optionNumber: OptionPosition
  origin?: string | null
}

function putAnswer(input: PutAnswerInput): Promise<Response> {
  const origin = input.origin === undefined ? PUBLIC_ORIGIN : input.origin
  return PUT(
    createRequest(`/api/sessoes/atual/respostas/${input.questionNumber}`, {
      method: 'PUT',
      origin,
      cookie: `${SESSION_COOKIE_NAME}=${input.sessionId}`,
      body: JSON.stringify({ optionNumber: input.optionNumber }),
    }),
    { params: Promise.resolve({ questionNumber: String(input.questionNumber) }) },
  )
}

function readCreatedSessionId(response: Response): string {
  const sessionId = readSessionId(response.headers.get(SET_COOKIE_HEADER))
  if (sessionId === null) {
    throw new Error('Session cookie was not set')
  }
  return sessionId
}

function countSessions(path: string): number {
  if (!existsSync(path)) {
    return EMPTY_COUNT
  }
  const database = new SqliteDatabase(path)
  try {
    database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`)
    const row = database.prepare('SELECT COUNT(*) AS total FROM sessions').get()
    if (!isTotalRow(row)) {
      return EMPTY_COUNT
    }
    return row.total
  } finally {
    database.close()
  }
}

function isTotalRow(row: unknown): row is TotalRow {
  if (typeof row !== 'object') {
    return false
  }
  if (row === null) {
    return false
  }
  if (!('total' in row)) {
    return false
  }
  return typeof row.total === 'number'
}

function readStoredSession(path: string, sessionId: string): Session | null {
  const probe = new SqliteSessionRepository(path)
  try {
    return probe.findById(sessionId)
  } finally {
    probe.close()
  }
}

function readDatabaseText(path: string): string {
  const files = [path, `${path}-wal`, `${path}-shm`]
  const chunks: string[] = []
  for (const file of files) {
    if (!existsSync(file)) {
      continue
    }
    chunks.push(readFileSync(file).toString('utf8'))
  }
  return chunks.join('\n')
}

async function captureStdout(action: () => Promise<void>): Promise<string> {
  const chunks: string[] = []
  const originalWrite = process.stdout.write
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(readChunk(chunk))
    return true
  }) as typeof process.stdout.write
  try {
    await action()
  } finally {
    process.stdout.write = originalWrite
  }
  return chunks.join('')
}

function readChunk(chunk: string | Uint8Array): string {
  if (typeof chunk === 'string') {
    return chunk
  }
  return Buffer.from(chunk).toString('utf8')
}

function readLogEntries(output: string): Array<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = []
  for (const line of output.split('\n')) {
    if (line === '') {
      continue
    }
    entries.push(readLogEntry(line))
  }
  return entries
}

function readLogEntry(line: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(line)
  if (!isRecord(parsed)) {
    throw new Error('Log line is not an object')
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object') {
    return false
  }
  if (value === null) {
    return false
  }
  return !Array.isArray(value)
}

async function answerEveryQuestion(sessionId: string, optionNumber: OptionPosition): Promise<Response> {
  let response: Response | undefined
  for (const question of surveyCatalog) {
    response = await putAnswer({
      sessionId,
      questionNumber: question.number,
      optionNumber,
    })
    expect(response.status).toBe(HTTP_OK)
  }
  if (response === undefined) {
    throw new Error('Survey catalog is empty')
  }
  return response
}

describe('session routes', () => {
  beforeEach(() => {
    directoryPath = mkdtempSync(join(tmpdir(), TEMP_DIRECTORY_PREFIX))
    databasePath = join(directoryPath, 'event.sqlite')
    previousDatabasePath = process.env.DATABASE_PATH
    previousPublicUrl = process.env.PUBLIC_URL
    previousPanelPassword = process.env.PANEL_PASSWORD
    process.env.DATABASE_PATH = databasePath
    process.env.PUBLIC_URL = PUBLIC_URL
    process.env.PANEL_PASSWORD = PANEL_PASSWORD
  })

  afterEach(() => {
    try {
      closeParticipantRepositories()
    } finally {
      restoreEnv('DATABASE_PATH', previousDatabasePath)
      restoreEnv('PUBLIC_URL', previousPublicUrl)
      restoreEnv('PANEL_PASSWORD', previousPanelPassword)
      rmSync(directoryPath, { recursive: true, force: true })
    }
  })

  it('creates two different sessions from two posts without a cookie', async () => {
    const first = postSession()
    const second = postSession()
    const firstId = readCreatedSessionId(first)
    const secondId = readCreatedSessionId(second)
    const firstBody: unknown = await first.json()
    const secondBody: unknown = await second.json()
    expect(first.status).toBe(HTTP_OK)
    expect(second.status).toBe(HTTP_OK)
    expect(first.headers.get(SET_COOKIE_HEADER)).toBe(buildSessionCookie(firstId))
    expect(second.headers.get(SET_COOKIE_HEADER)).toBe(buildSessionCookie(secondId))
    expect(first.headers.get(CACHE_CONTROL_HEADER)).toBe(NO_STORE_DIRECTIVE)
    expect(firstId).not.toBe(secondId)
    expect(firstBody).toEqual({
      status: OPEN_SESSION_STATUS,
      currentQuestion: FIRST_QUESTION_NUMBER,
      furthestQuestion: FIRST_QUESTION_NUMBER,
      answers: [],
    })
    expect(secondBody).toEqual(firstBody)
    expect(JSON.stringify(firstBody)).not.toContain(firstId)
    expect(JSON.stringify(secondBody)).not.toContain(secondId)
    expect(countSessions(databasePath)).toBe(TWO_SESSIONS)
    expect(readStoredSession(databasePath, firstId)?.id).toBe(firstId)
    expect(readStoredSession(databasePath, secondId)?.id).toBe(secondId)
  })

  it('returns the screen question and the saved answers for the cookie', async () => {
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    const saved = await putAnswer({
      sessionId,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    const replaced = await putAnswer({
      sessionId,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const current = getSession(sessionId, FOREIGN_ORIGIN)
    const body: unknown = await current.json()
    expect(saved.status).toBe(HTTP_OK)
    expect(saved.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(replaced.status).toBe(HTTP_OK)
    expect(current.status).toBe(HTTP_OK)
    expect(current.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(body).toEqual({
      status: OPEN_SESSION_STATUS,
      currentQuestion: SECOND_QUESTION,
      furthestQuestion: SECOND_QUESTION,
      answers: [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION }],
    })
    expect(readStoredSession(databasePath, sessionId)?.answers).toEqual([
      { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION },
    ])
  })

  it('completes on question 10, then refuses another answer with 409', async () => {
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    const completed = await answerEveryQuestion(sessionId, FIRST_OPTION)
    const completedBody: unknown = await completed.json()
    const refused = await putAnswer({
      sessionId,
      questionNumber: QUESTION_COUNT,
      optionNumber: FOURTH_OPTION,
    })
    const current = getSession(sessionId)
    const body: unknown = await current.json()
    const stored = readStoredSession(databasePath, sessionId)
    expect(completedBody).toEqual({
      status: COMPLETED_SESSION_STATUS,
      currentQuestion: QUESTION_COUNT,
      furthestQuestion: QUESTION_COUNT,
      answers: surveyCatalog.map((question) => ({
        questionNumber: question.number,
        optionNumber: FIRST_OPTION,
      })),
    })
    expect(refused.status).toBe(HTTP_CONFLICT)
    expect(await refused.json()).toEqual({ error: CONFLICT_ERROR })
    expect(refused.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(current.status).toBe(HTTP_OK)
    expect(body).toEqual({
      status: COMPLETED_SESSION_STATUS,
      currentQuestion: QUESTION_COUNT,
      furthestQuestion: QUESTION_COUNT,
      answers: surveyCatalog.map((question) => ({
        questionNumber: question.number,
        optionNumber: FIRST_OPTION,
      })),
    })
    expect(stored?.status).toBe(COMPLETED_SESSION_STATUS)
    expect(stored?.answers.find((answer) => answer.questionNumber === QUESTION_COUNT)).toEqual({
      questionNumber: QUESTION_COUNT,
      optionNumber: FIRST_OPTION,
    })
  })

  it('returns 404 for a missing cookie or an unknown id and does not create a session', async () => {
    const missing = getSession(null)
    const unknown = getSession(UNKNOWN_SESSION_ID)
    const refused = await PUT(
      createRequest(`/api/sessoes/atual/respostas/${FIRST_QUESTION_NUMBER}`, {
        method: 'PUT',
        origin: PUBLIC_ORIGIN,
        cookie: `${SESSION_COOKIE_NAME}=${UNKNOWN_SESSION_ID}`,
        body: JSON.stringify({ optionNumber: FIRST_OPTION }),
      }),
      { params: Promise.resolve({ questionNumber: String(FIRST_QUESTION_NUMBER) }) },
    )
    expect(missing.status).toBe(HTTP_NOT_FOUND)
    expect(await missing.json()).toEqual({ error: NOT_FOUND_ERROR })
    expect(missing.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(unknown.status).toBe(HTTP_NOT_FOUND)
    expect(unknown.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(refused.status).toBe(HTTP_NOT_FOUND)
    expect(await refused.json()).toEqual({ error: NOT_FOUND_ERROR })
    expect(refused.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(countSessions(databasePath)).toBe(EMPTY_COUNT)
  })

  it('rejects a mutation whose origin differs from PUBLIC_URL', async () => {
    const foreign = postSession(FOREIGN_ORIGIN)
    const missingOrigin = postSession(null)
    expect(foreign.status).toBe(HTTP_FORBIDDEN)
    expect(await foreign.json()).toEqual({ error: FORBIDDEN_ERROR })
    expect(foreign.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(missingOrigin.status).toBe(HTTP_FORBIDDEN)
    expect(missingOrigin.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(existsSync(databasePath)).toBe(false)
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    const refused = await putAnswer({
      sessionId,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
      origin: FOREIGN_ORIGIN,
    })
    expect(refused.status).toBe(HTTP_FORBIDDEN)
    expect(refused.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(readStoredSession(databasePath, sessionId)?.answers).toEqual([])
    expect(countSessions(databasePath)).toBe(ONE_SESSION)
  })

  it('returns 400 for an option outside the catalog and keeps the session unchanged', async () => {
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    const response = await PUT(
      createRequest(`/api/sessoes/atual/respostas/${FIRST_QUESTION_NUMBER}`, {
        method: 'PUT',
        origin: PUBLIC_ORIGIN,
        cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        body: JSON.stringify({ optionNumber: OPTION_COUNT + FIRST_OPTION_POSITION }),
      }),
      { params: Promise.resolve({ questionNumber: String(FIRST_QUESTION_NUMBER) }) },
    )
    expect(response.status).toBe(HTTP_BAD_REQUEST)
    expect(await response.json()).toEqual({ error: BAD_REQUEST_ERROR })
    expect(response.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(readStoredSession(databasePath, sessionId)?.answers).toEqual([])
    expect(readStoredSession(databasePath, sessionId)?.currentQuestion).toBe(FIRST_QUESTION_NUMBER)
  })

  it('rejects a question segment that is not the decimal 1 to 10', async () => {
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    const response = await PUT(
      createRequest('/api/sessoes/atual/respostas/1e0', {
        method: 'PUT',
        origin: PUBLIC_ORIGIN,
        cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        body: JSON.stringify({ optionNumber: FIRST_OPTION }),
      }),
      { params: Promise.resolve({ questionNumber: '1e0' }) },
    )
    expect(response.status).toBe(HTTP_BAD_REQUEST)
    expect(await response.json()).toEqual({ error: BAD_REQUEST_ERROR })
    expect(response.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(readStoredSession(databasePath, sessionId)?.answers).toEqual([])
  })

  it('does not create another session or replace the cookie when the server fails', async () => {
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    const saved = await putAnswer({
      sessionId,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    expect(saved.status).toBe(HTTP_OK)
    delete process.env.PUBLIC_URL
    const failedPut = await putAnswer({
      sessionId,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const failedPost = postSession()
    const failedPutBody: unknown = await failedPut.json()
    expect(failedPut.status).toBe(HTTP_SERVER_ERROR)
    expect(failedPutBody).toEqual({ error: SERVER_ERROR })
    expect(failedPut.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(JSON.stringify(failedPutBody)).not.toContain(sessionId)
    expect(failedPost.status).toBe(HTTP_SERVER_ERROR)
    expect(failedPost.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(countSessions(databasePath)).toBe(ONE_SESSION)
    process.env.PUBLIC_URL = PUBLIC_URL
    const current = getSession(sessionId)
    const body: unknown = await current.json()
    expect(current.status).toBe(HTTP_OK)
    expect(current.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(body).toEqual({
      status: OPEN_SESSION_STATUS,
      currentQuestion: SECOND_QUESTION,
      furthestQuestion: SECOND_QUESTION,
      answers: [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FIRST_OPTION }],
    })
  })

  it('logs the session and the question number without personal data', async () => {
    let sessionId = ''
    const output = await captureStdout(async () => {
      const created = POST(
        createRequest('/api/sessoes', {
          method: 'POST',
          origin: PUBLIC_ORIGIN,
          userAgent: USER_AGENT,
          forwardedFor: FORWARDED_ADDRESS,
        }),
      )
      sessionId = readCreatedSessionId(created)
      const saved = await PUT(
        createRequest(`/api/sessoes/atual/respostas/${FIRST_QUESTION_NUMBER}`, {
          method: 'PUT',
          origin: PUBLIC_ORIGIN,
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
          userAgent: USER_AGENT,
          forwardedFor: FORWARDED_ADDRESS,
          body: JSON.stringify({
            optionNumber: FOURTH_OPTION,
            name: PERSON_NAME,
            email: CONTACT_EMAIL,
          }),
        }),
        { params: Promise.resolve({ questionNumber: String(FIRST_QUESTION_NUMBER) }) },
      )
      expect(saved.status).toBe(HTTP_OK)
    })
    const entries = readLogEntries(output)
    expect(entries).toEqual([
      { level: INFO_LOG_LEVEL, event: SESSION_CREATED_EVENT },
      { level: INFO_LOG_LEVEL, event: ANSWER_SAVED_EVENT, questionNumber: FIRST_QUESTION_NUMBER },
    ])
    expect(output).not.toContain(sessionId)
    expect(output).not.toContain(PERSON_NAME)
    expect(output).not.toContain(CONTACT_EMAIL)
    expect(output).not.toContain(USER_AGENT)
    expect(output).not.toContain(FORWARDED_ADDRESS)
    expect(output).not.toContain(PANEL_PASSWORD)
    expect(output).not.toContain('optionNumber')
    const storedText = readDatabaseText(databasePath)
    expect(storedText).not.toContain(PERSON_NAME)
    expect(storedText).not.toContain(CONTACT_EMAIL)
    expect(storedText).not.toContain(USER_AGENT)
    expect(storedText).not.toContain(FORWARDED_ADDRESS)
    expect(storedText).not.toContain(PANEL_PASSWORD)
  })
})
