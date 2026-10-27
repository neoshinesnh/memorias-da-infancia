import { HTTP_OK } from '@/application/session-http'
import { HTTP_UNAUTHORIZED } from '@/application/panel-http'
import type { PanelBoardTransport } from '@/components/panel-board-store'
import { readResultsEventData } from '@/components/panel-live'
import type { ResultsSnapshot } from '@/domain/results'

const ENTER_PATH = '/api/painel/entrar'
const RESET_PATH = '/api/painel/zerar'
const PANEL_PATH = '/painel'
const POST_METHOD = 'POST'
const JSON_TYPE = 'application/json'
const CONTENT_TYPE = 'content-type'
const SAME_ORIGIN = 'same-origin' as const
const PASSWORD_FIELD = 'password'
const CONFIRM_FIELD = 'confirm'

export const PANEL_ROUTE = PANEL_PATH

export type GateResult = 'accepted' | 'rejected' | 'unavailable'

export async function enterPanelWithPassword(password: string): Promise<GateResult> {
  try {
    const response = await fetch(ENTER_PATH, {
      method: POST_METHOD,
      credentials: SAME_ORIGIN,
      headers: { [CONTENT_TYPE]: JSON_TYPE },
      body: JSON.stringify({ [PASSWORD_FIELD]: password }),
    })
    return readGateResult(response.status)
  } catch {
    return 'unavailable'
  }
}

export function createBrowserPanelTransport(): PanelBoardTransport {
  return {
    resetEdition: resetFromBrowser,
  }
}

async function resetFromBrowser(): Promise<ResultsSnapshot | null> {
  try {
    const response = await fetch(RESET_PATH, {
      method: POST_METHOD,
      credentials: SAME_ORIGIN,
      headers: { [CONTENT_TYPE]: JSON_TYPE },
      body: JSON.stringify({ [CONFIRM_FIELD]: true }),
    })
    return readResetBody(response)
  } catch {
    return null
  }
}

function readGateResult(status: number): GateResult {
  if (status === HTTP_OK) {
    return 'accepted'
  }
  if (status === HTTP_UNAUTHORIZED) {
    return 'rejected'
  }
  return 'unavailable'
}

async function readResetBody(response: Response): Promise<ResultsSnapshot | null> {
  if (!response.ok) {
    return null
  }
  try {
    const body: unknown = await response.json()
    return readResultsEventData(JSON.stringify(body))
  } catch {
    return null
  }
}
