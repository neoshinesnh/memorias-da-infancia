import { createHash, timingSafeEqual } from 'node:crypto'

const DIGEST_ALGORITHM = 'sha256'
const TEXT_ENCODING = 'utf8'
const FAILURE_WINDOW_MINUTES = 15
const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

export const PASSWORD_FAILURE_LIMIT = 10
export const FAILURE_WINDOW_MILLISECONDS =
  FAILURE_WINDOW_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND

const failuresByOrigin = new Map<string, number[]>()

export class PanelPasswordRejectedError extends Error {
  constructor() {
    super('Panel password was rejected')
    this.name = 'PanelPasswordRejectedError'
  }
}

export class TooManyPasswordAttemptsError extends Error {
  constructor() {
    super('Too many panel password attempts')
    this.name = 'TooManyPasswordAttemptsError'
  }
}

export class MissingPanelPasswordError extends Error {
  constructor() {
    super('PANEL_PASSWORD is required')
    this.name = 'MissingPanelPasswordError'
  }
}

export function matchDigests(provided: string, expected: string): boolean {
  const providedDigest = createHash(DIGEST_ALGORITHM).update(provided, TEXT_ENCODING).digest()
  const expectedDigest = createHash(DIGEST_ALGORITHM).update(expected, TEXT_ENCODING).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

export function matchPasswords(provided: string, expected: string): boolean {
  return matchDigests(provided, expected)
}

export function isPasswordAttemptLimited(origin: string, attemptedAt: number): boolean {
  return readFreshStamps(origin, attemptedAt).length >= PASSWORD_FAILURE_LIMIT
}

export function recordPasswordFailure(origin: string, attemptedAt: number): void {
  const stamps = readFreshStamps(origin, attemptedAt)
  stamps.push(attemptedAt)
  failuresByOrigin.set(origin, stamps)
}

export function dropPasswordFailures(origin: string): void {
  failuresByOrigin.delete(origin)
}

export function clearPasswordFailures(): void {
  failuresByOrigin.clear()
}

function readFreshStamps(origin: string, attemptedAt: number): number[] {
  const stamps = failuresByOrigin.get(origin)
  if (stamps === undefined) {
    return []
  }
  return stamps.filter((stamp) => isInsideFailureWindow(stamp, attemptedAt))
}

function isInsideFailureWindow(stamp: number, attemptedAt: number): boolean {
  return attemptedAt - stamp < FAILURE_WINDOW_MILLISECONDS
}
