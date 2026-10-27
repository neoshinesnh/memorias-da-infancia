import type { ResultsPublisher } from '@/application/results-publisher'
import type { SessionRepository } from '@/application/session-repository'
import type { ResultsSnapshot } from '@/domain/results'

export function resetEdition(repository: SessionRepository, publisher: ResultsPublisher): ResultsSnapshot {
  repository.deleteAll()
  const snapshot = repository.summarize()
  publisher.publish(snapshot)
  return snapshot
}
