import { createClient } from '@/lib/supabase/server'
import { SavClient } from '@/components/sav/SavClient'
import type { Incident } from '@/components/sav/types'

export default async function SavPage() {
  const supabase = await createClient()

  const [
    { data: incidents },
    { data: properties },
  ] = await Promise.all([
    supabase
      .from('incidents')
      .select(`
        *,
        property:properties(id, name, city, country),
        reservation:reservations(
          id, check_in, check_out, platform,
          guest:guests(full_name, phone)
        )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('properties')
      .select('id, name, city, country')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <SavClient
      initialIncidents={(incidents ?? []) as unknown as Incident[]}
      properties={properties ?? []}
    />
  )
}
