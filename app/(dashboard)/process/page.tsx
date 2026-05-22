import { createClient } from '@/lib/supabase/server'
import { ProcessLibraryClient, type ProcessRow, type PropertyOption } from '@/components/process/ProcessLibraryClient'

export default async function ProcessPage() {
  const supabase = await createClient()

  const [{ data: processes, error }, { data: properties }] = await Promise.all([
    supabase
      .from('process_library')
      .select('*')
      .order('number', { ascending: true }),
    supabase
      .from('properties')
      .select('id, name, city, country, access_type, key_box_code, key_box_location, address, floor_info, concierge_phone, backup_phone, check_in_time, check_out_time, syndic_required, syndic_phone, syndic_name, syndic_whatsapp_message, syndic_requires_contract, cleaning_provider_contact, cleaning_specific_instructions, cleaning_duration_hours, wifi_name, wifi_pass, tuya_device_id, access_instructions_full')
      .eq('is_active', true)
      .order('name'),
  ])

  if (error) console.error('[Process] Erreur chargement:', error.message)

  return (
    <div className="h-full">
      <ProcessLibraryClient
        initialProcesses={(processes ?? []) as ProcessRow[]}
        properties={(properties ?? []) as PropertyOption[]}
      />
    </div>
  )
}
