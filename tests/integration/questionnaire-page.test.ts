import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SqliteDatabase from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeParticipantRepositories } from '@/adapters/http/participant-session'
import { SqliteSessionRepository } from '@/adapters/sqlite/sqlite-session-repository'
import {
  COOKIE_HEADER,
  HTTP_SERVER_ERROR,
  ORIGIN_HEADER,
  SESSION_COOKIE_NAME,
  readSessionId,
} from '@/application/session-http'
import { LOADING_LABEL, REGISTERED_MESSAGE, RETRY_LABEL, SAVE_ERROR_MESSAGE, THANKS_MESSAGE } from '@/components/questionnaire-copy'
import type { QuestionnaireFlow } from '@/components/questionnaire-flow'
import { QuestionnaireScreen } from '@/components/questionnaire-screen'
import { createQuestionnaireStore, type QuestionnaireStore } from '@/components/questionnaire-store'
import { readSessionResponse, type SessionTransport } from '@/components/session-transport'
import HomePage from '@/app/page'
import { GET } from '@/app/api/sessoes/atual/route'
import { PUT } from '@/app/api/sessoes/atual/respostas/[questionNumber]/route'
import { POST } from '@/app/api/sessoes/route'
import { FIRST_OPTION_POSITION, FIRST_QUESTION_NUMBER } from '@/domain/session'
import { OPTION_COUNT, QUESTION_COUNT, type OptionPosition, type QuestionNumber } from '@/domain/survey-catalog'

const PUBLIC_URL = 'https://evento.test/'
const PUBLIC_ORIGIN = 'https://evento.test'
const TEMP_DIRECTORY_PREFIX = 'memorias-questionnaire-'
const JSON_CONTENT_TYPE = 'application/json'
const CONTENT_TYPE_HEADER = 'content-type'
const SET_COOKIE_HEADER = 'set-cookie'
const EMPTY_COUNT = 0
const BUSY_TIMEOUT_MILLISECONDS = 5000
const SECOND_QUESTION: QuestionNumber = 2
const FOURTH_OPTION: OptionPosition = 4

type RequestOptions = {
  method: string
  origin?: string
  cookie?: string
  body?: string
}

type TransportGuard = {
  failReads: boolean
  saveFailures: number
  creates: number
}

type IdRow = {
  id: string
}

let directoryPath: string
let databasePath: string
let previousDatabasePath: string | undefined
let previousPublicUrl: string | undefined

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
  if (options.origin !== undefined) {
    headers.set(ORIGIN_HEADER, options.origin)
  }
  if (options.cookie !== undefined) {
    headers.set(COOKIE_HEADER, options.cookie)
  }
  return new Request(`${PUBLIC_ORIGIN}${path}`, {
    method: options.method,
    headers,
    body: options.body,
  })
}

function createRouteTransport(): SessionTransport {
  let cookie: string | undefined
  return {
    readCurrent: async () => {
      const response = GET(createRequest('/api/sessoes/atual', { method: 'GET', cookie }))
      return readSessionResponse(response)
    },
    createSession: async () => {
      const response = POST(createRequest('/api/sessoes', { method: 'POST', origin: PUBLIC_ORIGIN }))
      cookie = readCookieHeader(response) ?? cookie
      return readSessionResponse(response)
    },
    saveAnswer: async (attempt) => {
      const response = await PUT(
        createRequest(`/api/sessoes/atual/respostas/${attempt.questionNumber}`, {
          method: 'PUT',
          origin: PUBLIC_ORIGIN,
          cookie,
          body: JSON.stringify({ optionNumber: attempt.optionNumber }),
        }),
        { params: Promise.resolve({ questionNumber: String(attempt.questionNumber) }) },
      )
      return readSessionResponse(response)
    },
  }
}

function createGuardedTransport(inner: SessionTransport, guard: TransportGuard): SessionTransport {
  return {
    readCurrent: () => {
      if (guard.failReads) {
        return Promise.resolve({ status: HTTP_SERVER_ERROR, payload: null })
      }
      return inner.readCurrent()
    },
    createSession: async () => {
      guard.creates += 1
      return inner.createSession()
    },
    saveAnswer: (attempt) => {
      if (guard.saveFailures > EMPTY_COUNT) {
        guard.saveFailures -= 1
        return Promise.resolve({ status: HTTP_SERVER_ERROR, payload: null })
      }
      return inner.saveAnswer(attempt)
    },
  }
}

function readCookieHeader(response: Response): string | undefined {
  const sessionId = readSessionId(response.headers.get(SET_COOKIE_HEADER))
  if (sessionId === null) {
    return undefined
  }
  return `${SESSION_COOKIE_NAME}=${sessionId}`
}

function renderScreen(flow: QuestionnaireFlow): string {
  return renderToStaticMarkup(
    createElement(QuestionnaireScreen, {
      flow,
      onChoose: () => undefined,
      onRetry: () => undefined,
      onReturn: () => undefined,
    }),
  )
}

function countOccurrences(source: string, token: string): number {
  return source.split(token).length - 1
}

async function answerRemaining(store: QuestionnaireStore, optionNumber: OptionPosition): Promise<void> {
  let remaining = QUESTION_COUNT
  while (remaining > EMPTY_COUNT && store.readFlow().phase === 'question') {
    await store.choose(optionNumber)
    remaining -= 1
  }
}

function eraseSessions(): void {
  closeParticipantRepositories()
  const repository = new SqliteSessionRepository(databasePath)
  try {
    repository.deleteAll()
  } finally {
    repository.close()
  }
}

function readSessionIds(path: string): string[] {
  if (!existsSync(path)) {
    return []
  }
  const database = new SqliteDatabase(path)
  try {
    database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`)
    const rows = database.prepare('SELECT id FROM sessions ORDER BY created_at').all()
    return rows.filter(isIdRow).map((row) => row.id)
  } finally {
    database.close()
  }
}

function countSessions(path: string): number {
  return readSessionIds(path).length
}

function isIdRow(value: unknown): value is IdRow {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('id' in value)) {
    return false
  }
  return typeof value.id === 'string'
}

describe('questionnaire page', () => {
  beforeEach(() => {
    directoryPath = mkdtempSync(join(tmpdir(), TEMP_DIRECTORY_PREFIX))
    databasePath = join(directoryPath, 'event.sqlite')
    previousDatabasePath = process.env.DATABASE_PATH
    previousPublicUrl = process.env.PUBLIC_URL
    process.env.DATABASE_PATH = databasePath
    process.env.PUBLIC_URL = PUBLIC_URL
  })

  afterEach(() => {
    try {
      closeParticipantRepositories()
    } finally {
      restoreEnv('DATABASE_PATH', previousDatabasePath)
      restoreEnv('PUBLIC_URL', previousPublicUrl)
      rmSync(directoryPath, { recursive: true, force: true })
    }
  })

  it('opens on question 1 without a welcome screen', async () => {
    const store = createQuestionnaireStore(createRouteTransport())
    await store.start()
    const markup = renderScreen(store.readFlow())
    const home = renderToStaticMarkup(createElement(HomePage))
    expect(store.readFlow().phase).toBe('question')
    expect(store.readFlow().displayedQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(markup).toContain('Com qual brinquedo você mais brincava?')
    expect(markup).toContain('Pergunta 1 de 10')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('role="progressbar"')
    expect(markup).not.toContain('Voltar')
    expect(markup).not.toContain('Próxima')
    expect(markup).not.toContain('type="text"')
    expect(markup).not.toContain('type="email"')
    expect(markup).not.toContain('type="tel"')
    expect(markup).not.toContain('type="file"')
    expect(countOccurrences(markup, 'type="radio"')).toBe(OPTION_COUNT)
    expect(home).toContain(LOADING_LABEL)
    expect(home).not.toContain('Bem-vindo')
  })

  it('saves on the option, goes back, and replaces the previous choice', async () => {
    const store = createQuestionnaireStore(createRouteTransport())
    await store.start()
    await store.choose(FIRST_OPTION_POSITION)
    const advanced = renderScreen(store.readFlow())
    store.goBack()
    const returned = renderScreen(store.readFlow())
    await store.choose(FOURTH_OPTION)
    expect(store.readFlow().displayedQuestion).toBe(SECOND_QUESTION)
    expect(store.readFlow().payload?.answers).toEqual([
      { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION },
    ])
    expect(advanced).toContain('Pergunta 2 de 10')
    expect(advanced).toContain('Onde você morava na infância?')
    expect(advanced).toContain('Voltar')
    expect(advanced).toContain('sticker-slot--filled')
    expect(advanced).toContain('sticker-slot--arriving')
    expect(advanced).not.toContain('Próxima')
    expect(returned).toContain('answer-option--selected')
    expect(returned).toContain('Pião')
  })

  it('thanks the participant and hides voting when the same session is reopened', async () => {
    const transport = createRouteTransport()
    const store = createQuestionnaireStore(transport)
    await store.start()
    await answerRemaining(store, FIRST_OPTION_POSITION)
    const thanks = renderScreen(store.readFlow())
    const reopened = createQuestionnaireStore(transport)
    await reopened.start()
    const registered = renderScreen(reopened.readFlow())
    expect(store.readFlow().phase).toBe('thanks')
    expect(reopened.readFlow().phase).toBe('registered')
    expect(thanks).toContain(THANKS_MESSAGE)
    expect(thanks).not.toContain(REGISTERED_MESSAGE)
    expect(thanks).not.toContain('type="radio"')
    expect(registered).toContain(REGISTERED_MESSAGE)
    expect(registered).not.toContain(THANKS_MESSAGE)
    expect(registered).not.toContain('type="radio"')
    expect(registered).toContain('role="progressbar"')
  })

  it('shows the save error and retries the same answer', async () => {
    const guard: TransportGuard = { failReads: false, saveFailures: 1, creates: 0 }
    const store = createQuestionnaireStore(createGuardedTransport(createRouteTransport(), guard))
    await store.start()
    await store.choose(FOURTH_OPTION)
    const failed = renderScreen(store.readFlow())
    await store.retry()
    expect(store.readFlow().phase).toBe('question')
    expect(store.readFlow().displayedQuestion).toBe(SECOND_QUESTION)
    expect(store.readFlow().payload?.answers[0]?.optionNumber).toBe(FOURTH_OPTION)
    expect(guard.creates).toBe(1)
    expect(failed).toContain(SAVE_ERROR_MESSAGE)
    expect(failed).toContain(RETRY_LABEL)
    expect(failed).toContain('type="radio"')
    expect(countSessions(databasePath)).toBe(1)
  })

  it('opens a clean question when the saved session disappears', async () => {
    const store = createQuestionnaireStore(createRouteTransport())
    await store.start()
    await store.choose(FOURTH_OPTION)
    const previousIds = readSessionIds(databasePath)
    eraseSessions()
    await store.refresh()
    const nextIds = readSessionIds(databasePath)
    const markup = renderScreen(store.readFlow())
    expect(previousIds).toHaveLength(1)
    expect(nextIds).toHaveLength(1)
    expect(nextIds[0]).not.toBe(previousIds[0])
    expect(store.readFlow().phase).toBe('question')
    expect(store.readFlow().displayedQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(store.readFlow().payload?.answers).toEqual([])
    expect(markup).toContain('Pergunta 1 de 10')
    expect(markup).not.toContain('answer-option--selected')
  })

  it('keeps the answers when the session poll fails', async () => {
    const guard: TransportGuard = { failReads: false, saveFailures: 0, creates: 0 }
    const store = createQuestionnaireStore(createGuardedTransport(createRouteTransport(), guard))
    await store.start()
    await store.choose(FIRST_OPTION_POSITION)
    const createsAfterStart = guard.creates
    guard.failReads = true
    await store.refresh()
    expect(guard.creates).toBe(createsAfterStart)
    expect(store.readFlow().payload?.answers).toHaveLength(1)
    expect(store.readFlow().displayedQuestion).toBe(SECOND_QUESTION)
    expect(countSessions(databasePath)).toBe(1)
  })
})
