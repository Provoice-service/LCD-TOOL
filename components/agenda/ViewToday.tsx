'use client'

import { useMemo } from 'react'
import type { Task, TaskList } from '@/components/agenda/types'
import { QUADRANTS, isOverdue, isDueToday } from '@/components/agenda/types'
import { TaskCard } from '@/components/agenda/TaskCard'
import { QuickAdd } from '@/components/agenda/QuickAdd'
import { AlertCircle, Clock, Calendar } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ViewTodayProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onToggle: (id: string, done: boolean) => void
  onAdd: (partial: Partial<Task>) => Promise<void>
}

export function ViewToday({ tasks, onTaskClick, onToggle, onAdd }: ViewTodayProps) {
  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')

  const urgent     = useMemo(() => active.filter(t => t.priority === 'urgent_important'), [active])
  const todayTasks = useMemo(() => active.filter(t => isDueToday(t) && t.priority !== 'urgent_important'), [active])
  const overdue    = useMemo(() => active.filter(t => isOverdue(t) && !isDueToday(t)), [active])

  // Next 5 days
  const upcoming = useMemo(() => {
    const sections: { label: string; date: string; tasks: Task[] }[] = []
    for (let i = 1; i <= 5; i++) {
      const d    = addDays(new Date(), i)
      const dStr = d.toISOString().slice(0, 10)
      const ts   = active.filter(t => t.due_date === dStr)
      if (ts.length > 0) sections.push({ label: format(d, 'EEEE dd MMMM', { locale: fr }), date: dStr, tasks: ts })
    }
    return sections
  }, [active])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-2xl mx-auto w-full">

      {/* Urgent & Important */}
      {urgent.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700">Urgent & Important — Traiter maintenant</h2>
            <span className="ml-auto text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">{urgent.length}</span>
          </div>
          <div className="space-y-1">
            {urgent.map(t => (
              <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} onToggle={onToggle} />
            ))}
          </div>
        </section>
      )}

      {/* Aujourd'hui */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">À faire aujourd&apos;hui</h2>
          {todayTasks.length > 0 && (
            <span className="ml-auto text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{todayTasks.length}</span>
          )}
        </div>
        {todayTasks.length === 0 && urgent.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            Aucune tâche pour aujourd&apos;hui 🎉
          </div>
        ) : (
          <div className="space-y-1">
            {todayTasks.map(t => (
              <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} onToggle={onToggle} />
            ))}
          </div>
        )}
      </section>

      {/* En retard */}
      {overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-600">En retard</h2>
            <span className="ml-auto text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">{overdue.length}</span>
          </div>
          <div className="space-y-1">
            {overdue.map(t => (
              <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} onToggle={onToggle} />
            ))}
          </div>
        </section>
      )}

      {/* À venir */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">À venir cette semaine</h2>
          </div>
          <div className="space-y-3">
            {upcoming.map(s => (
              <div key={s.date}>
                <p className="text-xs font-medium text-muted-foreground mb-1 capitalize">{s.label}</p>
                <div className="space-y-1">
                  {s.tasks.map(t => (
                    <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} onToggle={onToggle} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick add */}
      <div className="sticky bottom-0 pb-2 pt-1 bg-background">
        <QuickAdd
          defaultDate={new Date().toISOString().slice(0, 10)}
          onAdd={onAdd}
        />
      </div>
    </div>
  )
}
