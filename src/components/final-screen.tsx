import type { Ref } from 'react'
import { StickerAlbum } from '@/components/sticker-album'
import type { QuestionnaireFlow } from '@/components/questionnaire-flow'
import { buildFinalStickers, countFilledStickers } from '@/components/questionnaire-view'

type FinalScreenProperties = {
  message: string
  flow: QuestionnaireFlow
  headingRef?: Ref<HTMLHeadingElement>
}

export function FinalScreen(props: FinalScreenProperties) {
  const slots = buildFinalStickers(props.flow)
  return (
    <main className="survey-page">
      <div className="final-screen">
        <h1 className="final-title" tabIndex={-1} ref={props.headingRef}>
          {props.message}
        </h1>
        <StickerAlbum
          slots={slots}
          answeredCount={countFilledStickers(slots)}
          arrivedQuestion={props.flow.arrivedQuestion}
          placement="center"
        />
      </div>
    </main>
  )
}
