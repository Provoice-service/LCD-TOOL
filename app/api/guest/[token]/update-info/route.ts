import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select('id, guest_id')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const body = await req.json() as {
    full_name?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    country_residence?: string
    arrival_time?: string
    num_guests?: number
    nb_adults?: number
    step?: number
  }

  // Mise à jour guests
  const guestUpdate: Record<string, unknown> = {}
  if (body.full_name     !== undefined) guestUpdate.full_name          = body.full_name
  if (body.email         !== undefined) guestUpdate.email              = body.email
  if (body.phone         !== undefined) guestUpdate.phone              = body.phone
  if (body.address       !== undefined) guestUpdate.address            = body.address
  if (body.city          !== undefined) guestUpdate.city               = body.city
  if (body.country_residence !== undefined) guestUpdate.country_residence = body.country_residence

  if (Object.keys(guestUpdate).length > 0 && res.guest_id) {
    await svc.from('guests').update(guestUpdate).eq('id', res.guest_id)
  }

  // Mise à jour reservations
  const resUpdate: Record<string, unknown> = {}
  if (body.arrival_time !== undefined) resUpdate.arrival_time = body.arrival_time
  if (body.num_guests   !== undefined) resUpdate.num_guests   = body.num_guests
  if (body.nb_adults    !== undefined) resUpdate.nb_adults    = body.nb_adults
  if (body.step         !== undefined) resUpdate.onboarding_step = body.step

  if (Object.keys(resUpdate).length > 0) {
    await svc.from('reservations').update(resUpdate).eq('id', res.id)
  }

  return NextResponse.json({ ok: true })
}
