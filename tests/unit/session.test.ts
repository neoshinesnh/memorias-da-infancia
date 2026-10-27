import { describe, expect, it } from 'vitest'
import {
  COMPLETED_SESSION_STATUS,
  CompletedSessionError,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  InvalidAnswerError,
  OPEN_SESSION_STATUS,
  QuestionNotDisplayedError,
  createOpenSession,
  recordAnswer,
  showDisplayedQuestion,
  showPreviousQuestion,
  type Session,
  type SessionAnswer,
} from '@/domain/session'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'

const SESSION_ID = 'session-1'
const CREATED_AT = '2026-10-27T12:00:00.000Z'
const FIRST_OPTION: OptionPosition = 1
const SECOND_OPTION: OptionPosition = 2
const SECOND_QUESTION: QuestionNumber = 2
const THIRD_QUESTION: QuestionNumber = 3
const FOURTH_QUESTION: QuestionNumber = 4
const FIFTH_QUESTION: QuestionNumber = 5
const LAST_QUESTION: QuestionNumber = QUESTION_COUNT
const ANONYMOUS_FIELDS = [
  'answers',
  'createdAt',
  'currentQuestion',
  'furthestQuestion',
  'id',
  'status',
]

function reachQuestion(session: Session, questionNumber: QuestionNumber): Session {
  let current = session
  while (current.currentQuestion < questionNumber) {
    const displayed = current.currentQuestion
    current = recordAnswer(current, {
      questionNumber: displayed,
      optionNumber: FIRST_OPTION,
    })
  }
  return current
}

function createAnswer(
  questionNumber: QuestionNumber,
  optionNumber: OptionPosition = FIRST_OPTION,
): SessionAnswer {
  return {
    questionNumber,
    optionNumber,
  }
}

describe('session', () => {
  it('opens an anonymous session on the first question', () => {
    const session = createOpenSession(SESSION_ID, CREATED_AT)
    expect(session.id).toBe(SESSION_ID)
    expect(session.status).toBe(OPEN_SESSION_STATUS)
    expect(session.currentQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(session.furthestQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(session.answers).toEqual([])
    expect(session.createdAt).toBe(CREATED_AT)
    expect(Object.keys(session).sort()).toEqual(ANONYMOUS_FIELDS)
  })

  it('stores one option and moves the screen to the next question', () => {
    const session = createOpenSession(SESSION_ID, CREATED_AT)
    const saved = recordAnswer(session, createAnswer(FIRST_QUESTION_NUMBER, FIRST_OPTION))
    expect(saved.answers).toEqual([createAnswer(FIRST_QUESTION_NUMBER, FIRST_OPTION)])
    expect(saved.currentQuestion).toBe(SECOND_QUESTION)
    expect(saved.furthestQuestion).toBe(SECOND_QUESTION)
    expect(saved.status).toBe(OPEN_SESSION_STATUS)
    expect(session.answers).toEqual([])
  })

  it('replaces the previous option on the same question', () => {
    const opened = createOpenSession(SESSION_ID, CREATED_AT)
    const first = recordAnswer(opened, createAnswer(FIRST_QUESTION_NUMBER, FIRST_OPTION))
    const previous = showPreviousQuestion(first)
    const replaced = recordAnswer(previous, createAnswer(FIRST_QUESTION_NUMBER, SECOND_OPTION))
    expect(replaced.answers).toEqual([createAnswer(FIRST_QUESTION_NUMBER, SECOND_OPTION)])
    expect(first.answers).toEqual([createAnswer(FIRST_QUESTION_NUMBER, FIRST_OPTION)])
    expect(replaced.status).toBe(OPEN_SESSION_STATUS)
  })

  it('moves forward from the edited question after going back', () => {
    const opened = createOpenSession(SESSION_ID, CREATED_AT)
    const reached = reachQuestion(opened, FIFTH_QUESTION)
    const questionFour = showPreviousQuestion(reached)
    const questionThree = showPreviousQuestion(questionFour)
    const saved = recordAnswer(questionThree, createAnswer(THIRD_QUESTION, SECOND_OPTION))
    expect(questionThree.currentQuestion).toBe(THIRD_QUESTION)
    expect(saved.currentQuestion).toBe(FOURTH_QUESTION)
    expect(saved.furthestQuestion).toBe(FIFTH_QUESTION)
    expect(saved.answers).toEqual([
      createAnswer(FIRST_QUESTION_NUMBER),
      createAnswer(SECOND_QUESTION),
      createAnswer(THIRD_QUESTION, SECOND_OPTION),
      createAnswer(FOURTH_QUESTION),
    ])
  })

  it('refuses a question that has not been displayed', () => {
    const session = createOpenSession(SESSION_ID, CREATED_AT)
    expect(() => recordAnswer(session, createAnswer(SECOND_QUESTION))).toThrow(QuestionNotDisplayedError)
    expect(() => showDisplayedQuestion(session, SECOND_QUESTION)).toThrow(QuestionNotDisplayedError)
    expect(showPreviousQuestion(session)).toBe(session)
    expect(session.answers).toEqual([])
  })

  it('completes the session when the last question is answered', () => {
    const opened = createOpenSession(SESSION_ID, CREATED_AT)
    const lastQuestion = reachQuestion(opened, LAST_QUESTION)
    const completed = recordAnswer(lastQuestion, createAnswer(LAST_QUESTION, SECOND_OPTION))
    expect(completed.status).toBe(COMPLETED_SESSION_STATUS)
    expect(completed.currentQuestion).toBe(LAST_QUESTION)
    expect(completed.furthestQuestion).toBe(LAST_QUESTION)
    expect(completed.answers).toHaveLength(QUESTION_COUNT)
    expect(completed.answers[LAST_QUESTION - FIRST_QUESTION_NUMBER]).toEqual(
      createAnswer(LAST_QUESTION, SECOND_OPTION),
    )
  })

  it('refuses a new answer after the session is completed', () => {
    const opened = createOpenSession(SESSION_ID, CREATED_AT)
    const lastQuestion = reachQuestion(opened, LAST_QUESTION)
    const completed = recordAnswer(lastQuestion, createAnswer(LAST_QUESTION, FIRST_OPTION))
    const answers = completed.answers.map((answer) => ({ ...answer }))
    expect(() => recordAnswer(completed, createAnswer(LAST_QUESTION, SECOND_OPTION))).toThrow(CompletedSessionError)
    expect(() => showPreviousQuestion(completed)).toThrow(CompletedSessionError)
    expect(completed.status).toBe(COMPLETED_SESSION_STATUS)
    expect(completed.answers).toEqual(answers)
  })

  it('rejects an option outside the catalog', () => {
    const session = createOpenSession(SESSION_ID, CREATED_AT)
    const optionOutsideCatalog = (OPTION_COUNT + FIRST_OPTION_POSITION) as OptionPosition
    expect(() => recordAnswer(session, createAnswer(FIRST_QUESTION_NUMBER, optionOutsideCatalog))).toThrow(
      InvalidAnswerError,
    )
    expect(session.answers).toEqual([])
  })
})
