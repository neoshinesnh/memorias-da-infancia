import type { ResultsPublisher } from '@/application/results-publisher'
import type { SaveAnswer, SessionRepository } from '@/application/session-repository'
import type { ResultsSnapshot } from '@/domain/results'
import { createOpenSession, type Session } from '@/domain/session'

export type OpenSessionInput = {
  id: string
  createdAt: string
}

export async function openSession(repository: SessionRepository, input: OpenSessionInput): Promise<Session> {
  const session = createOpenSession(input.id, input.createdAt)
  await repository.insert(session)
  return session
}

export function resumeSession(repository: SessionRepository, id: string): Promise<Session | null> {
  return repository.findById(id)
}

export async function saveSessionAnswer(
  repository: SessionRepository,
  publisher: ResultsPublisher,
  input: SaveAnswer,
): Promise<Session> {
  const session = await repository.saveAnswer(input)
  publisher.publish(await repository.summarize())
  return session
}

export function readResults(repository: SessionRepository): Promise<ResultsSnapshot> {
  return repository.summarize()
}
