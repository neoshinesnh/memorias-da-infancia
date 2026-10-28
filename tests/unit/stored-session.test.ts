import { describe, expect, it } from 'vitest'
import { SessionStoreError, raiseStoreFailure } from '@/adapters/supabase/supabase-config'
import {
  createAnswerArguments,
  mapStoredSession,
  mapStoredSessions,
} from '@/adapters/supabase/stored-session'
import { InvalidSessionRowError } from '@/adapters/supabase/session-row'
import { OPEN_SESSION_STATUS, FIRST_QUESTION_NUMBER } from '@/domain/session'
import type { OptionPosition, QuestionNumber } from '@/domain/survey-catalog'

const SESSION_ID = '6f1c0c3e-3d1a-4c0a-9c1e-6d2b9a0e1f11'
const CREATED_AT = '2026-10-27T12:00:00.000Z'
const UPDATED_AT = '2026-10-27T12:05:00.000Z'
const UNIQUE_VIOLATION = '23505'
const SECOND_QUESTION: QuestionNumber = 2
const FIRST_OPTION: OptionPosition = 1
const FOURTH_OPTION: OptionPosition = 4

describe('stored session mapping', () => {
  it('maps a supabase row and sorts answers by question', () => {
    const session = mapStoredSession({
      id: SESSION_ID,
      status: OPEN_SESSION_STATUS,
      current_question: SECOND_QUESTION,
      furthest_question: SECOND_QUESTION,
      created_at: CREATED_AT,
      answers: [
        { question_number: SECOND_QUESTION, option_number: FOURTH_OPTION },
        { question_number: FIRST_QUESTION_NUMBER, option_number: FIRST_OPTION },
      ],
    })
    expect(session).toEqual({
      id: SESSION_ID,
      status: OPEN_SESSION_STATUS,
      currentQuestion: SECOND_QUESTION,
      furthestQuestion: SECOND_QUESTION,
      createdAt: CREATED_AT,
      answers: [
        { questionNumber: FIRST_QUESTION_NUMBER, optionNumber: FIRST_OPTION },
        { questionNumber: SECOND_QUESTION, optionNumber: FOURTH_OPTION },
      ],
    })
  })

  it('treats a missing answer list as no answers', () => {
    const sessions = mapStoredSessions([
      {
        id: SESSION_ID,
        status: OPEN_SESSION_STATUS,
        current_question: FIRST_QUESTION_NUMBER,
        furthest_question: FIRST_QUESTION_NUMBER,
        created_at: CREATED_AT,
        answers: null,
      },
    ])
    expect(sessions[0]?.answers).toEqual([])
  })

  it('refuses a row outside the catalog', () => {
    expect(() =>
      mapStoredSession({
        id: SESSION_ID,
        status: 'closed',
        current_question: FIRST_QUESTION_NUMBER,
        furthest_question: FIRST_QUESTION_NUMBER,
        created_at: CREATED_AT,
        answers: [],
      }),
    ).toThrow(InvalidSessionRowError)
  })

  it('builds the save_session_answer arguments', () => {
    const session = mapStoredSession({
      id: SESSION_ID,
      status: OPEN_SESSION_STATUS,
      current_question: SECOND_QUESTION,
      furthest_question: SECOND_QUESTION,
      created_at: CREATED_AT,
      answers: [{ question_number: FIRST_QUESTION_NUMBER, option_number: FOURTH_OPTION }],
    })
    const answer = session.answers[0]
    if (answer === undefined) {
      throw new Error('Answer is missing')
    }
    expect(createAnswerArguments({ session, answer, updatedAt: UPDATED_AT })).toEqual({
      p_session_id: SESSION_ID,
      p_status: OPEN_SESSION_STATUS,
      p_current_question: SECOND_QUESTION,
      p_furthest_question: SECOND_QUESTION,
      p_question_number: FIRST_QUESTION_NUMBER,
      p_option_number: FOURTH_OPTION,
      p_updated_at: UPDATED_AT,
    })
  })

  it('hides the remote message and keeps the failure code', () => {
    expect(() => raiseStoreFailure({ code: UNIQUE_VIOLATION, message: 'duplicate key value' })).toThrow(
      SessionStoreError,
    )
    expect(() => raiseStoreFailure({ code: UNIQUE_VIOLATION, message: 'duplicate key value' })).toThrow(
      `Session store failed (${UNIQUE_VIOLATION})`,
    )
  })
})
