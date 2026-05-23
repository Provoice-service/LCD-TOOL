import { createClient } from '@/lib/supabase/server'
import { ContactsClient } from '@/components/contacts/ContactsClient'
import type { Provider } from '@/components/contacts/types'

export default async function ContactsPage() {
  const supabase = await createClient()

  const [{ data: providers }, { data: properties }] = await Promise.all([
    supabase.from('providers').select('*').eq('is_active', true).order('name'),
    supabase.from('properties').select('id, name').eq('is_active', true).order('name'),
  ])

  return (
    <ContactsClient
      initialProviders={(providers ?? []) as Provider[]}
      properties={properties ?? []}
    />
  )
}
