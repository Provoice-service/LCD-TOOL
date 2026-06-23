import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegistreClient, type RegistreRow } from '@/components/registre/RegistreClient'

export default async function RegistrePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id, check_in, check_out, platform, nb_adults,
      identity_documents, onboarding_completed_at,
      guest:guests(full_name, email),
      property:properties(name, city)
    `)
    .order('check_in', { ascending: false })

  if (error) console.error('[Registre]', error.message)

  return <RegistreClient rows={(data ?? []) as unknown as RegistreRow[]} />
}
