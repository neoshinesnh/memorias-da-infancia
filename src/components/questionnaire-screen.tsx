import type { Ref } from 'react'
import { FinalScreen } from '@/components/final-screen'
import { LoadingNotice } from '@/components/loading-notice'
import { QuestionCard } from '@/components/question-card'
import { REGISTERED_MESSAGE, RETURN_LABEL, THANKS_MESSAGE } from '@/components/questionnaire-copy'
import type { QuestionnaireFlow } from '@/components/questionnaire-flow'
import { buildQuestionScreen } from '@/components/questionnaire-view'
import { SaveErrorNotice } from '@/components/save-error-notice'
import { StickerAlbum } from '@/components/sticker-album'
import type { OptionPosition } from '@/domain/survey-catalog'

type ScreenProperties = {
  flow: QuestionnaireFlow
  onChoose: (optionNumber: OptionPosition) => void
  onRetry: () => void
  onReturn: () => void
  statementRef?: Ref<HTMLLegendElement>
  headingRef?: Ref<HTMLHeadingElement>
}

type ReturnProperties = {
  onReturn: () => void
}

export function QuestionnaireScreen(props: ScreenProperties) {
  if (props.flow.phase === 'thanks') {
    return <FinalScreen message={THANKS_MESSAGE} flow={props.flow} headingRef={props.headingRef} />
  }
  if (props.flow.phase === 'registered') {
    return <FinalScreen message={REGISTERED_MESSAGE} flow={props.flow} headingRef={props.headingRef} />
  }
  return <OpenScreen {...props} />
}

function OpenScreen(props: ScreenProperties) {
  const screen = buildQuestionScreen(props.flow)
  if (screen === null) {
    return <LoadingNotice />
  }
  return (
    <main className="survey-page">
      <StickerAlbum
        slots={screen.stickers}
        answeredCount={screen.answeredCount}
        arrivedQuestion={screen.arrivedQuestion}
        placement="start"
      />
      <QuestionCard
        screen={screen}
        phase={props.flow.phase}
        onChoose={props.onChoose}
        statementRef={props.statementRef}
      />
      {props.flow.phase === 'save-error' ? <SaveErrorNotice onRetry={props.onRetry} /> : null}
      {screen.canReturn ? <ReturnButton onReturn={props.onReturn} /> : null}
    </main>
  )
}

function ReturnButton(props: ReturnProperties) {
  return (
    <button type="button" className="secondary-button" onClick={props.onReturn}>
      {RETURN_LABEL}
    </button>
  )
}
