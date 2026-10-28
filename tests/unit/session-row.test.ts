import { describe, expect, it } from 'vitest'
import {
  InvalidSessionRowError,
  mapSessionRow,
  type AnswerTableRow,
  type SessionTableRow,
} from '@/adapters/supabase/session-row'
import {
  COMPLETED_SESSION_STATUS,
  FIRST_OPTION_POSITION,
  FIRST_QUESTION_NUMBER,
  OPEN_SESSION_STATUS,
} from '@/domain/session'
import { OPTION_COUNT, QUESTION_COUNT, type OptionPosition, type QuestionNumber } from '@/domain/survey-catalog'

const SESSION_ID = '6f1c0c3e-3d1a-4c0a-9c1e-6d2b9a0e1f11'
const CREATED_AT = '2026-10-27T12:00:00.000Z'
const SECOND_QUESTION: QuestionNumber = 2
const FOURTH_OPTION: OptionPosition = 4
const QUESTION_BEFORE_CATALOG = 0
const QUESTION_AFTER_CATALOG = 11
const FRACTIONAL_QUESTION = 1.5
const OPTION_BEFORE_CATALOG = 0
const OPTION_AFTER_CATALOG = 6
const FRACTIONAL_OPTION = 5.5
const UNKNOWN_STATUS = 'closed'

function openRow(): SessionTableRow {
  return {
    id: SESSION_ID,
    status: OPEN_SESSION_STATUS,
    currentQuestion: SECOND_QUESTION,
    furthestQuestion: SECOND_QUESTION,
    createdAt: CREATED_AT,
  }
}

function openAnswers(): readonly AnswerTableRow[] {
  return [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION }]
}

describe('session row mapping', () => {
  it('maps a valid row and its answers', () => {
    expect(mapSessionRow(openRow(), openAnswers())).toEqual({
      id: SESSION_ID,
      status: OPEN_SESSION_STATUS,
      currentQuestion: SECOND_QUESTION,
      furthestQuestion: SECOND_QUESTION,
      answers: [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FOURTH_OPTION }],
      createdAt: CREATED_AT,
    })
    expect(
      mapSessionRow(
        {
          id: SESSION_ID,
          status: COMPLETED_SESSION_STATUS,
          currentQuestion: QUESTION_COUNT,
          furthestQuestion: QUESTION_COUNT,
          createdAt: CREATED_AT,
        },
        [
          { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FIRST_OPTION_POSITION },
          { questionNumber: QUESTION_COUNT, optionNumber: OPTION_COUNT },
        ],
      ),
    ).toEqual({
      id: SESSION_ID,
      status: COMPLETED_SESSION_STATUS,
      currentQuestion: QUESTION_COUNT,
      furthestQuestion: QUESTION_COUNT,
      answers: [
        { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FIRST_OPTION_POSITION },
        { questionNumber: QUESTION_COUNT, optionNumber: OPTION_COUNT },
      ],
      createdAt: CREATED_AT,
    })
  })

  it('rejects an unknown status', () => {
    expect(() => mapSessionRow({ ...openRow(), status: UNKNOWN_STATUS }, [])).toThrow(InvalidSessionRowError)
    expect(() => mapSessionRow({ ...openRow(), status: 'Open' }, [])).toThrow(InvalidSessionRowError)
  })

  it('rejects a question outside the catalog', () => {
    expect(() => mapSessionRow({ ...openRow(), currentQuestion: QUESTION_BEFORE_CATALOG }, [])).toThrow(
      InvalidSessionRowError,
    )
    expect(() => mapSessionRow({ ...openRow(), furthestQuestion: QUESTION_AFTER_CATALOG }, [])).toThrow(
      InvalidSessionRowError,
    )
    expect(() => mapSessionRow({ ...openRow(), currentQuestion: FRACTIONAL_QUESTION }, [])).toThrow(
      InvalidSessionRowError,
    )
    expect(() =>
      mapSessionRow(openRow(), [{ questionNumber: QUESTION_AFTER_CATALOG, optionNumber: FIRST_OPTION_POSITION }]),
    ).toThrow(InvalidSessionRowError)
  })

  it('rejects an option outside the catalog', () => {
    expect(() =>
      mapSessionRow(openRow(), [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: OPTION_BEFORE_CATALOG }]),
    ).toThrow(InvalidSessionRowError)
    expect(() =>
      mapSessionRow(openRow(), [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: OPTION_AFTER_CATALOG }]),
    ).toThrow(InvalidSessionRowError)
    expect(() =>
      mapSessionRow(openRow(), [{ questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FRACTIONAL_OPTION }]),
    ).toThrow(InvalidSessionRowError)
  })
})
