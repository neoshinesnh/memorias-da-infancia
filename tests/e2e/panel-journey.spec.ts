import { expect, test } from './browser-fixtures'
import {
  assertCounters,
  assertOptionCount,
  assertPageStayed,
  assertPasswordRejected,
  assertTextAbsent,
  assertUnlockedPanel,
  CANCEL_ACTION,
  chooseOption,
  CONFIRM_ACTION,
  formatProgress,
  markOpenPage,
  ONE_COUNTERS,
  ONE_VOTE_LABEL,
  openQuestionnaire,
  readFirstOption,
  readFollowingQuestion,
  readOpeningQuestion,
  RESET_ACTION,
  RESET_WARNING,
  showPanelQuestion,
  submitPassword,
  unlockPanel,
  WRONG_PASSWORD,
  ZERO_COUNTERS,
  ZERO_VOTE_LABEL,
} from './journey-actions'

test('keeps the password gate when the password is wrong', async ({ panelPage }) => {
  await submitPassword(panelPage, WRONG_PASSWORD)
  await assertPasswordRejected(panelPage)
})

test('shows bars, counters, code and address after the right password', async ({ panelPage }) => {
  await unlockPanel(panelPage)
  await assertUnlockedPanel(panelPage)
})

test('shows a phone vote on the panel without reloading', async ({ participantPage, panelPage }) => {
  const opening = readOpeningQuestion()
  const firstOption = readFirstOption(opening)
  await unlockPanel(panelPage)
  await showPanelQuestion(panelPage, opening.number)
  await markOpenPage(panelPage)
  await openQuestionnaire(participantPage)
  await chooseOption(participantPage, firstOption)
  await assertCounters(panelPage, ONE_COUNTERS)
  await assertOptionCount(panelPage, firstOption, ONE_VOTE_LABEL)
  await assertPageStayed(panelPage)
})

test('keeps results until reset is confirmed and then starts a new session', async ({
  participantPage,
  panelPage,
}) => {
  const opening = readOpeningQuestion()
  const following = readFollowingQuestion(opening)
  const firstOption = readFirstOption(opening)
  await unlockPanel(panelPage)
  await showPanelQuestion(panelPage, opening.number)
  await openQuestionnaire(participantPage)
  await chooseOption(participantPage, firstOption)
  await expect(participantPage.getByText(following.text)).toBeVisible()
  await assertCounters(panelPage, ONE_COUNTERS)
  await panelPage.getByRole('button', { name: RESET_ACTION }).click()
  await expect(panelPage.getByText(RESET_WARNING)).toBeVisible()
  await assertCounters(panelPage, ONE_COUNTERS)
  await panelPage.getByRole('button', { name: CANCEL_ACTION }).click()
  await assertTextAbsent(panelPage, RESET_WARNING)
  await assertCounters(panelPage, ONE_COUNTERS)
  await panelPage.getByRole('button', { name: RESET_ACTION }).click()
  await panelPage.getByRole('button', { name: CONFIRM_ACTION }).click()
  await assertCounters(panelPage, ZERO_COUNTERS)
  await assertOptionCount(panelPage, firstOption, ZERO_VOTE_LABEL)
  await expect(participantPage.getByText(opening.text)).toBeVisible()
  await expect(participantPage.getByText(formatProgress(opening.number))).toBeVisible()
  await expect(participantPage.getByRole('radio', { name: firstOption })).not.toBeChecked()
})
