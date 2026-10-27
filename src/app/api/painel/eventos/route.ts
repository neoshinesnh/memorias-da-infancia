import { openPanelEvents } from '@/adapters/http/panel-events'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export function GET(request: Request): Response {
  return openPanelEvents(request)
}
