import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NUKI_BASE  = 'https://api.nuki.io'
const NUKI_TOKEN = process.env.NUKI_API_TOKEN ?? ''

const LOCK_STATE: Record<number, string> = {
  0:  'Non calibré',
  1:  'Verrouillé',
  2:  'Déverrouillage en cours',
  3:  'Déverrouillé',
  4:  'Verrouillage en cours',
  5:  'Non verrouillé (loquet)',
  6:  'Déverrouillage en cours',
  7:  'Non verrouillé',
  254: 'Moteur bloqué',
  255: 'Inconnu',
}

export async function GET(request: NextRequest) {
  const smartlockId = request.nextUrl.searchParams.get('smartlock_id')

  if (!smartlockId) {
    return Response.json({ error: 'smartlock_id requis' }, { status: 400 })
  }

  if (!NUKI_TOKEN) {
    return Response.json({ test_mode: true, message: 'Nuki non configuré (NUKI_API_TOKEN manquant)' })
  }

  try {
    const res = await fetch(`${NUKI_BASE}/smartlock/${smartlockId}`, {
      headers: { Authorization: `Bearer ${NUKI_TOKEN}` },
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json({ online: false, error: `Nuki API ${res.status}: ${text}` })
    }

    const data = await res.json()
    const stateId: number = data.state?.state ?? 255

    return Response.json({
      online:           data.state?.batteryCritical !== undefined,
      lock_state:       LOCK_STATE[stateId] ?? `État ${stateId}`,
      battery_critical: data.state?.batteryCritical as boolean ?? false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
