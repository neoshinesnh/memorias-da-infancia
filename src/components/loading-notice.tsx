import { LOADING_LABEL } from '@/components/questionnaire-copy'

export function LoadingNotice() {
  return (
    <main className="survey-page">
      <p className="loading-status" aria-live="polite">
        {LOADING_LABEL}
      </p>
    </main>
  )
}
