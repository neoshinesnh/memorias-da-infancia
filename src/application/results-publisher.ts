import type { ResultsSnapshot } from '@/domain/results'

export type ResultsListener = (snapshot: ResultsSnapshot) => void

export type ResultsPublisher = {
  publish(snapshot: ResultsSnapshot): void
  subscribe(listener: ResultsListener): () => void
}
