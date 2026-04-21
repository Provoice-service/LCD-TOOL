'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskList } from '@/components/agenda/types'
import { ViewToday } from '@/components/agenda/ViewToday'
import { ViewEisenhower } from '@/components/agenda/ViewEisenhower'
import { ViewAllTasks } from '@/components/agenda/ViewAllTasks'
import { ViewCalendar } from '@/components/agenda/ViewCalendar'
import { ViewLists } from '@/components/agenda/ViewLists'
import { TaskDetail } from '@/components/agenda/TaskDetail'
import { Button } from '@/components/ui/button'
import { Plus, Clock, Grid2x2, List, Calendar, FolderOpen, X } from 'lucide-react'

type ViewKey = 'today' | 'eisenhower' | 'all' | 'calendar' | 'lists'

interface AgendaClientProps {
  initialTasks: Task[]
  initialLists: TaskList[]
}

const VIEWS: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: 'today',      label: "Aujourd'hui", icon: Clock      },
  { key: 'eisenhower', label: 'Matrice',      icon: Grid2x2    },
  { key: 'all',        label: 'Toutes',       icon: List       },
  { key: 'calendar',   label: 'Calendrier',   icon: Calendar   },
  { key: 'lists',      label: 'Listes',       icon: FolderOpen },
]

export function AgendaClient({ initialTasks, initialLists }: AgendaClientProps) {
  const [tasks, setTasks]           = useState<Task[]>(initialTasks)
  const [lists]                     = useState<TaskList[]>(initialLists)
  const [view, setView]             = useState<ViewKey>('today')
  const [selected, setSelected]     = useState<Task | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') { setSelected(null); return }
      if (e.key === 'n' || e.key === 'N') { setShowNewTask(true); return }
      if (e.key === ' ' && selected) {
        e.preventDefault()
        toggleTask(selected.id, selected.status !== 'done')
        return
      }
      if (selected && ['1','2','3','4'].includes(e.key)) {
        const priorities = ['urgent_important','important','urgent','neither'] as const
        updateTask(selected.id, { priority: priorities[parseInt(e.key)-1] })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected])

  // ── CRUD helpers ────────────────────────────────────────────────────────────

  async function addTask(partial: Partial<Task>): Promise<void> {
    const supabase = createClient()
    const { data } = await supabase
      .from('tasks')
      .insert({ title: partial.title ?? 'Nouvelle tâche', ...partial, status: 'todo' })
      .select('*, property:properties(id,name)')
      .single()
    if (data) setTasks(ts => [data as Task, ...ts])
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    const supabase = createClient()
    await supabase.from('tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t))
    if (selected?.id === id) setSelected(s => s ? { ...s, ...patch } : null)
  }

  async function toggleTask(id: string, done: boolean) {
    await updateTask(id, {
      status: done ? 'done' : 'todo',
      completed_at: done ? new Date().toISOString() : null,
    })
  }

  function handleTaskUpdated(updated: Task) {
    setTasks(ts => ts.map(t => t.id === updated.id ? updated : t))
    setSelected(updated)
  }

  function handleTaskDeleted(id: string) {
    setTasks(ts => ts.filter(t => t.id !== id))
    setSelected(null)
  }

  // ── Quick new task modal ────────────────────────────────────────────────────
  const NewTaskModal = showNewTask ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/30"
      onClick={() => setShowNewTask(false)}>
      <div className="bg-background rounded-xl shadow-xl border w-full max-w-lg mx-4 p-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Nouvelle tâche rapide</span>
          <button onClick={() => setShowNewTask(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ViewToday
          tasks={[]}
          onTaskClick={() => {}}
          onToggle={() => {}}
          onAdd={async (p) => { await addTask(p); setShowNewTask(false) }}
        />
      </div>
    </div>
  ) : null

  const urgentCount = tasks.filter(t =>
    t.priority === 'urgent_important' && t.status !== 'done' && t.status !== 'cancelled'
  ).length

  return (
    <div className="h-full flex flex-col">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <div className="border-b bg-background/95 sticky top-0 z-10 flex items-center gap-1 px-3 py-2">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setView(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            {key === 'today' && urgentCount > 0 && (
              <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-semibold leading-none">
                {urgentCount}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:block text-xs text-muted-foreground border rounded-md px-2 py-1">
            N = nouvelle · 1-4 = priorité · Espace = terminé
          </span>
          <Button size="sm" onClick={() => setShowNewTask(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Tâche
          </Button>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">
        <div className={`flex-1 overflow-hidden flex flex-col transition-all ${selected ? 'lg:flex-[3]' : ''}`}>
          {view === 'today' && (
            <ViewToday tasks={tasks} onTaskClick={setSelected} onToggle={toggleTask} onAdd={addTask} />
          )}
          {view === 'eisenhower' && (
            <ViewEisenhower
              tasks={tasks}
              onTaskClick={setSelected}
              onToggle={toggleTask}
              onTasksUpdated={setTasks}
              onAdd={addTask}
            />
          )}
          {view === 'all' && (
            <ViewAllTasks
              tasks={tasks}
              lists={lists}
              onTaskClick={setSelected}
              onToggle={toggleTask}
              onTasksUpdated={setTasks}
            />
          )}
          {view === 'calendar' && (
            <ViewCalendar tasks={tasks} onTaskClick={setSelected} onAdd={addTask} />
          )}
          {view === 'lists' && (
            <ViewLists tasks={tasks} lists={lists} onTaskClick={setSelected} onToggle={toggleTask} onAdd={addTask} />
          )}
        </div>

        {/* ── Detail panel ─────────────────────────────────────────────── */}
        {selected && (
          <div className="w-80 lg:w-96 border-l flex-shrink-0 overflow-hidden">
            <TaskDetail
              task={selected}
              lists={lists}
              onClose={() => setSelected(null)}
              onUpdated={handleTaskUpdated}
              onDeleted={handleTaskDeleted}
            />
          </div>
        )}
      </div>

      {NewTaskModal}
    </div>
  )
}
