import { createClient } from '@/lib/supabase/server'
import { AgendaClient } from '@/components/agenda/AgendaClient'
import type { Task, TaskList } from '@/components/agenda/types'

export default async function AgendaPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: lists }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, property:properties(id,name)')
      .not('status', 'in', '("cancelled")')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('task_lists')
      .select('*')
      .order('sort_order', { ascending: true }),
  ])

  return (
    <div className="h-full">
      <AgendaClient
        initialTasks={(tasks ?? []) as unknown as Task[]}
        initialLists={(lists ?? []) as TaskList[]}
      />
    </div>
  )
}
