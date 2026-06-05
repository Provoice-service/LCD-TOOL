import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })

  const svc = createServiceClient()

  // Récupérer la réservation avec le logement
  const { data: res, error } = await svc
    .from('reservations')
    .select('id, check_in, guest_page_token, property:properties(access_code_delay_hours)')
    .eq('id', reservation_id)
    .single()

  if (error || !res) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

  // Réutiliser le token existant ou en générer un nouveau
  let token = res.guest_page_token
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36)
  }

  // Calculer access_code_display_from = check_in - delay_hours
  const delayHours = (res.property as unknown as { access_code_delay_hours: number | null } | null)?.access_code_delay_hours ?? 24
  let displayFrom: string | null = null
  if (res.check_in) {
    const d = new Date(res.check_in)
    d.setHours(d.getHours() - delayHours)
    displayFrom = d.toISOString()
  }

  const { error: updateErr } = await svc
    .from('reservations')
    .update({ guest_page_token: token, access_code_display_from: displayFrom })
    .eq('id', reservation_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const url = `${baseUrl}/guest/${token}`

  return NextResponse.json({ token, url })
}
