import { createHmac } from 'node:crypto'
import { matchDigests } from '@/application/panel-password'

const DIGEST_ALGORITHM = 'sha256'
const TEXT_ENCODING = 'utf8'
const EMPTY_LENGTH = 0
const MISSING_SEPARATOR = -1
const PANEL_COOKIE_HOURS = 12
const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const COOKIE_SEPARATOR = ';'
const NAME_VALUE_SEPARATOR = '='
const HTTP_ONLY_FLAG = 'HttpOnly'
const SECURE_FLAG = 'Secure'
const SAME_SITE_ATTRIBUTE = 'SameSite=Lax'
const ROOT_PATH_ATTRIBUTE = 'Path=/'
const MAX_AGE_ATTRIBUTE = 'Max-Age'

export const PANEL_COOKIE_NAME = 'painel'
export const PANEL_COOKIE_MAX_AGE_SECONDS = PANEL_COOKIE_HOURS * MINUTES_PER_HOUR * SECONDS_PER_MINUTE
export const COOKIE_SECRET_MINIMUM_BYTES = 32

export class MissingCookieSecretError extends Error {
  constructor() {
    super('COOKIE_SECRET is required')
    this.name = 'MissingCookieSecretError'
  }
}

export function assertCookieSecret(secret: string | undefined): string {
  if (secret === undefined) {
    throw new MissingCookieSecretError()
  }
  if (secret.length === EMPTY_LENGTH) {
    throw new MissingCookieSecretError()
  }
  if (Buffer.byteLength(secret) < COOKIE_SECRET_MINIMUM_BYTES) {
    throw new MissingCookieSecretError()
  }
  return secret
}

export function buildPanelCookie(secret: string): string {
  const verifiedSecret = assertCookieSecret(secret)
  const token = createPanelToken(verifiedSecret)
  const maxAge = `${MAX_AGE_ATTRIBUTE}=${PANEL_COOKIE_MAX_AGE_SECONDS}`
  return [
    `${PANEL_COOKIE_NAME}=${token}`,
    HTTP_ONLY_FLAG,
    SECURE_FLAG,
    SAME_SITE_ATTRIBUTE,
    ROOT_PATH_ATTRIBUTE,
    maxAge,
  ].join(`${COOKIE_SEPARATOR} `)
}

export function hasValidPanelCookie(cookieHeader: string | null, secret: string): boolean {
  const verifiedSecret = assertCookieSecret(secret)
  const token = readPanelToken(cookieHeader)
  if (token === null) {
    return false
  }
  return matchDigests(token, createPanelToken(verifiedSecret))
}

export function readPanelToken(cookieHeader: string | null): string | null {
  if (cookieHeader === null) {
    return null
  }
  const cookies = cookieHeader.split(COOKIE_SEPARATOR)
  for (const cookie of cookies) {
    const token = readMatchingToken(cookie)
    if (token !== null) {
      return token
    }
  }
  return null
}

function createPanelToken(secret: string): string {
  return createHmac(DIGEST_ALGORITHM, secret).update(PANEL_COOKIE_NAME, TEXT_ENCODING).digest('base64url')
}

function readMatchingToken(cookie: string): string | null {
  const separatorIndex = cookie.indexOf(NAME_VALUE_SEPARATOR)
  if (separatorIndex === MISSING_SEPARATOR) {
    return null
  }
  const name = cookie.slice(0, separatorIndex).trim()
  if (name !== PANEL_COOKIE_NAME) {
    return null
  }
  const value = cookie.slice(separatorIndex + NAME_VALUE_SEPARATOR.length).trim()
  if (value.length === EMPTY_LENGTH) {
    return null
  }
  return value
}
