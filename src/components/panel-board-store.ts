import type { PanelLiveMode } from '@/components/panel-live'
import {
  advanceRotation,
  chooseQuestion,
  pauseRotation,
  resumeRotation,
  startRotation,
  type PanelRotation,
} from '@/components/panel-rotation'
import type { ResultsSnapshot } from '@/domain/results'
import type { QuestionNumber } from '@/domain/survey-catalog'

export type PanelBoardTransport = {
  resetEdition: () => Promise<ResultsSnapshot | null>
}

export type PanelBoardState = {
  snapshot: ResultsSnapshot
  rotation: PanelRotation
  disconnected: boolean
  confirmingReset: boolean
}

export type PanelBoardInput = {
  now: number
  snapshot: ResultsSnapshot
}

export type PanelBoardStore = {
  readState: () => PanelBoardState
  receiveSnapshot: (snapshot: ResultsSnapshot) => void
  chooseQuestion: (questionNumber: QuestionNumber) => void
  pause: () => void
  resume: (now: number) => void
  tick: (now: number) => void
  askReset: () => void
  cancelReset: () => void
  confirmReset: () => Promise<void>
  applyMode: (mode: PanelLiveMode) => void
}

type BoardMemory = {
  state: PanelBoardState
  resetting: boolean
}

export function createPanelBoardStore(transport: PanelBoardTransport, input: PanelBoardInput): PanelBoardStore {
  const memory = createMemory(input)
  return {
    readState: () => memory.state,
    receiveSnapshot: (snapshot) => {
      memory.state = replaceSnapshot(memory.state, snapshot)
    },
    chooseQuestion: (questionNumber) => {
      memory.state = showChosenQuestion(memory.state, questionNumber)
    },
    pause: () => {
      memory.state = holdRotation(memory.state)
    },
    resume: (now) => {
      memory.state = continueRotation(memory.state, now)
    },
    tick: (now) => {
      memory.state = moveRotation(memory.state, now)
    },
    askReset: () => {
      memory.state = requestReset(memory.state)
    },
    cancelReset: () => {
      memory.state = dismissReset(memory.state)
    },
    confirmReset: () => confirmStoredReset(memory, transport),
    applyMode: (mode) => {
      memory.state = applyConnection(memory.state, mode)
    },
  }
}

function createMemory(input: PanelBoardInput): BoardMemory {
  return {
    state: {
      snapshot: input.snapshot,
      rotation: startRotation(input.now),
      disconnected: false,
      confirmingReset: false,
    },
    resetting: false,
  }
}

function replaceSnapshot(state: PanelBoardState, snapshot: ResultsSnapshot): PanelBoardState {
  return {
    ...state,
    snapshot,
  }
}

function showChosenQuestion(state: PanelBoardState, questionNumber: QuestionNumber): PanelBoardState {
  return {
    ...state,
    rotation: chooseQuestion(questionNumber),
  }
}

function holdRotation(state: PanelBoardState): PanelBoardState {
  return {
    ...state,
    rotation: pauseRotation(state.rotation),
  }
}

function continueRotation(state: PanelBoardState, now: number): PanelBoardState {
  return {
    ...state,
    rotation: resumeRotation(state.rotation, now),
  }
}

function moveRotation(state: PanelBoardState, now: number): PanelBoardState {
  const rotation = advanceRotation(state.rotation, now)
  if (rotation === state.rotation) {
    return state
  }
  return {
    ...state,
    rotation,
  }
}

function requestReset(state: PanelBoardState): PanelBoardState {
  return {
    ...state,
    confirmingReset: true,
  }
}

function dismissReset(state: PanelBoardState): PanelBoardState {
  return {
    ...state,
    confirmingReset: false,
  }
}

function applyConnection(state: PanelBoardState, mode: PanelLiveMode): PanelBoardState {
  return {
    ...state,
    disconnected: mode === 'fallback',
  }
}

function finishReset(state: PanelBoardState, snapshot: ResultsSnapshot): PanelBoardState {
  return {
    ...state,
    snapshot,
    confirmingReset: false,
  }
}

async function confirmStoredReset(memory: BoardMemory, transport: PanelBoardTransport): Promise<void> {
  if (!memory.state.confirmingReset) {
    return
  }
  if (memory.resetting) {
    return
  }
  memory.resetting = true
  const snapshot = await readResetSnapshot(transport)
  memory.resetting = false
  if (snapshot === null) {
    return
  }
  memory.state = finishReset(memory.state, snapshot)
}

async function readResetSnapshot(transport: PanelBoardTransport): Promise<ResultsSnapshot | null> {
  try {
    return await transport.resetEdition()
  } catch {
    return null
  }
}
