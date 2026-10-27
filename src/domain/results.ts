import {
  OPEN_SESSION_STATUS,
  COMPLETED_SESSION_STATUS,
  FIRST_OPTION_POSITION,
  type Session,
} from '@/domain/session'
import {
  OPTION_COUNT,
  surveyCatalog,
  type QuestionNumber,
} from '@/domain/survey-catalog'

const EMPTY_COUNT = 0
const COUNT_STEP = 1

export type QuestionCounts = {
  questionNumber: QuestionNumber
  counts: readonly number[]
}

export type ResultsSnapshot = {
  participating: number
  finished: number
  questions: readonly QuestionCounts[]
}

export function summarizeResults(sessions: readonly Session[]): ResultsSnapshot {
  return {
    participating: countParticipating(sessions),
    finished: countFinished(sessions),
    questions: countQuestions(sessions),
  }
}

function countParticipating(sessions: readonly Session[]): number {
  return sessions.filter(isParticipating).length
}

function isParticipating(session: Session): boolean {
  if (session.status !== OPEN_SESSION_STATUS) {
    return false
  }
  return session.answers.length > EMPTY_COUNT
}

function countFinished(sessions: readonly Session[]): number {
  return sessions.filter(isFinished).length
}

function isFinished(session: Session): boolean {
  return session.status === COMPLETED_SESSION_STATUS
}

function countQuestions(sessions: readonly Session[]): readonly QuestionCounts[] {
  return surveyCatalog.map((question) => ({
    questionNumber: question.number,
    counts: countOptions(sessions, question.number),
  }))
}

function countOptions(sessions: readonly Session[], questionNumber: QuestionNumber): readonly number[] {
  return sessions.reduce(
    (counts, session) => applySessionCount(counts, session, questionNumber),
    createEmptyCounts(),
  )
}

function createEmptyCounts(): readonly number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
}

function applySessionCount(
  counts: readonly number[],
  session: Session,
  questionNumber: QuestionNumber,
): readonly number[] {
  const answer = session.answers.find((item) => item.questionNumber === questionNumber)
  if (answer === undefined) {
    return counts
  }
  return incrementCount(counts, answer.optionNumber - FIRST_OPTION_POSITION)
}

function incrementCount(counts: readonly number[], index: number): readonly number[] {
  return counts.map((count, optionIndex) => selectCount(count, optionIndex, index))
}

function selectCount(count: number, optionIndex: number, selectedIndex: number): number {
  if (optionIndex !== selectedIndex) {
    return count
  }
  return count + COUNT_STEP
}
