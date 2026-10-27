import {
  OPTION_COUNT,
  QUESTION_COUNT,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'

export const OPEN_SESSION_STATUS = 'open'
export const COMPLETED_SESSION_STATUS = 'completed'
export const FIRST_QUESTION_NUMBER: QuestionNumber = 1
export const FIRST_OPTION_POSITION: OptionPosition = 1

const QUESTION_STEP = 1
const LAST_QUESTION_NUMBER: QuestionNumber = QUESTION_COUNT

export type SessionStatus = typeof OPEN_SESSION_STATUS | typeof COMPLETED_SESSION_STATUS

export type SessionAnswer = {
  questionNumber: QuestionNumber
  optionNumber: OptionPosition
}

export type Session = {
  id: string
  status: SessionStatus
  currentQuestion: QuestionNumber
  furthestQuestion: QuestionNumber
  answers: readonly SessionAnswer[]
  createdAt: string
}

export class CompletedSessionError extends Error {
  constructor() {
    super('Completed session refuses changes')
    this.name = 'CompletedSessionError'
  }
}

export class QuestionNotDisplayedError extends Error {
  constructor() {
    super('Question has not been displayed')
    this.name = 'QuestionNotDisplayedError'
  }
}

export class InvalidAnswerError extends Error {
  constructor() {
    super('Answer is outside the catalog')
    this.name = 'InvalidAnswerError'
  }
}

export function isQuestionNumber(value: number): value is QuestionNumber {
  if (!Number.isInteger(value)) {
    return false
  }
  if (value < FIRST_QUESTION_NUMBER) {
    return false
  }
  return value <= QUESTION_COUNT
}

export function isOptionPosition(value: number): value is OptionPosition {
  if (!Number.isInteger(value)) {
    return false
  }
  if (value < FIRST_OPTION_POSITION) {
    return false
  }
  return value <= OPTION_COUNT
}

export function createOpenSession(id: string, createdAt: string): Session {
  return {
    id,
    status: OPEN_SESSION_STATUS,
    currentQuestion: FIRST_QUESTION_NUMBER,
    furthestQuestion: FIRST_QUESTION_NUMBER,
    answers: [],
    createdAt,
  }
}

export function recordAnswer(session: Session, answer: SessionAnswer): Session {
  assertSessionIsOpen(session)
  assertOptionPosition(answer.optionNumber)
  assertQuestionIsDisplayed(session, answer.questionNumber)
  const answers = replaceAnswer(session.answers, answer)
  return moveForward(session, answer.questionNumber, answers)
}

export function showPreviousQuestion(session: Session): Session {
  assertSessionIsOpen(session)
  if (session.currentQuestion === FIRST_QUESTION_NUMBER) {
    return session
  }
  return showDisplayedQuestion(session, readPreviousQuestion(session.currentQuestion))
}

export function showDisplayedQuestion(session: Session, questionNumber: QuestionNumber): Session {
  assertSessionIsOpen(session)
  assertQuestionIsDisplayed(session, questionNumber)
  return {
    id: session.id,
    status: session.status,
    currentQuestion: questionNumber,
    furthestQuestion: session.furthestQuestion,
    answers: session.answers.map(copyAnswer),
    createdAt: session.createdAt,
  }
}

function assertSessionIsOpen(session: Session): void {
  if (session.status === COMPLETED_SESSION_STATUS) {
    throw new CompletedSessionError()
  }
}

function assertOptionPosition(optionNumber: OptionPosition): void {
  if (!isOptionPosition(optionNumber)) {
    throw new InvalidAnswerError()
  }
}

function assertQuestionIsDisplayed(session: Session, questionNumber: QuestionNumber): void {
  if (!isQuestionNumber(questionNumber)) {
    throw new InvalidAnswerError()
  }
  if (questionNumber > session.furthestQuestion) {
    throw new QuestionNotDisplayedError()
  }
}

function replaceAnswer(
  answers: readonly SessionAnswer[],
  answer: SessionAnswer,
): readonly SessionAnswer[] {
  const kept = answers.filter((current) => current.questionNumber !== answer.questionNumber)
  const next = kept.map(copyAnswer)
  next.push(copyAnswer(answer))
  next.sort((left, right) => left.questionNumber - right.questionNumber)
  return next
}

function copyAnswer(answer: SessionAnswer): SessionAnswer {
  return {
    questionNumber: answer.questionNumber,
    optionNumber: answer.optionNumber,
  }
}

function moveForward(
  session: Session,
  questionNumber: QuestionNumber,
  answers: readonly SessionAnswer[],
): Session {
  if (questionNumber === LAST_QUESTION_NUMBER) {
    return completeSession(session, answers)
  }
  const currentQuestion = advanceQuestionNumber(questionNumber)
  return {
    id: session.id,
    status: session.status,
    currentQuestion,
    furthestQuestion: chooseLaterQuestion(session.furthestQuestion, currentQuestion),
    answers,
    createdAt: session.createdAt,
  }
}

function completeSession(session: Session, answers: readonly SessionAnswer[]): Session {
  return {
    id: session.id,
    status: COMPLETED_SESSION_STATUS,
    currentQuestion: LAST_QUESTION_NUMBER,
    furthestQuestion: LAST_QUESTION_NUMBER,
    answers,
    createdAt: session.createdAt,
  }
}

function advanceQuestionNumber(questionNumber: QuestionNumber): QuestionNumber {
  const next = questionNumber + QUESTION_STEP
  if (!isQuestionNumber(next)) {
    throw new InvalidAnswerError()
  }
  return next
}

function readPreviousQuestion(questionNumber: QuestionNumber): QuestionNumber {
  const previous = questionNumber - QUESTION_STEP
  if (!isQuestionNumber(previous)) {
    throw new QuestionNotDisplayedError()
  }
  return previous
}

function chooseLaterQuestion(current: QuestionNumber, candidate: QuestionNumber): QuestionNumber {
  if (candidate > current) {
    return candidate
  }
  return current
}
