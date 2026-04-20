import { createClient } from '@/lib/supabase/server'
import { ProcessLibraryClient, type ProcessRow } from '@/components/process/ProcessLibraryClient'

export default async function ProcessPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('process_library')
    .select('*')
    .order('number', { ascending: true })

  if (error) console.error('[Process] Erreur chargement:', error.message)

  return (
    <div className="h-full">
      <ProcessLibraryClient initialProcesses={(data ?? []) as ProcessRow[]} />
    </div>
  )
}
