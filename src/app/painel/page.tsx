import { cookies } from 'next/headers'
import { PANEL_COOKIE_NAME } from '@/application/panel-cookie'
import { createPanelDocument } from '@/components/panel-document'

const EMPTY_LENGTH = 0

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(PANEL_COOKIE_NAME)?.value
  return createPanelDocument(formatPanelCookie(token))
}

function formatPanelCookie(token: string | undefined): string | null {
  if (token === undefined) {
    return null
  }
  if (token.length === EMPTY_LENGTH) {
    return null
  }
  return `${PANEL_COOKIE_NAME}=${token}`
}
