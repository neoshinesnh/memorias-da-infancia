import { resetPanelEdition } from '@/adapters/http/panel-access'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export function POST(request: Request): Promise<Response> {
  return resetPanelEdition(request)
}
