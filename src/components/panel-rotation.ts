import { FIRST_QUESTION_NUMBER, isQuestionNumber } from '@/domain/session'
import { QUESTION_COUNT, type QuestionNumber } from '@/domain/survey-catalog'

const ROTATION_SECONDS = 12
const MILLISECONDS_PER_SECOND = 1000
const QUESTION_STEP = 1
const NO_STEPS = 0

export const PANEL_ROTATION_MS = ROTATION_SECONDS * MILLISECONDS_PER_SECOND

export type PanelRotation = {
  questionNumber: QuestionNumber
  running: boolean
  nextAdvanceAt: number | null
}

export function startRotation(now: number): PanelRotation {
  return {
    questionNumber: FIRST_QUESTION_NUMBER,
    running: true,
    nextAdvanceAt: now + PANEL_ROTATION_MS,
  }
}

export function advanceRotation(rotation: PanelRotation, now: number): PanelRotation {
  const steps = readDueSteps(rotation, now)
  if (steps === NO_STEPS) {
    return rotation
  }
  const nextAdvanceAt = rotation.nextAdvanceAt
  if (nextAdvanceAt === null) {
    return rotation
  }
  return {
    questionNumber: shiftQuestion(rotation.questionNumber, steps),
    running: true,
    nextAdvanceAt: nextAdvanceAt + steps * PANEL_ROTATION_MS,
  }
}

export function chooseQuestion(questionNumber: QuestionNumber): PanelRotation {
  return {
    questionNumber,
    running: false,
    nextAdvanceAt: null,
  }
}

export function pauseRotation(rotation: PanelRotation): PanelRotation {
  return chooseQuestion(rotation.questionNumber)
}

export function resumeRotation(rotation: PanelRotation, now: number): PanelRotation {
  return {
    questionNumber: rotation.questionNumber,
    running: true,
    nextAdvanceAt: now + PANEL_ROTATION_MS,
  }
}

function readDueSteps(rotation: PanelRotation, now: number): number {
  if (!rotation.running) {
    return NO_STEPS
  }
  if (rotation.nextAdvanceAt === null) {
    return NO_STEPS
  }
  if (now < rotation.nextAdvanceAt) {
    return NO_STEPS
  }
  return Math.floor((now - rotation.nextAdvanceAt) / PANEL_ROTATION_MS) + QUESTION_STEP
}

function shiftQuestion(questionNumber: QuestionNumber, steps: number): QuestionNumber {
  const offset = questionNumber - FIRST_QUESTION_NUMBER
  const next = ((offset + steps) % QUESTION_COUNT) + FIRST_QUESTION_NUMBER
  if (!isQuestionNumber(next)) {
    return FIRST_QUESTION_NUMBER
  }
  return next
}
