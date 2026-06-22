import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildVars, personalize } from '@/lib/contract/personalize'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })

  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select(`
      id, platform, total_amount, num_guests, check_in, check_out,
      guest:guests(full_name),
      property:properties(name, address, check_in_time, check_out_time, deposit_amount, country)
    `)
    .eq('id', reservation_id)
    .single()

  if (!res) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

  const guest    = res.guest as unknown as { full_name: string } | null
  const property = res.property as unknown as { name: string; address: string | null; check_in_time: string | null; check_out_time: string | null; deposit_amount: number | null; country: string | null } | null

  // Récupérer le template actif pour le pays
  const { data: template } = await svc
    .from('contract_templates')
    .select('id, content_fr, content_en')
    .eq('is_active', true)
    .eq('country', property?.country ?? 'MA')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!template) return NextResponse.json({ error: 'No active template found' }, { status: 404 })

  const vars = buildVars({
    guestName:       guest?.full_name ?? 'Voyageur',
    propertyName:    property?.name ?? '—',
    propertyAddress: property?.address ?? null,
    checkIn:         res.check_in,
    checkOut:        res.check_out,
    checkInTime:     property?.check_in_time ?? null,
    checkOutTime:    property?.check_out_time ?? null,
    numGuests:       res.num_guests,
    depositAmount:   property?.deposit_amount ?? null,
    totalAmount:     res.total_amount,
    platform:        res.platform,
  })

  const content_fr = personalize(template.content_fr, vars)
  const content_en = template.content_en ? personalize(template.content_en, vars) : null

  await svc.from('reservations').update({
    contract_generated_at: new Date().toISOString(),
    contract_template_id: template.id,
  }).eq('id', reservation_id)

  return NextResponse.json({ content_fr, content_en, vars })
}
