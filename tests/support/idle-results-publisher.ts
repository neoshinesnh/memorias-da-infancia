import type { ResultsPublisher } from '@/application/results-publisher'

export const idleResultsPublisher: ResultsPublisher = {
  publish() {
    return undefined
  },
  subscribe() {
    return () => undefined
  },
}
