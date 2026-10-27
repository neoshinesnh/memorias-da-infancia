import type { QuestionNumber } from '@/domain/survey-catalog'

const INFO_LOG_LEVEL = 'info'
const SESSION_CREATED_EVENT = 'session_created'
const ANSWER_SAVED_EVENT = 'answer_saved'

type SessionCreatedLog = {
  level: typeof INFO_LOG_LEVEL
  event: typeof SESSION_CREATED_EVENT
}

type AnswerSavedLog = {
  level: typeof INFO_LOG_LEVEL
  event: typeof ANSWER_SAVED_EVENT
  questionNumber: QuestionNumber
}

type SessionLogEntry = SessionCreatedLog | AnswerSavedLog

export function logSessionCreated(): void {
  writeLogLine({
    level: INFO_LOG_LEVEL,
    event: SESSION_CREATED_EVENT,
  })
}

export function logAnswerSaved(questionNumber: QuestionNumber): void {
  writeLogLine({
    level: INFO_LOG_LEVEL,
    event: ANSWER_SAVED_EVENT,
    questionNumber,
  })
}

function writeLogLine(entry: SessionLogEntry): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`)
}
