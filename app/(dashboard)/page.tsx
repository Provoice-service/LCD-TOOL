import { MessageSquare, Calendar, AlertTriangle, Home, ClipboardList, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const today = new Date().toISOString().slice(0, 10)

const DATE_FR = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: unreadMessages },
    { count: todayReservations },
    { count: openIncidents },
    { count: urgentIncidents },
    { count: activeProperties },
    { data: urgentTasks },
    { count: urgentCount },
  ] = await Promise.all([
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabase.from('reservations').select('*', { count: 'exact', head: true })
      .or(`check_in.eq.${today},check_out.eq.${today}`).neq('status', 'cancelled'),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
    supabase.from('incidents').select('*', { count: 'exact', head: true })
      .eq('priority', 'urgente').neq('status', 'resolved'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tasks').select('id, title, due_date, priority, category, property:properties(name)')
      .eq('priority', 'urgent_important').not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false }).limit(5),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('priority', 'urgent_important').not('status', 'in', '("done","cancelled")'),
  ])

  const metrics = [
    { title: 'Messages non lus',     icon: MessageSquare, value: unreadMessages ?? 0,    href: '/inbox'        },
    { title: 'Réservations du jour', icon: Calendar,      value: todayReservations ?? 0, href: '/reservations' },
    {
      title: 'Incidents ouverts',
      icon: AlertTriangle,
      value: openIncidents ?? 0,
      href: '/sav',
      sub: (urgentIncidents ?? 0) > 0 ? `${urgentIncidents} urgent${(urgentIncidents ?? 0) > 1 ? 's' : ''}` : null,
    },
    { title: 'Logements actifs',     icon: Home,          value: activeProperties ?? 0,   href: '/properties'   },
  ]

  return (
    <div className="p-8 space-y-8 max-w-5xl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-heading), Georgia, serif',
            fontSize: 32,
            fontWeight: 500,
            color: '#1A1A1A',
            letterSpacing: '0.01em',
            lineHeight: 1.2,
          }}
        >
          Bonjour, Morad
        </h1>
        <p className="mt-1 text-sm capitalize" style={{ color: '#666666' }}>
          {DATE_FR.format(new Date())}
        </p>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Link key={metric.title} href={metric.href} className="group">
            <div
              className="p-5 rounded-xl transition-all duration-200 cursor-pointer"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E4DC',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: '#666666' }}>
                  {metric.title}
                </p>
                <metric.icon
                  className="h-4 w-4 shrink-0 transition-colors"
                  style={{ color: 'rgba(196,160,68,0.5)' }}
                />
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-heading), Georgia, serif',
                  fontSize: 36,
                  fontWeight: 500,
                  color: '#C4A044',
                  lineHeight: 1,
                }}
              >
                {metric.value}
              </p>
              {'sub' in metric && metric.sub && (
                <p className="text-xs font-semibold mt-1.5" style={{ color: '#C0392B' }}>
                  {metric.sub}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ── Tâches urgentes ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #E8E4DC' }}
        >
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4" style={{ color: '#C4A044' }} />
            <span
              style={{
                fontFamily: 'var(--font-heading), Georgia, serif',
                fontSize: 15,
                fontWeight: 500,
                color: '#1A1A1A',
                letterSpacing: '0.01em',
              }}
            >
              Tâches urgentes & importantes
            </span>
            {(urgentCount ?? 0) > 0 && (
              <span
                className="text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none"
                style={{ background: 'rgba(192,57,43,0.10)', color: '#C0392B', border: '1px solid rgba(192,57,43,0.25)' }}
              >
                {urgentCount}
              </span>
            )}
          </div>
          <Link
            href="/agenda"
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: '#999999' }}
          >
            Voir tout <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {!urgentTasks || urgentTasks.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#999999' }}>
              Aucune tâche urgente. Beau travail !
            </p>
          ) : (
            <ul className="space-y-2.5">
              {urgentTasks.map((task: any) => (
                <li key={task.id} className="flex items-center gap-3 text-sm">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: '#C0392B' }}
                  />
                  <span className="flex-1 truncate" style={{ color: '#1A1A1A' }}>
                    {task.title}
                  </span>
                  {task.property?.name && (
                    <span className="text-xs truncate max-w-[100px]" style={{ color: '#999999' }}>
                      {task.property.name}
                    </span>
                  )}
                  {task.due_date && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: task.due_date < today ? '#C0392B' : '#999999' }}
                    >
                      {task.due_date < today ? 'En retard' : task.due_date === today ? "Aujourd'hui" : task.due_date}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
