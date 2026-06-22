import { createServiceClient } from '@/lib/supabase/service'
import { GuestPageClient, type Reservation, type Upsell, type GuestMessage } from './GuestPageClient'
import OnboardingWizard, { type WizardReservation, type WizardGuest, type WizardProperty, type WizardUpsell } from './OnboardingWizard'
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
      id, check_in, check_out, platform, status, total_amount,
      num_guests, nb_adults, arrival_time,
      access_code, access_code_display_from,
      contract_url, contract_signed,
      id_received, id_document_url, id_document_uploaded_at, identity_documents,
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

  // Marquer vu
  await svc.from('reservations')
    .update({ guest_page_viewed_at: new Date().toISOString() })
    .eq('guest_page_token', token)
    .is('guest_page_viewed_at', null)

  const property = (Array.isArray(res.property) ? res.property[0] : res.property) as WizardProperty | null
  const guest    = (Array.isArray(res.guest)    ? res.guest[0]    : res.guest)    as WizardGuest    | null

  const { data: upsells } = property?.id
    ? await svc.from('upsells').select('id, name, description, price, currency, icon, category').eq('property_id', property.id).eq('is_active', true).order('sort_order')
    : { data: [] }

  // ── Wizard onboarding si pas encore complété ───────────────────────────────
  if (!res.onboarding_completed_at) {
    const wizardRes: WizardReservation = {
      id:              res.id,
      check_in:        res.check_in,
      check_out:       res.check_out,
      platform:        res.platform,
      num_guests:      res.num_guests,
      nb_adults:       (res as unknown as { nb_adults: number | null }).nb_adults ?? 1,
      arrival_time:    (res as unknown as { arrival_time: string | null }).arrival_time ?? null,
      contract_signed: res.contract_signed,
      onboarding_step: (res as unknown as { onboarding_step: number }).onboarding_step ?? 0,
      identity_documents: (res as unknown as { identity_documents: object[] | null }).identity_documents ?? [],
    }
    return (
      <OnboardingWizard
        token={token}
        reservation={wizardRes}
        guest={guest}
        property={property}
        upsells={(upsells ?? []) as WizardUpsell[]}
      />
    )
  }

  // ── Guide complet (onboarding terminé) ────────────────────────────────────
  const { data: messages } = await svc
    .from('guest_messages')
    .select('id, direction, body, read_at, created_at')
    .eq('reservation_id', res.id)
    .order('created_at', { ascending: true })

  return (
    <GuestPageClient
      token={token}
      reservation={res as unknown as Reservation}
      upsells={(upsells ?? []) as Upsell[]}
      initialMessages={(messages ?? []) as GuestMessage[]}
    />
  )
}
