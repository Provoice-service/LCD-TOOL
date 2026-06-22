import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select('id, guest_id, guest:guests(full_name, email), property:properties(name)')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  await svc.from('reservations').update({
    onboarding_completed_at: new Date().toISOString(),
    onboarding_step: 4,
  }).eq('id', res.id)

  // Notification inbox
  void svc.from('messages').insert({
    reservation_id: res.id,
    channel: 'guest_page',
    direction: 'inbound',
    body: `✅ Dossier voyageur complété`,
    sender_name: (res.guest as unknown as { full_name: string } | null)?.full_name ?? 'Voyageur',
    is_read: false,
  })

  // Message de bienvenue dans guest_messages
  const propertyName = (res.property as unknown as { name: string } | null)?.name ?? 'votre logement'
  void svc.from('guest_messages').insert({
    reservation_id: res.id,
    direction: 'host',
    body: `🎉 Merci ! Votre dossier est complet. Nous vous enverrons vos instructions d'accès à ${propertyName} la veille de votre arrivée.`,
  })

  return NextResponse.json({ ok: true })
}
