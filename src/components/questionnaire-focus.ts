import type { QuestionnairePhase } from '@/components/questionnaire-flow'

type Focusable = {
  focus: () => void
}

export type FocusTarget = {
  phase: QuestionnairePhase
  statement: Focusable | null
  heading: Focusable | null
}

export function focusQuestionnaireRegion(target: FocusTarget): void {
  if (target.phase === 'thanks' || target.phase === 'registered') {
    target.heading?.focus()
    return
  }
  if (target.phase !== 'question') {
    return
  }
  target.statement?.focus()
}
