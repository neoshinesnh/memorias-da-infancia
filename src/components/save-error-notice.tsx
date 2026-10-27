import { RETRY_LABEL, SAVE_ERROR_MESSAGE } from '@/components/questionnaire-copy'

type SaveErrorProperties = {
  onRetry: () => void
}

export function SaveErrorNotice(props: SaveErrorProperties) {
  return (
    <div className="save-error" role="alert">
      <div className="save-error-heading">
        <ErrorIcon />
        <p className="save-error-message">{SAVE_ERROR_MESSAGE}</p>
      </div>
      <button type="button" className="primary-button" onClick={props.onRetry}>
        {RETRY_LABEL}
      </button>
    </div>
  )
}

function ErrorIcon() {
  return (
    <svg className="save-error-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="M11 7h2v7h-2zm0 9h2v2h-2z" />
    </svg>
  )
}
