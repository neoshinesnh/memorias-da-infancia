import { MissingCookieSecretError } from '@/application/panel-cookie'
import {
  MissingPanelPasswordError,
  PanelPasswordRejectedError,
  TooManyPasswordAttemptsError,
} from '@/application/panel-password'
import {
  BAD_REQUEST_ERROR,
  FORBIDDEN_ERROR,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_SERVER_ERROR,
  OriginRejectedError,
  SERVER_ERROR,
} from '@/application/session-http'

const CONFIRM_FIELD = 'confirm'

export const HTTP_UNAUTHORIZED = 401
export const HTTP_TOO_MANY_REQUESTS = 429
export const UNAUTHORIZED_ERROR = 'unauthorized'
export const TOO_MANY_REQUESTS_ERROR = 'too_many_requests'

export class MissingPanelCookieError extends Error {
  constructor() {
    super('Panel cookie is missing')
    this.name = 'MissingPanelCookieError'
  }
}

export class ResetNotConfirmedError extends Error {
  constructor() {
    super('Edition reset was not confirmed')
    this.name = 'ResetNotConfirmedError'
  }
}

export type PanelFailure = {
  status: number
  error: string
}

export function isResetConfirmed(body: unknown): boolean {
  if (!isRecord(body)) {
    return false
  }
  return body[CONFIRM_FIELD] === true
}

export function resolvePanelFailure(error: unknown): PanelFailure {
  if (error instanceof PanelPasswordRejectedError) {
    return { status: HTTP_UNAUTHORIZED, error: UNAUTHORIZED_ERROR }
  }
  if (error instanceof MissingPanelCookieError) {
    return { status: HTTP_UNAUTHORIZED, error: UNAUTHORIZED_ERROR }
  }
  if (error instanceof TooManyPasswordAttemptsError) {
    return { status: HTTP_TOO_MANY_REQUESTS, error: TOO_MANY_REQUESTS_ERROR }
  }
  if (error instanceof ResetNotConfirmedError) {
    return { status: HTTP_BAD_REQUEST, error: BAD_REQUEST_ERROR }
  }
  if (error instanceof OriginRejectedError) {
    return { status: HTTP_FORBIDDEN, error: FORBIDDEN_ERROR }
  }
  if (error instanceof MissingPanelPasswordError) {
    return { status: HTTP_SERVER_ERROR, error: SERVER_ERROR }
  }
  if (error instanceof MissingCookieSecretError) {
    return { status: HTTP_SERVER_ERROR, error: SERVER_ERROR }
  }
  return { status: HTTP_SERVER_ERROR, error: SERVER_ERROR }
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
