import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select(`
      id, check_in, check_out, platform, status, total_amount,
      num_guests, nb_adults, arrival_time,
      access_code, access_code_display_from,
      contract_url, contract_signed,
      id_received, id_document_url, identity_documents,
      extras_requested, guest_page_language, guest_page_token,
      onboarding_completed_at, onboarding_step,
      guest:guests(id, full_name, phone, email, language, address, city, country_residence),
      property:properties(
        id, name, address, city, country,
        wifi_name, wifi_pass,
        house_rules, noise_rules, smoking_rules, pet_rules,
        access_instructions_full, key_box_code, key_box_location, floor_info,
        parking_info, elevator_info, trash_info,
        nearby_info, bakery_nearby, local_events,
        emergency_procedure, emergency_contacts, local_police_number,
        concierge_phone, backup_phone,
        appliances_info, heating_info, tv_instructions, ac_instructions, cleaning_products_location,
        check_in_time, check_out_time, inventory_notes, syndic_required,
        google_maps_url, airbnb_review_url, booking_review_url, google_review_url,
        access_code_delay_hours
      )
    `)
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const property = (Array.isArray(res.property) ? res.property[0] : res.property) as { id: string } | null
  const { data: upsells } = property?.id
    ? await svc.from('upsells').select('id, name, description, price, currency, icon, category').eq('property_id', property.id).eq('is_active', true).order('sort_order')
    : { data: [] }

  return NextResponse.json({ reservation: res, upsells: upsells ?? [] })
}
