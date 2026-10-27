import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SqliteDatabase from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeSessionRepositories } from '@/adapters/sqlite/session-repository-cache'
import { POST as enterPanel } from '@/app/api/painel/entrar/route'
import { GET as readPanelResults } from '@/app/api/painel/resultados/route'
import { POST as resetPanel } from '@/app/api/painel/zerar/route'
import { GET as readCurrentSession } from '@/app/api/sessoes/atual/route'
import { PUT as saveAnswer } from '@/app/api/sessoes/atual/respostas/[questionNumber]/route'
import { POST as createParticipant } from '@/app/api/sessoes/route'
import { buildPanelCookie, PANEL_COOKIE_NAME } from '@/application/panel-cookie'
import {
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
  TOO_MANY_REQUESTS_ERROR,
  UNAUTHORIZED_ERROR,
} from '@/application/panel-http'
import { clearPasswordFailures, PASSWORD_FAILURE_LIMIT } from '@/application/panel-password'
import {
  BAD_REQUEST_ERROR,
  COOKIE_HEADER,
  FORBIDDEN_ERROR,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_SERVER_ERROR,
  NOT_FOUND_ERROR,
  ORIGIN_HEADER,
  SERVER_ERROR,
  SESSION_COOKIE_NAME,
  readSessionId,
} from '@/application/session-http'
import type { ResultsSnapshot } from '@/domain/results'
import { FIRST_OPTION_POSITION, FIRST_QUESTION_NUMBER } from '@/domain/session'
import { OPTION_COUNT, surveyCatalog, type OptionPosition } from '@/domain/survey-catalog'

const PUBLIC_URL = 'https://evento.test/'
const PUBLIC_ORIGIN = 'https://evento.test'
const FOREIGN_ORIGIN = 'https://outro.test'
const PANEL_PASSWORD = 'SenhaCorretaDoPainelEvento'
const SAME_LENGTH_WRONG = 'SenhaErradaaDoPainelEvento'
const SHORT_PASSWORD = 'curta'
const WRONG_PASSWORD = 'SenhaDigitadaQueNaoPodeVazar'
const COOKIE_SECRET = '0123456789abcdef0123456789abcdef'
const SHORT_SECRET = 'short-secret'
const PERSON_NAME = 'PessoaUnicaMemorias'
const CONTACT_EMAIL = 'pessoa-unica@memorias.test'
const USER_AGENT = 'AgenteUnicoMemorias'
const FORWARDED_ADDRESS = '203.0.113.44'
const TEMP_DIRECTORY_PREFIX = 'memorias-panel-routes-'
const JSON_CONTENT_TYPE = 'application/json'
const CONTENT_TYPE_HEADER = 'content-type'
const USER_AGENT_HEADER = 'user-agent'
const FORWARDED_HEADER = 'x-forwarded-for'
const CACHE_CONTROL_HEADER = 'cache-control'
const NO_STORE_DIRECTIVE = 'no-store'
const SET_COOKIE_HEADER = 'set-cookie'
const BUSY_TIMEOUT_MILLISECONDS = 5000
const EMPTY_COUNT = 0
const ONE_ROW = 1
const ONE_VOTE = 1
const INFO_LOG_LEVEL = 'info'
const WARN_LOG_LEVEL = 'warn'
const PANEL_LOGIN_FAILED_EVENT = 'panel_login_failed'
const PANEL_LOGIN_SUCCEEDED_EVENT = 'panel_login_succeeded'
const EDITION_RESET_EVENT = 'edition_reset'
const COUNT_SESSIONS_SQL = 'SELECT COUNT(*) AS total FROM sessions'
const COUNT_ANSWERS_SQL = 'SELECT COUNT(*) AS total FROM answers'
const FIRST_OPTION: OptionPosition = 1

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

type SeededPanel = {
  sessionId: string
  panelCookie: string
}

let directoryPath: string
let databasePath: string
let previousDatabasePath: string | undefined
let previousPublicUrl: string | undefined
let previousPanelPassword: string | undefined
let previousCookieSecret: string | undefined

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

function postSession(): Response {
  return createParticipant(createRequest('/api/sessoes', { method: 'POST', origin: PUBLIC_ORIGIN }))
}

function getSession(sessionId: string): Response {
  return readCurrentSession(
    createRequest('/api/sessoes/atual', {
      method: 'GET',
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    }),
  )
}

function putAnswer(sessionId: string): Promise<Response> {
  return saveAnswer(
    createRequest(`/api/sessoes/atual/respostas/${FIRST_QUESTION_NUMBER}`, {
      method: 'PUT',
      origin: PUBLIC_ORIGIN,
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      body: JSON.stringify({ optionNumber: FIRST_OPTION }),
    }),
    { params: Promise.resolve({ questionNumber: String(FIRST_QUESTION_NUMBER) }) },
  )
}

function postLogin(
  password: unknown,
  origin: string | null = PUBLIC_ORIGIN,
  extra: Pick<RequestOptions, 'cookie' | 'userAgent' | 'forwardedFor'> = {},
): Promise<Response> {
  return enterPanel(
    createRequest('/api/painel/entrar', {
      method: 'POST',
      origin,
      cookie: extra.cookie,
      userAgent: extra.userAgent,
      forwardedFor: extra.forwardedFor,
      body: JSON.stringify({ password, name: PERSON_NAME, email: CONTACT_EMAIL }),
    }),
  )
}

function getResults(cookie?: string, origin: string | null = null): Response {
  return readPanelResults(
    createRequest('/api/painel/resultados', {
      method: 'GET',
      origin,
      cookie,
    }),
  )
}

function postReset(cookie: string | undefined, body: string, origin: string | null = PUBLIC_ORIGIN): Promise<Response> {
  return resetPanel(
    createRequest('/api/painel/zerar', {
      method: 'POST',
      origin,
      cookie,
      body,
    }),
  )
}

function readCreatedSessionId(response: Response): string {
  const sessionId = readSessionId(response.headers.get(SET_COOKIE_HEADER))
  if (sessionId === null) {
    throw new Error('Session cookie was not set')
  }
  return sessionId
}

function readCookiePair(response: Response): string {
  const header = response.headers.get(SET_COOKIE_HEADER)
  if (header === null) {
    throw new Error('Panel cookie was not set')
  }
  const pair = header.split(';')[0]
  if (pair === undefined) {
    throw new Error('Panel cookie was not set')
  }
  return pair
}

async function seedPanel(): Promise<SeededPanel> {
  const created = postSession()
  const sessionId = readCreatedSessionId(created)
  const saved = await putAnswer(sessionId)
  expect(saved.status).toBe(HTTP_OK)
  const login = await postLogin(PANEL_PASSWORD)
  expect(login.status).toBe(HTTP_OK)
  return { sessionId, panelCookie: readCookiePair(login) }
}

function countRows(path: string, countQuery: string): number {
  if (!existsSync(path)) {
    return EMPTY_COUNT
  }
  const database = new SqliteDatabase(path)
  try {
    database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`)
    const row = database.prepare(countQuery).get()
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

function createZeroCounts(): number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
}

function createCountsFor(optionNumber: OptionPosition): number[] {
  const counts = createZeroCounts()
  counts[optionNumber - FIRST_OPTION_POSITION] = ONE_VOTE
  return counts
}

function createZeroSnapshot(): ResultsSnapshot {
  return {
    participating: EMPTY_COUNT,
    finished: EMPTY_COUNT,
    questions: surveyCatalog.map((question) => ({
      questionNumber: question.number,
      counts: createZeroCounts(),
    })),
  }
}

function createVotedSnapshot(): ResultsSnapshot {
  return {
    participating: ONE_VOTE,
    finished: EMPTY_COUNT,
    questions: surveyCatalog.map((question) => ({
      questionNumber: question.number,
      counts: question.number === FIRST_QUESTION_NUMBER ? createCountsFor(FIRST_OPTION) : createZeroCounts(),
    })),
  }
}

describe('panel routes', () => {
  beforeEach(() => {
    clearPasswordFailures()
    directoryPath = mkdtempSync(join(tmpdir(), TEMP_DIRECTORY_PREFIX))
    databasePath = join(directoryPath, 'event.sqlite')
    previousDatabasePath = process.env.DATABASE_PATH
    previousPublicUrl = process.env.PUBLIC_URL
    previousPanelPassword = process.env.PANEL_PASSWORD
    previousCookieSecret = process.env.COOKIE_SECRET
    process.env.DATABASE_PATH = databasePath
    process.env.PUBLIC_URL = PUBLIC_URL
    process.env.PANEL_PASSWORD = PANEL_PASSWORD
    process.env.COOKIE_SECRET = COOKIE_SECRET
  })

  afterEach(() => {
    try {
      closeSessionRepositories()
    } finally {
      clearPasswordFailures()
      restoreEnv('DATABASE_PATH', previousDatabasePath)
      restoreEnv('PUBLIC_URL', previousPublicUrl)
      restoreEnv('PANEL_PASSWORD', previousPanelPassword)
      restoreEnv('COOKIE_SECRET', previousCookieSecret)
      rmSync(directoryPath, { recursive: true, force: true })
    }
  })

  it('opens the questionnaire without the panel password', () => {
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    expect(created.status).toBe(HTTP_OK)
    expect(created.headers.get(SET_COOKIE_HEADER)).not.toContain(`${PANEL_COOKIE_NAME}=`)
    expect(getSession(sessionId).status).toBe(HTTP_OK)
  })

  it('rejects a wrong password without a cookie and hides the totals', async () => {
    const short = await postLogin(SHORT_PASSWORD)
    const sameLength = await postLogin(SAME_LENGTH_WRONG)
    const numeric = await postLogin(1)
    const hidden = getResults()
    const shortBody: unknown = await short.json()
    const hiddenBody: unknown = await hidden.json()
    expect(SHORT_PASSWORD.length).not.toBe(PANEL_PASSWORD.length)
    expect(SAME_LENGTH_WRONG.length).toBe(PANEL_PASSWORD.length)
    expect(short.status).toBe(HTTP_UNAUTHORIZED)
    expect(short.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(short.headers.get(CACHE_CONTROL_HEADER)).toBe(NO_STORE_DIRECTIVE)
    expect(shortBody).toEqual({ error: UNAUTHORIZED_ERROR })
    expect(JSON.stringify(shortBody)).not.toContain(SHORT_PASSWORD)
    expect(sameLength.status).toBe(HTTP_UNAUTHORIZED)
    expect(sameLength.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(numeric.status).toBe(HTTP_UNAUTHORIZED)
    expect(numeric.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(hidden.status).toBe(HTTP_UNAUTHORIZED)
    expect(hiddenBody).toEqual({ error: UNAUTHORIZED_ERROR })
    expect(JSON.stringify(hiddenBody)).not.toContain('participating')
    expect(JSON.stringify(hiddenBody)).not.toContain('finished')
    expect(JSON.stringify(hiddenBody)).not.toContain('counts')
  })

  it('accepts the password and returns the five counts of each question', async () => {
    const seeded = await seedPanel()
    const results = getResults(seeded.panelCookie)
    const body: unknown = await results.json()
    expect(results.status).toBe(HTTP_OK)
    expect(results.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(results.headers.get(CACHE_CONTROL_HEADER)).toBe(NO_STORE_DIRECTIVE)
    expect(body).toEqual(createVotedSnapshot())
    const login = await postLogin(PANEL_PASSWORD)
    expect(login.headers.get(SET_COOKIE_HEADER)).toBe(buildPanelCookie(COOKIE_SECRET))
    expect(await login.json()).toEqual({})
  })

  it('returns 401 when the panel cookie is missing or forged', async () => {
    const seeded = await seedPanel()
    const missing = getResults()
    const participantOnly = getResults(`${SESSION_COOKIE_NAME}=${seeded.sessionId}`)
    const forged = getResults(`${PANEL_COOKIE_NAME}=forged-token`)
    const foreignOrigin = getResults(seeded.panelCookie, FOREIGN_ORIGIN)
    expect(missing.status).toBe(HTTP_UNAUTHORIZED)
    expect(await missing.json()).toEqual({ error: UNAUTHORIZED_ERROR })
    expect(participantOnly.status).toBe(HTTP_UNAUTHORIZED)
    expect(JSON.stringify(await participantOnly.json())).not.toContain('participating')
    expect(forged.status).toBe(HTTP_UNAUTHORIZED)
    expect(forged.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(foreignOrigin.status).toBe(HTTP_OK)
    expect(await foreignOrigin.json()).toEqual(createVotedSnapshot())
  })

  it('keeps the rows when reset is not confirmed', async () => {
    const seeded = await seedPanel()
    const rejectedBodies = ['{}', '{"confirm":false}', '{"confirm":"true"}', '{"confirm":1}', 'nao-json', '']
    for (const body of rejectedBodies) {
      const response = await postReset(seeded.panelCookie, body)
      expect(response.status).toBe(HTTP_BAD_REQUEST)
      expect(await response.json()).toEqual({ error: BAD_REQUEST_ERROR })
      expect(response.headers.get(SET_COOKIE_HEADER)).toBeNull()
    }
    const missingCookie = await postReset(undefined, JSON.stringify({ confirm: true }))
    const foreign = await postReset(seeded.panelCookie, JSON.stringify({ confirm: true }), FOREIGN_ORIGIN)
    expect(missingCookie.status).toBe(HTTP_UNAUTHORIZED)
    expect(foreign.status).toBe(HTTP_FORBIDDEN)
    expect(await foreign.json()).toEqual({ error: FORBIDDEN_ERROR })
    expect(countRows(databasePath, COUNT_SESSIONS_SQL)).toBe(ONE_ROW)
    expect(countRows(databasePath, COUNT_ANSWERS_SQL)).toBe(ONE_ROW)
    expect(getSession(seeded.sessionId).status).toBe(HTTP_OK)
    expect(await getResults(seeded.panelCookie).json()).toEqual(createVotedSnapshot())
  })

  it('deletes sessions and answers when reset is confirmed', async () => {
    const seeded = await seedPanel()
    const reset = await postReset(seeded.panelCookie, JSON.stringify({ confirm: true }))
    const resetBody: unknown = await reset.json()
    const current = getSession(seeded.sessionId)
    const results = getResults(seeded.panelCookie)
    expect(reset.status).toBe(HTTP_OK)
    expect(reset.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(resetBody).toEqual(createZeroSnapshot())
    expect(current.status).toBe(HTTP_NOT_FOUND)
    expect(await current.json()).toEqual({ error: NOT_FOUND_ERROR })
    expect(await results.json()).toEqual(createZeroSnapshot())
    expect(countRows(databasePath, COUNT_SESSIONS_SQL)).toBe(EMPTY_COUNT)
    expect(countRows(databasePath, COUNT_ANSWERS_SQL)).toBe(EMPTY_COUNT)
    const reopened = postSession()
    expect(reopened.status).toBe(HTTP_OK)
    expect(readCreatedSessionId(reopened)).not.toBe(seeded.sessionId)
  })

  it('returns 429 on the eleventh failure and omits the typed password from the log', async () => {
    const output = await captureStdout(async () => {
      for (let attempt = 0; attempt < PASSWORD_FAILURE_LIMIT; attempt += 1) {
        const response = await postLogin(WRONG_PASSWORD, PUBLIC_ORIGIN, {
          userAgent: USER_AGENT,
          forwardedFor: FORWARDED_ADDRESS,
        })
        expect(response.status).toBe(HTTP_UNAUTHORIZED)
        expect(response.headers.get(SET_COOKIE_HEADER)).toBeNull()
      }
      const blocked = await postLogin(WRONG_PASSWORD, PUBLIC_ORIGIN, {
        userAgent: USER_AGENT,
        forwardedFor: FORWARDED_ADDRESS,
      })
      const blockedBody: unknown = await blocked.json()
      const correct = await postLogin(PANEL_PASSWORD)
      expect(blocked.status).toBe(HTTP_TOO_MANY_REQUESTS)
      expect(blocked.headers.get(SET_COOKIE_HEADER)).toBeNull()
      expect(blockedBody).toEqual({ error: TOO_MANY_REQUESTS_ERROR })
      expect(JSON.stringify(blockedBody)).not.toContain('participating')
      expect(JSON.stringify(blockedBody)).not.toContain(WRONG_PASSWORD)
      expect(correct.status).toBe(HTTP_TOO_MANY_REQUESTS)
      expect(correct.headers.get(SET_COOKIE_HEADER)).toBeNull()
    })
    const entries = readLogEntries(output)
    expect(entries).toHaveLength(PASSWORD_FAILURE_LIMIT + 2)
    for (const entry of entries) {
      expect(entry).toEqual({ level: WARN_LOG_LEVEL, event: PANEL_LOGIN_FAILED_EVENT })
    }
    expect(output).not.toContain(WRONG_PASSWORD)
    expect(output).not.toContain(PANEL_PASSWORD)
    expect(output).not.toContain(COOKIE_SECRET)
    expect(output).not.toContain(USER_AGENT)
    expect(output).not.toContain(FORWARDED_ADDRESS)
    expect(output).not.toContain(PERSON_NAME)
    expect(output).not.toContain(CONTACT_EMAIL)
  })

  it('logs panel access without the password, address, or session id', async () => {
    const created = postSession()
    const sessionId = readCreatedSessionId(created)
    const output = await captureStdout(async () => {
      const failed = await postLogin(WRONG_PASSWORD, PUBLIC_ORIGIN, {
        cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        userAgent: USER_AGENT,
        forwardedFor: FORWARDED_ADDRESS,
      })
      const succeeded = await postLogin(PANEL_PASSWORD, PUBLIC_ORIGIN, {
        cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        userAgent: USER_AGENT,
        forwardedFor: FORWARDED_ADDRESS,
      })
      const reset = await postReset(readCookiePair(succeeded), JSON.stringify({ confirm: true }), PUBLIC_ORIGIN)
      expect(failed.status).toBe(HTTP_UNAUTHORIZED)
      expect(succeeded.status).toBe(HTTP_OK)
      expect(reset.status).toBe(HTTP_OK)
    })
    expect(readLogEntries(output)).toEqual([
      { level: WARN_LOG_LEVEL, event: PANEL_LOGIN_FAILED_EVENT },
      { level: INFO_LOG_LEVEL, event: PANEL_LOGIN_SUCCEEDED_EVENT },
      { level: INFO_LOG_LEVEL, event: EDITION_RESET_EVENT },
    ])
    expect(output).not.toContain(sessionId)
    expect(output).not.toContain(PANEL_PASSWORD)
    expect(output).not.toContain(WRONG_PASSWORD)
    expect(output).not.toContain(COOKIE_SECRET)
    expect(output).not.toContain(USER_AGENT)
    expect(output).not.toContain(FORWARDED_ADDRESS)
    expect(output).not.toContain(PERSON_NAME)
    expect(output).not.toContain(CONTACT_EMAIL)
    const storedText = readDatabaseText(databasePath)
    expect(storedText).not.toContain(PANEL_PASSWORD)
    expect(storedText).not.toContain(WRONG_PASSWORD)
    expect(storedText).not.toContain(COOKIE_SECRET)
    expect(storedText).not.toContain(USER_AGENT)
    expect(storedText).not.toContain(FORWARDED_ADDRESS)
    expect(storedText).not.toContain(PERSON_NAME)
  })

  it('rejects a panel mutation from another origin', async () => {
    const seeded = await seedPanel()
    const foreignLogin = await postLogin(PANEL_PASSWORD, FOREIGN_ORIGIN)
    const missingOrigin = await postLogin(PANEL_PASSWORD, null)
    expect(foreignLogin.status).toBe(HTTP_FORBIDDEN)
    expect(foreignLogin.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(await foreignLogin.json()).toEqual({ error: FORBIDDEN_ERROR })
    expect(missingOrigin.status).toBe(HTTP_FORBIDDEN)
    expect(missingOrigin.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(countRows(databasePath, COUNT_SESSIONS_SQL)).toBe(ONE_ROW)
    expect(seeded.panelCookie).toContain(`${PANEL_COOKIE_NAME}=`)
  })

  it('returns 500 when the panel secret is missing and does not set a cookie', async () => {
    delete process.env.PANEL_PASSWORD
    const missingPassword = await postLogin(PANEL_PASSWORD)
    expect(missingPassword.status).toBe(HTTP_SERVER_ERROR)
    expect(missingPassword.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(await missingPassword.json()).toEqual({ error: SERVER_ERROR })
    process.env.PANEL_PASSWORD = PANEL_PASSWORD
    process.env.COOKIE_SECRET = SHORT_SECRET
    const shortSecret = await postLogin(PANEL_PASSWORD)
    expect(shortSecret.status).toBe(HTTP_SERVER_ERROR)
    expect(shortSecret.headers.get(SET_COOKIE_HEADER)).toBeNull()
    expect(await shortSecret.json()).toEqual({ error: SERVER_ERROR })
  })
})
