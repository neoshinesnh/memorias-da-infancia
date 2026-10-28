import { createElement, type ReactElement } from 'react'
import { readSessionRepository } from '@/adapters/supabase/session-repository-cache'
import { hasValidPanelCookie } from '@/application/panel-cookie'
import { createAddressMarkup, readQuestionnaireAddress } from '@/application/panel-code'
import { readResults } from '@/application/session-use-cases'
import { PanelBoard } from '@/components/panel-board'
import { PanelGate } from '@/components/panel-gate'

const PUBLIC_URL_VARIABLE = 'PUBLIC_URL'
const COOKIE_SECRET_VARIABLE = 'COOKIE_SECRET'
const EMPTY_LENGTH = 0

export async function createPanelDocument(cookieHeader: string | null): Promise<ReactElement> {
  if (!isPanelOpen(cookieHeader)) {
    return createElement(PanelGate)
  }
  const address = readQuestionnaireAddress(process.env[PUBLIC_URL_VARIABLE])
  const codeMarkup = await createAddressMarkup(address)
  const snapshot = await readResults(readSessionRepository())
  return createElement(PanelBoard, { address, codeMarkup, initialSnapshot: snapshot })
}

function isPanelOpen(cookieHeader: string | null): boolean {
  const secret = readCookieSecret()
  if (secret === null) {
    return false
  }
  try {
    return hasValidPanelCookie(cookieHeader, secret)
  } catch {
    return false
  }
}

function readCookieSecret(): string | null {
  const secret = process.env[COOKIE_SECRET_VARIABLE]
  if (secret === undefined) {
    return null
  }
  if (secret.length === EMPTY_LENGTH) {
    return null
  }
  return secret
}
