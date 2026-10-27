import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { toString as renderCode } from 'qrcode'
import { describe, expect, it } from 'vitest'
import {
  ADDRESS_CODE_CORRECTION,
  createAddressMarkup,
  readQuestionnaireAddress,
} from '@/application/panel-code'
import {
  EMPTY_RESULTS_MESSAGE,
  OFFLINE_MESSAGE,
  PASSWORD_REJECTED,
} from '@/components/panel-copy'
import {
  advanceRotation,
  chooseQuestion,
  PANEL_ROTATION_MS,
  pauseRotation,
  resumeRotation,
  startRotation,
} from '@/components/panel-rotation'
import { PanelLock, PanelScreen, type PanelActions } from '@/components/panel-screen'
import type { PanelBoardState } from '@/components/panel-board-store'
import {
  buildPanelChart,
  formatBarLabel,
  readOptionPercent,
} from '@/components/panel-view'
import type { ResultsSnapshot } from '@/domain/results'
import { FIRST_QUESTION_NUMBER } from '@/domain/session'
import { OPTION_COUNT, QUESTION_COUNT, surveyCatalog, type QuestionNumber } from '@/domain/survey-catalog'

const ROTATION_SECONDS = 12
const MILLISECONDS_PER_SECOND = 1000
const START = 0
const PIP_COUNT = 12
const DOLL_COUNT = 18
const QUESTION_TOTAL = 30
const PIP_PERCENT = 40
const EMPTY_COUNT = 0
const PARTICIPATING = 3
const FINISHED = 1
const FOURTH_QUESTION: QuestionNumber = 4
const PUBLIC_ADDRESS = 'https://evento.test/'
const INTERNAL_HOST = 'http://127.0.0.1:3000/'
const STYLESHEET_PATH = resolve(process.cwd(), 'src/app/globals.css')
const BOARD_PATH = resolve(process.cwd(), 'src/components/panel-board.tsx')
const LOW_CORRECTION = 'L' as const

const idleActions: PanelActions = {
  chooseQuestion: () => undefined,
  pause: () => undefined,
  resume: () => undefined,
  askReset: () => undefined,
  cancelReset: () => undefined,
  confirmReset: () => undefined,
}

function createCounts(): number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_COUNT)
}

function createSnapshot(participating: number, finished: number, firstCounts: readonly number[]): ResultsSnapshot {
  return {
    participating,
    finished,
    questions: surveyCatalog.map((question) => ({
      questionNumber: question.number,
      counts: question.number === FIRST_QUESTION_NUMBER ? [...firstCounts] : createCounts(),
    })),
  }
}

function createState(snapshot: ResultsSnapshot, disconnected: boolean): PanelBoardState {
  return {
    snapshot,
    rotation: startRotation(START),
    disconnected,
    confirmingReset: false,
  }
}

function renderLock(): string {
  return renderToStaticMarkup(
    createElement(PanelLock, {
      message: PASSWORD_REJECTED,
      onSubmit: () => undefined,
    }),
  )
}

function renderScreen(state: PanelBoardState): string {
  return renderToStaticMarkup(
    createElement(PanelScreen, {
      state,
      address: PUBLIC_ADDRESS,
      codeMarkup: '<svg viewBox="0 0 1 1"></svg>',
      actions: idleActions,
    }),
  )
}

function readPaths(markup: string): string {
  const paths: string[] = []
  for (const match of markup.matchAll(/d="([^"]+)"/g)) {
    const path = match[1]
    if (path !== undefined) {
      paths.push(path)
    }
  }
  return paths.join('|')
}

describe('bar labels', () => {
  it('formats the option, the count and the percent of that question', () => {
    const counts = createCounts()
    counts[3] = PIP_COUNT
    counts[4] = DOLL_COUNT
    const chart = buildPanelChart(createSnapshot(PARTICIPATING, FINISHED, counts), FIRST_QUESTION_NUMBER)
    const pipa = chart.rows[3]
    expect(formatBarLabel('Pipa', PIP_COUNT, PIP_PERCENT)).toBe('Pipa: 12 (40%)')
    expect(readOptionPercent(PIP_COUNT, QUESTION_TOTAL)).toBe(PIP_PERCENT)
    expect(readOptionPercent(EMPTY_COUNT, EMPTY_COUNT)).toBe(EMPTY_COUNT)
    expect(pipa?.label).toBe('Pipa: 12 (40%)')
    expect(pipa?.width).toBe(PIP_PERCENT)
  })

  it('keeps five zero bars when nobody answered the question', () => {
    const snapshot = createSnapshot(EMPTY_COUNT, EMPTY_COUNT, createCounts())
    const chart = buildPanelChart(snapshot, FIRST_QUESTION_NUMBER)
    const markup = renderScreen(createState(snapshot, false))
    expect(chart.empty).toBe(true)
    expect(chart.rows).toHaveLength(OPTION_COUNT)
    expect(chart.rows.every((row) => row.count === EMPTY_COUNT && row.percent === EMPTY_COUNT)).toBe(true)
    expect(chart.rows[3]?.label).toBe('Pipa: 0 (0%)')
    expect(markup).toContain(EMPTY_RESULTS_MESSAGE)
    expect(markup).toContain('Pipa: 0 (0%)')
    expect(markup.split('panel-bar-fill').length - 1).toBe(OPTION_COUNT)
  })
})

describe('panel rotation', () => {
  it('advances every 12 seconds and returns to the first question', () => {
    const started = startRotation(START)
    const early = advanceRotation(started, PANEL_ROTATION_MS - 1)
    const second = advanceRotation(started, PANEL_ROTATION_MS)
    const last = advanceRotation(started, PANEL_ROTATION_MS * (QUESTION_COUNT - 1))
    const wrapped = advanceRotation(started, PANEL_ROTATION_MS * QUESTION_COUNT)
    expect(PANEL_ROTATION_MS).toBe(ROTATION_SECONDS * MILLISECONDS_PER_SECOND)
    expect(started.questionNumber).toBe(FIRST_QUESTION_NUMBER)
    expect(started.running).toBe(true)
    expect(early.questionNumber).toBe(FIRST_QUESTION_NUMBER)
    expect(second.questionNumber).toBe(2)
    expect(last.questionNumber).toBe(QUESTION_COUNT)
    expect(wrapped.questionNumber).toBe(FIRST_QUESTION_NUMBER)
  })

  it('pauses on a manual choice until the operator resumes', () => {
    const started = startRotation(START)
    const held = pauseRotation(started)
    const chosen = chooseQuestion(FOURTH_QUESTION)
    const stayed = advanceRotation(chosen, PANEL_ROTATION_MS * QUESTION_COUNT)
    const resumed = resumeRotation(chosen, PANEL_ROTATION_MS)
    const continued = advanceRotation(resumed, PANEL_ROTATION_MS + PANEL_ROTATION_MS)
    expect(held.running).toBe(false)
    expect(held.questionNumber).toBe(FIRST_QUESTION_NUMBER)
    expect(chosen.running).toBe(false)
    expect(stayed.questionNumber).toBe(FOURTH_QUESTION)
    expect(resumed.running).toBe(true)
    expect(resumed.questionNumber).toBe(FOURTH_QUESTION)
    expect(continued.questionNumber).toBe(5)
  })
})

describe('password screen', () => {
  it('hides totals, bars, the code and the address', () => {
    const markup = renderLock()
    expect(markup).toContain('Senha')
    expect(markup).toContain(PASSWORD_REJECTED)
    expect(markup).toContain('type="password"')
    expect(markup).not.toContain('participando')
    expect(markup).not.toContain('finalizaram')
    expect(markup).not.toContain('%')
    expect(markup).not.toContain('<svg')
    expect(markup).not.toContain('https://')
    expect(markup).not.toContain('panel-bar')
    expect(markup).not.toContain('panel-chart')
  })
})

describe('connection notice', () => {
  it('keeps the last counts in a polite status region', () => {
    const snapshot = createSnapshot(PARTICIPATING, FINISHED, createCounts())
    const markup = renderScreen(createState(snapshot, true))
    expect(markup).toContain(OFFLINE_MESSAGE)
    expect(markup).toContain('3 participando / 1 finalizaram')
    expect(markup).toContain('Pião: 0 (0%)')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-atomic="true"')
    expect(markup).not.toContain('tabindex')
    expect(markup).not.toContain('Ao vivo')
  })
})

describe('address code', () => {
  it('draws the public address as svg at correction level M', async () => {
    const address = readQuestionnaireAddress('https://evento.test')
    const markup = await createAddressMarkup(address)
    const medium = await renderCode(address, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
    const low = await renderCode(address, { type: 'svg', errorCorrectionLevel: LOW_CORRECTION, margin: 1 })
    expect(address).toBe(PUBLIC_ADDRESS)
    expect(address).not.toBe(INTERNAL_HOST)
    expect(ADDRESS_CODE_CORRECTION).toBe('M')
    expect(markup.startsWith('<svg')).toBe(true)
    expect(readPaths(markup)).toBe(readPaths(medium))
    expect(readPaths(markup)).not.toBe(readPaths(low))
    expect(markup).toContain('var(--cor-tinta)')
    expect(markup).toContain('var(--cor-papel-claro)')
    expect(markup).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
  })
})

describe('panel chart styles', () => {
  it('paints each position and stops the bar transition when motion is reduced', () => {
    const stylesheet = readFileSync(STYLESHEET_PATH, 'utf8')
    const board = readFileSync(BOARD_PATH, 'utf8')
    expect(stylesheet).toContain('width: min(960px, 100%)')
    expect(stylesheet).toContain('.panel-chart')
    expect(stylesheet).toContain('background-image: none')
    expect(stylesheet).toContain('transition: width 300ms')
    expect(stylesheet).toContain(".panel-bar-fill[data-position='1']")
    expect(stylesheet).toContain(".panel-bar-fill[data-position='2']")
    expect(stylesheet).toContain('repeating-linear-gradient')
    expect(stylesheet).toContain('radial-gradient')
    expect(stylesheet).toContain(".panel-bar-fill[data-position='5']")
    expect(stylesheet).toContain('.panel-bar-fill {\n    transition: none;')
    const reduced = stylesheet.slice(stylesheet.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toContain('.panel-bar-fill')
    expect(reduced).toContain('transition: none')
    expect(board).toContain('PANEL_ROTATION_MS')
    expect(board).not.toContain('location')
  })
})
