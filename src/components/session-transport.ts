import { HTTP_OK, HTTP_SERVER_ERROR } from '@/application/session-http'
import type { SessionPayload } from '@/application/session-http'
import type { AnswerAttempt } from '@/components/questionnaire-flow'
import {
  COMPLETED_SESSION_STATUS,
  OPEN_SESSION_STATUS,
  isOptionPosition,
  isQuestionNumber,
  type SessionAnswer,
  type SessionStatus,
} from '@/domain/session'
import type { QuestionNumber } from '@/domain/survey-catalog'

const CURRENT_SESSION_PATH = '/api/sessoes/atual'
const SESSIONS_PATH = '/api/sessoes'
const JSON_CONTENT_TYPE = 'application/json'
const CONTENT_TYPE_HEADER = 'content-type'
const GET_METHOD = 'GET'
const POST_METHOD = 'POST'
const PUT_METHOD = 'PUT'
const NO_STORE_CACHE = 'no-store' as const
const SAME_ORIGIN_CREDENTIALS = 'same-origin' as const

export type SessionResponse = {
  status: number
  payload: SessionPayload | null
}

export type SessionTransport = {
  readCurrent: () => Promise<SessionResponse>
  createSession: () => Promise<SessionResponse>
  saveAnswer: (attempt: AnswerAttempt) => Promise<SessionResponse>
}

type RequestOptions = {
  method: string
  body?: string
}

let pendingCreate: Promise<SessionResponse> | null = null

export function createBrowserSessionTransport(): SessionTransport {
  return {
    readCurrent: () => requestSession(CURRENT_SESSION_PATH, { method: GET_METHOD }),
    createSession: shareCreateRequest,
    saveAnswer: (attempt) =>
      requestSession(buildAnswerPath(attempt.questionNumber), {
        method: PUT_METHOD,
        body: JSON.stringify({ optionNumber: attempt.optionNumber }),
      }),
  }
}

export async function readSessionResponse(response: Response): Promise<SessionResponse> {
  return {
    status: response.status,
    payload: await readPayload(response),
  }
}

function shareCreateRequest(): Promise<SessionResponse> {
  if (pendingCreate !== null) {
    return pendingCreate
  }
  pendingCreate = requestSession(SESSIONS_PATH, { method: POST_METHOD }).finally(clearPendingCreate)
  return pendingCreate
}

function clearPendingCreate(): void {
  pendingCreate = null
}

async function requestSession(path: string, options: RequestOptions): Promise<SessionResponse> {
  try {
    const response = await fetch(path, {
      method: options.method,
      body: options.body,
      headers: createHeaders(options.body),
      cache: NO_STORE_CACHE,
      credentials: SAME_ORIGIN_CREDENTIALS,
    })
    return readSessionResponse(response)
  } catch {
    return createNetworkFailure()
  }
}

function createHeaders(body: string | undefined): HeadersInit | undefined {
  if (body === undefined) {
    return undefined
  }
  return { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE }
}

function createNetworkFailure(): SessionResponse {
  return {
    status: HTTP_SERVER_ERROR,
    payload: null,
  }
}

function buildAnswerPath(questionNumber: QuestionNumber): string {
  return `${CURRENT_SESSION_PATH}/respostas/${questionNumber}`
}

async function readPayload(response: Response): Promise<SessionPayload | null> {
  if (response.status !== HTTP_OK) {
    return null
  }
  try {
    return parseSessionPayload(await response.json())
  } catch {
    return null
  }
}

function parseSessionPayload(value: unknown): SessionPayload | null {
  if (!isRecord(value)) {
    return null
  }
  if (!isSessionStatus(value.status)) {
    return null
  }
  if (!isQuestionValue(value.currentQuestion) || !isQuestionValue(value.furthestQuestion)) {
    return null
  }
  const answers = parseAnswers(value.answers)
  if (answers === null) {
    return null
  }
  return {
    status: value.status,
    currentQuestion: value.currentQuestion,
    furthestQuestion: value.furthestQuestion,
    answers,
  }
}

function parseAnswers(value: unknown): readonly SessionAnswer[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const answers: SessionAnswer[] = []
  for (const item of value) {
    const answer = parseAnswer(item)
    if (answer === null) {
      return null
    }
    answers.push(answer)
  }
  return answers
}

function parseAnswer(value: unknown): SessionAnswer | null {
  if (!isRecord(value)) {
    return null
  }
  if (!isQuestionValue(value.questionNumber) || !isOptionValue(value.optionNumber)) {
    return null
  }
  return {
    questionNumber: value.questionNumber,
    optionNumber: value.optionNumber,
  }
}

function isSessionStatus(value: unknown): value is SessionStatus {
  if (value === OPEN_SESSION_STATUS) {
    return true
  }
  return value === COMPLETED_SESSION_STATUS
}

function isQuestionValue(value: unknown): value is QuestionNumber {
  if (typeof value !== 'number') {
    return false
  }
  return isQuestionNumber(value)
}

function isOptionValue(value: unknown): value is SessionAnswer['optionNumber'] {
  if (typeof value !== 'number') {
    return false
  }
  return isOptionPosition(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return !Array.isArray(value)
}
