import type { ResultsSnapshot } from '@/domain/results'
import { summarizeResults } from '@/domain/results'
import {
  recordAnswer,
  type Session,
  type SessionAnswer,
} from '@/domain/session'
import {
  DuplicateSessionError,
  SessionNotFoundError,
  type SaveAnswer,
  type SessionRepository,
} from '@/application/session-repository'

const EMPTY_COUNT = 0
const EQUAL_ORDER = 0

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>()

  async findById(id: string): Promise<Session | null> {
    return this.readSession(id)
  }

  async insert(session: Session): Promise<void> {
    if (this.sessions.has(session.id)) {
      throw new DuplicateSessionError()
    }
    this.sessions.set(session.id, copySession(session))
  }

  async saveAnswer(input: SaveAnswer): Promise<Session> {
    const existing = this.sessions.get(input.sessionId)
    if (existing === undefined) {
      throw new SessionNotFoundError()
    }
    const saved = recordAnswer(existing, {
      questionNumber: input.questionNumber,
      optionNumber: input.optionNumber,
    })
    this.sessions.set(saved.id, saved)
    return copySession(saved)
  }

  async summarize(): Promise<ResultsSnapshot> {
    return summarizeResults([...this.sessions.values()])
  }

  async deleteAll(): Promise<void> {
    this.sessions.clear()
  }

  countSessions(): number {
    return this.sessions.size
  }

  countAnswers(): number {
    let total = EMPTY_COUNT
    for (const session of this.sessions.values()) {
      total += session.answers.length
    }
    return total
  }

  readSessionIds(): string[] {
    return [...this.sessions.values()]
      .sort(compareSessions)
      .map((session) => session.id)
  }

  storedText(): string {
    return JSON.stringify([...this.sessions.values()])
  }

  private readSession(id: string): Session | null {
    const session = this.sessions.get(id)
    if (session === undefined) {
      return null
    }
    return copySession(session)
  }
}

function compareSessions(left: Session, right: Session): number {
  const byTime = left.createdAt.localeCompare(right.createdAt)
  if (byTime !== EQUAL_ORDER) {
    return byTime
  }
  return left.id.localeCompare(right.id)
}

function copySession(session: Session): Session {
  return {
    id: session.id,
    status: session.status,
    currentQuestion: session.currentQuestion,
    furthestQuestion: session.furthestQuestion,
    answers: session.answers.map(copyAnswer),
    createdAt: session.createdAt,
  }
}

function copyAnswer(answer: SessionAnswer): SessionAnswer {
  return {
    questionNumber: answer.questionNumber,
    optionNumber: answer.optionNumber,
  }
}
