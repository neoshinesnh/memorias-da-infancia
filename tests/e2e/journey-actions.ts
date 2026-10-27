import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type QuestionNumber,
  type SurveyQuestion,
} from '../../src/domain/survey-catalog'
import { APPLICATION_ORIGIN, PANEL_PASSWORD } from './server-settings'

const CATALOG_START = 0
const FIRST_OPTION_INDEX = 0
const FIRST_ATTEMPT = 0
const NEXT_ATTEMPT = 1
const NEXT_QUESTION_STEP = 1
const QUESTION_HEADING_LEVEL = 2
const TAB_ATTEMPT_LIMIT = 8
const EMPTY_COUNT = 0
const SINGLE_MATCH = 1
const HOME_PATH = '/'
const PANEL_PATH = '/painel'
const ENTER_PATH = '/api/painel/entrar'
const RESET_PATH = '/api/painel/zerar'
const ORIGIN_HEADER = 'origin'
const CONTENT_TYPE_HEADER = 'content-type'
const JSON_MEDIA_TYPE = 'application/json'
const PASSWORD_FIELD = 'password'
const CONFIRM_FIELD = 'confirm'
const OPTION_SELECTOR = 'label.answer-option'
const BAR_SELECTOR = '.panel-bar'
const CODE_SELECTOR = '.panel-code svg'
const JOURNEY_MARKER = 'kept'
const TAB_KEY = 'Tab'

export const ENTER_KEY = 'Enter'
export const SPACE_KEY = 'Space'
export const PASSWORD_LABEL = 'Senha'
export const ENTER_ACTION = 'Entrar'
export const THANKS_TEXT = 'Obrigado pelas suas respostas!'
export const REGISTERED_TEXT = 'Sua participação já foi registrada.'
export const REJECTED_TEXT = 'A senha não confere.'
export const ZERO_COUNTERS = '0 participando / 0 finalizaram'
export const ONE_COUNTERS = '1 participando / 0 finalizaram'
export const RESET_WARNING = 'Zerar apaga as respostas desta edição.'
export const RESET_ACTION = 'Zerar resultados'
export const CONFIRM_ACTION = 'Confirmar zeragem'
export const CANCEL_ACTION = 'Cancelar'
export const RETURN_ACTION = 'Voltar'
export const ADDRESS_CAPTION = 'Endereço do questionário'
export const QUESTION_CONTROL = 'Pergunta no telão'
export const RESUME_ACTION = 'Retomar rotação'
export const EMPTY_RESULTS = 'Ninguém respondeu ainda.'
export const ONE_VOTE_LABEL = '1 (100%)'
export const ZERO_VOTE_LABEL = '0 (0%)'
export const WRONG_PASSWORD = 'senha-incorreta'
export const COUNTER_WORD = 'participando'

export async function clearEdition(request: APIRequestContext): Promise<void> {
  const headers = buildJsonHeaders()
  const entered = await request.post(ENTER_PATH, {
    headers,
    data: { [PASSWORD_FIELD]: PANEL_PASSWORD },
  })
  await requireAccepted(entered)
  const cleared = await request.post(RESET_PATH, {
    headers,
    data: { [CONFIRM_FIELD]: true },
  })
  await requireAccepted(cleared)
}

export async function openQuestionnaire(page: Page): Promise<void> {
  const opening = readOpeningQuestion()
  await page.goto(HOME_PATH)
  await expect(page.getByText(opening.text)).toBeVisible()
}

export async function chooseOption(page: Page, optionText: string): Promise<void> {
  await page.locator(OPTION_SELECTOR, { hasText: optionText }).click()
}

export async function answerEveryQuestion(page: Page): Promise<void> {
  for (const question of surveyCatalog) {
    await expect(page.getByText(question.text)).toBeVisible()
    await chooseOption(page, readFirstOption(question))
  }
}

export async function reopenQuestionnaire(context: BrowserContext, page: Page): Promise<Page> {
  await page.close()
  const returnedPage = await context.newPage()
  await returnedPage.goto(HOME_PATH)
  return returnedPage
}

export async function submitPassword(page: Page, password: string): Promise<void> {
  await page.goto(PANEL_PATH)
  await page.getByLabel(PASSWORD_LABEL).fill(password)
  await page.getByRole('button', { name: ENTER_ACTION }).click()
}

export async function unlockPanel(page: Page): Promise<void> {
  await submitPassword(page, PANEL_PASSWORD)
  await assertCounters(page, ZERO_COUNTERS)
}

export async function assertPasswordRejected(page: Page): Promise<void> {
  const rejection = page.getByRole('alert').filter({ hasText: REJECTED_TEXT })
  await expect(rejection).toHaveText(REJECTED_TEXT)
  await expect(page.getByLabel(PASSWORD_LABEL)).toBeVisible()
  await expect(page.getByRole('button', { name: ENTER_ACTION })).toBeVisible()
  await assertTextAbsent(page, ADDRESS_CAPTION)
  await expect(page.locator(BAR_SELECTOR)).toHaveCount(EMPTY_COUNT)
  await assertTextAbsent(page, COUNTER_WORD)
}

export async function assertUnlockedPanel(page: Page): Promise<void> {
  const opening = readOpeningQuestion()
  await assertCounters(page, ZERO_COUNTERS)
  await expect(page.getByRole('heading', { level: QUESTION_HEADING_LEVEL, name: opening.text })).toBeVisible()
  await expect(page.locator(BAR_SELECTOR)).toHaveCount(OPTION_COUNT)
  await expect(page.getByText(EMPTY_RESULTS)).toBeVisible()
  await expect(page.locator(CODE_SELECTOR)).toBeVisible()
  await expect(page.getByText(ADDRESS_CAPTION)).toBeVisible()
  await expect(page.getByText(`${APPLICATION_ORIGIN}/`)).toBeVisible()
}

export async function showPanelQuestion(page: Page, questionNumber: QuestionNumber): Promise<void> {
  const question = readQuestion(questionNumber)
  const control = page.getByLabel(QUESTION_CONTROL)
  await control.selectOption(String(readOtherQuestion(question.number)))
  await control.selectOption(String(question.number))
  await expect(page.getByRole('heading', { level: QUESTION_HEADING_LEVEL, name: question.text })).toBeVisible()
  await expect(page.getByRole('button', { name: RESUME_ACTION })).toBeVisible()
}

export async function assertCounters(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('status')).toHaveText(text)
}

export async function assertOptionCount(page: Page, optionText: string, countText: string): Promise<void> {
  const bar = page.locator(BAR_SELECTOR, { hasText: optionText })
  const accessibleCount = page.getByRole('rowheader', { name: `${optionText}: ${countText}`, exact: true })
  await expect(bar).toContainText(countText)
  await expect(accessibleCount).toHaveCount(SINGLE_MATCH)
}

export async function markOpenPage(page: Page): Promise<void> {
  await page.evaluate((marker) => {
    document.documentElement.dataset.journey = marker
  }, JOURNEY_MARKER)
}

export async function assertPageStayed(page: Page): Promise<void> {
  const marker = await page.evaluate(() => document.documentElement.dataset.journey)
  expect(marker).toBe(JOURNEY_MARKER)
}

export async function focusWithTab(page: Page, target: Locator): Promise<void> {
  for (let attempt = FIRST_ATTEMPT; attempt < TAB_ATTEMPT_LIMIT; attempt += NEXT_ATTEMPT) {
    const focused = await target.evaluate((element) => element === document.activeElement)
    if (focused) {
      return
    }
    await page.keyboard.press(TAB_KEY)
  }
  await expect(target).toBeFocused()
}

export async function assertStatementFocused(page: Page, questionText: string): Promise<void> {
  const statement = page.getByRole('group', { name: questionText }).locator('legend')
  await expect(statement).toBeFocused()
}

export async function assertOptionChecked(page: Page, optionText: string): Promise<void> {
  await expect(page.getByRole('radio', { name: optionText })).toBeChecked()
}

export async function assertNoVote(page: Page): Promise<void> {
  await expect(page.getByRole('radio')).toHaveCount(EMPTY_COUNT)
}

export async function assertTextAbsent(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text)).toHaveCount(EMPTY_COUNT)
}

export function readOpeningQuestion(): SurveyQuestion {
  return readQuestion(readOpeningNumber())
}

export function readFollowingQuestion(question: SurveyQuestion): SurveyQuestion {
  return readQuestion(readNextNumber(question.number))
}

export function readFirstOption(question: SurveyQuestion): string {
  const option = question.options[FIRST_OPTION_INDEX]
  if (option === undefined) {
    throw new Error('Option is outside the catalog')
  }
  return option.text
}

export function formatProgress(questionNumber: QuestionNumber): string {
  return `Pergunta ${questionNumber} de ${QUESTION_COUNT}`
}

function buildJsonHeaders(): Record<string, string> {
  return {
    [ORIGIN_HEADER]: APPLICATION_ORIGIN,
    [CONTENT_TYPE_HEADER]: JSON_MEDIA_TYPE,
  }
}

async function requireAccepted(response: APIResponse): Promise<void> {
  if (response.ok()) {
    return
  }
  const detail = await response.text()
  throw new Error(`Request failed with status ${response.status()}: ${detail}`)
}

function readOpeningNumber(): QuestionNumber {
  const opening = surveyCatalog[CATALOG_START]
  if (opening === undefined) {
    throw new Error('Question is outside the catalog')
  }
  return opening.number
}

function readNextNumber(questionNumber: QuestionNumber): QuestionNumber {
  const nextNumber = questionNumber + NEXT_QUESTION_STEP
  const following = surveyCatalog.find((item) => item.number === nextNumber)
  if (following === undefined) {
    throw new Error('Question is outside the catalog')
  }
  return following.number
}

function readQuestion(questionNumber: QuestionNumber): SurveyQuestion {
  const question = surveyCatalog.find((item) => item.number === questionNumber)
  if (question === undefined) {
    throw new Error('Question is outside the catalog')
  }
  return question
}

function readOtherQuestion(questionNumber: QuestionNumber): number {
  if (questionNumber === QUESTION_COUNT) {
    return questionNumber - NEXT_QUESTION_STEP
  }
  return questionNumber + NEXT_QUESTION_STEP
}
