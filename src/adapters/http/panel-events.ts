import { assertPanelRequest, createPanelErrorResponse } from '@/adapters/http/panel-access'
import { readResultsPublisher } from '@/adapters/realtime/in-process-publisher'
import { readSessionRepository } from '@/adapters/sqlite/session-repository-cache'
import { logStreamClientConnected, logStreamClientDisconnected } from '@/application/panel-log'
import {
  PANEL_HEARTBEAT_MILLISECONDS,
  formatHeartbeatComment,
  formatResultsEvent,
} from '@/application/panel-stream'
import { HTTP_OK } from '@/application/session-http'
import { readResults } from '@/application/session-use-cases'
import type { ResultsSnapshot } from '@/domain/results'

const CONTENT_TYPE_HEADER = 'content-type'
const CACHE_CONTROL_HEADER = 'cache-control'
const ACCEL_BUFFERING_HEADER = 'x-accel-buffering'
const EVENT_STREAM_TYPE = 'text/event-stream; charset=utf-8'
const NO_CACHE_DIRECTIVE = 'no-cache'
const NO_BUFFER_DIRECTIVE = 'no'

type ByteController = ReadableStreamDefaultController<Uint8Array>

type StreamWriter = {
  closed: boolean
  unsubscribe: () => void
  heartbeat: ReturnType<typeof setInterval> | null
}

type ChunkTarget = {
  controller: ByteController
  writer: StreamWriter
  encoder: TextEncoder
}

export function openPanelEvents(request: Request): Response {
  try {
    assertPanelRequest(request)
    readSessionRepository()
  } catch (error) {
    return createPanelErrorResponse(error)
  }
  logStreamClientConnected()
  return createEventResponse(request.signal)
}

function createEventResponse(signal: AbortSignal): Response {
  return new Response(createEventStream(signal), {
    status: HTTP_OK,
    headers: createEventHeaders(),
  })
}

function createEventHeaders(): Headers {
  const headers = new Headers()
  headers.set(CONTENT_TYPE_HEADER, EVENT_STREAM_TYPE)
  headers.set(CACHE_CONTROL_HEADER, NO_CACHE_DIRECTIVE)
  headers.set(ACCEL_BUFFERING_HEADER, NO_BUFFER_DIRECTIVE)
  return headers
}

function createEventStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  const writer = createStreamWriter()
  return new ReadableStream({
    start(controller) {
      startEventStream(controller, writer, signal)
    },
    cancel() {
      closeEventStream(writer)
    },
  })
}

function createStreamWriter(): StreamWriter {
  return {
    closed: false,
    unsubscribe: () => undefined,
    heartbeat: null,
  }
}

function startEventStream(
  controller: ByteController,
  writer: StreamWriter,
  signal: AbortSignal,
): void {
  const send = createChunkSender(controller, writer)
  writer.unsubscribe = readResultsPublisher().subscribe((snapshot) => {
    send(formatResultsEvent(snapshot))
  })
  if (!sendCurrentSnapshot(send, writer, controller)) {
    return
  }
  writer.heartbeat = startHeartbeat(send)
  watchAbort(signal, controller, writer)
}

function sendCurrentSnapshot(
  send: (chunk: string) => void,
  writer: StreamWriter,
  controller: ByteController,
): boolean {
  try {
    send(formatResultsEvent(readCurrentSnapshot()))
  } catch (error) {
    closeEventStream(writer)
    errorController(controller, error)
    return false
  }
  return !writer.closed
}

function readCurrentSnapshot(): ResultsSnapshot {
  return readResults(readSessionRepository())
}

function createChunkSender(
  controller: ByteController,
  writer: StreamWriter,
): (chunk: string) => void {
  const target = {
    controller,
    writer,
    encoder: new TextEncoder(),
  }
  return (chunk: string) => {
    enqueueChunk(target, chunk)
  }
}

function enqueueChunk(target: ChunkTarget, chunk: string): void {
  if (target.writer.closed) {
    return
  }
  try {
    target.controller.enqueue(target.encoder.encode(chunk))
  } catch {
    closeEventStream(target.writer)
  }
}

function startHeartbeat(send: (chunk: string) => void): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    send(formatHeartbeatComment())
  }, PANEL_HEARTBEAT_MILLISECONDS)
  unrefTimer(timer)
  return timer
}

function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  if (typeof timer === 'number') {
    return
  }
  timer.unref()
}

function watchAbort(
  signal: AbortSignal,
  controller: ByteController,
  writer: StreamWriter,
): void {
  if (signal.aborted) {
    closeEventStream(writer)
    closeController(controller)
    return
  }
  signal.addEventListener(
    'abort',
    () => {
      closeEventStream(writer)
      closeController(controller)
    },
    { once: true },
  )
}

function closeEventStream(writer: StreamWriter): void {
  if (writer.closed) {
    return
  }
  writer.closed = true
  writer.unsubscribe()
  clearHeartbeat(writer)
  logStreamClientDisconnected()
}

function clearHeartbeat(writer: StreamWriter): void {
  if (writer.heartbeat === null) {
    return
  }
  clearInterval(writer.heartbeat)
  writer.heartbeat = null
}

function closeController(controller: ByteController): void {
  try {
    controller.close()
  } catch {
    return undefined
  }
}

function errorController(controller: ByteController, error: unknown): void {
  try {
    controller.error(error)
  } catch {
    return undefined
  }
}
