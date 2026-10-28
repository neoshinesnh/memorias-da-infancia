import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MissingSupabaseConfigError } from '@/adapters/supabase/supabase-config'
import { SupabaseSessionRepository, openSupabaseSessionRepository } from '@/adapters/supabase/supabase-session-repository'
import type { SessionStore } from '@/adapters/supabase/supabase-session-store'
import type { SessionWrite } from '@/adapters/supabase/stored-session'
import { DuplicateSessionError, SessionNotFoundError } from '@/application/session-repository'
import {
  COMPLETED_SESSION_STATUS,
  CompletedSessionError,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
  createOpenSession,
  recordAnswer,
  type Session,
} from '@/domain/session'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'

const CREATED_AT = '2026-10-27T12:00:00.000Z'
const SUPABASE_URL = 'https://example.supabase.co'
const SUPABASE_SECRET_KEY = 'secret-key'
const EMPTY_COUNT = 0
const ONE_VOTE = 1
const FIRST_OPTION: OptionPosition = 1
const FOURTH_OPTION: OptionPosition = 4
const SECOND_QUESTION: QuestionNumber = 2
const THIRD_QUESTION: QuestionNumber = 3

class MemorySessionStore implements SessionStore {
  readonly writes: SessionWrite[] = []
  private readonly sessions = new Map<string, Session>()

  async findSession(id: string): Promise<Session | null> {
    const session = this.sessions.get(id)
    if (session === undefined) {
      return null
    }
    return structuredClone(session)
  }

  async listSessions(): Promise<readonly Session[]> {
    return [...this.sessions.values()].map((session) => structuredClone(session))
  }

  async insertSession(session: Session): Promise<void> {
    if (this.sessions.has(session.id)) {
      throw new DuplicateSessionError()
    }
    this.sessions.set(session.id, structuredClone(session))
  }

  async writeAnswer(write: SessionWrite): Promise<void> {
    if (!this.sessions.has(write.session.id)) {
      throw new SessionNotFoundError()
    }
    this.writes.push(write)
    this.sessions.set(write.session.id, structuredClone(write.session))
  }

  async deleteSessions(): Promise<void> {
    this.sessions.clear()
  }
}

function createZeroCounts(): number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
}

function createCountsFor(optionNumber: OptionPosition, total: number): number[] {
  const counts = createZeroCounts()
  counts[optionNumber - FIRST_OPTION_POSITION] = total
  return counts
}

async function answerEveryQuestion(
  repository: SupabaseSessionRepository,
  sessionId: string,
  optionNumber: OptionPosition,
): Promise<void> {
  for (const question of surveyCatalog) {
    await repository.saveAnswer({
      sessionId,
      questionNumber: question.number,
      optionNumber,
    })
  }
}

function restoreSetting(name: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = previous
}

describe('supabase session repository', () => {
  let store: MemorySessionStore
  let repository: SupabaseSessionRepository

  beforeEach(() => {
    store = new MemorySessionStore()
    repository = new SupabaseSessionRepository(store)
  })

  it('returns the screen question and stored options after two answers', async () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    await repository.insert(opened)
    expect((await repository.summarize()).participating).toBe(EMPTY_COUNT)
    await repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    const saved = await repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: SECOND_QUESTION,
      optionNumber: FOURTH_OPTION,
    })
    const found = await repository.findById(opened.id)
    const results = await repository.summarize()
    expect(saved.currentQuestion).toBe(THIRD_QUESTION)
    expect(saved.answers).toEqual([
      { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FIRST_OPTION },
      { questionNumber: SECOND_QUESTION, optionNumber: FOURTH_OPTION },
    ])
    expect(found).toEqual(saved)
    expect(results.participating).toBe(ONE_VOTE)
    expect(results.finished).toBe(EMPTY_COUNT)
    expect(store.writes).toHaveLength(2)
  })

  it('replaces an option and moves the summary count', async () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    await repository.insert(opened)
    await repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    const replaced = await repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const results = await repository.summarize()
    expect(replaced.currentQuestion).toBe(SECOND_QUESTION)
    expect(replaced.status).toBe(OPEN_SESSION_STATUS)
    expect(replaced.answers).toEqual([
      { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION },
    ])
    expect(results.participating).toBe(ONE_VOTE)
    expect(results.finished).toBe(EMPTY_COUNT)
    expect(results.questions.find((question) => question.questionNumber === FIRST_QUESTION_NUMBER)?.counts).toEqual(
      createCountsFor(FOURTH_OPTION, ONE_VOTE),
    )
    expect(await repository.findById(opened.id)).toEqual(replaced)
  })

  it('resumes the stored screen from the same store', async () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    await repository.insert(opened)
    const saved = await repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const reopened = new SupabaseSessionRepository(store)
    expect(await reopened.findById(opened.id)).toEqual(saved)
  })

  it('completes on the last question and keeps the store unchanged when refused', async () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    await repository.insert(opened)
    await answerEveryQuestion(repository, opened.id, FIRST_OPTION)
    const completed = await repository.findById(opened.id)
    const before = await repository.summarize()
    const writesBeforeRefusal = store.writes.length
    expect(completed?.status).toBe(COMPLETED_SESSION_STATUS)
    expect(completed?.currentQuestion).toBe(QUESTION_COUNT)
    expect(before.participating).toBe(EMPTY_COUNT)
    expect(before.finished).toBe(ONE_VOTE)
    expect(before.questions.find((question) => question.questionNumber === QUESTION_COUNT)?.counts).toEqual(
      createCountsFor(FIRST_OPTION, ONE_VOTE),
    )
    await expect(
      repository.saveAnswer({
        sessionId: opened.id,
        questionNumber: QUESTION_COUNT,
        optionNumber: FOURTH_OPTION,
      }),
    ).rejects.toThrow(CompletedSessionError)
    expect(await repository.findById(opened.id)).toEqual(completed)
    expect(await repository.summarize()).toEqual(before)
    expect(store.writes).toHaveLength(writesBeforeRefusal)
    const reopened = new SupabaseSessionRepository(store)
    expect(await reopened.findById(opened.id)).toEqual(completed)
    expect(await reopened.summarize()).toEqual(before)
  })

  it('clears participating, finished, and every option count', async () => {
    const openSession = createOpenSession(randomUUID(), CREATED_AT)
    const finishedSession = createOpenSession(randomUUID(), CREATED_AT)
    await repository.insert(openSession)
    await repository.saveAnswer({
      sessionId: openSession.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    await repository.insert(finishedSession)
    await answerEveryQuestion(repository, finishedSession.id, FOURTH_OPTION)
    expect((await repository.summarize()).participating).toBe(ONE_VOTE)
    expect((await repository.summarize()).finished).toBe(ONE_VOTE)
    await repository.deleteAll()
    const results = await repository.summarize()
    expect(await repository.findById(openSession.id)).toBeNull()
    expect(await repository.findById(finishedSession.id)).toBeNull()
    expect(results.participating).toBe(EMPTY_COUNT)
    expect(results.finished).toBe(EMPTY_COUNT)
    expect(results.questions.map((question) => question.questionNumber)).toEqual(
      surveyCatalog.map((question) => question.number),
    )
    for (const question of results.questions) {
      expect(question.counts).toEqual(createZeroCounts())
    }
  })

  it('stores answers that arrive with the inserted session', async () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    const saved = recordAnswer(opened, {
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    await repository.insert(saved)
    expect(await repository.findById(saved.id)).toEqual(saved)
    expect((await repository.summarize()).participating).toBe(ONE_VOTE)
  })

  it('refuses a missing session and a duplicated insert', async () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    await repository.insert(opened)
    await expect(
      repository.saveAnswer({
        sessionId: randomUUID(),
        questionNumber: FIRST_QUESTION_NUMBER,
        optionNumber: FIRST_OPTION,
      }),
    ).rejects.toThrow(SessionNotFoundError)
    await expect(repository.insert(opened)).rejects.toThrow(DuplicateSessionError)
    expect(await repository.findById(opened.id)).toEqual(opened)
    expect((await repository.summarize()).participating).toBe(EMPTY_COUNT)
  })
})

describe('supabase session repository configuration', () => {
  let previousUrl: string | undefined
  let previousSecret: string | undefined

  beforeEach(() => {
    previousUrl = process.env.SUPABASE_URL
    previousSecret = process.env.SUPABASE_SECRET_KEY
  })

  afterEach(() => {
    restoreSetting('SUPABASE_URL', previousUrl)
    restoreSetting('SUPABASE_SECRET_KEY', previousSecret)
  })

  it('opens when both settings are present', () => {
    process.env.SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SECRET_KEY = SUPABASE_SECRET_KEY
    const opened = openSupabaseSessionRepository()
    expect(typeof opened.findById).toBe('function')
  })

  it('refuses to open when a setting is missing or empty', () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SECRET_KEY
    expect(() => openSupabaseSessionRepository()).toThrow(MissingSupabaseConfigError)
    process.env.SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SECRET_KEY = ''
    expect(() => openSupabaseSessionRepository()).toThrow(MissingSupabaseConfigError)
    process.env.SUPABASE_URL = ''
    process.env.SUPABASE_SECRET_KEY = SUPABASE_SECRET_KEY
    expect(() => openSupabaseSessionRepository()).toThrow(MissingSupabaseConfigError)
  })
})
