import {
  COMPLETED_SESSION_STATUS,
  OPEN_SESSION_STATUS,
  isOptionPosition,
  isQuestionNumber,
  type Session,
  type SessionAnswer,
  type SessionStatus,
} from '@/domain/session'
import type { OptionPosition, QuestionNumber } from '@/domain/survey-catalog'

export type SessionTableRow = {
  id: string
  status: string
  currentQuestion: number
  furthestQuestion: number
  createdAt: string
}

export type AnswerTableRow = {
  questionNumber: number
  optionNumber: number
}

export class InvalidSessionRowError extends Error {
  constructor() {
    super('Session row is outside the catalog')
    this.name = 'InvalidSessionRowError'
  }
}

export function mapSessionRow(row: SessionTableRow, answers: readonly AnswerTableRow[]): Session {
  return {
    id: row.id,
    status: readSessionStatus(row.status),
    currentQuestion: readQuestionNumber(row.currentQuestion),
    furthestQuestion: readQuestionNumber(row.furthestQuestion),
    answers: answers.map(mapAnswerRow),
    createdAt: row.createdAt,
  }
}

function readSessionStatus(status: string): SessionStatus {
  if (status === OPEN_SESSION_STATUS) {
    return OPEN_SESSION_STATUS
  }
  if (status === COMPLETED_SESSION_STATUS) {
    return COMPLETED_SESSION_STATUS
  }
  throw new InvalidSessionRowError()
}

function readQuestionNumber(value: number): QuestionNumber {
  if (!isQuestionNumber(value)) {
    throw new InvalidSessionRowError()
  }
  return value
}

function mapAnswerRow(row: AnswerTableRow): SessionAnswer {
  return {
    questionNumber: readQuestionNumber(row.questionNumber),
    optionNumber: readOptionNumber(row.optionNumber),
  }
}

function readOptionNumber(value: number): OptionPosition {
  if (!isOptionPosition(value)) {
    throw new InvalidSessionRowError()
  }
  return value
}
