'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskPriority } from '@/components/agenda/types'
import { QUADRANTS } from '@/components/agenda/types'
import { TaskCard } from '@/components/agenda/TaskCard'
import { QuickAdd } from '@/components/agenda/QuickAdd'

interface ViewEisenhowerProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onToggle: (id: string, done: boolean) => void
  onTasksUpdated: (tasks: Task[]) => void
  onAdd: (partial: Partial<Task>) => Promise<void>
}

const QUADRANT_ORDER: TaskPriority[] = ['urgent_important', 'important', 'urgent', 'neither']

export function ViewEisenhower({ tasks, onTaskClick, onToggle, onTasksUpdated, onAdd }: ViewEisenhowerProps) {
  const [dragId, setDragId]     = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TaskPriority | null>(null)

  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')

  async function handleDrop(priority: TaskPriority) {
    if (!dragId) return
    const task = tasks.find(t => t.id === dragId)
    if (!task || task.priority === priority) { setDragId(null); setDragOver(null); return }
    const supabase = createClient()
    await supabase.from('tasks').update({ priority, updated_at: new Date().toISOString() }).eq('id', dragId)
    onTasksUpdated(tasks.map(t => t.id === dragId ? { ...t, priority } : t))
    setDragId(null)
    setDragOver(null)
  }

  return (
    <div className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-auto">
      {QUADRANT_ORDER.map(priority => {
        const q         = QUADRANTS[priority]
        const qTasks    = active.filter(t => t.priority === priority)
        const isOver    = dragOver === priority

        return (
          <div
            key={priority}
            className={`flex flex-col rounded-xl border-2 transition-all min-h-64 ${q.bg} ${
              isOver ? 'border-primary shadow-md scale-[1.01]' : q.border
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(priority) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(priority)}
          >
            {/* Quadrant header */}
            <div className={`px-3 py-2.5 border-b ${q.border} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${q.dot}`} />
                  <span className={`text-sm font-semibold ${q.color}`}>{q.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{q.sublabel}</p>
              </div>
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${q.bg} ${q.color} border ${q.border}`}>
                {qTasks.length}
              </span>
            </div>

            {/* Tasks */}
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
              {qTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                  onToggle={onToggle}
                  draggable
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null) }}
                />
              ))}
              {qTasks.length === 0 && (
                <div className={`h-12 flex items-center justify-center rounded-lg border border-dashed ${q.border} text-xs text-muted-foreground`}>
                  {isOver ? '⬇ Déposer ici' : 'Vide'}
                </div>
              )}
            </div>

            {/* Quick add per quadrant */}
            <div className="p-2 border-t border-dashed border-current/10">
              <QuickAdd
                defaultPriority={priority}
                placeholder={`+ Ajouter dans "${q.sublabel}"…`}
                onAdd={async (partial) => onAdd({ ...partial, priority })}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
