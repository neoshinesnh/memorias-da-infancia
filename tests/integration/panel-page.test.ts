import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SqliteDatabase from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeSessionRepositories } from '@/adapters/sqlite/session-repository-cache'
import { POST as enterPanel } from '@/app/api/painel/entrar/route'
import { GET as readPanelResults } from '@/app/api/painel/resultados/route'
import { POST as resetPanel } from '@/app/api/painel/zerar/route'
import { PUT as saveAnswer } from '@/app/api/sessoes/atual/respostas/[questionNumber]/route'
import { POST as createParticipant } from '@/app/api/sessoes/route'
import { HTTP_UNAUTHORIZED } from '@/application/panel-http'
import { clearPasswordFailures } from '@/application/panel-password'
import {
  COOKIE_HEADER,
  HTTP_BAD_REQUEST,
  HTTP_OK,
  ORIGIN_HEADER,
  SESSION_COOKIE_NAME,
  readSessionId,
} from '@/application/session-http'
import { createPanelDocument } from '@/components/panel-document'
import { readResultsEventData } from '@/components/panel-live'
import { PANEL_ROTATION_MS } from '@/components/panel-rotation'
import { PanelScreen, type PanelActions } from '@/components/panel-screen'
import { createPanelBoardStore, type PanelBoardState } from '@/components/panel-board-store'
import {
  EMPTY_RESULTS_MESSAGE,
  PASSWORD_LABEL,
} from '@/components/panel-copy'
import type { ResultsSnapshot } from '@/domain/results'
import { FIRST_OPTION_POSITION, FIRST_QUESTION_NUMBER } from '@/domain/session'
import { OPTION_COUNT, type QuestionNumber } from '@/domain/survey-catalog'

const PUBLIC_URL = 'https://evento.test/'
const PUBLIC_ORIGIN = 'https://evento.test'
const PANEL_PASSWORD = 'SenhaCorretaDoPainelEvento'
const WRONG_PASSWORD = 'SenhaDigitadaQueNaoPodeVazar'
const COOKIE_SECRET = '0123456789abcdef0123456789abcdef'
const TEMP_DIRECTORY_PREFIX = 'memorias-panel-page-'
const JSON_CONTENT_TYPE = 'application/json'
const CONTENT_TYPE_HEADER = 'content-type'
const SET_COOKIE_HEADER = 'set-cookie'
const BUSY_TIMEOUT_MILLISECONDS = 5000
const EMPTY_COUNT = 0
const SECOND_QUESTION: QuestionNumber = 2
const THIRD_QUESTION: QuestionNumber = 3
const START = 0
const COUNT_SESSIONS_SQL = 'SELECT COUNT(*) AS total FROM sessions'

const idleActions: PanelActions = {
  chooseQuestion: () => undefined,
  pause: () => undefined,
  resume: () => undefined,
  askReset: () => undefined,
  cancelReset: () => undefined,
  confirmReset: () => undefined,
}

type RequestOptions = {
  method: string
  origin?: string
  cookie?: string
  body?: string
}

type TotalRow = {
  total: number
}

type ResetLog = {
  calls: number
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

function postSession(): Response {
  return createParticipant(createRequest('/api/sessoes', { method: 'POST', origin: PUBLIC_ORIGIN }))
}

function putFirstAnswer(sessionId: string): Promise<Response> {
  return saveAnswer(
    createRequest(`/api/sessoes/atual/respostas/${FIRST_QUESTION_NUMBER}`, {
      method: 'PUT',
      origin: PUBLIC_ORIGIN,
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      body: JSON.stringify({ optionNumber: FIRST_OPTION_POSITION }),
    }),
    { params: Promise.resolve({ questionNumber: String(FIRST_QUESTION_NUMBER) }) },
  )
}

function postLogin(password: string): Promise<Response> {
  return enterPanel(
    createRequest('/api/painel/entrar', {
      method: 'POST',
      origin: PUBLIC_ORIGIN,
      body: JSON.stringify({ password }),
    }),
  )
}

function getResults(cookie: string): Response {
  return readPanelResults(createRequest('/api/painel/resultados', { method: 'GET', cookie }))
}

function postReset(cookie: string, body: string): Promise<Response> {
  return resetPanel(
    createRequest('/api/painel/zerar', {
      method: 'POST',
      origin: PUBLIC_ORIGIN,
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

async function readSnapshot(response: Response): Promise<ResultsSnapshot> {
  const body: unknown = await response.json()
  const snapshot = readResultsEventData(JSON.stringify(body))
  if (snapshot === null) {
    throw new Error('Results snapshot is missing')
  }
  return snapshot
}

async function seedAnswer(): Promise<string> {
  const created = postSession()
  const sessionId = readCreatedSessionId(created)
  const saved = await putFirstAnswer(sessionId)
  expect(saved.status).toBe(HTTP_OK)
  return sessionId
}

async function seedPanel(): Promise<string> {
  await seedAnswer()
  const login = await postLogin(PANEL_PASSWORD)
  expect(login.status).toBe(HTTP_OK)
  return readCookiePair(login)
}

function renderDocument(cookieHeader: string | null): Promise<string> {
  return createPanelDocument(cookieHeader).then((element) => renderToStaticMarkup(element))
}

function renderState(state: PanelBoardState): string {
  return renderToStaticMarkup(
    createElement(PanelScreen, {
      state,
      address: PUBLIC_URL,
      codeMarkup: '<svg viewBox="0 0 1 1"></svg>',
      actions: idleActions,
    }),
  )
}

function countOccurrences(source: string, token: string): number {
  return source.split(token).length - 1
}

function countSessions(): number {
  if (!existsSync(databasePath)) {
    return EMPTY_COUNT
  }
  const database = new SqliteDatabase(databasePath)
  try {
    database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`)
    const row = database.prepare(COUNT_SESSIONS_SQL).get()
    if (!isTotalRow(row)) {
      return EMPTY_COUNT
    }
    return row.total
  } finally {
    database.close()
  }
}

function isTotalRow(row: unknown): row is TotalRow {
  if (typeof row !== 'object' || row === null) {
    return false
  }
  if (!('total' in row)) {
    return false
  }
  return typeof row.total === 'number'
}

describe('panel page', () => {
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
      restoreEnv('DATABASE_PATH', previousDatabasePath)
      restoreEnv('PUBLIC_URL', previousPublicUrl)
      restoreEnv('PANEL_PASSWORD', previousPanelPassword)
      restoreEnv('COOKIE_SECRET', previousCookieSecret)
      rmSync(directoryPath, { recursive: true, force: true })
    }
  })

  it('keeps a wrong password on the entry and hides the totals', async () => {
    await seedAnswer()
    const rejected = await postLogin(WRONG_PASSWORD)
    const body = await rejected.text()
    const markup = await renderDocument(null)
    expect(rejected.status).toBe(HTTP_UNAUTHORIZED)
    expect(body).not.toContain('participando')
    expect(body).not.toContain('Pião')
    expect(markup).toContain(PASSWORD_LABEL)
    expect(markup).toContain('type="password"')
    expect(markup).not.toContain('participando')
    expect(markup).not.toContain('finalizaram')
    expect(markup).not.toContain('Pião')
    expect(markup).not.toContain('<svg')
    expect(markup).not.toContain(PUBLIC_URL)
    expect(markup).not.toContain('127.0.0.1')
    expect(countSessions()).toBe(1)
  })

  it('shows one question, the public address and the stored portrait', async () => {
    const cookie = await seedPanel()
    const snapshot = await readSnapshot(getResults(cookie))
    const markup = await renderDocument(cookie)
    expect(snapshot.participating).toBe(1)
    expect(snapshot.finished).toBe(EMPTY_COUNT)
    expect(markup).toContain('https://evento.test/')
    expect(markup).toContain('<svg')
    expect(markup).toContain('var(--cor-tinta)')
    expect(markup).not.toContain('localhost')
    expect(markup).not.toContain('127.0.0.1')
    expect(markup).not.toContain('type="password"')
    expect(markup).toContain('Com qual brinquedo você mais brincava?')
    expect(markup).not.toContain('Onde você morava na infância?')
    expect(markup).toContain('1 participando / 0 finalizaram')
    expect(markup).toContain('Pião: 1 (100%)')
    expect(markup).toContain('Pular corda: 0 (0%)')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-atomic="true"')
    expect(markup).toContain('Ao vivo')
    expect(countOccurrences(markup, '<h2')).toBe(1)
    expect(countOccurrences(markup, 'panel-bar-fill')).toBe(OPTION_COUNT)
  })

  it('shows the chosen question and pauses until rotation resumes', async () => {
    const cookie = await seedPanel()
    const snapshot = await readSnapshot(getResults(cookie))
    const store = createPanelBoardStore({ resetEdition: async () => null }, { now: START, snapshot })
    store.chooseQuestion(SECOND_QUESTION)
    const chosen = renderState(store.readState())
    store.resume(START)
    store.tick(PANEL_ROTATION_MS)
    const resumed = renderState(store.readState())
    expect(store.readState().rotation.running).toBe(true)
    expect(store.readState().rotation.questionNumber).toBe(THIRD_QUESTION)
    expect(chosen).toContain('Onde você morava na infância?')
    expect(chosen).toContain(EMPTY_RESULTS_MESSAGE)
    expect(chosen).toContain('Retomar rotação')
    expect(chosen).not.toContain('Pausar rotação')
    expect(chosen).not.toContain('Com qual brinquedo você mais brincava?')
    expect(countOccurrences(chosen, '<h2')).toBe(1)
    expect(countOccurrences(chosen, 'panel-bar-fill')).toBe(OPTION_COUNT)
    expect(resumed).toContain('Como você ia para a escola?')
    expect(resumed).toContain('Pausar rotação')
    expect(cookie.startsWith('painel=')).toBe(true)
  })

  it('cancels a reset without deleting and confirms one without reloading', async () => {
    const cookie = await seedPanel()
    const snapshot = await readSnapshot(getResults(cookie))
    const log: ResetLog = { calls: 0 }
    const store = createPanelBoardStore({
      resetEdition: async () => {
        log.calls += 1
        const response = await postReset(cookie, JSON.stringify({ confirm: true }))
        expect(response.status).toBe(HTTP_OK)
        return readSnapshot(response)
      },
    }, { now: START, snapshot })
    store.askReset()
    const asking = renderState(store.readState())
    store.cancelReset()
    const cancelled = renderState(store.readState())
    const refused = await postReset(cookie, JSON.stringify({ confirm: false }))
    expect(asking).toContain('Confirmar zeragem')
    expect(asking).toContain('Cancelar')
    expect(asking).toContain('1 participando / 0 finalizaram')
    expect(log.calls).toBe(EMPTY_COUNT)
    expect(cancelled).toContain('Zerar resultados')
    expect(cancelled).not.toContain('Confirmar zeragem')
    expect(refused.status).toBe(HTTP_BAD_REQUEST)
    expect(countSessions()).toBe(1)
    expect(store.readState().snapshot.participating).toBe(1)
    store.askReset()
    await store.confirmReset()
    const cleared = renderState(store.readState())
    expect(log.calls).toBe(1)
    expect(store.readState().confirmingReset).toBe(false)
    expect(cleared).toContain('0 participando / 0 finalizaram')
    expect(cleared).toContain('Pião: 0 (0%)')
    expect(cleared).toContain(EMPTY_RESULTS_MESSAGE)
    expect(cleared).toContain('panel-bar-fill')
    expect(countSessions()).toBe(EMPTY_COUNT)
  })
})
