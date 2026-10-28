import { readPanelSnapshot } from '@/adapters/http/panel-access'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export function GET(request: Request): Promise<Response> {
  return readPanelSnapshot(request)
}
