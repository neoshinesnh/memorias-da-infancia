import type { ChangeEvent, FormEvent } from 'react'
import {
  ADDRESS_LABEL,
  CANCEL_RESET_LABEL,
  CONFIRM_RESET_LABEL,
  COUNT_COLUMN,
  EMPTY_RESULTS_MESSAGE,
  ENTER_LABEL,
  LIVE_LABEL,
  OFFLINE_MESSAGE,
  OPTION_COLUMN,
  PANEL_TITLE,
  PASSWORD_LABEL,
  PAUSE_ROTATION_LABEL,
  PERCENT_COLUMN,
  QUESTION_CONTROL_LABEL,
  RESET_LABEL,
  RESET_PROMPT,
  RESUME_ROTATION_LABEL,
} from '@/components/panel-copy'
import type { PanelBoardState } from '@/components/panel-board-store'
import type { PanelRotation } from '@/components/panel-rotation'
import { buildPanelChart, type BarRow, type QuestionChart } from '@/components/panel-view'
import { isQuestionNumber } from '@/domain/session'
import { surveyCatalog, type QuestionNumber } from '@/domain/survey-catalog'

export type PanelActions = {
  chooseQuestion: (questionNumber: QuestionNumber) => void
  pause: () => void
  resume: () => void
  askReset: () => void
  cancelReset: () => void
  confirmReset: () => void
}

type PanelLockProps = {
  message: string | null
  onSubmit: (password: string) => void
}

type PanelScreenProps = {
  state: PanelBoardState
  address: string
  codeMarkup: string
  actions: PanelActions
}

export function PanelLock(props: PanelLockProps) {
  return (
    <main className="panel-page">
      <form className="panel-lock" onSubmit={(event) => submitLock(event, props.onSubmit)}>
        <h1>{PANEL_TITLE}</h1>
        <label className="panel-field" htmlFor="panel-password">
          {PASSWORD_LABEL}
          <input id="panel-password" name="password" type="password" autoComplete="current-password" required />
        </label>
        <LockMessage message={props.message} />
        <button className="primary-button" type="submit">
          {ENTER_LABEL}
        </button>
      </form>
    </main>
  )
}

export function PanelScreen(props: PanelScreenProps) {
  const chart = buildPanelChart(props.state.snapshot, props.state.rotation.questionNumber)
  return (
    <main className="panel-page">
      <h1 className="visually-hidden">{PANEL_TITLE}</h1>
      <PanelShare address={props.address} codeMarkup={props.codeMarkup} />
      <p className="panel-counts" role="status" aria-atomic="true">
        {chart.participation}
      </p>
      <ConnectionMark state={props.state} />
      <QuestionChartView chart={chart} state={props.state} />
      <PanelControls state={props.state} actions={props.actions} />
    </main>
  )
}

function LockMessage(props: { message: string | null }) {
  if (props.message === null) {
    return null
  }
  return (
    <p className="panel-error" role="alert">
      {props.message}
    </p>
  )
}

function submitLock(event: FormEvent<HTMLFormElement>, onSubmit: (password: string) => void): void {
  event.preventDefault()
  const password = new FormData(event.currentTarget).get('password')
  if (typeof password !== 'string') {
    return
  }
  onSubmit(password)
}

function PanelShare(props: { address: string; codeMarkup: string }) {
  return (
    <div className="panel-share">
      <div className="panel-code" aria-hidden="true" dangerouslySetInnerHTML={{ __html: props.codeMarkup }} />
      <p className="panel-address">
        <span className="panel-address-label">{ADDRESS_LABEL}</span>
        {props.address}
      </p>
    </div>
  )
}

function ConnectionMark(props: { state: PanelBoardState }) {
  if (props.state.disconnected) {
    return null
  }
  return (
    <p className="panel-live">
      <span className="panel-live-dot" aria-hidden="true" />
      {LIVE_LABEL}
    </p>
  )
}

function QuestionChartView(props: { chart: QuestionChart; state: PanelBoardState }) {
  return (
    <section className="panel-chart">
      <OfflineNotice state={props.state} />
      <h2>{props.chart.questionText}</h2>
      <EmptyNotice chart={props.chart} />
      <div className="panel-bars" aria-hidden="true">
        {props.chart.rows.map((row) => (
          <BarTrack key={row.position} row={row} />
        ))}
      </div>
      <ChartTable chart={props.chart} />
    </section>
  )
}

function OfflineNotice(props: { state: PanelBoardState }) {
  if (!props.state.disconnected) {
    return null
  }
  return (
    <p className="panel-offline" aria-live="polite">
      {OFFLINE_MESSAGE}
    </p>
  )
}

function EmptyNotice(props: { chart: QuestionChart }) {
  if (!props.chart.empty) {
    return null
  }
  return <p className="panel-empty">{EMPTY_RESULTS_MESSAGE}</p>
}

function BarTrack(props: { row: BarRow }) {
  return (
    <div className="panel-bar">
      <div className="panel-bar-heading">
        <span>{props.row.name}</span>
        <span>{`${props.row.count} (${props.row.percent}%)`}</span>
      </div>
      <div className="panel-bar-track">
        <div
          className="panel-bar-fill"
          data-position={props.row.position}
          style={{ width: `${props.row.width}%` }}
        />
      </div>
    </div>
  )
}

function ChartTable(props: { chart: QuestionChart }) {
  return (
    <table className="visually-hidden">
      <caption>{props.chart.questionText}</caption>
      <thead>
        <tr>
          <th scope="col">{OPTION_COLUMN}</th>
          <th scope="col">{COUNT_COLUMN}</th>
          <th scope="col">{PERCENT_COLUMN}</th>
        </tr>
      </thead>
      <tbody>
        {props.chart.rows.map((row) => (
          <tr key={row.position}>
            <th scope="row">{row.label}</th>
            <td>{row.count}</td>
            <td>{`${row.percent}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PanelControls(props: { state: PanelBoardState; actions: PanelActions }) {
  return (
    <div className="panel-tools">
      <QuestionSelect questionNumber={props.state.rotation.questionNumber} onChoose={props.actions.chooseQuestion} />
      <RotationButton rotation={props.state.rotation} actions={props.actions} />
      <ResetControls state={props.state} actions={props.actions} />
    </div>
  )
}

function QuestionSelect(props: { questionNumber: QuestionNumber; onChoose: (questionNumber: QuestionNumber) => void }) {
  return (
    <label className="panel-field" htmlFor="panel-question">
      {QUESTION_CONTROL_LABEL}
      <select
        id="panel-question"
        value={props.questionNumber}
        onChange={(event) => chooseFromSelect(event, props.onChoose)}
      >
        {surveyCatalog.map((question) => (
          <option key={question.number} value={question.number}>
            {`Pergunta ${question.number}`}
          </option>
        ))}
      </select>
    </label>
  )
}

function chooseFromSelect(
  event: ChangeEvent<HTMLSelectElement>,
  onChoose: (questionNumber: QuestionNumber) => void,
): void {
  const questionNumber = Number(event.target.value)
  if (!isQuestionNumber(questionNumber)) {
    return
  }
  onChoose(questionNumber)
}

function RotationButton(props: { rotation: PanelRotation; actions: PanelActions }) {
  if (props.rotation.running) {
    return (
      <button type="button" className="secondary-button" onClick={props.actions.pause}>
        {PAUSE_ROTATION_LABEL}
      </button>
    )
  }
  return (
    <button type="button" className="secondary-button" onClick={props.actions.resume}>
      {RESUME_ROTATION_LABEL}
    </button>
  )
}

function ResetControls(props: { state: PanelBoardState; actions: PanelActions }) {
  if (props.state.confirmingReset) {
    return (
      <div className="panel-confirm">
        <p>{RESET_PROMPT}</p>
        <button type="button" className="primary-button" onClick={props.actions.confirmReset}>
          {CONFIRM_RESET_LABEL}
        </button>
        <button type="button" className="secondary-button" onClick={props.actions.cancelReset}>
          {CANCEL_RESET_LABEL}
        </button>
      </div>
    )
  }
  return (
    <button type="button" className="secondary-button" onClick={props.actions.askReset}>
      {RESET_LABEL}
    </button>
  )
}
