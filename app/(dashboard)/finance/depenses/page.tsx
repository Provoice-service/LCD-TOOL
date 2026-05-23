import { createClient } from '@/lib/supabase/server'
import { DepensesClient } from '@/components/finance/DepensesClient'

export default async function DepensesPage() {
  const supabase = await createClient()

  const [{ data: expenses }, { data: properties }, { data: owners }, { data: providers }] = await Promise.all([
    supabase
      .from('expenses')
      .select(`
        *,
        property:properties(id, name, city, country),
        owner:owners(id, full_name),
        provider:providers(id, name, phone)
      `)
      .order('expense_date', { ascending: false })
      .limit(200),
    supabase.from('properties').select('id, name, city, country').eq('is_active', true).order('name'),
    supabase.from('owners').select('id, full_name').order('full_name'),
    supabase.from('providers').select('id, name, phone').eq('is_active', true).order('name'),
  ])

  return (
    <DepensesClient
      initialExpenses={expenses ?? []}
      properties={properties ?? []}
      owners={owners ?? []}
      providers={providers ?? []}
    />
  )
}
