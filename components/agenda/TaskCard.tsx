'use client'

import type { Task } from '@/components/agenda/types'
import { QUADRANTS, CATEGORY_CONFIG, isOverdue } from '@/components/agenda/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, Home, AlertCircle } from 'lucide-react'

interface TaskCardProps {
  task: Task
  onClick: () => void
  onToggle: (id: string, done: boolean) => void
  compact?: boolean
  draggable?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
}

export function TaskCard({
  task, onClick, onToggle, compact = false,
  draggable: isDraggable = false, onDragStart, onDragEnd
}: TaskCardProps) {
  const q       = QUADRANTS[task.priority]
  const cat     = task.category ? CATEGORY_CONFIG[task.category] : null
  const overdue = isOverdue(task)
  const done    = task.status === 'done'

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-all cursor-pointer select-none
        ${done ? 'opacity-50' : ''}
        ${isDraggable ? 'hover:shadow-sm active:opacity-60' : 'hover:bg-muted/30'}
        bg-background`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(task.id, !done) }}
        className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
          ${done ? 'bg-primary border-primary' : `border-current ${q.color} hover:opacity-70`}`}
      >
        {done && (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-primary-foreground fill-current">
            <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${done ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </p>

        {!compact && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {cat && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>
                {cat.label}
              </span>
            )}
            {task.due_date && (
              <span className={`flex items-center gap-0.5 text-xs ${
                overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
              }`}>
                {overdue && <AlertCircle className="h-3 w-3" />}
                <Calendar className="h-3 w-3" />
                {format(new Date(task.due_date), 'dd MMM', { locale: fr })}
                {task.due_time && ` ${task.due_time.slice(0, 5)}`}
              </span>
            )}
            {task.property && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Home className="h-3 w-3" />
                {task.property.name}
              </span>
            )}
            {task.subtasks && task.subtasks.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {task.subtasks.filter(s => s.status === 'done').length}/{task.subtasks.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Priorité dot */}
      <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${q.dot}`} title={q.label} />
    </div>
  )
}
