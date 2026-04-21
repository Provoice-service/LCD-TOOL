import { createClient } from '@/lib/supabase/server'
import { CrmClient } from '@/components/crm/CrmClient'
import type { CrmLead, CrmMarket } from '@/components/crm/types'

export default async function CrmPage() {
  const supabase = await createClient()

  const [{ data: leads }, { data: markets }] = await Promise.all([
    supabase
      .from('crm_leads')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('crm_markets')
      .select('*')
      .order('status', { ascending: true }),
  ])

  return (
    <div className="h-full">
      <CrmClient
        initialLeads={(leads ?? []) as CrmLead[]}
        initialMarkets={(markets ?? []) as CrmMarket[]}
      />
    </div>
  )
}
