import { expect, test } from './browser-fixtures'
import {
  assertCounters,
  assertOptionChecked,
  assertStatementFocused,
  assertTextAbsent,
  CANCEL_ACTION,
  chooseOption,
  CONFIRM_ACTION,
  ENTER_KEY,
  focusWithTab,
  ONE_COUNTERS,
  openQuestionnaire,
  readFirstOption,
  readFollowingQuestion,
  readOpeningQuestion,
  RESET_ACTION,
  RESET_WARNING,
  RETURN_ACTION,
  showPanelQuestion,
  SPACE_KEY,
  unlockPanel,
  ZERO_COUNTERS,
} from './journey-actions'

test('moves focus to the next statement and returns with the keyboard', async ({ participantPage }) => {
  const opening = readOpeningQuestion()
  const following = readFollowingQuestion(opening)
  const firstOption = readFirstOption(opening)
  const followingOption = readFirstOption(following)
  await openQuestionnaire(participantPage)
  await assertStatementFocused(participantPage, opening.text)
  await focusWithTab(participantPage, participantPage.getByRole('radio', { name: firstOption }))
  await participantPage.keyboard.press(SPACE_KEY)
  await assertStatementFocused(participantPage, following.text)
  await focusWithTab(participantPage, participantPage.getByRole('radio', { name: followingOption }))
  await focusWithTab(participantPage, participantPage.getByRole('button', { name: RETURN_ACTION }))
  await participantPage.keyboard.press(ENTER_KEY)
  await expect(participantPage.getByText(opening.text)).toBeVisible()
  await assertOptionChecked(participantPage, firstOption)
})

test('cancels and confirms reset from the keyboard', async ({ participantPage, panelPage }) => {
  const opening = readOpeningQuestion()
  const firstOption = readFirstOption(opening)
  await unlockPanel(panelPage)
  await showPanelQuestion(panelPage, opening.number)
  await openQuestionnaire(participantPage)
  await chooseOption(participantPage, firstOption)
  await assertCounters(panelPage, ONE_COUNTERS)
  const resetButton = panelPage.getByRole('button', { name: RESET_ACTION })
  await focusWithTab(panelPage, resetButton)
  await panelPage.keyboard.press(ENTER_KEY)
  await focusWithTab(panelPage, panelPage.getByRole('button', { name: CANCEL_ACTION }))
  await panelPage.keyboard.press(ENTER_KEY)
  await assertCounters(panelPage, ONE_COUNTERS)
  await assertTextAbsent(panelPage, RESET_WARNING)
  await focusWithTab(panelPage, resetButton)
  await panelPage.keyboard.press(ENTER_KEY)
  await focusWithTab(panelPage, panelPage.getByRole('button', { name: CONFIRM_ACTION }))
  await panelPage.keyboard.press(ENTER_KEY)
  await assertCounters(panelPage, ZERO_COUNTERS)
})
