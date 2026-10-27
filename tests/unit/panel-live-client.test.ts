import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PANEL_FALLBACK_MILLISECONDS,
  createPanelLiveClient,
  readResultsEventData,
  type OpenPanelStream,
  type PanelStreamHandlers,
} from '@/components/panel-live'
import type { ResultsSnapshot } from '@/domain/results'
import { OPTION_COUNT, surveyCatalog } from '@/domain/survey-catalog'

const FALLBACK_INTERVAL_SECONDS = 3
const MILLISECONDS_PER_SECOND = 1000
const EMPTY_COUNT = 0
const ONE_PARTICIPANT = 1
const START = 0
const PAGE_PATH = resolve(process.cwd(), 'src/app/page.tsx')
const QUESTIONNAIRE_PATH = resolve(process.cwd(), 'src/components/questionnaire-page.tsx')
const LIVE_CLIENT_PATH = resolve(process.cwd(), 'src/components/panel-live.tsx')
const EVENT_ROUTE_PATH = resolve(process.cwd(), 'src/app/api/painel/eventos/route.ts')
const EVENT_ADAPTER_PATH = resolve(process.cwd(), 'src/adapters/http/panel-events.ts')

type FakeStream = {
  handlers: PanelStreamHandlers | null
  opened: number
  closed: number
  open: OpenPanelStream
}

type PollSource = {
  calls: number
  read: () => Promise<ResultsSnapshot | null>
}

function createPortrait(participating: number): ResultsSnapshot {
  return {
    participating,
    finished: EMPTY_COUNT,
    questions: surveyCatalog.map((question) => ({
      questionNumber: question.number,
      counts: Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT),
    })),
  }
}

function createFakeStream(): FakeStream {
  const stream: FakeStream = {
    handlers: null,
    opened: 0,
    closed: 0,
    open: (handlers) => {
      stream.opened += 1
      stream.handlers = handlers
      return {
        close() {
          stream.closed += 1
          stream.handlers = null
        },
      }
    },
  }
  return stream
}

function createPollLog(snapshot: ResultsSnapshot | null, failures = EMPTY_COUNT): PollSource {
  const source: PollSource = {
    calls: EMPTY_COUNT,
    read: async () => {
      source.calls += 1
      if (source.calls <= failures) {
        throw new Error('snapshot offline')
      }
      return snapshot
    },
  }
  return source
}

describe('panel live client', () => {
  it('keeps the reserve interval at 3 seconds', () => {
    expect(PANEL_FALLBACK_MILLISECONDS).toBe(FALLBACK_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND)
  })

  it('stays on the stream and does not poll while the connection is open', async () => {
    const stream = createFakeStream()
    const polls = createPollLog(createPortrait(ONE_PARTICIPANT))
    const seen: ResultsSnapshot[] = []
    const client = createPanelLiveClient({
      openStream: stream.open,
      readSnapshot: polls.read,
      onSnapshot: (snapshot) => {
        seen.push(snapshot)
      },
    })
    const portrait = createPortrait(ONE_PARTICIPANT)
    client.start(START)
    await client.advance(PANEL_FALLBACK_MILLISECONDS)
    await client.advance(PANEL_FALLBACK_MILLISECONDS * 2)
    expect(client.readMode()).toBe('stream')
    expect(polls.calls).toBe(EMPTY_COUNT)
    expect(stream.opened).toBe(1)
    stream.handlers?.onSnapshot(portrait)
    expect(client.readMode()).toBe('stream')
    expect(client.readSnapshot()).toEqual(portrait)
    expect(seen).toEqual([portrait])
    client.start(PANEL_FALLBACK_MILLISECONDS)
    expect(stream.opened).toBe(1)
    client.stop()
    expect(stream.closed).toBe(1)
    await client.advance(PANEL_FALLBACK_MILLISECONDS * 4)
    expect(polls.calls).toBe(EMPTY_COUNT)
  })

  it('polls every 3 seconds after the stream fails until the stream returns', async () => {
    const stream = createFakeStream()
    const portrait = createPortrait(ONE_PARTICIPANT)
    const polls = createPollLog(portrait)
    const seen: ResultsSnapshot[] = []
    const client = createPanelLiveClient({
      openStream: stream.open,
      readSnapshot: polls.read,
      onSnapshot: (snapshot) => {
        seen.push(snapshot)
      },
    })
    const justBefore = PANEL_FALLBACK_MILLISECONDS - 1
    client.start(START)
    await client.advance(PANEL_FALLBACK_MILLISECONDS)
    expect(polls.calls).toBe(EMPTY_COUNT)
    stream.handlers?.onFailure()
    stream.handlers?.onFailure()
    expect(client.readMode()).toBe('fallback')
    await client.advance(PANEL_FALLBACK_MILLISECONDS)
    expect(polls.calls).toBe(1)
    expect(seen).toEqual([portrait])
    await client.advance(PANEL_FALLBACK_MILLISECONDS + justBefore)
    stream.handlers?.onFailure()
    expect(polls.calls).toBe(1)
    await client.advance(PANEL_FALLBACK_MILLISECONDS * 2)
    expect(polls.calls).toBe(2)
    stream.handlers?.onSnapshot(portrait)
    expect(client.readMode()).toBe('stream')
    await client.advance(PANEL_FALLBACK_MILLISECONDS * 5)
    expect(polls.calls).toBe(2)
    client.stop()
    expect(stream.closed).toBe(1)
  })

  it('polls every 3 seconds when the stream cannot be opened', async () => {
    const portrait = createPortrait(EMPTY_COUNT)
    const polls = createPollLog(portrait)
    const client = createPanelLiveClient({
      openStream: null,
      readSnapshot: polls.read,
      onSnapshot: () => undefined,
    })
    const justBefore = PANEL_FALLBACK_MILLISECONDS - 1
    client.start(START)
    expect(client.readMode()).toBe('fallback')
    await client.advance(START)
    expect(polls.calls).toBe(1)
    expect(client.readSnapshot()).toEqual(portrait)
    await client.advance(justBefore)
    expect(polls.calls).toBe(1)
    await client.advance(PANEL_FALLBACK_MILLISECONDS)
    expect(polls.calls).toBe(2)
    await client.advance(PANEL_FALLBACK_MILLISECONDS * 2 - 1)
    expect(polls.calls).toBe(2)
    await client.advance(PANEL_FALLBACK_MILLISECONDS * 2)
    expect(polls.calls).toBe(3)
  })

  it('stays on the reserve interval when a poll fails', async () => {
    const polls = createPollLog(createPortrait(ONE_PARTICIPANT), 1)
    const client = createPanelLiveClient({
      openStream: null,
      readSnapshot: polls.read,
      onSnapshot: () => undefined,
    })
    client.start(START)
    await expect(client.advance(START)).resolves.toBeUndefined()
    expect(client.readMode()).toBe('fallback')
    expect(client.readSnapshot()).toBeNull()
    await client.advance(PANEL_FALLBACK_MILLISECONDS - 1)
    expect(polls.calls).toBe(1)
    await client.advance(PANEL_FALLBACK_MILLISECONDS)
    expect(polls.calls).toBe(2)
    expect(client.readSnapshot()).toEqual(createPortrait(ONE_PARTICIPANT))
  })

  it('reads a full results payload and rejects a malformed one', () => {
    const portrait = createPortrait(ONE_PARTICIPANT)
    expect(readResultsEventData(JSON.stringify(portrait))).toEqual(portrait)
    expect(readResultsEventData('not-json')).toBeNull()
    expect(readResultsEventData({ participating: ONE_PARTICIPANT })).toBeNull()
    expect(readResultsEventData(JSON.stringify({ participating: ONE_PARTICIPANT, finished: EMPTY_COUNT }))).toBeNull()
  })

  it('does not open a panel stream from the questionnaire', () => {
    const page = readFileSync(PAGE_PATH, 'utf8')
    const questionnaire = readFileSync(QUESTIONNAIRE_PATH, 'utf8')
    const client = readFileSync(LIVE_CLIENT_PATH, 'utf8')
    const route = readFileSync(EVENT_ROUTE_PATH, 'utf8')
    const adapter = readFileSync(EVENT_ADAPTER_PATH, 'utf8')
    expect(page).not.toContain('EventSource')
    expect(page).not.toContain('WebSocket')
    expect(page).not.toContain('panel-live')
    expect(questionnaire).not.toContain('EventSource')
    expect(questionnaire).not.toContain('WebSocket')
    expect(questionnaire).not.toContain('/api/painel/eventos')
    expect(client).toContain('EventSource')
    expect(client).toContain("'/api/painel/resultados'")
    expect(client).toContain('PANEL_FALLBACK_MILLISECONDS')
    expect(client).not.toContain('WebSocket')
    expect(route).not.toMatch(/\d/)
    expect(adapter).toContain('PANEL_HEARTBEAT_MILLISECONDS')
    expect(adapter).not.toMatch(/\b15\b/)
    expect(adapter).not.toContain('WebSocket')
  })
})
