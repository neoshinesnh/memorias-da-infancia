import { beforeEach, describe, expect, it } from 'vitest'
import { resetEdition } from '@/application/panel-edition'
import {
  COOKIE_SECRET_MINIMUM_BYTES,
  MissingCookieSecretError,
  PANEL_COOKIE_MAX_AGE_SECONDS,
  PANEL_COOKIE_NAME,
  assertCookieSecret,
  buildPanelCookie,
  hasValidPanelCookie,
  readPanelToken,
} from '@/application/panel-cookie'
import {
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
  MissingPanelCookieError,
  ResetNotConfirmedError,
  isResetConfirmed,
  resolvePanelFailure,
} from '@/application/panel-http'
import {
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_SERVER_ERROR,
  OriginRejectedError,
} from '@/application/session-http'
import {
  FAILURE_WINDOW_MILLISECONDS,
  MissingPanelPasswordError,
  PASSWORD_FAILURE_LIMIT,
  PanelPasswordRejectedError,
  TooManyPasswordAttemptsError,
  clearPasswordFailures,
  dropPasswordFailures,
  isPasswordAttemptLimited,
  matchPasswords,
  recordPasswordFailure,
} from '@/application/panel-password'
import type { ResultsPublisher } from '@/application/results-publisher'
import { openSession, saveSessionAnswer } from '@/application/session-use-cases'
import type { ResultsSnapshot } from '@/domain/results'
import { FIRST_OPTION_POSITION, FIRST_QUESTION_NUMBER } from '@/domain/session'
import { OPTION_COUNT, surveyCatalog } from '@/domain/survey-catalog'
import { idleResultsPublisher } from '../support/idle-results-publisher'
import { InMemorySessionRepository } from '../support/in-memory-session-repository'

const PANEL_PASSWORD = 'SenhaCorretaDoPainelEvento'
const SAME_LENGTH_WRONG = 'SenhaErradaaDoPainelEvento'
const SHORT_PASSWORD = 'curta'
const LONG_PASSWORD = 'uma-senha-bem-mais-longa-que-a-do-painel'
const COOKIE_SECRET = '0123456789abcdef0123456789abcdef'
const OTHER_SECRET = 'fedcba9876543210fedcba9876543210'
const PUBLIC_ORIGIN = 'https://evento.test'
const FOREIGN_ORIGIN = 'https://outro.test'
const WINDOW_START = 1_700_000_000_000
const PANEL_COOKIE_HOURS = 12
const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const WINDOW_MINUTES = 15
const MILLISECONDS_PER_SECOND = 1000
const EMPTY_COUNT = 0
const CREATED_AT = '2026-10-27T12:00:00.000Z'
const SESSION_ID = 'panel-session'

describe('panel password comparison', () => {
  it('accepts the configured password', () => {
    expect(matchPasswords(PANEL_PASSWORD, PANEL_PASSWORD)).toBe(true)
  })

  it('rejects another password of the same length', () => {
    expect(PANEL_PASSWORD.length).toBe(SAME_LENGTH_WRONG.length)
    expect(matchPasswords(SAME_LENGTH_WRONG, PANEL_PASSWORD)).toBe(false)
  })

  it('rejects a password of a different length without throwing', () => {
    expect(SHORT_PASSWORD.length).not.toBe(PANEL_PASSWORD.length)
    expect(LONG_PASSWORD.length).not.toBe(PANEL_PASSWORD.length)
    expect(() => matchPasswords(SHORT_PASSWORD, PANEL_PASSWORD)).not.toThrow()
    expect(matchPasswords(SHORT_PASSWORD, PANEL_PASSWORD)).toBe(false)
    expect(matchPasswords(LONG_PASSWORD, PANEL_PASSWORD)).toBe(false)
    expect(matchPasswords(PANEL_PASSWORD, SHORT_PASSWORD)).toBe(false)
  })
})

describe('panel password attempt limit', () => {
  beforeEach(() => {
    clearPasswordFailures()
  })

  it('allows ten failures and blocks the next attempt inside the window', () => {
    expect(PASSWORD_FAILURE_LIMIT).toBe(10)
    expect(FAILURE_WINDOW_MILLISECONDS).toBe(WINDOW_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND)
    for (let attempt = 0; attempt < PASSWORD_FAILURE_LIMIT; attempt += 1) {
      expect(isPasswordAttemptLimited(PUBLIC_ORIGIN, WINDOW_START)).toBe(false)
      recordPasswordFailure(PUBLIC_ORIGIN, WINDOW_START)
    }
    const stillInside = WINDOW_START + FAILURE_WINDOW_MILLISECONDS - 1
    const justOutside = WINDOW_START + FAILURE_WINDOW_MILLISECONDS
    expect(isPasswordAttemptLimited(PUBLIC_ORIGIN, stillInside)).toBe(true)
    expect(isPasswordAttemptLimited(PUBLIC_ORIGIN, justOutside)).toBe(false)
    expect(isPasswordAttemptLimited(FOREIGN_ORIGIN, stillInside)).toBe(false)
  })

  it('drops the recorded failures for one origin', () => {
    recordPasswordFailure(PUBLIC_ORIGIN, WINDOW_START)
    dropPasswordFailures(PUBLIC_ORIGIN)
    expect(isPasswordAttemptLimited(PUBLIC_ORIGIN, WINDOW_START)).toBe(false)
  })
})

describe('panel cookie', () => {
  it('signs an httpOnly cookie for 12 hours and accepts only that signature', () => {
    expect(Buffer.byteLength(COOKIE_SECRET)).toBeGreaterThanOrEqual(COOKIE_SECRET_MINIMUM_BYTES)
    expect(PANEL_COOKIE_MAX_AGE_SECONDS).toBe(PANEL_COOKIE_HOURS * MINUTES_PER_HOUR * SECONDS_PER_MINUTE)
    const header = buildPanelCookie(COOKIE_SECRET)
    const token = readPanelToken(header)
    expect(token).not.toBeNull()
    expect(header).toBe(
      `${PANEL_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${PANEL_COOKIE_MAX_AGE_SECONDS}`,
    )
    expect(header).not.toContain(COOKIE_SECRET)
    const pair = `${PANEL_COOKIE_NAME}=${token}`
    expect(hasValidPanelCookie(pair, COOKIE_SECRET)).toBe(true)
    expect(hasValidPanelCookie(`sessao=abc; ${pair}`, COOKIE_SECRET)).toBe(true)
    expect(hasValidPanelCookie(`${pair}; sessao=abc`, COOKIE_SECRET)).toBe(true)
    expect(hasValidPanelCookie(pair, OTHER_SECRET)).toBe(false)
    expect(hasValidPanelCookie(`${PANEL_COOKIE_NAME}=${'a'.repeat(token?.length ?? 0)}`, COOKIE_SECRET)).toBe(false)
    expect(hasValidPanelCookie(`${PANEL_COOKIE_NAME}=abc`, COOKIE_SECRET)).toBe(false)
    expect(hasValidPanelCookie(`${PANEL_COOKIE_NAME}=${token}extra`, COOKIE_SECRET)).toBe(false)
    expect(hasValidPanelCookie(null, COOKIE_SECRET)).toBe(false)
    expect(hasValidPanelCookie(`${PANEL_COOKIE_NAME}=`, COOKIE_SECRET)).toBe(false)
    expect(hasValidPanelCookie('sessao=abc', COOKIE_SECRET)).toBe(false)
  })

  it('rejects a cookie secret shorter than 32 bytes', () => {
    expect(() => assertCookieSecret(undefined)).toThrow(MissingCookieSecretError)
    expect(() => assertCookieSecret('')).toThrow(MissingCookieSecretError)
    expect(() => assertCookieSecret('a'.repeat(COOKIE_SECRET_MINIMUM_BYTES - 1))).toThrow(MissingCookieSecretError)
    expect(() => buildPanelCookie('short-secret')).toThrow(MissingCookieSecretError)
  })
})

describe('panel reset confirmation', () => {
  it('accepts only an explicit boolean confirmation', () => {
    expect(isResetConfirmed({ confirm: true })).toBe(true)
    expect(isResetConfirmed({ confirm: true, extra: false })).toBe(true)
    expect(isResetConfirmed({ confirm: false })).toBe(false)
    expect(isResetConfirmed({ confirm: 'true' })).toBe(false)
    expect(isResetConfirmed({ confirm: 1 })).toBe(false)
    expect(isResetConfirmed({})).toBe(false)
    expect(isResetConfirmed(null)).toBe(false)
    expect(isResetConfirmed([])).toBe(false)
  })

  it('maps panel failures without returning totals', () => {
    expect(resolvePanelFailure(new PanelPasswordRejectedError())).toEqual({
      status: HTTP_UNAUTHORIZED,
      error: 'unauthorized',
    })
    expect(resolvePanelFailure(new MissingPanelCookieError())).toEqual({
      status: HTTP_UNAUTHORIZED,
      error: 'unauthorized',
    })
    expect(resolvePanelFailure(new TooManyPasswordAttemptsError())).toEqual({
      status: HTTP_TOO_MANY_REQUESTS,
      error: 'too_many_requests',
    })
    expect(resolvePanelFailure(new ResetNotConfirmedError())).toEqual({
      status: HTTP_BAD_REQUEST,
      error: 'bad_request',
    })
    expect(resolvePanelFailure(new OriginRejectedError())).toEqual({
      status: HTTP_FORBIDDEN,
      error: 'forbidden',
    })
    expect(resolvePanelFailure(new MissingPanelPasswordError())).toEqual({
      status: HTTP_SERVER_ERROR,
      error: 'server_error',
    })
    expect(resolvePanelFailure(new MissingCookieSecretError())).toEqual({
      status: HTTP_SERVER_ERROR,
      error: 'server_error',
    })
    expect(JSON.stringify(resolvePanelFailure(new Error('hidden password')))).not.toContain('password')
  })

  it('returns a zero snapshot after the stored edition is deleted', () => {
    const repository = new InMemorySessionRepository()
    const opened = openSession(repository, { id: SESSION_ID, createdAt: CREATED_AT })
    saveSessionAnswer(repository, idleResultsPublisher, {
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION_POSITION,
    })
    const published: ResultsSnapshot[] = []
    const publisher: ResultsPublisher = {
      publish(snapshot) {
        expect(repository.findById(opened.id)).toBeNull()
        published.push(snapshot)
      },
      subscribe() {
        return () => undefined
      },
    }
    const snapshot = resetEdition(repository, publisher)
    expect(published).toEqual([snapshot])
    expect(snapshot.participating).toBe(EMPTY_COUNT)
    expect(snapshot.finished).toBe(EMPTY_COUNT)
    expect(snapshot.questions).toHaveLength(surveyCatalog.length)
    for (const question of snapshot.questions) {
      expect(question.counts).toHaveLength(OPTION_COUNT)
      expect(question.counts.every((count) => count === EMPTY_COUNT)).toBe(true)
    }
    expect(repository.findById(opened.id)).toBeNull()
    expect(repository.summarize().participating).toBe(EMPTY_COUNT)
  })
})
