import { createClient } from '@/lib/supabase/server'
import { InboxClient, type MessageWithContext } from '@/components/inbox/InboxClient'

export default async function InboxPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, body, channel, direction, status, priority, created_at, reservation_id,
      reservation:reservations(
        id, check_in, check_out, platform,
        contract_signed, id_received, deposit_ok, access_code_sent,
        guest:guests(id, full_name, phone),
        property:properties(id, name, city)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Inbox] Erreur chargement messages:', error.message)
  }

  return (
    <div className="h-full">
      <InboxClient initialMessages={(data ?? []) as unknown as MessageWithContext[]} />
    </div>
  )
}
