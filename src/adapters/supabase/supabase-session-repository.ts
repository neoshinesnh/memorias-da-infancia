import { createSupabaseClient } from '@/adapters/supabase/supabase-config'
import {
  createSupabaseSessionStore,
  type SessionStore,
} from '@/adapters/supabase/supabase-session-store'
import type { SessionWrite } from '@/adapters/supabase/stored-session'
import { InvalidSessionRowError } from '@/adapters/supabase/session-row'
import { SessionNotFoundError, type SaveAnswer, type SessionRepository } from '@/application/session-repository'
import { summarizeResults, type ResultsSnapshot } from '@/domain/results'
import { recordAnswer, type Session, type SessionAnswer } from '@/domain/session'
import type { QuestionNumber } from '@/domain/survey-catalog'

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly store: SessionStore) {}

  findById(id: string): Promise<Session | null> {
    return this.store.findSession(id)
  }

  async insert(session: Session): Promise<void> {
    await this.store.insertSession(session)
    await this.writeSessionAnswers(session, session.createdAt)
  }

  async saveAnswer(input: SaveAnswer): Promise<Session> {
    const saved = await this.reviseSession(input)
    const answer = readRevisedAnswer(saved, input.questionNumber)
    await this.store.writeAnswer(createWrite(saved, answer, createTimestamp()))
    return saved
  }

  async summarize(): Promise<ResultsSnapshot> {
    return summarizeResults(await this.store.listSessions())
  }

  deleteAll(): Promise<void> {
    return this.store.deleteSessions()
  }

  private async reviseSession(input: SaveAnswer): Promise<Session> {
    const existing = await this.store.findSession(input.sessionId)
    if (existing === null) {
      throw new SessionNotFoundError()
    }
    return recordAnswer(existing, {
      questionNumber: input.questionNumber,
      optionNumber: input.optionNumber,
    })
  }

  private async writeSessionAnswers(session: Session, updatedAt: string): Promise<void> {
    for (const answer of session.answers) {
      await this.store.writeAnswer(createWrite(session, answer, updatedAt))
    }
  }
}

export function openSupabaseSessionRepository(): SupabaseSessionRepository {
  return new SupabaseSessionRepository(createSupabaseSessionStore(createSupabaseClient()))
}

function createWrite(session: Session, answer: SessionAnswer, updatedAt: string): SessionWrite {
  return { session, answer, updatedAt }
}

function readRevisedAnswer(session: Session, questionNumber: QuestionNumber): SessionAnswer {
  const answer = session.answers.find((item) => item.questionNumber === questionNumber)
  if (answer === undefined) {
    throw new InvalidSessionRowError()
  }
  return answer
}

function createTimestamp(): string {
  return new Date().toISOString()
}
