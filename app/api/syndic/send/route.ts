import { NextRequest } from 'next/server'
import { checkAndSendSyndicDocuments } from '@/lib/syndic/sendSyndicDocuments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { reservation_id, force = true } = await request.json()
    if (!reservation_id) {
      return Response.json({ error: 'reservation_id requis' }, { status: 400 })
    }

    const result = await checkAndSendSyndicDocuments(reservation_id, force)

    if (!result.success && result.error) {
      return Response.json({ error: result.error }, { status: 400 })
    }
    return Response.json(result)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[API Syndic Send] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
