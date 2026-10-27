import { FIRST_OPTION_POSITION } from '@/domain/session'
import type { ResultsSnapshot } from '@/domain/results'
import {
  OPTION_COUNT,
  surveyCatalog,
  type OptionPosition,
  type QuestionNumber,
  type SurveyOption,
  type SurveyQuestion,
} from '@/domain/survey-catalog'

const EMPTY_TOTAL = 0
const PERCENT_SCALE = 100

export type BarRow = {
  position: OptionPosition
  name: string
  count: number
  percent: number
  width: number
  label: string
}

export type QuestionChart = {
  questionNumber: QuestionNumber
  questionText: string
  rows: readonly BarRow[]
  empty: boolean
  participation: string
}

export function formatBarLabel(name: string, count: number, percent: number): string {
  return `${name}: ${count} (${percent}%)`
}

export function readOptionPercent(count: number, total: number): number {
  if (total === EMPTY_TOTAL) {
    return EMPTY_TOTAL
  }
  return Math.round((count * PERCENT_SCALE) / total)
}

export function readBarWidth(count: number, total: number): number {
  if (total === EMPTY_TOTAL) {
    return EMPTY_TOTAL
  }
  return (count * PERCENT_SCALE) / total
}

export function formatParticipation(participating: number, finished: number): string {
  return `${participating} participando / ${finished} finalizaram`
}

export function buildPanelChart(snapshot: ResultsSnapshot, questionNumber: QuestionNumber): QuestionChart {
  const question = readQuestion(questionNumber)
  const counts = readCounts(snapshot, questionNumber)
  const total = sumCounts(counts)
  return {
    questionNumber,
    questionText: question.text,
    rows: question.options.map((option) => buildBarRow(option, counts, total)),
    empty: total === EMPTY_TOTAL,
    participation: formatParticipation(snapshot.participating, snapshot.finished),
  }
}

function readQuestion(questionNumber: QuestionNumber): SurveyQuestion {
  const question = surveyCatalog.find((item) => item.number === questionNumber)
  if (question === undefined) {
    throw new Error('Question is outside the catalog')
  }
  return question
}

function readCounts(snapshot: ResultsSnapshot, questionNumber: QuestionNumber): readonly number[] {
  const question = snapshot.questions.find((item) => item.questionNumber === questionNumber)
  if (question === undefined) {
    return createEmptyCounts()
  }
  return question.counts
}

function createEmptyCounts(): readonly number[] {
  return Array.from({ length: OPTION_COUNT }, () => EMPTY_TOTAL)
}

function sumCounts(counts: readonly number[]): number {
  return counts.reduce((total, count) => total + count, EMPTY_TOTAL)
}

function buildBarRow(option: SurveyOption, counts: readonly number[], total: number): BarRow {
  const count = readCount(counts, option.position)
  const percent = readOptionPercent(count, total)
  return {
    position: option.position,
    name: option.text,
    count,
    percent,
    width: readBarWidth(count, total),
    label: formatBarLabel(option.text, count, percent),
  }
}

function readCount(counts: readonly number[], position: OptionPosition): number {
  const count = counts[position - FIRST_OPTION_POSITION]
  if (count === undefined) {
    return EMPTY_TOTAL
  }
  return count
}
