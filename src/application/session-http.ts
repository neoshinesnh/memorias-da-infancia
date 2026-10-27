import { SessionNotFoundError } from '@/application/session-repository'
import {
  CompletedSessionError,
  InvalidAnswerError,
  QuestionNotDisplayedError,
  type Session,
  type SessionAnswer,
  type SessionStatus,
} from '@/domain/session'
import type { QuestionNumber } from '@/domain/survey-catalog'

const EMPTY_LENGTH = 0
const MISSING_SEPARATOR = -1
const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const COOKIE_SEPARATOR = ';'
const NAME_VALUE_SEPARATOR = '='
const HTTP_ONLY_FLAG = 'HttpOnly'
const SECURE_FLAG = 'Secure'
const HTTPS_PROTOCOL = 'https:'
const LOCAL_HOST = 'localhost'
const LOOPBACK_HOST = '127.0.0.1'
const LOOPBACK_V6_HOST = '::1'
const SAME_SITE_ATTRIBUTE = 'SameSite=Lax'
const ROOT_PATH_ATTRIBUTE = 'Path=/'
const MAX_AGE_ATTRIBUTE = 'Max-Age'

export const SESSION_COOKIE_NAME = 'sessao'
export const SESSION_COOKIE_MAX_AGE_SECONDS = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE
export const HTTP_OK = 200
export const HTTP_BAD_REQUEST = 400
export const HTTP_FORBIDDEN = 403
export const HTTP_NOT_FOUND = 404
export const HTTP_CONFLICT = 409
export const HTTP_SERVER_ERROR = 500
export const NOT_FOUND_ERROR = 'not_found'
export const CONFLICT_ERROR = 'conflict'
export const BAD_REQUEST_ERROR = 'bad_request'
export const FORBIDDEN_ERROR = 'forbidden'
export const SERVER_ERROR = 'server_error'
export const ORIGIN_HEADER = 'origin'
export const COOKIE_HEADER = 'cookie'

export class OriginRejectedError extends Error {
  constructor() {
    super('Origin is not allowed')
    this.name = 'OriginRejectedError'
  }
}

export class MissingPublicUrlError extends Error {
  constructor() {
    super('PUBLIC_URL is required')
    this.name = 'MissingPublicUrlError'
  }
}

export type SessionPayload = {
  status: SessionStatus
  currentQuestion: QuestionNumber
  furthestQuestion: QuestionNumber
  answers: readonly SessionAnswer[]
}

export type SessionFailure = {
  status: number
  error: string
}

export function requiresSecureCookie(publicUrl: string | undefined): boolean {
  if (publicUrl === undefined) {
    return true
  }
  if (publicUrl.length === EMPTY_LENGTH) {
    return true
  }
  let address: URL
  try {
    address = new URL(publicUrl)
  } catch {
    return true
  }
  if (address.protocol === HTTPS_PROTOCOL) {
    return true
  }
  return isLoopbackHost(address.hostname)
}

export function buildSessionCookie(sessionId: string): string {
  const maxAge = `${MAX_AGE_ATTRIBUTE}=${SESSION_COOKIE_MAX_AGE_SECONDS}`
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    ...readCookieFlags(requiresSecureCookie(process.env.PUBLIC_URL), maxAge),
  ].join(`${COOKIE_SEPARATOR} `)
}

function readCookieFlags(secure: boolean, maxAge: string): readonly string[] {
  if (!secure) {
    return [HTTP_ONLY_FLAG, SAME_SITE_ATTRIBUTE, ROOT_PATH_ATTRIBUTE, maxAge]
  }
  return [HTTP_ONLY_FLAG, SECURE_FLAG, SAME_SITE_ATTRIBUTE, ROOT_PATH_ATTRIBUTE, maxAge]
}

function isLoopbackHost(hostname: string): boolean {
  if (hostname === LOCAL_HOST) {
    return true
  }
  if (hostname === LOOPBACK_HOST) {
    return true
  }
  return hostname === LOOPBACK_V6_HOST
}

export function readSessionId(cookieHeader: string | null): string | null {
  if (cookieHeader === null) {
    return null
  }
  const cookies = cookieHeader.split(COOKIE_SEPARATOR)
  for (const cookie of cookies) {
    const sessionId = readMatchingSessionId(cookie)
    if (sessionId !== null) {
      return sessionId
    }
  }
  return null
}

export function assertMutationOrigin(originHeader: string | null, publicUrl: string | undefined): void {
  const publicOrigin = readPublicOrigin(publicUrl)
  if (readNormalizedOrigin(originHeader) !== publicOrigin) {
    throw new OriginRejectedError()
  }
}

export function readPublicOrigin(publicUrl: string | undefined): string {
  if (publicUrl === undefined) {
    throw new MissingPublicUrlError()
  }
  if (publicUrl.length === EMPTY_LENGTH) {
    throw new MissingPublicUrlError()
  }
  return parseOrigin(publicUrl)
}

export function toSessionPayload(session: Session): SessionPayload {
  return {
    status: session.status,
    currentQuestion: session.currentQuestion,
    furthestQuestion: session.furthestQuestion,
    answers: session.answers.map(copyAnswer),
  }
}

export function resolveResumeStatus(session: Session | null): number {
  if (session === null) {
    return HTTP_NOT_FOUND
  }
  return HTTP_OK
}

export function resolveSessionFailure(error: unknown): SessionFailure {
  if (error instanceof SessionNotFoundError) {
    return { status: HTTP_NOT_FOUND, error: NOT_FOUND_ERROR }
  }
  if (error instanceof CompletedSessionError) {
    return { status: HTTP_CONFLICT, error: CONFLICT_ERROR }
  }
  if (error instanceof InvalidAnswerError) {
    return { status: HTTP_BAD_REQUEST, error: BAD_REQUEST_ERROR }
  }
  if (error instanceof QuestionNotDisplayedError) {
    return { status: HTTP_BAD_REQUEST, error: BAD_REQUEST_ERROR }
  }
  if (error instanceof OriginRejectedError) {
    return { status: HTTP_FORBIDDEN, error: FORBIDDEN_ERROR }
  }
  return { status: HTTP_SERVER_ERROR, error: SERVER_ERROR }
}

function readMatchingSessionId(cookie: string): string | null {
  const separatorIndex = cookie.indexOf(NAME_VALUE_SEPARATOR)
  if (separatorIndex === MISSING_SEPARATOR) {
    return null
  }
  const name = cookie.slice(0, separatorIndex).trim()
  if (name !== SESSION_COOKIE_NAME) {
    return null
  }
  const value = cookie.slice(separatorIndex + NAME_VALUE_SEPARATOR.length).trim()
  if (value.length === EMPTY_LENGTH) {
    return null
  }
  return value
}

function readNormalizedOrigin(originHeader: string | null): string | null {
  if (originHeader === null) {
    return null
  }
  if (originHeader.length === EMPTY_LENGTH) {
    return null
  }
  try {
    return parseOrigin(originHeader)
  } catch {
    return null
  }
}

function parseOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    throw new MissingPublicUrlError()
  }
}

function copyAnswer(answer: SessionAnswer): SessionAnswer {
  return {
    questionNumber: answer.questionNumber,
    optionNumber: answer.optionNumber,
  }
}
