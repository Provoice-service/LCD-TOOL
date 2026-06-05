import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select('id, extras_requested, property:properties(concierge_phone, name)')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const { extra_id, name, quantity, note } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const existing = (res.extras_requested as object[] | null) ?? []
  const newEntry = { extra_id, name, quantity: quantity ?? 1, note: note ?? '', requested_at: new Date().toISOString() }
  const updated = [...existing, newEntry]

  await svc.from('reservations').update({ extras_requested: updated }).eq('id', res.id)

  // Message automatique dans guest_messages
  await svc.from('guest_messages').insert({
    reservation_id: res.id,
    direction: 'host',
    body: `✓ Votre demande "${name}" (x${quantity ?? 1}) a bien été reçue. Nous vous confirmons sous peu.`,
  })

  // Notification dans inbox
  const property = res.property as unknown as { concierge_phone: string | null; name: string } | null
  void svc.from('messages').insert({
    reservation_id: res.id,
    channel: 'guest_page',
    direction: 'inbound',
    body: `[Extra demandé] ${name} x${quantity ?? 1}${note ? ` — Note: ${note}` : ''}`,
    sender_name: 'Voyageur',
    is_read: false,
  })

  // WhatsApp au concierge si configuré
  if (property?.concierge_phone) {
    const wa = `https://wa.me/${property.concierge_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`🏠 ${property.name} — Demande extra : ${name} x${quantity ?? 1}${note ? ` (${note})` : ''}`)}`
    // En production, envoyer via Twilio/WhatsApp API. Pour l'instant on log.
    console.log('[Guest Extras] WhatsApp notif:', wa)
  }

  return NextResponse.json({ ok: true })
}
