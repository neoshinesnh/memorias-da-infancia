'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPanelBoardStore, type PanelBoardState, type PanelBoardStore } from '@/components/panel-board-store'
import { PanelLive, type PanelLiveMode } from '@/components/panel-live'
import { PANEL_ROTATION_MS } from '@/components/panel-rotation'
import { PanelScreen, type PanelActions } from '@/components/panel-screen'
import { createBrowserPanelTransport } from '@/components/panel-transport'
import type { ResultsSnapshot } from '@/domain/results'
import type { QuestionNumber } from '@/domain/survey-catalog'

type PanelBoardProps = {
  address: string
  codeMarkup: string
  initialSnapshot: ResultsSnapshot
}

export function PanelBoard(props: PanelBoardProps) {
  const store = usePanelStore(props.initialSnapshot)
  const [state, publish] = usePublishedState(store)
  const onSnapshot = useSnapshotHandler(store, publish)
  const onMode = useModeHandler(store, publish)
  const actions = usePanelActions(store, publish)
  useRotationClock(store, publish)
  return (
    <>
      <PanelLive onSnapshot={onSnapshot} onMode={onMode} />
      <PanelScreen state={state} address={props.address} codeMarkup={props.codeMarkup} actions={actions} />
    </>
  )
}

function usePanelStore(snapshot: ResultsSnapshot): PanelBoardStore {
  const storeRef = useRef<PanelBoardStore | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createPanelBoardStore(createBrowserPanelTransport(), {
      now: Date.now(),
      snapshot,
    })
  }
  return storeRef.current
}

function usePublishedState(store: PanelBoardStore): [PanelBoardState, () => void] {
  const [state, setState] = useState(() => store.readState())
  const publish = useCallback(() => {
    setState(store.readState())
  }, [store])
  return [state, publish]
}

function useSnapshotHandler(
  store: PanelBoardStore,
  publish: () => void,
): (snapshot: ResultsSnapshot) => void {
  return useCallback((snapshot: ResultsSnapshot) => {
    store.receiveSnapshot(snapshot)
    publish()
  }, [publish, store])
}

function useModeHandler(store: PanelBoardStore, publish: () => void): (mode: PanelLiveMode) => void {
  return useCallback((mode: PanelLiveMode) => {
    store.applyMode(mode)
    publish()
  }, [publish, store])
}

function useRotationClock(store: PanelBoardStore, publish: () => void): void {
  useEffect(() => {
    const timer = setInterval(() => {
      store.tick(Date.now())
      publish()
    }, PANEL_ROTATION_MS)
    return () => {
      clearInterval(timer)
    }
  }, [publish, store])
}

function usePanelActions(store: PanelBoardStore, publish: () => void): PanelActions {
  const chooseQuestion = useCallback((questionNumber: QuestionNumber) => {
    store.chooseQuestion(questionNumber)
    publish()
  }, [publish, store])
  const pause = useCallback(() => {
    store.pause()
    publish()
  }, [publish, store])
  const resume = useCallback(() => {
    store.resume(Date.now())
    publish()
  }, [publish, store])
  const askReset = useCallback(() => {
    store.askReset()
    publish()
  }, [publish, store])
  const cancelReset = useCallback(() => {
    store.cancelReset()
    publish()
  }, [publish, store])
  const confirmReset = useCallback(() => {
    void store.confirmReset().then(publish, publish)
  }, [publish, store])
  return { chooseQuestion, pause, resume, askReset, cancelReset, confirmReset }
}
