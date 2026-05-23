import { createClient } from '@/lib/supabase/server'
import { ProprietairesClient } from '@/components/proprietaires/ProprietairesClient'

export default async function ProprietairesPage() {
  const supabase = await createClient()

  const { data: owners } = await supabase
    .from('owners')
    .select(`
      *,
      properties:properties(id, name, city, country, is_active)
    `)
    .order('full_name')

  return <ProprietairesClient initialOwners={owners ?? []} />
}
