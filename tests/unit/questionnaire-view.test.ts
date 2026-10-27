import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SessionPayload } from '@/application/session-http'
import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_SERVER_ERROR,
} from '@/application/session-http'
import { focusQuestionnaireRegion } from '@/components/questionnaire-focus'
import {
  acceptSavedAnswer,
  decideSessionRefresh,
  discardRememberedSession,
  markSaveFailure,
  mergeServerPayload,
  openExistingSession,
  sessionAllowsVoting,
  showPreviousQuestionOnFlow,
} from '@/components/questionnaire-flow'
import { SESSION_REFRESH_MILLISECONDS } from '@/components/questionnaire-store'
import {
  buildQuestionScreen,
  buildStickerSlots,
  formatQuestionProgress,
} from '@/components/questionnaire-view'
import {
  COMPLETED_SESSION_STATUS,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
} from '@/domain/session'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type OptionPosition,
  type QuestionNumber,
} from '@/domain/survey-catalog'

const SECOND_QUESTION: QuestionNumber = 2
const FOURTH_OPTION: OptionPosition = 4
const REFRESH_INTERVAL_SECONDS = 5
const MILLISECONDS_PER_SECOND = 1000
const STYLESHEET_PATH = resolve(process.cwd(), 'src/app/globals.css')
const EMPTY_APPEARANCE_COUNT = QUESTION_COUNT - 1

function readLastQuestion(): QuestionNumber {
  const last = surveyCatalog[QUESTION_COUNT - 1]
  if (last === undefined) {
    throw new Error('Survey catalog is empty')
  }
  return last.number
}

function createOpenPayload(): SessionPayload {
  return {
    status: OPEN_SESSION_STATUS,
    currentQuestion: FIRST_QUESTION_NUMBER,
    furthestQuestion: FIRST_QUESTION_NUMBER,
    answers: [],
  }
}

function createAdvancedPayload(optionNumber: OptionPosition): SessionPayload {
  return {
    status: OPEN_SESSION_STATUS,
    currentQuestion: SECOND_QUESTION,
    furthestQuestion: SECOND_QUESTION,
    answers: [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber }],
  }
}

function createCompletedPayload(): SessionPayload {
  return {
    status: COMPLETED_SESSION_STATUS,
    currentQuestion: readLastQuestion(),
    furthestQuestion: readLastQuestion(),
    answers: surveyCatalog.map((question) => ({
      questionNumber: question.number,
      optionNumber: FIRST_OPTION_POSITION,
    })),
  }
}

function createFocusTarget(): { focus: () => void; readCount: () => number } {
  let count = 0
  return {
    focus: () => {
      count += 1
    },
    readCount: () => count,
  }
}

describe('sticker album', () => {
  it('marks the open question as current and the rest as empty', () => {
    const slots = buildStickerSlots({
      displayedQuestion: FIRST_QUESTION_NUMBER,
      answers: [],
    })
    expect(slots).toHaveLength(QUESTION_COUNT)
    expect(slots[0]?.appearance).toBe('current')
    expect(slots.filter((slot) => slot.appearance === 'empty')).toHaveLength(EMPTY_APPEARANCE_COUNT)
    expect(slots.filter((slot) => slot.appearance === 'filled')).toHaveLength(0)
  })

  it('fills the answered question and keeps the next one current', () => {
    const slots = buildStickerSlots({
      displayedQuestion: SECOND_QUESTION,
      answers: [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION }],
    })
    expect(slots[0]).toEqual({
      questionNumber: FIRST_QUESTION_NUMBER,
      appearance: 'filled',
      optionNumber: FOURTH_OPTION,
    })
    expect(slots[1]?.appearance).toBe('current')
    expect(slots[2]?.appearance).toBe('empty')
  })

  it('fills every sticker when the ten answers are stored', () => {
    const slots = buildStickerSlots({
      displayedQuestion: readLastQuestion(),
      answers: createCompletedPayload().answers,
    })
    expect(slots.every((slot) => slot.appearance === 'filled')).toBe(true)
    expect(slots.filter((slot) => slot.appearance === 'empty')).toHaveLength(0)
  })
})

describe('question announcement', () => {
  it('announces the open question as Pergunta N de 10', () => {
    const screen = buildQuestionScreen(openExistingSession(createOpenPayload()))
    expect(formatQuestionProgress(FIRST_QUESTION_NUMBER)).toBe('Pergunta 1 de 10')
    expect(formatQuestionProgress(readLastQuestion())).toBe('Pergunta 10 de 10')
    expect(screen?.progress).toBe('Pergunta 1 de 10')
    expect(screen?.choices).toHaveLength(OPTION_COUNT)
  })
})

describe('completed session', () => {
  it('offers no vote when the session is reopened or just finished', () => {
    const registered = openExistingSession(createCompletedPayload())
    const thanked = acceptSavedAnswer({
      payload: createCompletedPayload(),
      questionNumber: readLastQuestion(),
    })
    expect(registered.phase).toBe('registered')
    expect(thanked.phase).toBe('thanks')
    expect(sessionAllowsVoting(registered)).toBe(false)
    expect(sessionAllowsVoting(thanked)).toBe(false)
    expect(buildQuestionScreen(registered)).toBeNull()
    expect(buildQuestionScreen(thanked)).toBeNull()
  })
})

describe('session refresh', () => {
  it('creates a session only when the current one is missing', () => {
    expect(decideSessionRefresh(HTTP_NOT_FOUND)).toBe('create-session')
    expect(decideSessionRefresh(HTTP_OK)).toBe('apply-payload')
    expect(decideSessionRefresh(HTTP_SERVER_ERROR)).toBe('keep-view')
    expect(decideSessionRefresh(HTTP_BAD_REQUEST)).toBe('keep-view')
    expect(decideSessionRefresh(HTTP_CONFLICT)).toBe('keep-view')
    expect(SESSION_REFRESH_MILLISECONDS).toBe(REFRESH_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND)
  })

  it('drops remembered answers before a replacement session is opened', () => {
    const remembered = acceptSavedAnswer({
      payload: createAdvancedPayload(FOURTH_OPTION),
      questionNumber: FIRST_QUESTION_NUMBER,
    })
    const discarded = discardRememberedSession()
    expect(remembered.payload?.answers).toHaveLength(1)
    expect(discarded.payload).toBeNull()
    expect(discarded.phase).toBe('loading')
    expect(discarded.displayedQuestion).toBe(FIRST_QUESTION_NUMBER)
  })

  it('keeps the question on screen when a successful poll arrives', () => {
    const advanced = acceptSavedAnswer({
      payload: createAdvancedPayload(FIRST_OPTION_POSITION),
      questionNumber: FIRST_QUESTION_NUMBER,
    })
    const back = showPreviousQuestionOnFlow(advanced)
    const payload = back.payload
    if (payload === null) {
      throw new Error('Payload is missing')
    }
    const merged = mergeServerPayload(back, payload)
    expect(back.displayedQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(merged.displayedQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(merged.phase).toBe('question')
  })

  it('treats a stored answer as saved when the response was lost', () => {
    const failed = markSaveFailure(openExistingSession(createOpenPayload()), {
      questionNumber: FIRST_QUESTION_NUMBER,
      optionNumber: FOURTH_OPTION,
    })
    const recovered = mergeServerPayload(failed, createAdvancedPayload(FOURTH_OPTION))
    const stillMissing = mergeServerPayload(failed, createOpenPayload())
    const finished = mergeServerPayload(
      markSaveFailure(openExistingSession(createOpenPayload()), {
        questionNumber: readLastQuestion(),
        optionNumber: FIRST_OPTION_POSITION,
      }),
      createCompletedPayload(),
    )
    expect(recovered.phase).toBe('question')
    expect(recovered.displayedQuestion).toBe(SECOND_QUESTION)
    expect(recovered.pendingOption).toBeNull()
    expect(stillMissing.phase).toBe('save-error')
    expect(stillMissing.pendingOption).toBe(FOURTH_OPTION)
    expect(finished.phase).toBe('thanks')
  })

  it('opens question 1 when a finished screen receives a new open session', () => {
    const registered = openExistingSession(createCompletedPayload())
    const thanked = acceptSavedAnswer({
      payload: createCompletedPayload(),
      questionNumber: readLastQuestion(),
    })
    const reopened = mergeServerPayload(registered, createOpenPayload())
    const restarted = mergeServerPayload(thanked, createOpenPayload())
    const continued = mergeServerPayload(thanked, createCompletedPayload())
    expect(reopened.phase).toBe('question')
    expect(reopened.displayedQuestion).toBe(FIRST_QUESTION_NUMBER)
    expect(reopened.payload?.answers).toEqual([])
    expect(restarted.phase).toBe('question')
    expect(restarted.payload?.answers).toEqual([])
    expect(continued.phase).toBe('thanks')
  })
})

describe('question focus', () => {
  it('moves focus to the statement when the question advances', () => {
    const statement = createFocusTarget()
    const heading = createFocusTarget()
    focusQuestionnaireRegion({ phase: 'question', statement, heading })
    focusQuestionnaireRegion({ phase: 'saving', statement, heading })
    focusQuestionnaireRegion({ phase: 'save-error', statement, heading })
    expect(statement.readCount()).toBe(1)
    expect(heading.readCount()).toBe(0)
  })

  it('moves focus to the final heading when the session is finished', () => {
    const statement = createFocusTarget()
    const heading = createFocusTarget()
    focusQuestionnaireRegion({ phase: 'thanks', statement, heading })
    focusQuestionnaireRegion({ phase: 'registered', statement, heading })
    expect(heading.readCount()).toBe(2)
    expect(statement.readCount()).toBe(0)
  })
})

describe('sticker motion', () => {
  it('plays the sticker animation and removes it when motion is reduced', () => {
    const stylesheet = readFileSync(STYLESHEET_PATH, 'utf8')
    expect(stylesheet).toContain('sticker-stick')
    expect(stylesheet).toContain('min-height: 56px')
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)')
    expect(stylesheet).toContain('animation: none')
  })
})
