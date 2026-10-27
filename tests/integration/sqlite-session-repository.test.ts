import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import SqliteDatabase from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MissingDatabasePathError,
  SqliteSessionRepository,
  openSqliteSessionRepository,
} from '@/adapters/sqlite/sqlite-session-repository'
import { DuplicateSessionError, SessionNotFoundError } from '@/application/session-repository'
import {
  COMPLETED_SESSION_STATUS,
  CompletedSessionError,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
  createOpenSession,
  recordAnswer,
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
const TEMP_DIRECTORY_PREFIX = 'memorias-session-'
const WAL_JOURNAL_MODE = 'wal'
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FIRST_OPTION: OptionPosition = 1
const FOURTH_OPTION: OptionPosition = 4
const SECOND_QUESTION: QuestionNumber = 2
const THIRD_QUESTION: QuestionNumber = 3

function createZeroCounts(): number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
}

function createCountsFor(optionNumber: OptionPosition, total: number): number[] {
  const counts = createZeroCounts()
  counts[optionNumber - FIRST_OPTION_POSITION] = total
  return counts
}

function answerEveryQuestion(repository: SqliteSessionRepository, sessionId: string, optionNumber: OptionPosition): void {
  for (const question of surveyCatalog) {
    repository.saveAnswer({
      sessionId,
      questionNumber: question.number,
      optionNumber,
    })
  }
}

function restoreDatabasePath(previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env.DATABASE_PATH
    return
  }
  process.env.DATABASE_PATH = previous
}

function readJournalMode(databasePath: string): unknown {
  const probe = new SqliteDatabase(databasePath)
  try {
    return probe.pragma('journal_mode', { simple: true })
  } finally {
    probe.close()
  }
}

describe('sqlite session repository', () => {
  let directoryPath: string
  let databasePath: string
  let repository: SqliteSessionRepository

  beforeEach(() => {
    directoryPath = mkdtempSync(join(tmpdir(), TEMP_DIRECTORY_PREFIX))
    databasePath = join(directoryPath, 'event.sqlite')
    repository = new SqliteSessionRepository(databasePath)
  })

  afterEach(() => {
    try {
      repository.close()
    } finally {
      rmSync(directoryPath, { recursive: true, force: true })
    }
  })

  it('returns the screen question and stored options after two answers', () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    repository.insert(opened)
    expect(repository.summarize().participating).toBe(EMPTY_COUNT)
    repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    const saved = repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: SECOND_QUESTION,
      optionNumber: FOURTH_OPTION,
    })
    const found = repository.findById(opened.id)
    const results = repository.summarize()
    expect(saved.currentQuestion).toBe(THIRD_QUESTION)
    expect(saved.answers).toEqual([
      { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FIRST_OPTION },
      { questionNumber: SECOND_QUESTION, optionNumber: FOURTH_OPTION },
    ])
    expect(found).toEqual(saved)
    expect(results.participating).toBe(ONE_VOTE)
    expect(results.finished).toBe(EMPTY_COUNT)
  })

  it('replaces an option and moves the summary count', () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    repository.insert(opened)
    repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    const replaced = repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const results = repository.summarize()
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
    expect(repository.findById(opened.id)).toEqual(replaced)
  })

  it('resumes the stored screen from the same file', () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    repository.insert(opened)
    const saved = repository.saveAnswer({
      sessionId: opened.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    repository.close()
    repository = new SqliteSessionRepository(databasePath)
    expect(repository.findById(opened.id)).toEqual(saved)
  })

  it('completes on the last question and keeps the file unchanged when refused', () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    repository.insert(opened)
    answerEveryQuestion(repository, opened.id, FIRST_OPTION)
    const completed = repository.findById(opened.id)
    const before = repository.summarize()
    expect(completed?.status).toBe(COMPLETED_SESSION_STATUS)
    expect(completed?.currentQuestion).toBe(QUESTION_COUNT)
    expect(before.participating).toBe(EMPTY_COUNT)
    expect(before.finished).toBe(ONE_VOTE)
    expect(before.questions.find((question) => question.questionNumber === QUESTION_COUNT)?.counts).toEqual(
      createCountsFor(FIRST_OPTION, ONE_VOTE),
    )
    expect(() =>
      repository.saveAnswer({
        sessionId: opened.id,
        questionNumber: QUESTION_COUNT,
        optionNumber: FOURTH_OPTION,
      }),
    ).toThrow(CompletedSessionError)
    expect(repository.findById(opened.id)).toEqual(completed)
    expect(repository.summarize()).toEqual(before)
    repository.close()
    repository = new SqliteSessionRepository(databasePath)
    expect(repository.findById(opened.id)).toEqual(completed)
    expect(repository.summarize()).toEqual(before)
  })

  it('clears participating, finished, and every option count', () => {
    const openSession = createOpenSession(randomUUID(), CREATED_AT)
    const finishedSession = createOpenSession(randomUUID(), CREATED_AT)
    repository.insert(openSession)
    repository.saveAnswer({
      sessionId: openSession.id,
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FIRST_OPTION,
    })
    repository.insert(finishedSession)
    answerEveryQuestion(repository, finishedSession.id, FOURTH_OPTION)
    expect(repository.summarize().participating).toBe(ONE_VOTE)
    expect(repository.summarize().finished).toBe(ONE_VOTE)
    repository.deleteAll()
    const results = repository.summarize()
    expect(repository.findById(openSession.id)).toBeNull()
    expect(repository.findById(finishedSession.id)).toBeNull()
    expect(results.participating).toBe(EMPTY_COUNT)
    expect(results.finished).toBe(EMPTY_COUNT)
    expect(results.questions.map((question) => question.questionNumber)).toEqual(
      surveyCatalog.map((question) => question.number),
    )
    for (const question of results.questions) {
      expect(question.counts).toEqual(createZeroCounts())
    }
  })

  it('keeps the database in a temporary file with write-ahead logging', () => {
    expect(databasePath.startsWith(tmpdir())).toBe(true)
    expect(databasePath.startsWith(PROJECT_ROOT)).toBe(false)
    repository.close()
    expect(readJournalMode(databasePath)).toBe(WAL_JOURNAL_MODE)
  })

  it('opens the database named by DATABASE_PATH', () => {
    const previous = process.env.DATABASE_PATH
    const environmentDatabasePath = join(directoryPath, 'env.sqlite')
    process.env.DATABASE_PATH = environmentDatabasePath
    const opened = openSqliteSessionRepository()
    try {
      const session = createOpenSession(randomUUID(), CREATED_AT)
      opened.insert(session)
      expect(opened.findById(session.id)).toEqual(session)
      expect(environmentDatabasePath.startsWith(directoryPath)).toBe(true)
    } finally {
      opened.close()
      restoreDatabasePath(previous)
    }
  })

  it('stores answers that arrive with the inserted session', () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    const saved = recordAnswer(opened, {
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    repository.insert(saved)
    expect(repository.findById(saved.id)).toEqual(saved)
    expect(repository.summarize().participating).toBe(ONE_VOTE)
  })

  it('refuses to open when DATABASE_PATH is missing', () => {
    const previous = process.env.DATABASE_PATH
    try {
      delete process.env.DATABASE_PATH
      expect(() => openSqliteSessionRepository()).toThrow(MissingDatabasePathError)
      process.env.DATABASE_PATH = ''
      expect(() => openSqliteSessionRepository()).toThrow(MissingDatabasePathError)
    } finally {
      restoreDatabasePath(previous)
    }
  })

  it('refuses a missing session and a duplicated insert', () => {
    const opened = createOpenSession(randomUUID(), CREATED_AT)
    repository.insert(opened)
    expect(() =>
      repository.saveAnswer({
        sessionId: randomUUID(),
        questionNumber: FIRST_QUESTION_NUMBER,
        optionNumber: FIRST_OPTION,
      }),
    ).toThrow(SessionNotFoundError)
    expect(() => repository.insert(opened)).toThrow(DuplicateSessionError)
    expect(repository.findById(opened.id)).toEqual(opened)
    expect(repository.summarize().participating).toBe(EMPTY_COUNT)
  })
})
