import { EventEmitter } from 'node:events'
import type { ResultsListener, ResultsPublisher } from '@/application/results-publisher'
import type { ResultsSnapshot } from '@/domain/results'

const RESULTS_EVENT = 'results'
const UNLIMITED_LISTENERS = 0

export class InProcessResultsPublisher implements ResultsPublisher {
  private readonly emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(UNLIMITED_LISTENERS)
  }

  publish(snapshot: ResultsSnapshot): void {
    this.emitter.emit(RESULTS_EVENT, snapshot)
  }

  subscribe(listener: ResultsListener): () => void {
    const wrapped = (snapshot: ResultsSnapshot) => {
      notifyListener(listener, snapshot)
    }
    this.emitter.on(RESULTS_EVENT, wrapped)
    return () => {
      this.emitter.off(RESULTS_EVENT, wrapped)
    }
  }
}

function notifyListener(listener: ResultsListener, snapshot: ResultsSnapshot): void {
  try {
    listener(snapshot)
  } catch {
    return undefined
  }
}

let currentPublisher: InProcessResultsPublisher | null = null

export function readResultsPublisher(): ResultsPublisher {
  if (currentPublisher === null) {
    currentPublisher = new InProcessResultsPublisher()
  }
  return currentPublisher
}
