'use client'

import { useState, useMemo } from 'react'
import type { Task, TaskList } from '@/components/agenda/types'
import { TaskCard } from '@/components/agenda/TaskCard'
import { QuickAdd } from '@/components/agenda/QuickAdd'
import { Inbox, Calendar, Star, Clock, List, CheckCircle2 } from 'lucide-react'
import { isToday, isThisWeek } from 'date-fns'

interface ViewListsProps {
  tasks: Task[]
  lists: TaskList[]
  onTaskClick: (task: Task) => void
  onToggle: (id: string, done: boolean) => void
  onAdd: (partial: Partial<Task>) => Promise<void>
}

type SystemList = 'inbox' | 'today' | 'week' | 'important'

export function ViewLists({ tasks, lists, onTaskClick, onToggle, onAdd }: ViewListsProps) {
  const [activeSystemList, setASL] = useState<SystemList>('today')
  const [activeCustomList, setACL] = useState<string | null>(null)

  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')

  const systemCounts: Record<SystemList, number> = useMemo(() => ({
    inbox:     active.filter(t => !t.task_list_id).length,
    today:     active.filter(t => t.due_date && isToday(new Date(t.due_date))).length,
    week:      active.filter(t => t.due_date && isThisWeek(new Date(t.due_date), { weekStartsOn: 1 })).length,
    important: active.filter(t => t.priority === 'urgent_important' || t.priority === 'important').length,
  }), [active])

  const customCounts = useMemo(() =>
    Object.fromEntries(lists.map(l => [l.id, active.filter(t => t.task_list_id === l.id).length])),
    [active, lists]
  )

  const visibleTasks = useMemo(() => {
    if (activeCustomList) return active.filter(t => t.task_list_id === activeCustomList)
    switch (activeSystemList) {
      case 'inbox':     return active.filter(t => !t.task_list_id)
      case 'today':     return active.filter(t => t.due_date && isToday(new Date(t.due_date)))
      case 'week':      return active.filter(t => t.due_date && isThisWeek(new Date(t.due_date), { weekStartsOn: 1 }))
      case 'important': return active.filter(t => t.priority === 'urgent_important' || t.priority === 'important')
    }
  }, [active, activeSystemList, activeCustomList])

  function selectSystem(key: SystemList) { setASL(key); setACL(null) }
  function selectCustom(id: string) { setACL(id); }

  const activeList = activeCustomList ? lists.find(l => l.id === activeCustomList) : null
  const listTitle  = activeList ? activeList.name : {
    inbox: 'Boîte de réception', today: 'Aujourd\'hui', week: 'Cette semaine', important: 'Important',
  }[activeSystemList]

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar listes */}
      <div className="w-52 shrink-0 border-r bg-muted/10 flex flex-col overflow-y-auto">
        <div className="p-2 space-y-0.5">
          <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Système</p>
          {([
            { key: 'inbox' as SystemList,     label: 'Boîte de réception', icon: Inbox,       count: systemCounts.inbox     },
            { key: 'today' as SystemList,     label: 'Aujourd\'hui',       icon: Calendar,    count: systemCounts.today     },
            { key: 'week' as SystemList,      label: 'Cette semaine',      icon: Clock,       count: systemCounts.week      },
            { key: 'important' as SystemList, label: 'Important',          icon: Star,        count: systemCounts.important },
          ]).map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => selectSystem(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                !activeCustomList && activeSystemList === key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">{label}</span>
              {count > 0 && <span className="text-xs bg-muted rounded-full px-1.5 py-0.5">{count}</span>}
            </button>
          ))}
        </div>

        <div className="p-2 space-y-0.5 flex-1">
          <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mes listes</p>
          {lists.map(list => (
            <button key={list.id} onClick={() => selectCustom(list.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                activeCustomList === list.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
              <span className="flex-1 text-left truncate">{list.name}</span>
              {customCounts[list.id] > 0 && (
                <span className="text-xs bg-muted rounded-full px-1.5 py-0.5">{customCounts[list.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu liste */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {activeList && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeList.color }} />}
            <h2 className="font-semibold">{listTitle}</h2>
            <span className="text-sm text-muted-foreground">{visibleTasks.length} tâches</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleTasks.map(t => (
            <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} onToggle={onToggle} />
          ))}
          {visibleTasks.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              Aucune tâche dans cette liste.
            </div>
          )}
        </div>

        <div className="p-3 border-t">
          <QuickAdd
            defaultCategory={activeCustomList ? undefined : undefined}
            onAdd={partial => onAdd({
              ...partial,
              task_list_id: activeCustomList ?? undefined,
            })}
          />
        </div>
      </div>
    </div>
  )
}
