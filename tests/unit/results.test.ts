import { describe, expect, it } from 'vitest'
import { summarizeResults, type ResultsSnapshot } from '@/domain/results'
import {
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  createOpenSession,
  recordAnswer,
  showPreviousQuestion,
  type Session,
  type SessionAnswer,
} from '@/domain/session'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'

const CREATED_AT = '2026-10-27T12:00:00.000Z'
const EMPTY_COUNT = 0
const ONE_VOTE = 1
const FIRST_OPTION: OptionPosition = 1
const SECOND_OPTION: OptionPosition = 2
const LAST_QUESTION: QuestionNumber = QUESTION_COUNT

function createZeroCounts(): number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
}

function createCountsFor(optionNumber: OptionPosition, total: number): number[] {
  const counts = createZeroCounts()
  counts[optionNumber - FIRST_OPTION_POSITION] = total
  return counts
}

function readCounts(snapshot: ResultsSnapshot, questionNumber: QuestionNumber): readonly number[] {
  const question = snapshot.questions.find((item) => item.questionNumber === questionNumber)
  if (question === undefined) {
    throw new Error('Question is missing from the portrait')
  }
  return question.counts
}

function createAnswer(questionNumber: QuestionNumber, optionNumber: OptionPosition): SessionAnswer {
  return {
    questionNumber,
    optionNumber,
  }
}

function reachQuestion(session: Session, questionNumber: QuestionNumber): Session {
  let current = session
  while (current.currentQuestion < questionNumber) {
    const displayed = current.currentQuestion
    current = recordAnswer(current, createAnswer(displayed, FIRST_OPTION))
  }
  return current
}

describe('results', () => {
  it('returns a zero portrait when there are no sessions', () => {
    const snapshot = summarizeResults([])
    expect(snapshot.participating).toBe(EMPTY_COUNT)
    expect(snapshot.finished).toBe(EMPTY_COUNT)
    expect(snapshot.questions).toHaveLength(QUESTION_COUNT)
    expect(snapshot.questions.map((question) => question.questionNumber)).toEqual(
      surveyCatalog.map((question) => question.number),
    )
    for (const question of snapshot.questions) {
      expect(question.counts).toEqual(createZeroCounts())
    }
  })

  it('leaves a session without answers out of participating', () => {
    const snapshot = summarizeResults([createOpenSession('empty', CREATED_AT)])
    expect(snapshot.participating).toBe(EMPTY_COUNT)
    expect(snapshot.finished).toBe(EMPTY_COUNT)
    for (const question of snapshot.questions) {
      expect(question.counts).toEqual(createZeroCounts())
    }
  })

  it('moves the vote when the option is replaced and keeps the session participating', () => {
    const opened = createOpenSession('voting', CREATED_AT)
    const first = recordAnswer(opened, createAnswer(FIRST_QUESTION_NUMBER, FIRST_OPTION))
    const previous = showPreviousQuestion(first)
    const replaced = recordAnswer(previous, createAnswer(FIRST_QUESTION_NUMBER, SECOND_OPTION))
    const snapshot = summarizeResults([replaced])
    expect(snapshot.participating).toBe(ONE_VOTE)
    expect(snapshot.finished).toBe(EMPTY_COUNT)
    expect(readCounts(snapshot, FIRST_QUESTION_NUMBER)).toEqual(createCountsFor(SECOND_OPTION, ONE_VOTE))
    for (const question of snapshot.questions) {
      if (question.questionNumber === FIRST_QUESTION_NUMBER) {
        continue
      }
      expect(question.counts).toEqual(createZeroCounts())
    }
  })

  it('adds two votes on the same option', () => {
    const first = recordAnswer(
      createOpenSession('first', CREATED_AT),
      createAnswer(FIRST_QUESTION_NUMBER, FIRST_OPTION),
    )
    const second = recordAnswer(
      createOpenSession('second', CREATED_AT),
      createAnswer(FIRST_QUESTION_NUMBER, FIRST_OPTION),
    )
    const snapshot = summarizeResults([first, second])
    const twoVotes = ONE_VOTE + ONE_VOTE
    expect(snapshot.participating).toBe(twoVotes)
    expect(readCounts(snapshot, FIRST_QUESTION_NUMBER)).toEqual(createCountsFor(FIRST_OPTION, twoVotes))
  })

  it('drops a completed session from participating and adds it to finished', () => {
    const opened = createOpenSession('done', CREATED_AT)
    const lastQuestion = reachQuestion(opened, LAST_QUESTION)
    const completed = recordAnswer(lastQuestion, createAnswer(LAST_QUESTION, FIRST_OPTION))
    const stillOpen = recordAnswer(createOpenSession('open', CREATED_AT), createAnswer(FIRST_QUESTION_NUMBER, SECOND_OPTION))
    const snapshot = summarizeResults([completed, stillOpen, createOpenSession('empty', CREATED_AT)])
    expect(snapshot.participating).toBe(ONE_VOTE)
    expect(snapshot.finished).toBe(ONE_VOTE)
    const questionOne = createCountsFor(FIRST_OPTION, ONE_VOTE)
    questionOne[SECOND_OPTION - FIRST_OPTION_POSITION] = ONE_VOTE
    expect(readCounts(snapshot, FIRST_QUESTION_NUMBER)).toEqual(questionOne)
    expect(readCounts(snapshot, LAST_QUESTION)).toEqual(createCountsFor(FIRST_OPTION, ONE_VOTE))
  })
})
