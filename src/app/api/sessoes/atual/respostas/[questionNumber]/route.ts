import { saveCurrentAnswer, type QuestionRouteContext } from '@/adapters/http/participant-session'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export function PUT(request: Request, context: QuestionRouteContext): Promise<Response> {
  return saveCurrentAnswer(request, context.params)
}
