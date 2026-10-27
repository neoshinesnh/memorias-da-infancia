import { createParticipantSession } from '@/adapters/http/participant-session'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export function POST(request: Request): Response {
  return createParticipantSession(request)
}
