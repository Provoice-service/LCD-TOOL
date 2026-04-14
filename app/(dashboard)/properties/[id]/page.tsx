import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PropertyFormClient } from '@/components/properties/PropertyFormClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !property) notFound()

  return <PropertyFormClient property={property} />
}
