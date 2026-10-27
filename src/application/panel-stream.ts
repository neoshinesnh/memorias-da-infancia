import type { ResultsSnapshot } from '@/domain/results'

const HEARTBEAT_INTERVAL_SECONDS = 15
const MILLISECONDS_PER_SECOND = 1000
const RESULTS_EVENT_NAME = 'resultados'
const EVENT_FIELD = 'event'
const DATA_FIELD = 'data'
const HEARTBEAT_COMMENT = 'pulse'
const FRAME_SUFFIX = '\n\n'

export const PANEL_HEARTBEAT_MILLISECONDS = HEARTBEAT_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND

export function formatResultsEvent(snapshot: ResultsSnapshot): string {
  const payload = JSON.stringify(snapshot)
  return `${EVENT_FIELD}: ${RESULTS_EVENT_NAME}\n${DATA_FIELD}: ${payload}${FRAME_SUFFIX}`
}

export function formatHeartbeatComment(): string {
  return `: ${HEARTBEAT_COMMENT}${FRAME_SUFFIX}`
}
