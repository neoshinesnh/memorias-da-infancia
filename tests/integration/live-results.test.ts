import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readResultsPublisher } from '@/adapters/realtime/in-process-publisher'
import type { InMemorySessionRepository } from '@/adapters/memory/in-memory-session-repository'
import { closeSessionRepositories, readMemoryRepository } from '@/adapters/supabase/session-repository-cache'
import { MEMORY_SESSION_STORE, SESSION_STORE_VARIABLE } from '@/adapters/supabase/session-store-mode'
import { GET as readPanelEvents } from '@/app/api/painel/eventos/route'
import { POST as enterPanel } from '@/app/api/painel/entrar/route'
import { GET as readPanelResults } from '@/app/api/painel/resultados/route'
import { POST as resetPanel } from '@/app/api/painel/zerar/route'
import { GET as readCurrentSession } from '@/app/api/sessoes/atual/route'
import { PUT as saveAnswer } from '@/app/api/sessoes/atual/respostas/[questionNumber]/route'
import { POST as createParticipant } from '@/app/api/sessoes/route'
import { formatHeartbeatComment, PANEL_HEARTBEAT_MILLISECONDS } from '@/application/panel-stream'
import { HTTP_UNAUTHORIZED, UNAUTHORIZED_ERROR } from '@/application/panel-http'
import { clearPasswordFailures } from '@/application/panel-password'
import {
  COOKIE_HEADER,
  HTTP_NOT_FOUND,
  HTTP_OK,
  ORIGIN_HEADER,
  SESSION_COOKIE_NAME,
  readSessionId,
} from '@/application/session-http'
import { readResultsEventData } from '@/components/panel-live'
import type { ResultsSnapshot } from '@/domain/results'
import { FIRST_OPTION_POSITION, FIRST_QUESTION_NUMBER } from '@/domain/session'
import { OPTION_COUNT, surveyCatalog, type OptionPosition } from '@/domain/survey-catalog'

const PUBLIC_URL = 'https://evento.test/'
const PUBLIC_ORIGIN = 'https://evento.test'
const PANEL_PASSWORD = 'SenhaCorretaDoPainelEvento'
const COOKIE_SECRET = '0123456789abcdef0123456789abcdef'
const USER_AGENT = 'AgenteUnicoMemorias'
const FORWARDED_ADDRESS = '203.0.113.44'
const JSON_CONTENT_TYPE = 'application/json'
const CONTENT_TYPE_HEADER = 'content-type'
const USER_AGENT_HEADER = 'user-agent'
const FORWARDED_HEADER = 'x-forwarded-for'
const CACHE_CONTROL_HEADER = 'cache-control'
const ACCEL_BUFFERING_HEADER = 'x-accel-buffering'
const SET_COOKIE_HEADER = 'set-cookie'
const NO_CACHE_DIRECTIVE = 'no-cache'
const NO_BUFFER_DIRECTIVE = 'no'
const EVENT_STREAM_TYPE = 'text/event-stream'
const RESULTS_EVENT_LINE = 'event: resultados'
const FRAME_BOUNDARY = '\n\n'
const DATA_PREFIX = 'data: '
const MISSING_SEPARATOR = -1
const FRAME_WAIT_MILLISECONDS = 1000
const HEARTBEAT_INTERVAL_SECONDS = 15
const MILLISECONDS_PER_SECOND = 1000
const EMPTY_COUNT = 0
const ONE_ROW = 1
const ONE_VOTE = 1
const INFO_LOG_LEVEL = 'info'
const CONNECTED_STREAM_EVENT = 'sse_client_connected'
const DISCONNECTED_STREAM_EVENT = 'sse_client_disconnected'
const FIRST_OPTION: OptionPosition = 1

type RequestOptions = {
  method: string
  origin?: string | null
  cookie?: string
  body?: string
  userAgent?: string
  forwardedFor?: string
}

type FrameBuffer = {
  text: string
}

type FrameReader = {
  readFrame: () => Promise<string>
  close: () => Promise<void>
}

let sessions: InMemorySessionRepository
let previousSessionStore: string | undefined
let previousPublicUrl: string | undefined
let previousPanelPassword: string | undefined
let previousCookieSecret: string | undefined
let activeReader: FrameReader | null = null

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

function postSession(): Promise<Response> {
  return createParticipant(createRequest('/api/sessoes', { method: 'POST', origin: PUBLIC_ORIGIN }))
}

function getSession(sessionId: string): Promise<Response> {
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
      userAgent: USER_AGENT,
      forwardedFor: FORWARDED_ADDRESS,
      body: JSON.stringify({ optionNumber: FIRST_OPTION }),
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

function getResults(cookie: string): Promise<Response> {
  return readPanelResults(
    createRequest('/api/painel/resultados', {
      method: 'GET',
      cookie,
    }),
  )
}

function postReset(cookie: string): Promise<Response> {
  return resetPanel(
    createRequest('/api/painel/zerar', {
      method: 'POST',
      origin: PUBLIC_ORIGIN,
      cookie,
      body: JSON.stringify({ confirm: true }),
    }),
  )
}

function getEvents(cookie?: string): Response {
  return readPanelEvents(
    createRequest('/api/painel/eventos', {
      method: 'GET',
      cookie,
      userAgent: USER_AGENT,
      forwardedFor: FORWARDED_ADDRESS,
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

function openFrameReader(response: Response): FrameReader {
  if (response.body === null) {
    throw new Error('Event stream is missing')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const buffer: FrameBuffer = { text: '' }
  let closed = false
  const frameReader = {
    readFrame: () => withFrameTimeout(readNextFrame(reader, decoder, buffer)),
    close: async () => {
      if (closed) {
        return
      }
      closed = true
      await reader.cancel()
    },
  }
  activeReader = frameReader
  return frameReader
}

async function readNextFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  buffer: FrameBuffer,
): Promise<string> {
  while (buffer.text.indexOf(FRAME_BOUNDARY) === MISSING_SEPARATOR) {
    const chunk = await reader.read()
    if (chunk.done) {
      throw new Error('Event stream closed')
    }
    buffer.text += decoder.decode(chunk.value, { stream: true })
  }
  return takeFrame(buffer)
}

function takeFrame(buffer: FrameBuffer): string {
  const boundary = buffer.text.indexOf(FRAME_BOUNDARY)
  const frame = buffer.text.slice(0, boundary)
  buffer.text = buffer.text.slice(boundary + FRAME_BOUNDARY.length)
  return frame
}

function withFrameTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Event frame timed out'))
    }, FRAME_WAIT_MILLISECONDS)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function readSnapshotFrame(frame: string): ResultsSnapshot {
  const lines = frame.split('\n')
  if (!lines.includes(RESULTS_EVENT_LINE)) {
    throw new Error('Results frame is missing')
  }
  const dataLine = lines.find((line) => line.startsWith(DATA_PREFIX))
  if (dataLine === undefined) {
    throw new Error('Results frame is missing')
  }
  const snapshot = readResultsEventData(dataLine.slice(DATA_PREFIX.length))
  if (snapshot === null) {
    throw new Error('Results frame is invalid')
  }
  return snapshot
}

async function closeActiveReader(): Promise<void> {
  if (activeReader === null) {
    return
  }
  const reader = activeReader
  activeReader = null
  await reader.close()
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

async function withHeartbeatSpy(action: (pulse: () => void) => Promise<void>): Promise<number[]> {
  const delays: number[] = []
  let pulse = () => undefined
  const original = globalThis.setInterval
  globalThis.setInterval = ((handler: TimerHandler, timeout?: number, ...args: never[]) => {
    if (typeof timeout === 'number') {
      delays.push(timeout)
    }
    if (typeof handler === 'function' && timeout === PANEL_HEARTBEAT_MILLISECONDS) {
      pulse = () => {
        handler()
      }
    }
    return original(handler, timeout, ...args)
  }) as typeof setInterval
  try {
    await action(() => {
      pulse()
    })
  } finally {
    globalThis.setInterval = original
  }
  return delays
}

describe('live results', () => {
  beforeEach(() => {
    clearPasswordFailures()
    previousSessionStore = process.env[SESSION_STORE_VARIABLE]
    previousPublicUrl = process.env.PUBLIC_URL
    previousPanelPassword = process.env.PANEL_PASSWORD
    previousCookieSecret = process.env.COOKIE_SECRET
    process.env[SESSION_STORE_VARIABLE] = MEMORY_SESSION_STORE
    process.env.PUBLIC_URL = PUBLIC_URL
    process.env.PANEL_PASSWORD = PANEL_PASSWORD
    process.env.COOKIE_SECRET = COOKIE_SECRET
    closeSessionRepositories()
    sessions = readMemoryRepository()
  })

  afterEach(async () => {
    try {
      await closeActiveReader()
      closeSessionRepositories()
    } finally {
      clearPasswordFailures()
      restoreEnv(SESSION_STORE_VARIABLE, previousSessionStore)
      restoreEnv('PUBLIC_URL', previousPublicUrl)
      restoreEnv('PANEL_PASSWORD', previousPanelPassword)
      restoreEnv('COOKIE_SECRET', previousCookieSecret)
    }
  })

  it('delivers the committed portrait when an answer is saved and when the edition is reset', async () => {
    const created = await postSession()
    const sessionId = readCreatedSessionId(created)
    const login = await postLogin(PANEL_PASSWORD)
    const panelCookie = readCookiePair(login)
    const rowsAtPublish: number[] = []
    const unsubscribe = readResultsPublisher().subscribe(() => {
      rowsAtPublish.push(sessions.countAnswers())
    })
    const output = await captureStdout(async () => {
      const response = getEvents(panelCookie)
      const events = openFrameReader(response)
      try {
        expect(response.status).toBe(HTTP_OK)
        expect(response.headers.get(CONTENT_TYPE_HEADER)).toContain(EVENT_STREAM_TYPE)
        expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(NO_CACHE_DIRECTIVE)
        expect(response.headers.get(ACCEL_BUFFERING_HEADER)).toBe(NO_BUFFER_DIRECTIVE)
        expect(readSnapshotFrame(await events.readFrame())).toEqual(createZeroSnapshot())
        const saved = await putAnswer(sessionId)
        expect(saved.status).toBe(HTTP_OK)
        expect(readSnapshotFrame(await events.readFrame())).toEqual(createVotedSnapshot())
        expect(sessions.countAnswers()).toBe(ONE_ROW)
        const reset = await postReset(panelCookie)
        expect(reset.status).toBe(HTTP_OK)
        expect(readSnapshotFrame(await events.readFrame())).toEqual(createZeroSnapshot())
        expect(sessions.countAnswers()).toBe(EMPTY_COUNT)
        expect(sessions.countSessions()).toBe(EMPTY_COUNT)
        expect((await getSession(sessionId)).status).toBe(HTTP_NOT_FOUND)
      } finally {
        unsubscribe()
        await events.close()
      }
    })
    const logs = readLogEntries(output)
    expect(rowsAtPublish).toEqual([ONE_ROW, EMPTY_COUNT])
    expect(logs).toContainEqual({ level: INFO_LOG_LEVEL, event: CONNECTED_STREAM_EVENT })
    expect(logs).toContainEqual({ level: INFO_LOG_LEVEL, event: DISCONNECTED_STREAM_EVENT })
    expect(output).not.toContain(sessionId)
    expect(output).not.toContain(FORWARDED_ADDRESS)
    expect(output).not.toContain(USER_AGENT)
    expect(output).not.toContain(PANEL_PASSWORD)
    expect(output).not.toContain('participating')
  })

  it('refuses the event stream without the panel cookie', async () => {
    const created = await postSession()
    const sessionId = readCreatedSessionId(created)
    const output = await captureStdout(async () => {
      const missing = getEvents()
      const participant = getEvents(`${SESSION_COOKIE_NAME}=${sessionId}`)
      expect(missing.status).toBe(HTTP_UNAUTHORIZED)
      expect(participant.status).toBe(HTTP_UNAUTHORIZED)
      expect(missing.headers.get(CONTENT_TYPE_HEADER)).not.toContain(EVENT_STREAM_TYPE)
      const missingBody: unknown = await withFrameTimeout(missing.json())
      const participantBody: unknown = await withFrameTimeout(participant.json())
      expect(missingBody).toEqual({ error: UNAUTHORIZED_ERROR })
      expect(participantBody).toEqual({ error: UNAUTHORIZED_ERROR })
      expect(JSON.stringify(missingBody)).not.toContain('participating')
      expect(JSON.stringify(participantBody)).not.toContain('finished')
      expect(JSON.stringify(participantBody)).not.toContain('questions')
    })
    expect(output).not.toContain(CONNECTED_STREAM_EVENT)
    expect(output).not.toContain(sessionId)
    expect(output).not.toContain(FORWARDED_ADDRESS)
  })

  it('writes a heartbeat comment on the panel interval', async () => {
    expect(PANEL_HEARTBEAT_MILLISECONDS).toBe(HEARTBEAT_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND)
    const login = await postLogin(PANEL_PASSWORD)
    const delays = await withHeartbeatSpy(async (pulse) => {
      const response = getEvents(readCookiePair(login))
      const events = openFrameReader(response)
      try {
        await events.readFrame()
        pulse()
        const frame = await events.readFrame()
        expect(`${frame}${FRAME_BOUNDARY}`).toBe(formatHeartbeatComment())
      } finally {
        await events.close()
      }
    })
    expect(delays).toContain(PANEL_HEARTBEAT_MILLISECONDS)
  })

  it('keeps the saved answer when a subscriber throws', async () => {
    const created = await postSession()
    const sessionId = readCreatedSessionId(created)
    const login = await postLogin(PANEL_PASSWORD)
    const panelCookie = readCookiePair(login)
    const unsubscribe = readResultsPublisher().subscribe(() => {
      throw new Error('subscriber failed')
    })
    try {
      const saved = await putAnswer(sessionId)
      expect(saved.status).toBe(HTTP_OK)
      const results = await getResults(panelCookie)
      expect(results.status).toBe(HTTP_OK)
      const body: unknown = await results.json()
      expect(body).toEqual(createVotedSnapshot())
    } finally {
      unsubscribe()
    }
  })
})
