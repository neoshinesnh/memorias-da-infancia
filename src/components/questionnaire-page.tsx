'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuestionnaireScreen } from '@/components/questionnaire-screen'
import { focusQuestionnaireRegion } from '@/components/questionnaire-focus'
import type { QuestionnaireFlow } from '@/components/questionnaire-flow'
import {
  createQuestionnaireStore,
  SESSION_REFRESH_MILLISECONDS,
  type QuestionnaireStore,
} from '@/components/questionnaire-store'
import { createBrowserSessionTransport } from '@/components/session-transport'
import type { OptionPosition } from '@/domain/survey-catalog'

type QuestionnaireController = {
  flow: QuestionnaireFlow
  choose: (optionNumber: OptionPosition) => void
  retry: () => void
  goBack: () => void
}

export function QuestionnairePage() {
  const controller = useQuestionnaireController()
  const statementRef = useRef<HTMLLegendElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    focusQuestionnaireRegion({
      phase: controller.flow.phase,
      statement: statementRef.current,
      heading: headingRef.current,
    })
  }, [controller.flow.displayedQuestion, controller.flow.phase])
  return (
    <QuestionnaireScreen
      flow={controller.flow}
      onChoose={controller.choose}
      onRetry={controller.retry}
      onReturn={controller.goBack}
      statementRef={statementRef}
      headingRef={headingRef}
    />
  )
}

function useQuestionnaireController(): QuestionnaireController {
  const transport = useMemo(createBrowserSessionTransport, [])
  const store = useMemo(() => createQuestionnaireStore(transport), [transport])
  const [flow, setFlow] = useState(() => store.readFlow())
  const publish = useCallback(() => {
    setFlow(store.readFlow())
  }, [store])
  useEffect(() => {
    void store.start().then(publish, publish)
    const timer = setInterval(() => {
      void store.refresh().then(publish, publish)
    }, SESSION_REFRESH_MILLISECONDS)
    return () => {
      clearInterval(timer)
    }
  }, [publish, store])
  return {
    flow,
    choose: useStoreChoice(store, publish),
    retry: useStoreRetry(store, publish),
    goBack: useStoreReturn(store, publish),
  }
}

function useStoreChoice(store: QuestionnaireStore, publish: () => void): (optionNumber: OptionPosition) => void {
  return useCallback((optionNumber: OptionPosition) => {
    void store.choose(optionNumber).then(publish, publish)
  }, [publish, store])
}

function useStoreRetry(store: QuestionnaireStore, publish: () => void): () => void {
  return useCallback(() => {
    void store.retry().then(publish, publish)
  }, [publish, store])
}

function useStoreReturn(store: QuestionnaireStore, publish: () => void): () => void {
  return useCallback(() => {
    store.goBack()
    publish()
  }, [publish, store])
}
