import { readCurrentSession } from '@/adapters/http/participant-session'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export function GET(request: Request): Response {
  return readCurrentSession(request)
}
