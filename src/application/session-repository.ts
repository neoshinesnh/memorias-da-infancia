import type { ResultsSnapshot } from '@/domain/results'
import type { Session } from '@/domain/session'
import type { OptionPosition, QuestionNumber } from '@/domain/survey-catalog'

export type SaveAnswer = {
  sessionId: string
  questionNumber: QuestionNumber
  optionNumber: OptionPosition
}

export type SessionRepository = {
  findById(id: string): Promise<Session | null>
  insert(session: Session): Promise<void>
  saveAnswer(input: SaveAnswer): Promise<Session>
  summarize(): Promise<ResultsSnapshot>
  deleteAll(): Promise<void>
}

export class SessionNotFoundError extends Error {
  constructor() {
    super('Session was not found')
    this.name = 'SessionNotFoundError'
  }
}

export class DuplicateSessionError extends Error {
  constructor() {
    super('Session already exists')
    this.name = 'DuplicateSessionError'
  }
}
