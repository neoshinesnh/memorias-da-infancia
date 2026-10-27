import { HTTP_NOT_FOUND, HTTP_OK } from '@/application/session-http'
import type { SessionPayload } from '@/application/session-http'
import {
  COMPLETED_SESSION_STATUS,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
  isQuestionNumber,
  type SessionAnswer,
} from '@/domain/session'
import {
  QUESTION_COUNT,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'

const QUESTION_STEP = 1

export type QuestionnairePhase =
  | 'loading'
  | 'question'
  | 'saving'
  | 'save-error'
  | 'thanks'
  | 'registered'

export type AnswerAttempt = {
  questionNumber: QuestionNumber
  optionNumber: OptionPosition
}

export type SavedSession = {
  payload: SessionPayload
  questionNumber: QuestionNumber
}

export type QuestionnaireFlow = {
  phase: QuestionnairePhase
  payload: SessionPayload | null
  displayedQuestion: QuestionNumber
  pendingOption: OptionPosition | null
  pendingQuestion: QuestionNumber | null
  arrivedQuestion: QuestionNumber | null
}

export type RefreshDecision = 'create-session' | 'apply-payload' | 'keep-view'

export function createInitialFlow(): QuestionnaireFlow {
  return {
    phase: 'loading',
    payload: null,
    displayedQuestion: FIRST_QUESTION_NUMBER,
    pendingOption: null,
    pendingQuestion: null,
    arrivedQuestion: null,
  }
}

export function decideSessionRefresh(status: number): RefreshDecision {
  if (status === HTTP_NOT_FOUND) {
    return 'create-session'
  }
  if (status === HTTP_OK) {
    return 'apply-payload'
  }
  return 'keep-view'
}

export function discardRememberedSession(): QuestionnaireFlow {
  return createInitialFlow()
}

export function openExistingSession(payload: SessionPayload): QuestionnaireFlow {
  if (payload.status === COMPLETED_SESSION_STATUS) {
    return settleFlow('registered', payload)
  }
  return settleFlow('question', payload)
}

export function acceptSavedAnswer(saved: SavedSession): QuestionnaireFlow {
  if (saved.payload.status === COMPLETED_SESSION_STATUS) {
    return {
      phase: 'thanks',
      payload: saved.payload,
      displayedQuestion: saved.payload.currentQuestion,
      pendingOption: null,
      pendingQuestion: null,
      arrivedQuestion: saved.questionNumber,
    }
  }
  return {
    phase: 'question',
    payload: saved.payload,
    displayedQuestion: saved.payload.currentQuestion,
    pendingOption: null,
    pendingQuestion: null,
    arrivedQuestion: saved.questionNumber,
  }
}

export function markSaving(flow: QuestionnaireFlow, attempt: AnswerAttempt): QuestionnaireFlow {
  return {
    phase: 'saving',
    payload: flow.payload,
    displayedQuestion: attempt.questionNumber,
    pendingOption: attempt.optionNumber,
    pendingQuestion: attempt.questionNumber,
    arrivedQuestion: null,
  }
}

export function markSaveFailure(flow: QuestionnaireFlow, attempt: AnswerAttempt): QuestionnaireFlow {
  return {
    phase: 'save-error',
    payload: flow.payload,
    displayedQuestion: attempt.questionNumber,
    pendingOption: attempt.optionNumber,
    pendingQuestion: attempt.questionNumber,
    arrivedQuestion: flow.arrivedQuestion,
  }
}

export function showPreviousQuestionOnFlow(flow: QuestionnaireFlow): QuestionnaireFlow {
  if (!canReturnToPrevious(flow)) {
    return flow
  }
  return {
    phase: flow.phase,
    payload: flow.payload,
    displayedQuestion: readEarlierQuestion(flow.displayedQuestion),
    pendingOption: null,
    pendingQuestion: null,
    arrivedQuestion: null,
  }
}

export function mergeServerPayload(flow: QuestionnaireFlow, payload: SessionPayload): QuestionnaireFlow {
  if (flow.phase === 'loading') {
    return openExistingSession(payload)
  }
  if (flow.phase === 'saving') {
    return flow
  }
  if (flow.phase === 'save-error') {
    return reconcileSaveError(flow, payload)
  }
  if (flow.phase === 'thanks' || flow.phase === 'registered') {
    return mergeFinishedView(flow, payload)
  }
  if (payload.status === COMPLETED_SESSION_STATUS) {
    return openExistingSession(payload)
  }
  return moveOpenQuestion(flow, payload)
}

export function sessionAllowsVoting(flow: QuestionnaireFlow): boolean {
  if (flow.payload === null) {
    return false
  }
  if (flow.payload.status !== OPEN_SESSION_STATUS) {
    return false
  }
  if (flow.phase === 'thanks' || flow.phase === 'registered' || flow.phase === 'loading') {
    return false
  }
  return true
}

export function canReturnToPrevious(flow: QuestionnaireFlow): boolean {
  if (flow.phase !== 'question') {
    return false
  }
  if (flow.payload === null) {
    return false
  }
  if (flow.payload.status !== OPEN_SESSION_STATUS) {
    return false
  }
  return flow.displayedQuestion !== FIRST_QUESTION_NUMBER
}

export function readRetryAttempt(flow: QuestionnaireFlow): AnswerAttempt | null {
  if (flow.phase !== 'save-error') {
    return null
  }
  if (flow.pendingQuestion === null || flow.pendingOption === null) {
    return null
  }
  return {
    questionNumber: flow.pendingQuestion,
    optionNumber: flow.pendingOption,
  }
}

export function readSavedOption(
  answers: readonly SessionAnswer[],
  questionNumber: QuestionNumber,
): OptionPosition | null {
  const answer = answers.find((item) => item.questionNumber === questionNumber)
  if (answer === undefined) {
    return null
  }
  return answer.optionNumber
}

function settleFlow(phase: 'question' | 'registered', payload: SessionPayload): QuestionnaireFlow {
  return {
    phase,
    payload,
    displayedQuestion: payload.currentQuestion,
    pendingOption: null,
    pendingQuestion: null,
    arrivedQuestion: null,
  }
}

function reconcileSaveError(flow: QuestionnaireFlow, payload: SessionPayload): QuestionnaireFlow {
  if (payload.status === COMPLETED_SESSION_STATUS) {
    return settleCompletedSave(flow, payload)
  }
  if (!pendingAnswerIsStored(flow, payload) || flow.pendingQuestion === null) {
    return replacePayload(flow, payload)
  }
  return acceptSavedAnswer({
    payload,
    questionNumber: flow.pendingQuestion,
  })
}

function settleCompletedSave(flow: QuestionnaireFlow, payload: SessionPayload): QuestionnaireFlow {
  if (flow.pendingQuestion !== QUESTION_COUNT) {
    return openExistingSession(payload)
  }
  return acceptSavedAnswer({
    payload,
    questionNumber: flow.pendingQuestion,
  })
}

function pendingAnswerIsStored(flow: QuestionnaireFlow, payload: SessionPayload): boolean {
  if (flow.pendingQuestion === null || flow.pendingOption === null) {
    return false
  }
  return readSavedOption(payload.answers, flow.pendingQuestion) === flow.pendingOption
}

function mergeFinishedView(flow: QuestionnaireFlow, payload: SessionPayload): QuestionnaireFlow {
  if (payload.status === OPEN_SESSION_STATUS) {
    return openExistingSession(payload)
  }
  return replacePayload(flow, payload)
}

function replacePayload(flow: QuestionnaireFlow, payload: SessionPayload): QuestionnaireFlow {
  return {
    phase: flow.phase,
    payload,
    displayedQuestion: flow.displayedQuestion,
    pendingOption: flow.pendingOption,
    pendingQuestion: flow.pendingQuestion,
    arrivedQuestion: flow.arrivedQuestion,
  }
}

function moveOpenQuestion(flow: QuestionnaireFlow, payload: SessionPayload): QuestionnaireFlow {
  return {
    phase: 'question',
    payload,
    displayedQuestion: clampDisplayedQuestion(flow.displayedQuestion, payload),
    pendingOption: null,
    pendingQuestion: null,
    arrivedQuestion: flow.arrivedQuestion,
  }
}

function clampDisplayedQuestion(displayed: QuestionNumber, payload: SessionPayload): QuestionNumber {
  if (displayed > payload.furthestQuestion) {
    return payload.currentQuestion
  }
  return displayed
}

function readEarlierQuestion(questionNumber: QuestionNumber): QuestionNumber {
  const earlier = questionNumber - QUESTION_STEP
  if (!isQuestionNumber(earlier)) {
    return questionNumber
  }
  return earlier
}
