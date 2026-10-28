import { randomUUID } from 'node:crypto'
import { readResultsPublisher } from '@/adapters/realtime/in-process-publisher'
import { closeSessionRepositories, readSessionRepository } from '@/adapters/supabase/session-repository-cache'
import { SessionNotFoundError } from '@/application/session-repository'
import { logAnswerSaved, logSessionCreated } from '@/application/session-log'
import {
  COOKIE_HEADER,
  HTTP_NOT_FOUND,
  HTTP_OK,
  ORIGIN_HEADER,
  assertMutationOrigin,
  buildSessionCookie,
  readSessionId,
  resolveResumeStatus,
  resolveSessionFailure,
  toSessionPayload,
} from '@/application/session-http'
import { openSession, resumeSession, saveSessionAnswer } from '@/application/session-use-cases'
import { InvalidAnswerError, isOptionPosition, isQuestionNumber, type Session } from '@/domain/session'
import type { OptionPosition, QuestionNumber } from '@/domain/survey-catalog'

const CACHE_CONTROL_HEADER = 'cache-control'
const SET_COOKIE_HEADER = 'set-cookie'
const NO_STORE_DIRECTIVE = 'no-store'
const PUBLIC_URL_VARIABLE = 'PUBLIC_URL'
const QUESTION_NUMBER_PATTERN = /^(?:[1-9]|10)$/

export type QuestionRouteParams = {
  questionNumber?: string | string[]
}

export type QuestionRouteContext = {
  params?: Promise<QuestionRouteParams>
}

export async function createParticipantSession(request: Request): Promise<Response> {
  try {
    assertMutationOrigin(request.headers.get(ORIGIN_HEADER), readPublicUrl())
    const session = await openParticipantSession()
    logSessionCreated()
    return createCreatedResponse(session)
  } catch (error) {
    return createFailureResponse(error)
  }
}

export async function readCurrentSession(request: Request): Promise<Response> {
  try {
    return createPayloadResponse(await findCurrentSession(request))
  } catch (error) {
    return createFailureResponse(error)
  }
}

export async function saveCurrentAnswer(
  request: Request,
  params: Promise<QuestionRouteParams> | undefined,
): Promise<Response> {
  try {
    assertMutationOrigin(request.headers.get(ORIGIN_HEADER), readPublicUrl())
    const sessionId = readRequestSessionId(request)
    const questionNumber = parseQuestionNumber(await readQuestionSegment(params))
    const optionNumber = await readOptionNumber(request)
    const session = await saveSessionAnswer(readSessionRepository(), readResultsPublisher(), {
      sessionId,
      questionNumber,
      optionNumber,
    })
    logAnswerSaved(questionNumber)
    return createPayloadResponse(session)
  } catch (error) {
    return createFailureResponse(error)
  }
}

export function closeParticipantRepositories(): void {
  closeSessionRepositories()
}

function openParticipantSession(): Promise<Session> {
  return openSession(readSessionRepository(), {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  })
}

async function findCurrentSession(request: Request): Promise<Session> {
  const sessionId = readRequestSessionId(request)
  const session = await resumeSession(readSessionRepository(), sessionId)
  return requireSession(session)
}

function readRequestSessionId(request: Request): string {
  const sessionId = readSessionId(request.headers.get(COOKIE_HEADER))
  if (sessionId === null) {
    throw new SessionNotFoundError()
  }
  return sessionId
}

function requireSession(session: Session | null): Session {
  if (resolveResumeStatus(session) === HTTP_NOT_FOUND || session === null) {
    throw new SessionNotFoundError()
  }
  return session
}

function readPublicUrl(): string | undefined {
  return process.env[PUBLIC_URL_VARIABLE]
}

function createCreatedResponse(session: Session): Response {
  const headers = createPrivateHeaders()
  headers.append(SET_COOKIE_HEADER, buildSessionCookie(session.id))
  return Response.json(toSessionPayload(session), { status: HTTP_OK, headers })
}

function createPayloadResponse(session: Session): Response {
  return Response.json(toSessionPayload(session), {
    status: HTTP_OK,
    headers: createPrivateHeaders(),
  })
}

function createFailureResponse(error: unknown): Response {
  const failure = resolveSessionFailure(error)
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

async function readQuestionSegment(params: Promise<QuestionRouteParams> | undefined): Promise<string | undefined> {
  if (params === undefined) {
    return undefined
  }
  const resolved = await params
  return readSingleSegment(resolved.questionNumber)
}

function readSingleSegment(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return undefined
  }
  return value
}

function parseQuestionNumber(value: string | undefined): QuestionNumber {
  if (value === undefined) {
    throw new InvalidAnswerError()
  }
  if (!QUESTION_NUMBER_PATTERN.test(value)) {
    throw new InvalidAnswerError()
  }
  const parsed = Number(value)
  if (!isQuestionNumber(parsed)) {
    throw new InvalidAnswerError()
  }
  return parsed
}

async function readOptionNumber(request: Request): Promise<OptionPosition> {
  const body = await readJsonBody(request)
  const optionNumber = body.optionNumber
  if (typeof optionNumber !== 'number') {
    throw new InvalidAnswerError()
  }
  if (!isOptionPosition(optionNumber)) {
    throw new InvalidAnswerError()
  }
  return optionNumber
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await readJsonValue(request)
  if (!isJsonObject(body)) {
    throw new InvalidAnswerError()
  }
  return body
}

async function readJsonValue(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new InvalidAnswerError()
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
