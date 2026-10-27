import type { Ref } from 'react'
import { AnswerOption } from '@/components/answer-option'
import type { QuestionnairePhase } from '@/components/questionnaire-flow'
import type { QuestionScreen } from '@/components/questionnaire-view'
import type { OptionPosition } from '@/domain/survey-catalog'

type QuestionCardProperties = {
  screen: QuestionScreen
  phase: QuestionnairePhase
  onChoose: (optionNumber: OptionPosition) => void
  statementRef?: Ref<HTMLLegendElement>
}

export function QuestionCard(props: QuestionCardProperties) {
  const interaction = props.phase === 'saving' ? 'busy' : 'ready'
  return (
    <article className="question-card">
      <p className="question-progress" aria-live="polite">
        {props.screen.progress}
      </p>
      <fieldset className="question-fields" disabled={interaction === 'busy'}>
        <legend className="question-statement" tabIndex={-1} ref={props.statementRef}>
          {props.screen.questionText}
        </legend>
        <div className="answer-list">
          {props.screen.choices.map((choice) => (
            <AnswerOption
              key={choice.position}
              choice={choice}
              questionNumber={props.screen.questionNumber}
              interaction={interaction}
              onChoose={props.onChoose}
            />
          ))}
        </div>
      </fieldset>
    </article>
  )
}
