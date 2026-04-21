'use client'

import { useState } from 'react'
import type { Task } from '@/components/agenda/types'
import { QUADRANTS } from '@/components/agenda/types'
import { QuickAdd } from '@/components/agenda/QuickAdd'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isToday, format, addMonths, subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'

interface ViewCalendarProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onAdd: (partial: Partial<Task>) => Promise<void>
}

export function ViewCalendar({ tasks, onTaskClick, onAdd }: ViewCalendarProps) {
  const [current, setCurrent]   = useState(new Date())
  const [selected, setSelected] = useState<Date | null>(null)

  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')

  function tasksForDay(day: Date) {
    const dStr = day.toISOString().slice(0, 10)
    return active.filter(t => t.due_date === dStr)
  }

  const selectedDayTasks = selected ? tasksForDay(selected) : []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <button onClick={() => setCurrent(d => subMonths(d, 1))} className="p-1.5 hover:bg-muted/50 rounded-md">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold capitalize">
          {format(current, 'MMMM yyyy', { locale: fr })}
        </h2>
        <button onClick={() => setCurrent(d => addMonths(d, 1))} className="p-1.5 hover:bg-muted/50 rounded-md">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 flex-1">
          {days.map(day => {
            const dt    = tasksForDay(day)
            const today = isToday(day)
            const cur   = isSameMonth(day, current)
            const sel   = selected && isSameDay(day, selected)

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelected(isSameDay(day, selected ?? new Date('')) ? null : day)}
                className={`min-h-20 p-1.5 border-b border-r cursor-pointer transition-colors ${
                  !cur ? 'bg-muted/10 text-muted-foreground/50' : ''
                } ${sel ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${
                  today ? 'bg-primary text-primary-foreground' : ''
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dt.slice(0, 3).map(t => {
                    const q = QUADRANTS[t.priority]
                    return (
                      <div
                        key={t.id}
                        onClick={e => { e.stopPropagation(); onTaskClick(t) }}
                        className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${q.bg} ${q.color}`}
                      >
                        {t.title}
                      </div>
                    )
                  })}
                  {dt.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">+{dt.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selected && (
        <div className="border-t bg-background p-4 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold capitalize">
              {format(selected, 'EEEE dd MMMM', { locale: fr })}
            </h3>
          </div>
          {selectedDayTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">Aucune tâche ce jour.</p>
          ) : (
            <div className="space-y-1 mb-3">
              {selectedDayTasks.map(t => (
                <div key={t.id} onClick={() => onTaskClick(t)}
                  className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50 cursor-pointer">
                  <div className={`w-2 h-2 rounded-full ${QUADRANTS[t.priority].dot}`} />
                  {t.title}
                  {t.due_time && <span className="text-xs text-muted-foreground ml-auto">{t.due_time.slice(0,5)}</span>}
                </div>
              ))}
            </div>
          )}
          <QuickAdd
            defaultDate={selected.toISOString().slice(0, 10)}
            placeholder={`+ Ajouter le ${format(selected, 'dd/MM')}…`}
            onAdd={partial => onAdd({ ...partial, due_date: selected.toISOString().slice(0, 10) })}
          />
        </div>
      )}
    </div>
  )
}
