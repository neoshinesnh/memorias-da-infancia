import { readResultsPublisher } from '@/adapters/realtime/in-process-publisher'
import { readSessionRepository } from '@/adapters/supabase/session-repository-cache'
import { resetEdition } from '@/application/panel-edition'
import { assertCookieSecret, buildPanelCookie, hasValidPanelCookie } from '@/application/panel-cookie'
import {
  MissingPanelCookieError,
  ResetNotConfirmedError,
  isResetConfirmed,
  resolvePanelFailure,
} from '@/application/panel-http'
import { logEditionReset, logPanelLoginFailed, logPanelLoginSucceeded } from '@/application/panel-log'
import {
  MissingPanelPasswordError,
  PanelPasswordRejectedError,
  TooManyPasswordAttemptsError,
  dropPasswordFailures,
  isPasswordAttemptLimited,
  matchPasswords,
  recordPasswordFailure,
} from '@/application/panel-password'
import {
  COOKIE_HEADER,
  HTTP_OK,
  ORIGIN_HEADER,
  assertMutationOrigin,
  readPublicOrigin,
} from '@/application/session-http'
import { readResults } from '@/application/session-use-cases'
import type { ResultsSnapshot } from '@/domain/results'

const CACHE_CONTROL_HEADER = 'cache-control'
const SET_COOKIE_HEADER = 'set-cookie'
const NO_STORE_DIRECTIVE = 'no-store'
const PUBLIC_URL_VARIABLE = 'PUBLIC_URL'
const PANEL_PASSWORD_VARIABLE = 'PANEL_PASSWORD'
const COOKIE_SECRET_VARIABLE = 'COOKIE_SECRET'
const PASSWORD_FIELD = 'password'
const EMPTY_LENGTH = 0

export async function enterPanel(request: Request): Promise<Response> {
  try {
    const publicUrl = readPublicUrl()
    assertMutationOrigin(request.headers.get(ORIGIN_HEADER), publicUrl)
    const secret = assertCookieSecret(readCookieSecret())
    const expected = readPanelPassword()
    const provided = await readProvidedPassword(request)
    const origin = readPublicOrigin(publicUrl)
    const attemptedAt = Date.now()
    if (isPasswordAttemptLimited(origin, attemptedAt)) {
      logPanelLoginFailed()
      throw new TooManyPasswordAttemptsError()
    }
    if (!matchPasswords(provided, expected)) {
      recordPasswordFailure(origin, attemptedAt)
      logPanelLoginFailed()
      throw new PanelPasswordRejectedError()
    }
    dropPasswordFailures(origin)
    logPanelLoginSucceeded()
    return createSignedResponse(secret)
  } catch (error) {
    return createPanelErrorResponse(error)
  }
}

export async function readPanelSnapshot(request: Request): Promise<Response> {
  try {
    assertPanelCookie(request.headers.get(COOKIE_HEADER))
    return createSnapshotResponse(await readResults(readSessionRepository()))
  } catch (error) {
    return createPanelErrorResponse(error)
  }
}

export async function resetPanelEdition(request: Request): Promise<Response> {
  try {
    assertMutationOrigin(request.headers.get(ORIGIN_HEADER), readPublicUrl())
    assertPanelCookie(request.headers.get(COOKIE_HEADER))
    const confirmed = isResetConfirmed(await readJsonObject(request))
    if (!confirmed) {
      throw new ResetNotConfirmedError()
    }
    const snapshot = await resetEdition(readSessionRepository(), readResultsPublisher())
    logEditionReset()
    return createSnapshotResponse(snapshot)
  } catch (error) {
    return createPanelErrorResponse(error)
  }
}

export function assertPanelRequest(request: Request): void {
  assertPanelCookie(request.headers.get(COOKIE_HEADER))
}

function assertPanelCookie(cookieHeader: string | null): void {
  const secret = assertCookieSecret(readCookieSecret())
  if (!hasValidPanelCookie(cookieHeader, secret)) {
    throw new MissingPanelCookieError()
  }
}

function readPanelPassword(): string {
  const password = process.env[PANEL_PASSWORD_VARIABLE]
  if (password === undefined) {
    throw new MissingPanelPasswordError()
  }
  if (password.length === EMPTY_LENGTH) {
    throw new MissingPanelPasswordError()
  }
  return password
}

function readCookieSecret(): string | undefined {
  return process.env[COOKIE_SECRET_VARIABLE]
}

function readPublicUrl(): string | undefined {
  return process.env[PUBLIC_URL_VARIABLE]
}

function createSignedResponse(secret: string): Response {
  const headers = createPrivateHeaders()
  headers.append(SET_COOKIE_HEADER, buildPanelCookie(secret))
  return Response.json({}, { status: HTTP_OK, headers })
}

function createSnapshotResponse(snapshot: ResultsSnapshot): Response {
  return Response.json(snapshot, {
    status: HTTP_OK,
    headers: createPrivateHeaders(),
  })
}

export function createPanelErrorResponse(error: unknown): Response {
  const failure = resolvePanelFailure(error)
  return Response.json(
    { error: failure.error },
    { status: failure.status, headers: createPrivateHeaders() },
  )
}

function createPrivateHeaders(): Headers {
  const headers = new Headers()
  headers.set(CACHE_CONTROL_HEADER, NO_STORE_DIRECTIVE)
  return headers
}

async function readProvidedPassword(request: Request): Promise<string> {
  const body = await readJsonObject(request)
  if (body === null) {
    return ''
  }
  const password = body[PASSWORD_FIELD]
  if (typeof password !== 'string') {
    return ''
  }
  return password
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    if (!isJsonObject(body)) {
      return null
    }
    return body
  } catch {
    return null
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object') {
    return false
  }
  if (value === null) {
    return false
  }
  return !Array.isArray(value)
}
