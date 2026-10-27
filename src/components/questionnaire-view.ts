import {
  canReturnToPrevious,
  readSavedOption,
  sessionAllowsVoting,
  type QuestionnaireFlow,
} from '@/components/questionnaire-flow'
import { FIRST_QUESTION_NUMBER, type SessionAnswer } from '@/domain/session'
import {
  QUESTION_COUNT,
  surveyCatalog,
  type OptionPosition,
  type QuestionNumber,
  type SurveyOption,
  type SurveyQuestion,
} from '@/domain/survey-catalog'

const SINGULAR_COUNT = 1

const OPTION_LETTERS: Record<OptionPosition, string> = {
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
  5: 'E',
}

export type StickerAppearance = 'empty' | 'current' | 'filled'

export type StickerSlot = {
  questionNumber: QuestionNumber
  appearance: StickerAppearance
  optionNumber: OptionPosition | null
}

export type StickerInput = {
  displayedQuestion: QuestionNumber
  answers: readonly SessionAnswer[]
}

export type AnswerChoice = {
  position: OptionPosition
  letter: string
  text: string
  selected: boolean
}

export type QuestionScreen = {
  progress: string
  questionText: string
  questionNumber: QuestionNumber
  choices: readonly AnswerChoice[]
  stickers: readonly StickerSlot[]
  answeredCount: number
  canReturn: boolean
  arrivedQuestion: QuestionNumber | null
}

export function formatQuestionProgress(questionNumber: QuestionNumber): string {
  return `Pergunta ${questionNumber} de ${QUESTION_COUNT}`
}

export function formatAnsweredProgress(answeredCount: number): string {
  if (answeredCount === SINGULAR_COUNT) {
    return `${SINGULAR_COUNT} de ${QUESTION_COUNT} respondida`
  }
  return `${answeredCount} de ${QUESTION_COUNT} respondidas`
}

export function readOptionLetter(position: OptionPosition): string {
  return OPTION_LETTERS[position]
}

export function buildStickerSlots(input: StickerInput): readonly StickerSlot[] {
  return surveyCatalog.map((question) => buildStickerSlot(question.number, input))
}

export function buildQuestionScreen(flow: QuestionnaireFlow): QuestionScreen | null {
  if (!sessionAllowsVoting(flow) || flow.payload === null) {
    return null
  }
  const question = readSurveyQuestion(flow.displayedQuestion)
  const savedOption = readSavedOption(flow.payload.answers, flow.displayedQuestion)
  return {
    progress: formatQuestionProgress(flow.displayedQuestion),
    questionText: question.text,
    questionNumber: flow.displayedQuestion,
    choices: buildAnswerChoices(question, savedOption),
    stickers: buildStickerSlots({
      displayedQuestion: flow.displayedQuestion,
      answers: flow.payload.answers,
    }),
    answeredCount: flow.payload.answers.length,
    canReturn: canReturnToPrevious(flow),
    arrivedQuestion: flow.arrivedQuestion,
  }
}

export function buildFinalStickers(flow: QuestionnaireFlow): readonly StickerSlot[] {
  if (flow.payload === null) {
    return buildStickerSlots({
      displayedQuestion: FIRST_QUESTION_NUMBER,
      answers: [],
    })
  }
  return buildStickerSlots({
    displayedQuestion: flow.payload.currentQuestion,
    answers: flow.payload.answers,
  })
}

export function countFilledStickers(slots: readonly StickerSlot[]): number {
  return slots.filter((slot) => slot.appearance === 'filled').length
}

function buildStickerSlot(questionNumber: QuestionNumber, input: StickerInput): StickerSlot {
  const optionNumber = readSavedOption(input.answers, questionNumber)
  if (optionNumber !== null) {
    return { questionNumber, appearance: 'filled', optionNumber }
  }
  if (questionNumber === input.displayedQuestion) {
    return { questionNumber, appearance: 'current', optionNumber: null }
  }
  return { questionNumber, appearance: 'empty', optionNumber: null }
}

function buildAnswerChoices(
  question: SurveyQuestion,
  savedOption: OptionPosition | null,
): readonly AnswerChoice[] {
  return question.options.map((option) => createAnswerChoice(option, savedOption))
}

function createAnswerChoice(option: SurveyOption, savedOption: OptionPosition | null): AnswerChoice {
  return {
    position: option.position,
    letter: readOptionLetter(option.position),
    text: option.text,
    selected: option.position === savedOption,
  }
}

function readSurveyQuestion(questionNumber: QuestionNumber): SurveyQuestion {
  const question = surveyCatalog.find((item) => item.number === questionNumber)
  if (question === undefined) {
    throw new Error('Question is outside the catalog')
  }
  return question
}
