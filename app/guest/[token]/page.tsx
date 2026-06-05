import { createServiceClient } from '@/lib/supabase/service'
import { GuestPageClient } from './GuestPageClient'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function GuestPage({ params }: Props) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select(`
      id, check_in, check_out, platform, status, total_amount, num_guests,
      access_code, access_code_display_from,
      contract_url, contract_signed,
      id_received, id_document_url, id_document_uploaded_at,
      extras_requested, guest_page_language, guest_page_token,
      guest:guests(id, full_name, phone, email, language),
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
        check_in_time, check_out_time, inventory_notes,
        syndic_required,
        google_maps_url, airbnb_review_url, booking_review_url, google_review_url,
        access_code_delay_hours
      )
    `)
    .eq('guest_page_token', token)
    .single()

  if (!res) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#F8F7F5' }}>
        <Image src="/logo-alma-keys.png" alt="Alma Keys" width={140} height={42} className="mb-8 h-10 w-auto" />
        <div className="text-center px-6">
          <p className="text-2xl font-light mb-2" style={{ fontFamily: 'var(--font-heading), serif', color: '#1A1A1A' }}>
            Lien invalide ou expiré
          </p>
          <p className="text-sm" style={{ color: '#999999' }}>
            Ce lien n'existe pas ou a été révoqué. Contactez votre gestionnaire.
          </p>
        </div>
      </div>
    )
  }

  // Marquer la page comme vue
  await svc.from('reservations')
    .update({ guest_page_viewed_at: new Date().toISOString() })
    .eq('guest_page_token', token)
    .is('guest_page_viewed_at', null)

  // Charger les upsells du logement
  const property = (Array.isArray(res.property) ? res.property[0] : res.property) as { id: string } | null
  const { data: upsells } = property?.id
    ? await svc.from('upsells').select('*').eq('property_id', property.id).eq('is_active', true).order('sort_order')
    : { data: [] }

  // Charger les messages
  const { data: messages } = await svc
    .from('guest_messages')
    .select('id, direction, body, read_at, created_at')
    .eq('reservation_id', res.id)
    .order('created_at', { ascending: true })

  return (
    <GuestPageClient
      token={token}
      reservation={res as unknown as Parameters<typeof GuestPageClient>[0]['reservation']}
      upsells={(upsells ?? []) as Parameters<typeof GuestPageClient>[0]['upsells']}
      initialMessages={(messages ?? []) as Parameters<typeof GuestPageClient>[0]['initialMessages']}
    />
  )
}
