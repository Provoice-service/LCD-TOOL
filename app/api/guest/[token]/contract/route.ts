import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildVars, personalize } from '@/lib/contract/personalize'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select(`
      id, platform, total_amount, num_guests, check_in, check_out,
      contract_signed, contract_pdf_url, contract_signed_at,
      guest:guests(full_name),
      property:properties(name, address, check_in_time, check_out_time, deposit_amount, country)
    `)
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const guest    = res.guest as unknown as { full_name: string } | null
  const property = res.property as unknown as { name: string; address: string | null; check_in_time: string | null; check_out_time: string | null; deposit_amount: number | null; country: string | null } | null

  const { data: template } = await svc
    .from('contract_templates')
    .select('id, content_fr, content_en')
    .eq('is_active', true)
    .eq('country', property?.country ?? 'MA')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!template) return NextResponse.json({ error: 'No template' }, { status: 404 })

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

  return NextResponse.json({
    content_fr: personalize(template.content_fr, vars),
    content_en: template.content_en ? personalize(template.content_en, vars) : null,
    vars,
    reservation: {
      id: res.id,
      contract_signed: res.contract_signed,
      contract_pdf_url: res.contract_pdf_url,
      contract_signed_at: res.contract_signed_at,
      platform: res.platform,
    },
  })
}
