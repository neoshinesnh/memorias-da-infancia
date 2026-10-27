import type { ResultsPublisher } from '@/application/results-publisher'
import type { SaveAnswer, SessionRepository } from '@/application/session-repository'
import type { ResultsSnapshot } from '@/domain/results'
import { createOpenSession, type Session } from '@/domain/session'

export type OpenSessionInput = {
  id: string
  createdAt: string
}

export function openSession(repository: SessionRepository, input: OpenSessionInput): Session {
  const session = createOpenSession(input.id, input.createdAt)
  repository.insert(session)
  return session
}

export function resumeSession(repository: SessionRepository, id: string): Session | null {
  return repository.findById(id)
}

export function saveSessionAnswer(
  repository: SessionRepository,
  publisher: ResultsPublisher,
  input: SaveAnswer,
): Session {
  const session = repository.saveAnswer(input)
  publisher.publish(repository.summarize())
  return session
}

export function readResults(repository: SessionRepository): ResultsSnapshot {
  return repository.summarize()
}
