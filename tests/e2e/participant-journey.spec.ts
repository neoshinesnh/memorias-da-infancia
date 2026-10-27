import { expect, test } from './browser-fixtures'
import {
  answerEveryQuestion,
  assertNoVote,
  assertOptionChecked,
  chooseOption,
  formatProgress,
  openQuestionnaire,
  readFirstOption,
  readFollowingQuestion,
  readOpeningQuestion,
  REGISTERED_TEXT,
  reopenQuestionnaire,
  RETURN_ACTION,
  THANKS_TEXT,
} from './journey-actions'

test('finishes every question and shows the registered notice on return', async ({
  participantContext,
  participantPage,
}) => {
  await openQuestionnaire(participantPage)
  await answerEveryQuestion(participantPage)
  await expect(participantPage.getByRole('heading', { name: THANKS_TEXT })).toBeVisible()
  await assertNoVote(participantPage)
  const returnedPage = await reopenQuestionnaire(participantContext, participantPage)
  await expect(returnedPage.getByRole('heading', { name: REGISTERED_TEXT })).toBeVisible()
  await assertNoVote(returnedPage)
})

test('reopens the question on screen with the saved answer', async ({
  participantContext,
  participantPage,
}) => {
  const opening = readOpeningQuestion()
  const following = readFollowingQuestion(opening)
  const firstOption = readFirstOption(opening)
  await openQuestionnaire(participantPage)
  await chooseOption(participantPage, firstOption)
  await expect(participantPage.getByText(following.text)).toBeVisible()
  await expect(participantPage.getByText(formatProgress(following.number))).toBeVisible()
  const returnedPage = await reopenQuestionnaire(participantContext, participantPage)
  await expect(returnedPage.getByText(following.text)).toBeVisible()
  await expect(returnedPage.getByText(formatProgress(following.number))).toBeVisible()
  await returnedPage.getByRole('button', { name: RETURN_ACTION }).click()
  await expect(returnedPage.getByText(opening.text)).toBeVisible()
  await expect(returnedPage.getByText(formatProgress(opening.number))).toBeVisible()
  await assertOptionChecked(returnedPage, firstOption)
})
