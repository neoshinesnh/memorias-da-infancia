import type { MouseEvent } from 'react'
import type { AnswerChoice } from '@/components/questionnaire-view'
import type { OptionPosition, QuestionNumber } from '@/domain/survey-catalog'

type AnswerInteraction = 'ready' | 'busy'

type AnswerOptionProperties = {
  choice: AnswerChoice
  questionNumber: QuestionNumber
  interaction: AnswerInteraction
  onChoose: (optionNumber: OptionPosition) => void
}

export function AnswerOption(props: AnswerOptionProperties) {
  return (
    <label className={readOptionClassName(props.choice)} data-position={props.choice.position}>
      <input
        type="radio"
        name={`answer-${props.questionNumber}`}
        value={props.choice.position}
        checked={props.choice.selected}
        disabled={props.interaction === 'busy'}
        onChange={() => props.onChoose(props.choice.position)}
        onClick={(event) => chooseSavedOption(event, props)}
      />
      <span className="answer-mark" data-position={props.choice.position}>
        {props.choice.letter}
      </span>
      <span className="answer-text">{props.choice.text}</span>
      {props.choice.selected ? <AnswerCheck /> : null}
    </label>
  )
}

function chooseSavedOption(event: MouseEvent<HTMLInputElement>, props: AnswerOptionProperties): void {
  if (!event.currentTarget.checked || !props.choice.selected) {
    return
  }
  if (props.interaction === 'busy') {
    return
  }
  props.onChoose(props.choice.position)
}

function readOptionClassName(choice: AnswerChoice): string {
  if (choice.selected) {
    return 'answer-option answer-option--selected'
  }
  return 'answer-option'
}

function AnswerCheck() {
  return (
    <svg className="answer-check" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="3" d="M5 12.5 10 17.5 19 7.5" />
    </svg>
  )
}
