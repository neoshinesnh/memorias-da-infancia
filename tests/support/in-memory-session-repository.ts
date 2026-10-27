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

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>()

  findById(id: string): Session | null {
    const session = this.sessions.get(id)
    if (session === undefined) {
      return null
    }
    return copySession(session)
  }

  insert(session: Session): void {
    if (this.sessions.has(session.id)) {
      throw new DuplicateSessionError()
    }
    this.sessions.set(session.id, copySession(session))
  }

  saveAnswer(input: SaveAnswer): Session {
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

  summarize(): ResultsSnapshot {
    return summarizeResults([...this.sessions.values()])
  }

  deleteAll(): void {
    this.sessions.clear()
  }
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
