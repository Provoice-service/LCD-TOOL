import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TemplatesClient from './TemplatesClient'

interface Template {
  id: string
  name: string
  country: string
  is_active: boolean
  created_at: string
  content_fr: string
  content_en: string | null
}

export default async function ContractTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: templates } = await supabase
    .from('contract_templates')
    .select('id, name, country, is_active, created_at, content_fr, content_en')
    .order('created_at', { ascending: false })

  return <TemplatesClient initialTemplates={(templates ?? []) as Template[]} />
}
