import { defineConfig } from '@playwright/test'
import {
  ACTION_TIMEOUT_MILLISECONDS,
  APPLICATION_ORIGIN,
  APPLICATION_PORT,
  COOKIE_SECRET,
  EXPECT_TIMEOUT_MILLISECONDS,
  NAVIGATION_WAIT_MILLISECONDS,
  NO_RETRIES,
  PANEL_PASSWORD,
  SERVER_TIMEOUT_MILLISECONDS,
  SINGLE_WORKER,
  TEST_TIMEOUT_MILLISECONDS,
} from './tests/e2e/server-settings'

const SESSION_STORE = 'SESSION_STORE'
const MEMORY_SESSION_STORE = 'memory'
const PUBLIC_URL = 'PUBLIC_URL'
const PANEL_PASSWORD_NAME = 'PANEL_PASSWORD'
const COOKIE_SECRET_NAME = 'COOKIE_SECRET'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: SINGLE_WORKER,
  retries: NO_RETRIES,
  forbidOnly: true,
  timeout: TEST_TIMEOUT_MILLISECONDS,
  expect: {
    timeout: EXPECT_TIMEOUT_MILLISECONDS,
  },
  use: {
    baseURL: APPLICATION_ORIGIN,
    actionTimeout: ACTION_TIMEOUT_MILLISECONDS,
    navigationTimeout: NAVIGATION_WAIT_MILLISECONDS,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --hostname localhost --port ${APPLICATION_PORT}`,
    url: APPLICATION_ORIGIN,
    reuseExistingServer: false,
    timeout: SERVER_TIMEOUT_MILLISECONDS,
    env: {
      [SESSION_STORE]: MEMORY_SESSION_STORE,
      [PUBLIC_URL]: APPLICATION_ORIGIN,
      [PANEL_PASSWORD_NAME]: PANEL_PASSWORD,
      [COOKIE_SECRET_NAME]: COOKIE_SECRET,
    },
  },
})
