import { describe, expect, it } from 'vitest'
import { readResults, openSession, resumeSession, saveSessionAnswer } from '@/application/session-use-cases'
import { idleResultsPublisher } from '../support/idle-results-publisher'
import {
  DuplicateSessionError,
  SessionNotFoundError,
  type SessionRepository,
} from '@/application/session-repository'
import {
  COMPLETED_SESSION_STATUS,
  CompletedSessionError,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
} from '@/domain/session'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'
import { InMemorySessionRepository } from '../support/in-memory-session-repository'

const CREATED_AT = '2026-10-27T12:00:00.000Z'
const EMPTY_COUNT = 0
const ONE_VOTE = 1
const FIRST_OPTION: OptionPosition = 1
const FOURTH_OPTION: OptionPosition = 4
const SECOND_QUESTION: QuestionNumber = 2
const THIRD_QUESTION: QuestionNumber = 3
const FOURTH_QUESTION: QuestionNumber = 4

function createZeroCounts(): number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
}

function createCountsFor(optionNumber: OptionPosition, total: number): number[] {
  const counts = createZeroCounts()
  counts[optionNumber - FIRST_OPTION_POSITION] = total
  return counts
}

async function answerEveryQuestion(
  repository: SessionRepository,
  sessionId: string,
  optionNumber: OptionPosition,
): Promise<void> {
  for (const question of surveyCatalog) {
    await saveSessionAnswer(repository, idleResultsPublisher, {
      sessionId,
      questionNumber: question.number,
      optionNumber,
    })
  }
}

describe('session use cases', () => {
  it('opens a session that stays out of participating until the first answer', async () => {
    const repository = new InMemorySessionRepository()
    const opened = await openSession(repository, { id: 'session-1', createdAt: CREATED_AT })
    const resumed = await resumeSession(repository, opened.id)
    const results = await readResults(repository)
    expect(opened.currentQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(opened.status).toBe(OPEN_SESSION_STATUS)
    expect(resumed).toEqual(opened)
    expect(results.participating).toBe(EMPTY_COUNT)
    expect(results.finished).toBe(EMPTY_COUNT)
  })

  it('replaces an option, keeps the session participating, and resumes the stored screen', async () => {
    const repository = new InMemorySessionRepository()
    const opened = await openSession(repository, { id: 'session-1', createdAt: CREATED_AT })
    await saveSessionAnswer(repository, idleResultsPublisher, {
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    const replaced = await saveSessionAnswer(repository, idleResultsPublisher, {
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const resumed = await resumeSession(repository, opened.id)
    const results = await readResults(repository)
    expect(replaced.currentQuestion).toBe(SECOND_QUESTION)
    expect(replaced.answers).toEqual([
      { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION },
    ])
    expect(resumed).toEqual(replaced)
    expect(results.participating).toBe(ONE_VOTE)
    expect(results.finished).toBe(EMPTY_COUNT)
    expect(results.questions.find((question) => question.questionNumber === FIRST_QUESTION_NUMBER)?.counts).toEqual(
      createCountsFor(FOURTH_OPTION, ONE_VOTE),
    )
  })

  it('returns to the following question when an earlier answer is saved again', async () => {
    const repository = new InMemorySessionRepository()
    const opened = await openSession(repository, { id: 'session-1', createdAt: CREATED_AT })
    for (const question of surveyCatalog) {
      if (question.number > THIRD_QUESTION) {
        break
      }
      await saveSessionAnswer(repository, idleResultsPublisher, {
        sessionId: opened.id,
        questionNumber: question.number,
        optionNumber: FIRST_OPTION,
      })
    }
    const saved = await saveSessionAnswer(repository, idleResultsPublisher, {
      sessionId: opened.id,
      questionNumber: THIRD_QUESTION,
      optionNumber: FOURTH_OPTION,
    })
    const results = await readResults(repository)
    expect(saved.currentQuestion).toBe(FOURTH_QUESTION)
    expect(saved.furthestQuestion).toBe(FOURTH_QUESTION)
    expect(saved.status).toBe(OPEN_SESSION_STATUS)
    expect(results.participating).toBe(ONE_VOTE)
    expect(results.questions.find((question) => question.questionNumber === THIRD_QUESTION)?.counts).toEqual(
      createCountsFor(FOURTH_OPTION, ONE_VOTE),
    )
  })

  it('completes on the last question and refuses a later save without changing counts', async () => {
    const repository = new InMemorySessionRepository()
    const opened = await openSession(repository, { id: 'session-1', createdAt: CREATED_AT })
    await answerEveryQuestion(repository, opened.id, FIRST_OPTION)
    const completed = await resumeSession(repository, opened.id)
    const before = await readResults(repository)
    expect(completed?.status).toBe(COMPLETED_SESSION_STATUS)
    expect(completed?.currentQuestion).toBe(QUESTION_COUNT)
    expect(before.participating).toBe(EMPTY_COUNT)
    expect(before.finished).toBe(ONE_VOTE)
    expect(before.questions.find((question) => question.questionNumber === QUESTION_COUNT)?.counts).toEqual(
      createCountsFor(FIRST_OPTION, ONE_VOTE),
    )
    await expect(
      saveSessionAnswer(repository, idleResultsPublisher, {
        sessionId: opened.id,
        questionNumber: QUESTION_COUNT,
        optionNumber: FOURTH_OPTION,
      }),
    ).rejects.toThrow(CompletedSessionError)
    expect(await readResults(repository)).toEqual(before)
    const lastAnswer = (await resumeSession(repository, opened.id))?.answers.find(
      (answer) => answer.questionNumber === QUESTION_COUNT,
    )
    expect(lastAnswer).toEqual({
      questionNumber: QUESTION_COUNT,
      optionNumber: FIRST_OPTION,
    })
  })

  it('resets participating, finished, and every option count', async () => {
    const repository = new InMemorySessionRepository()
    const opened = await openSession(repository, { id: 'session-1', createdAt: CREATED_AT })
    await saveSessionAnswer(repository, idleResultsPublisher, {
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    await repository.deleteAll()
    const results = await readResults(repository)
    expect(await resumeSession(repository, opened.id)).toBeNull()
    expect(results.participating).toBe(EMPTY_COUNT)
    expect(results.finished).toBe(EMPTY_COUNT)
    expect(results.questions).toHaveLength(QUESTION_COUNT)
    for (const question of results.questions) {
      expect(question.counts).toEqual(createZeroCounts())
    }
  })

  it('refuses a missing session and a duplicated open', async () => {
    const repository = new InMemorySessionRepository()
    const opened = await openSession(repository, { id: 'session-1', createdAt: CREATED_AT })
    await expect(
      saveSessionAnswer(repository, idleResultsPublisher, {
        sessionId: 'missing',
        questionNumber: FIRST_QUESTION_NUMBER,
        optionNumber: FIRST_OPTION,
      }),
    ).rejects.toThrow(SessionNotFoundError)
    await expect(openSession(repository, { id: opened.id, createdAt: CREATED_AT })).rejects.toThrow(DuplicateSessionError)
    expect((await readResults(repository)).participating).toBe(EMPTY_COUNT)
  })
})
