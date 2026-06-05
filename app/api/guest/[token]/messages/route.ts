import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getReservationByToken(token: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('reservations')
    .select('id, guest:guests(full_name)')
    .eq('guest_page_token', token)
    .single()
  return data
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const res = await getReservationByToken(token)
  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const svc = createServiceClient()
  const { data: messages } = await svc
    .from('guest_messages')
    .select('id, direction, body, read_at, created_at')
    .eq('reservation_id', res.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const res = await getReservationByToken(token)
  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const svc = createServiceClient()

  // Insérer dans guest_messages
  await svc.from('guest_messages').insert({
    reservation_id: res.id,
    direction: 'guest',
    body: body.trim(),
  })

  // Créer notification dans l'inbox LCD Tool
  const guest = res.guest as unknown as { full_name: string } | null
  await svc.from('messages').insert({
    reservation_id: res.id,
    channel: 'guest_page',
    direction: 'inbound',
    body: body.trim(),
    sender_name: guest?.full_name ?? 'Voyageur',
    is_read: false,
  })

  return NextResponse.json({ ok: true })
}
