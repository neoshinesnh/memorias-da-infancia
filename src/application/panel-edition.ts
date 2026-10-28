import type { ResultsPublisher } from '@/application/results-publisher'
import type { SessionRepository } from '@/application/session-repository'
import type { ResultsSnapshot } from '@/domain/results'

export async function resetEdition(
  repository: SessionRepository,
  publisher: ResultsPublisher,
): Promise<ResultsSnapshot> {
  await repository.deleteAll()
  const snapshot = await repository.summarize()
  publisher.publish(snapshot)
  return snapshot
}
