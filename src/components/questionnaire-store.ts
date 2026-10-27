import { HTTP_OK, HTTP_SERVER_ERROR } from '@/application/session-http'
import {
  acceptSavedAnswer,
  decideSessionRefresh,
  discardRememberedSession,
  markSaveFailure,
  markSaving,
  mergeServerPayload,
  openExistingSession,
  readRetryAttempt,
  sessionAllowsVoting,
  showPreviousQuestionOnFlow,
  type AnswerAttempt,
  type QuestionnaireFlow,
} from '@/components/questionnaire-flow'
import type { SessionResponse, SessionTransport } from '@/components/session-transport'
import type { OptionPosition } from '@/domain/survey-catalog'

const REFRESH_INTERVAL_SECONDS = 5
const MILLISECONDS_PER_SECOND = 1000

export const SESSION_REFRESH_MILLISECONDS = REFRESH_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND

export type QuestionnaireStore = {
  readFlow: () => QuestionnaireFlow
  start: () => Promise<void>
  choose: (optionNumber: OptionPosition) => Promise<void>
  retry: () => Promise<void>
  goBack: () => void
  refresh: () => Promise<void>
}

type StoreMemory = {
  flow: QuestionnaireFlow
  queue: Promise<void>
  started: boolean
}

export function createQuestionnaireStore(transport: SessionTransport): QuestionnaireStore {
  const memory = createMemory()
  return {
    readFlow: () => memory.flow,
    start: () => startStore(memory, transport),
    choose: (optionNumber) => chooseOption(memory, transport, optionNumber),
    retry: () => retrySave(memory, transport),
    goBack: () => {
      memory.flow = showPreviousQuestionOnFlow(memory.flow)
    },
    refresh: () => enqueue(memory, () => refreshCurrent(memory, transport)),
  }
}

function createMemory(): StoreMemory {
  return {
    flow: discardRememberedSession(),
    queue: Promise.resolve(),
    started: false,
  }
}

function startStore(memory: StoreMemory, transport: SessionTransport): Promise<void> {
  if (memory.started) {
    return Promise.resolve()
  }
  memory.started = true
  return enqueue(memory, () => loadInitial(memory, transport))
}

function chooseOption(
  memory: StoreMemory,
  transport: SessionTransport,
  optionNumber: OptionPosition,
): Promise<void> {
  if (!canStartSave(memory.flow)) {
    return Promise.resolve()
  }
  const attempt = {
    questionNumber: memory.flow.displayedQuestion,
    optionNumber,
  }
  memory.flow = markSaving(memory.flow, attempt)
  return enqueue(memory, () => saveIfCurrent(memory, transport, attempt))
}

function retrySave(memory: StoreMemory, transport: SessionTransport): Promise<void> {
  const attempt = readRetryAttempt(memory.flow)
  if (attempt === null) {
    return Promise.resolve()
  }
  memory.flow = markSaving(memory.flow, attempt)
  return enqueue(memory, () => saveIfCurrent(memory, transport, attempt))
}

function enqueue(memory: StoreMemory, work: () => Promise<void>): Promise<void> {
  const next = memory.queue.then(work, work)
  memory.queue = next.then(finishQuietly, finishQuietly)
  return next
}

async function loadInitial(memory: StoreMemory, transport: SessionTransport): Promise<void> {
  const response = await transport.readCurrent()
  await applyLoadedSession(memory, transport, response)
}

async function refreshCurrent(memory: StoreMemory, transport: SessionTransport): Promise<void> {
  const response = await transport.readCurrent()
  await applyLoadedSession(memory, transport, response)
}

async function applyLoadedSession(
  memory: StoreMemory,
  transport: SessionTransport,
  response: SessionResponse,
): Promise<void> {
  const decision = decideSessionRefresh(response.status)
  if (decision === 'create-session') {
    memory.flow = discardRememberedSession()
    await storeCreatedSession(memory, transport)
    return
  }
  if (decision !== 'apply-payload' || response.payload === null) {
    return
  }
  memory.flow = mergeServerPayload(memory.flow, response.payload)
}

async function storeCreatedSession(memory: StoreMemory, transport: SessionTransport): Promise<void> {
  const response = await transport.createSession()
  if (response.status !== HTTP_OK || response.payload === null) {
    return
  }
  memory.flow = openExistingSession(response.payload)
}

async function saveIfCurrent(
  memory: StoreMemory,
  transport: SessionTransport,
  attempt: AnswerAttempt,
): Promise<void> {
  if (!isCurrentAttempt(memory.flow, attempt)) {
    return
  }
  const response = await readSaveResponse(transport, attempt)
  if (!isCurrentAttempt(memory.flow, attempt)) {
    return
  }
  memory.flow = applySaveResult(memory.flow, response, attempt)
}

async function readSaveResponse(
  transport: SessionTransport,
  attempt: AnswerAttempt,
): Promise<SessionResponse> {
  try {
    return await transport.saveAnswer(attempt)
  } catch {
    return { status: HTTP_SERVER_ERROR, payload: null }
  }
}

function canStartSave(flow: QuestionnaireFlow): boolean {
  if (flow.phase === 'saving') {
    return false
  }
  return sessionAllowsVoting(flow)
}

function isCurrentAttempt(flow: QuestionnaireFlow, attempt: AnswerAttempt): boolean {
  if (flow.phase !== 'saving') {
    return false
  }
  if (flow.pendingQuestion !== attempt.questionNumber) {
    return false
  }
  return flow.pendingOption === attempt.optionNumber
}

function applySaveResult(
  flow: QuestionnaireFlow,
  response: SessionResponse,
  attempt: AnswerAttempt,
): QuestionnaireFlow {
  if (response.status !== HTTP_OK || response.payload === null) {
    return markSaveFailure(flow, attempt)
  }
  return acceptSavedAnswer({
    payload: response.payload,
    questionNumber: attempt.questionNumber,
  })
}

function finishQuietly(): void {
  return undefined
}
