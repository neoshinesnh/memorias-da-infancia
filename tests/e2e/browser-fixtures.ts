import { test as base, devices, type BrowserContext, type Page } from '@playwright/test'
import { clearEdition } from './journey-actions'
import { APPLICATION_ORIGIN } from './server-settings'

const PHONE = devices['Pixel 5']
const SCREEN_WIDTH = 1600
const SCREEN_HEIGHT = 900

type JourneyFixtures = {
  participantContext: BrowserContext
  participantPage: Page
  panelContext: BrowserContext
  panelPage: Page
  cleanEdition: void
}

export const test = base.extend<JourneyFixtures>({
  cleanEdition: [
    async ({ request }, use) => {
      await clearEdition(request)
      await use()
    },
    { auto: true },
  ],
  participantContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: PHONE.viewport,
      userAgent: PHONE.userAgent,
      deviceScaleFactor: PHONE.deviceScaleFactor,
      isMobile: PHONE.isMobile,
      hasTouch: PHONE.hasTouch,
      baseURL: APPLICATION_ORIGIN,
    })
    await use(context)
    await context.close()
  },
  participantPage: async ({ participantContext }, use) => {
    const page = await participantContext.newPage()
    await use(page)
  },
  panelContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
      baseURL: APPLICATION_ORIGIN,
    })
    await use(context)
    await context.close()
  },
  panelPage: async ({ panelContext }, use) => {
    const page = await panelContext.newPage()
    await use(page)
  },
})

export { expect } from '@playwright/test'
