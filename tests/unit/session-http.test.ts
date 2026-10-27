import { describe, expect, it } from 'vitest'
import { SessionNotFoundError } from '@/application/session-repository'
import {
  BAD_REQUEST_ERROR,
  CONFLICT_ERROR,
  FORBIDDEN_ERROR,
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_SERVER_ERROR,
  MissingPublicUrlError,
  NOT_FOUND_ERROR,
  OriginRejectedError,
  SERVER_ERROR,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  assertMutationOrigin,
  buildSessionCookie,
  readSessionId,
  requiresSecureCookie,
  resolveResumeStatus,
  resolveSessionFailure,
  toSessionPayload,
} from '@/application/session-http'
import {
  CompletedSessionError,
  FIRST_QUESTION_NUMBER,
  InvalidAnswerError,
  OPEN_SESSION_STATUS,
  QuestionNotDisplayedError,
  createOpenSession,
  recordAnswer,
} from '@/domain/session'
import type { OptionPosition, QuestionNumber } from '@/domain/survey-catalog'

const CREATED_AT = '2026-10-27T12:00:00.000Z'
const SESSION_ID = '6f0d5c1e-1b2a-4c3d-8e9f-001122334455'
const HIDDEN_SESSION_ID = 'hidden-session-id'
const PUBLIC_URL = 'https://evento.test/'
const PUBLIC_ORIGIN = 'https://evento.test'
const FOREIGN_ORIGIN = 'https://outro.test'
const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE
const FOURTH_OPTION: OptionPosition = 4
const SECOND_QUESTION: QuestionNumber = 2

describe('session http decisions', () => {
  it('returns 200 when the session exists and 404 when it does not', () => {
    const session = createOpenSession(SESSION_ID, CREATED_AT)
    expect(resolveResumeStatus(session)).toBe(HTTP_OK)
    expect(resolveResumeStatus(null)).toBe(HTTP_NOT_FOUND)
  })

  it('maps a missing session to 404 and a completed session to 409', () => {
    expect(resolveSessionFailure(new SessionNotFoundError())).toEqual({
      status: HTTP_NOT_FOUND,
      error: NOT_FOUND_ERROR,
    })
    expect(resolveSessionFailure(new CompletedSessionError())).toEqual({
      status: HTTP_CONFLICT,
      error: CONFLICT_ERROR,
    })
  })

  it('maps an invalid answer and a hidden question to 400', () => {
    expect(resolveSessionFailure(new InvalidAnswerError())).toEqual({
      status: HTTP_BAD_REQUEST,
      error: BAD_REQUEST_ERROR,
    })
    expect(resolveSessionFailure(new QuestionNotDisplayedError())).toEqual({
      status: HTTP_BAD_REQUEST,
      error: BAD_REQUEST_ERROR,
    })
  })

  it('maps a foreign origin to 403 and an unexpected failure to 500', () => {
    expect(resolveSessionFailure(new OriginRejectedError())).toEqual({
      status: HTTP_FORBIDDEN,
      error: FORBIDDEN_ERROR,
    })
    expect(resolveSessionFailure(new MissingPublicUrlError())).toEqual({
      status: HTTP_SERVER_ERROR,
      error: SERVER_ERROR,
    })
    expect(resolveSessionFailure(new Error(`session ${HIDDEN_SESSION_ID} failed`))).toEqual({
      status: HTTP_SERVER_ERROR,
      error: SERVER_ERROR,
    })
  })

  it('builds a persistent httpOnly cookie for 24 hours', () => {
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(SECONDS_PER_DAY)
    expect(requiresSecureCookie(PUBLIC_URL)).toBe(true)
    expect(requiresSecureCookie('http://localhost:3000')).toBe(true)
    expect(requiresSecureCookie('http://192.168.0.153:3000')).toBe(false)
    expect(buildSessionCookie(SESSION_ID)).toBe(
      `${SESSION_COOKIE_NAME}=${SESSION_ID}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SECONDS_PER_DAY}`,
    )
  })

  it('omits Secure when PUBLIC_URL is plain http on the local network', () => {
    const previous = process.env.PUBLIC_URL
    process.env.PUBLIC_URL = 'http://192.168.0.153:3000'
    try {
      expect(buildSessionCookie(SESSION_ID)).toBe(
        `${SESSION_COOKIE_NAME}=${SESSION_ID}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SECONDS_PER_DAY}`,
      )
    } finally {
      restorePublicUrl(previous)
    }
  })

  it('reads the session cookie and ignores the other cookies', () => {
    const pair = buildSessionCookie(SESSION_ID).split(';')[0]
    expect(readSessionId(`tema=claro; ${pair}; outro=1`)).toBe(SESSION_ID)
    expect(readSessionId(null)).toBeNull()
    expect(readSessionId(`${SESSION_COOKIE_NAME}=`)).toBeNull()
    expect(readSessionId('painel=abc')).toBeNull()
  })

  it('accepts the origin of PUBLIC_URL and rejects a different one', () => {
    expect(() => assertMutationOrigin(PUBLIC_ORIGIN, PUBLIC_URL)).not.toThrow()
    expect(() => assertMutationOrigin('https://EVENTO.TEST', PUBLIC_URL)).not.toThrow()
    expect(() => assertMutationOrigin(FOREIGN_ORIGIN, PUBLIC_URL)).toThrow(OriginRejectedError)
    expect(() => assertMutationOrigin(null, PUBLIC_URL)).toThrow(OriginRejectedError)
    expect(() => assertMutationOrigin(PUBLIC_ORIGIN, undefined)).toThrow(MissingPublicUrlError)
    expect(() => assertMutationOrigin(PUBLIC_ORIGIN, '')).toThrow(MissingPublicUrlError)
    expect(() => assertMutationOrigin(PUBLIC_ORIGIN, 'nao-e-url')).toThrow(MissingPublicUrlError)
  })

  it('returns the screen and the saved answers without the session id', () => {
    const saved = recordAnswer(createOpenSession(HIDDEN_SESSION_ID, CREATED_AT), {
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const payload = toSessionPayload(saved)
    expect(payload).toEqual({
      status: OPEN_SESSION_STATUS,
      currentQuestion: SECOND_QUESTION,
      furthestQuestion: SECOND_QUESTION,
      answers: [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION }],
    })
    expect(JSON.stringify(payload)).not.toContain(HIDDEN_SESSION_ID)
    expect(JSON.stringify(payload)).not.toContain(CREATED_AT)
  })
})

function restorePublicUrl(previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env.PUBLIC_URL
    return
  }
  process.env.PUBLIC_URL = previous
}
