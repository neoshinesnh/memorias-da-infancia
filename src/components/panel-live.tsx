'use client'

import { useEffect } from 'react'
import type { ResultsSnapshot, QuestionCounts } from '@/domain/results'
import { isQuestionNumber } from '@/domain/session'
import { OPTION_COUNT, QUESTION_COUNT } from '@/domain/survey-catalog'

const FALLBACK_INTERVAL_SECONDS = 3
const MILLISECONDS_PER_SECOND = 1000
const EVENTS_PATH = '/api/painel/eventos'
const RESULTS_PATH = '/api/painel/resultados'
const RESULTS_EVENT_NAME = 'resultados'
const GET_METHOD = 'GET'
const NO_STORE_CACHE = 'no-store' as const
const SAME_ORIGIN_CREDENTIALS = 'same-origin' as const

export const PANEL_FALLBACK_MILLISECONDS = FALLBACK_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND

export type PanelLiveMode = 'stream' | 'fallback'

export type PanelStreamHandlers = {
  onSnapshot: (snapshot: ResultsSnapshot) => void
  onFailure: () => void
}

export type PanelStreamHandle = {
  close: () => void
}

export type OpenPanelStream = (handlers: PanelStreamHandlers) => PanelStreamHandle

export type ReadPanelSnapshot = () => Promise<ResultsSnapshot | null>

export type PanelLiveDependencies = {
  openStream: OpenPanelStream | null
  readSnapshot: ReadPanelSnapshot
  onSnapshot: (snapshot: ResultsSnapshot) => void
  onMode?: (mode: PanelLiveMode) => void
}

export type PanelLiveClient = {
  readMode: () => PanelLiveMode
  readSnapshot: () => ResultsSnapshot | null
  start: (now: number) => void
  advance: (now: number) => Promise<void>
  stop: () => void
}

type PanelLiveProps = {
  onSnapshot: (snapshot: ResultsSnapshot) => void
  onMode?: (mode: PanelLiveMode) => void
}

type LiveMemory = {
  mode: PanelLiveMode
  snapshot: ResultsSnapshot | null
  handle: PanelStreamHandle | null
  nextPollAt: number | null
  running: boolean
  now: number
}

export function PanelLive({ onSnapshot, onMode }: PanelLiveProps): null {
  useEffect(() => {
    const client = createPanelLiveClient({
      openStream: readBrowserStreamOpener(),
      readSnapshot: readBrowserSnapshot,
      onSnapshot,
      onMode,
    })
    const startedAt = Date.now()
    client.start(startedAt)
    void client.advance(startedAt)
    const timer = setInterval(() => {
      void client.advance(Date.now())
    }, PANEL_FALLBACK_MILLISECONDS)
    return () => {
      clearInterval(timer)
      client.stop()
    }
  }, [onMode, onSnapshot])
  return null
}

export function createPanelLiveClient(dependencies: PanelLiveDependencies): PanelLiveClient {
  const memory = createMemory()
  return {
    readMode: () => memory.mode,
    readSnapshot: () => memory.snapshot,
    start: (now) => {
      startClient(memory, dependencies, now)
    },
    advance: (now) => advanceClient(memory, dependencies, now),
    stop: () => {
      stopClient(memory)
    },
  }
}

export function readResultsEventData(value: unknown): ResultsSnapshot | null {
  if (typeof value !== 'string') {
    return null
  }
  try {
    return acceptSnapshot(JSON.parse(value))
  } catch {
    return null
  }
}

function createMemory(): LiveMemory {
  return {
    mode: 'stream',
    snapshot: null,
    handle: null,
    nextPollAt: null,
    running: false,
    now: 0,
  }
}

function startClient(memory: LiveMemory, dependencies: PanelLiveDependencies, now: number): void {
  if (memory.running) {
    return
  }
  memory.running = true
  memory.now = now
  openLiveTransport(memory, dependencies)
}

function openLiveTransport(memory: LiveMemory, dependencies: PanelLiveDependencies): void {
  if (dependencies.openStream === null) {
    beginFallback(memory, dependencies)
    return
  }
  memory.mode = 'stream'
  memory.handle = dependencies.openStream({
    onSnapshot: (snapshot) => {
      acceptStreamSnapshot(memory, dependencies, snapshot)
    },
    onFailure: () => {
      beginFallback(memory, dependencies)
    },
  })
}

function beginFallback(memory: LiveMemory, dependencies: PanelLiveDependencies): void {
  if (!memory.running) {
    return
  }
  if (memory.mode === 'fallback') {
    return
  }
  memory.mode = 'fallback'
  memory.nextPollAt = memory.now
  reportMode(dependencies, 'fallback')
}

function reportMode(dependencies: PanelLiveDependencies, mode: PanelLiveMode): void {
  if (dependencies.onMode === undefined) {
    return
  }
  dependencies.onMode(mode)
}

function acceptStreamSnapshot(
  memory: LiveMemory,
  dependencies: PanelLiveDependencies,
  snapshot: ResultsSnapshot,
): void {
  if (!memory.running) {
    return
  }
  const recovered = memory.mode === 'fallback'
  memory.mode = 'stream'
  memory.nextPollAt = null
  memory.snapshot = snapshot
  dependencies.onSnapshot(snapshot)
  if (!recovered) {
    return
  }
  reportMode(dependencies, 'stream')
}

async function advanceClient(
  memory: LiveMemory,
  dependencies: PanelLiveDependencies,
  now: number,
): Promise<void> {
  memory.now = now
  if (!isPollDue(memory, now)) {
    return
  }
  memory.nextPollAt = now + PANEL_FALLBACK_MILLISECONDS
  await pollStoredSnapshot(memory, dependencies)
}

function isPollDue(memory: LiveMemory, now: number): boolean {
  if (!memory.running) {
    return false
  }
  if (memory.mode !== 'fallback') {
    return false
  }
  if (memory.nextPollAt === null) {
    return false
  }
  return now >= memory.nextPollAt
}

async function pollStoredSnapshot(memory: LiveMemory, dependencies: PanelLiveDependencies): Promise<void> {
  const snapshot = await readPolledSnapshot(dependencies)
  if (!memory.running) {
    return
  }
  if (memory.mode !== 'fallback') {
    return
  }
  if (snapshot === null) {
    return
  }
  memory.snapshot = snapshot
  dependencies.onSnapshot(snapshot)
}

async function readPolledSnapshot(dependencies: PanelLiveDependencies): Promise<ResultsSnapshot | null> {
  try {
    return await dependencies.readSnapshot()
  } catch {
    return null
  }
}

function stopClient(memory: LiveMemory): void {
  memory.running = false
  memory.nextPollAt = null
  closeOpenStream(memory)
}

function closeOpenStream(memory: LiveMemory): void {
  if (memory.handle === null) {
    return
  }
  const handle = memory.handle
  memory.handle = null
  handle.close()
}

function readBrowserStreamOpener(): OpenPanelStream | null {
  if (typeof EventSource === 'undefined') {
    return null
  }
  return openBrowserStream
}

function openBrowserStream(handlers: PanelStreamHandlers): PanelStreamHandle {
  const source = new EventSource(EVENTS_PATH, { withCredentials: true })
  const onResults = (event: Event) => {
    deliverBrowserEvent(handlers, event)
  }
  source.addEventListener(RESULTS_EVENT_NAME, onResults)
  source.onerror = () => {
    handlers.onFailure()
  }
  return {
    close() {
      source.removeEventListener(RESULTS_EVENT_NAME, onResults)
      source.close()
    },
  }
}

function deliverBrowserEvent(handlers: PanelStreamHandlers, event: Event): void {
  if (!isMessageEvent(event)) {
    return
  }
  const snapshot = readResultsEventData(event.data)
  if (snapshot === null) {
    return
  }
  handlers.onSnapshot(snapshot)
}

function isMessageEvent(event: Event): event is MessageEvent<string> {
  if (!('data' in event)) {
    return false
  }
  return typeof event.data === 'string'
}

async function readBrowserSnapshot(): Promise<ResultsSnapshot | null> {
  try {
    const response = await fetch(RESULTS_PATH, {
      method: GET_METHOD,
      cache: NO_STORE_CACHE,
      credentials: SAME_ORIGIN_CREDENTIALS,
    })
    return readSnapshotResponse(response)
  } catch {
    return null
  }
}

async function readSnapshotResponse(response: Response): Promise<ResultsSnapshot | null> {
  if (!response.ok) {
    return null
  }
  try {
    const body: unknown = await response.json()
    return acceptSnapshot(body)
  } catch {
    return null
  }
}

function acceptSnapshot(value: unknown): ResultsSnapshot | null {
  if (!isResultsSnapshot(value)) {
    return null
  }
  return value
}

function isResultsSnapshot(value: unknown): value is ResultsSnapshot {
  if (!isRecord(value)) {
    return false
  }
  if (typeof value.participating !== 'number') {
    return false
  }
  if (typeof value.finished !== 'number') {
    return false
  }
  if (!isQuestionCountList(value.questions)) {
    return false
  }
  return true
}

function isQuestionCountList(value: unknown): value is ResultsSnapshot['questions'] {
  if (!Array.isArray(value)) {
    return false
  }
  if (value.length !== QUESTION_COUNT) {
    return false
  }
  return value.every(isQuestionCount)
}

function isQuestionCount(value: unknown): value is QuestionCounts {
  if (!isRecord(value)) {
    return false
  }
  if (typeof value.questionNumber !== 'number') {
    return false
  }
  if (!isQuestionNumber(value.questionNumber)) {
    return false
  }
  if (!isCountList(value.counts)) {
    return false
  }
  return true
}

function isCountList(value: unknown): value is readonly number[] {
  if (!Array.isArray(value)) {
    return false
  }
  if (value.length !== OPTION_COUNT) {
    return false
  }
  return value.every((count) => typeof count === 'number')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object') {
    return false
  }
  if (value === null) {
    return false
  }
  return !Array.isArray(value)
}
