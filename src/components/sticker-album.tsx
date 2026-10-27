import { formatAnsweredProgress, type StickerSlot } from '@/components/questionnaire-view'
import { QUESTION_COUNT, type QuestionNumber } from '@/domain/survey-catalog'

const PROGRESS_MINIMUM = 0

type AlbumPlacement = 'start' | 'center'

type StickerAlbumProperties = {
  slots: readonly StickerSlot[]
  answeredCount: number
  arrivedQuestion: QuestionNumber | null
  placement: AlbumPlacement
}

type SlotViewProperties = {
  slot: StickerSlot
  arrivedQuestion: QuestionNumber | null
}

export function StickerAlbum(props: StickerAlbumProperties) {
  const progress = formatAnsweredProgress(props.answeredCount)
  const className = readAlbumClassName(props.placement)
  return (
    <div
      className={className}
      role="progressbar"
      aria-valuemin={PROGRESS_MINIMUM}
      aria-valuemax={QUESTION_COUNT}
      aria-valuenow={props.answeredCount}
    >
      <span className="visually-hidden">{progress}</span>
      {props.slots.map((slot) => (
        <StickerSlotView key={slot.questionNumber} slot={slot} arrivedQuestion={props.arrivedQuestion} />
      ))}
    </div>
  )
}

function StickerSlotView(props: SlotViewProperties) {
  return (
    <span className={readSlotClassName(props.slot, props.arrivedQuestion)} data-option={readOptionAttribute(props.slot)}>
      {props.slot.appearance === 'filled' ? <StickerStar /> : null}
    </span>
  )
}

function StickerStar() {
  return (
    <svg className="sticker-star" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.6 14.8 8.7 21.4 9.3 16.3 13.8 17.9 20.4 12 16.9 6.1 20.4 7.7 13.8 2.6 9.3 9.2 8.7Z"
      />
    </svg>
  )
}

function readAlbumClassName(placement: AlbumPlacement): string {
  if (placement === 'center') {
    return 'sticker-album sticker-album--centered'
  }
  return 'sticker-album'
}

function readSlotClassName(slot: StickerSlot, arrivedQuestion: QuestionNumber | null): string {
  const base = `sticker-slot sticker-slot--${slot.appearance}`
  if (slot.questionNumber !== arrivedQuestion) {
    return base
  }
  if (slot.appearance !== 'filled') {
    return base
  }
  return `${base} sticker-slot--arriving`
}

function readOptionAttribute(slot: StickerSlot): number | undefined {
  if (slot.optionNumber === null) {
    return undefined
  }
  return slot.optionNumber
}
