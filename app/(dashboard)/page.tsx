import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Calendar, AlertTriangle, Home, ClipboardList, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const today = new Date().toISOString().slice(0, 10)

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: unreadMessages },
    { count: todayReservations },
    { count: openIncidents },
    { count: activeProperties },
    { data: urgentTasks },
    { count: urgentCount },
  ] = await Promise.all([
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabase.from('reservations').select('*', { count: 'exact', head: true })
      .or(`check_in.eq.${today},check_out.eq.${today}`).neq('status', 'cancelled'),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tasks').select('id, title, due_date, priority, category, property:properties(name)')
      .eq('priority', 'urgent_important').not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false }).limit(5),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('priority', 'urgent_important').not('status', 'in', '("done","cancelled")'),
  ])

  const metrics = [
    { title: 'Messages non lus',     icon: MessageSquare, value: unreadMessages ?? 0,    href: '/inbox'         },
    { title: 'Réservations du jour', icon: Calendar,      value: todayReservations ?? 0, href: '/reservations'  },
    { title: 'Incidents ouverts',    icon: AlertTriangle, value: openIncidents ?? 0,      href: '/incidents'     },
    { title: 'Logements actifs',     icon: Home,          value: activeProperties ?? 0,   href: '/properties'    },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Link key={metric.title} href={metric.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metric.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Tasks Widget */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Tâches urgentes & importantes</CardTitle>
            {(urgentCount ?? 0) > 0 && (
              <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">
                {urgentCount}
              </span>
            )}
          </div>
          <Link href="/agenda" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Voir tout <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {!urgentTasks || urgentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aucune tâche urgente. Beau travail !</p>
          ) : (
            <ul className="space-y-2">
              {urgentTasks.map((task: any) => (
                <li key={task.id} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="flex-1 truncate">{task.title}</span>
                  {task.property?.name && (
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{task.property.name}</span>
                  )}
                  {task.due_date && (
                    <span className={`text-xs font-medium ${task.due_date < today ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {task.due_date < today ? 'En retard' : task.due_date === today ? "Aujourd'hui" : task.due_date}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
