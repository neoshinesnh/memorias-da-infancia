import {
  mapSessionRow,
  type AnswerTableRow,
  type SessionTableRow,
} from '@/adapters/supabase/session-row'
import { SessionStoreError } from '@/adapters/supabase/supabase-config'
import type { Session, SessionAnswer } from '@/domain/session'

const UNEXPECTED_PAYLOAD = 'unexpected_payload'
const EMPTY_LENGTH = 0

export type AnswerArguments = {
  p_session_id: string
  p_status: string
  p_current_question: number
  p_furthest_question: number
  p_question_number: number
  p_option_number: number
  p_updated_at: string
}

export type SessionWrite = {
  session: Session
  answer: SessionAnswer
  updatedAt: string
}

type SessionRecord = {
  id: string
  status: string
  currentQuestion: number
  furthestQuestion: number
  createdAt: string
  answers: readonly AnswerTableRow[]
}

export function mapStoredSession(value: unknown): Session {
  const record = readSessionRecord(value)
  return mapSessionRow(toSessionRow(record), sortAnswers(record.answers))
}

export function mapStoredSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  return value.map(mapStoredSession)
}

export function createAnswerArguments(write: SessionWrite): AnswerArguments {
  return {
    p_session_id: write.session.id,
    p_status: write.session.status,
    p_current_question: write.session.currentQuestion,
    p_furthest_question: write.session.furthestQuestion,
    p_question_number: write.answer.questionNumber,
    p_option_number: write.answer.optionNumber,
    p_updated_at: write.updatedAt,
  }
}

export function createSessionInsert(session: Session): SessionTableRow {
  return toSessionRow({
    id: session.id,
    status: session.status,
    currentQuestion: session.currentQuestion,
    furthestQuestion: session.furthestQuestion,
    createdAt: session.createdAt,
    answers: [],
  })
}

function readSessionRecord(value: unknown): SessionRecord {
  if (!isRecord(value)) {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  return {
    id: readText(value, 'id'),
    status: readText(value, 'status'),
    currentQuestion: readInteger(value, 'current_question'),
    furthestQuestion: readInteger(value, 'furthest_question'),
    createdAt: readText(value, 'created_at'),
    answers: readAnswers(value.answers),
  }
}

function toSessionRow(record: SessionRecord): SessionTableRow {
  return {
    id: record.id,
    status: record.status,
    currentQuestion: record.currentQuestion,
    furthestQuestion: record.furthestQuestion,
    createdAt: record.createdAt,
  }
}

function sortAnswers(answers: readonly AnswerTableRow[]): AnswerTableRow[] {
  return [...answers].sort(compareAnswers)
}

function compareAnswers(left: AnswerTableRow, right: AnswerTableRow): number {
  return left.questionNumber - right.questionNumber
}

function readAnswers(value: unknown): AnswerTableRow[] {
  if (value === null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  return value.map(readAnswer)
}

function readAnswer(value: unknown): AnswerTableRow {
  if (!isRecord(value)) {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  return {
    questionNumber: readInteger(value, 'question_number'),
    optionNumber: readInteger(value, 'option_number'),
  }
}

function readText(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  if (value.length === EMPTY_LENGTH) {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  return value
}

function readInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number') {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  if (!Number.isInteger(value)) {
    throw new SessionStoreError(UNEXPECTED_PAYLOAD)
  }
  return value
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
