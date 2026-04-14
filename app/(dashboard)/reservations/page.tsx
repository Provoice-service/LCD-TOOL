import { createClient } from '@/lib/supabase/server'
import { ReservationsClient, type ReservationRow } from '@/components/reservations/ReservationsClient'

export default async function ReservationsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id, check_in, check_out, platform, status, total_amount,
      contract_signed, id_received, deposit_ok, access_code_sent,
      access_code, access_type_override,
      guest:guests(id, full_name, phone, language),
      property:properties(id, name, city, access_type, tuya_device_id, wifi_name, wifi_pass, house_rules)
    `)
    .order('check_in', { ascending: true })

  if (error) {
    console.error('[Reservations] Erreur chargement:', error.message)
  }

  return (
    <div className="h-full">
      <ReservationsClient initialReservations={(data ?? []) as unknown as ReservationRow[]} />
    </div>
  )
}
