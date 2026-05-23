// =============================================================================
// Agenda — Types partagés
// =============================================================================

export type TaskPriority = 'urgent_important' | 'important' | 'urgent' | 'neither'
export type TaskStatus   = 'todo' | 'in_progress' | 'done' | 'cancelled' | 'deferred'
export type TaskCategory =
  | 'voyageur' | 'menage' | 'maintenance' | 'commercial'
  | 'administratif' | 'proprietaire' | 'equipe' | 'personnel' | 'autre'

export interface Task {
  id: string
  title: string
  description: string | null
  category: TaskCategory | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  due_time: string | null
  reminder_at: string | null
  task_list_id: string | null
  property_id: string | null
  reservation_id: string | null
  lead_id: string | null
  incident_id: string | null
  assigned_to: string | null
  created_by: string | null
  tags: string[]
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
  parent_task_id: string | null
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
  // joined
  subtasks?: Task[]
  property?: { id: string; name: string } | null
  reservation?: { id: string; guest?: { full_name: string } | null } | null
}

export interface TaskList {
  id: string
  name: string
  color: string
  icon: string
  sort_order: number
  created_at: string
}

// ─── Eisenhower quadrants ─────────────────────────────────────────────────────

export const QUADRANTS: Record<TaskPriority, {
  label: string
  sublabel: string
  color: string
  bg: string
  border: string
  dot: string
}> = {
  urgent_important: {
    label: 'Urgent & Important',
    sublabel: 'Traiter maintenant',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  important: {
    label: 'Important',
    sublabel: 'Planifier',
    color: 'text-[#A88830]',
    bg: 'bg-[rgba(196,160,68,0.07)]',
    border: 'border-[#C4A044]',
    dot: 'bg-[#C4A044]',
  },
  urgent: {
    label: 'Urgent',
    sublabel: 'Déléguer',
    color: 'text-[#C17C1A]',
    bg: 'bg-[rgba(193,124,26,0.07)]',
    border: 'border-[#C17C1A]',
    dot: 'bg-[#C17C1A]',
  },
  neither: {
    label: 'Ni urgent ni important',
    sublabel: 'Différer ou éliminer',
    color: 'text-gray-400',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    dot: 'bg-gray-300',
  },
}

// ─── Catégories ───────────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<TaskCategory, { label: string; color: string; bg: string }> = {
  voyageur:      { label: 'Voyageur',      color: 'text-teal-700',    bg: 'bg-teal-100'    },
  menage:        { label: 'Ménage',        color: 'text-green-700',   bg: 'bg-green-100'   },
  maintenance:   { label: 'Maintenance',   color: 'text-orange-700',  bg: 'bg-orange-100'  },
  commercial:    { label: 'Commercial',    color: 'text-blue-700',    bg: 'bg-blue-100'    },
  administratif: { label: 'Administratif', color: 'text-violet-700',  bg: 'bg-violet-100'  },
  proprietaire:  { label: 'Propriétaire',  color: 'text-indigo-700',  bg: 'bg-indigo-100'  },
  equipe:        { label: 'Équipe',        color: 'text-amber-700',   bg: 'bg-amber-100'   },
  personnel:     { label: 'Personnel',     color: 'text-gray-600',    bg: 'bg-gray-100'    },
  autre:         { label: 'Autre',         color: 'text-gray-500',    bg: 'bg-gray-50'     },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done' || task.status === 'cancelled') return false
  return new Date(task.due_date) < new Date(new Date().toDateString())
}

export function isDueToday(task: Task): boolean {
  if (!task.due_date) return false
  return task.due_date === new Date().toISOString().slice(0, 10)
}

/** Parse quick-add text for smart defaults */
export function parseQuickAdd(text: string): Partial<Task> {
  const result: Partial<Task> = { title: text }
  const lower = text.toLowerCase()

  // Priority
  if (/urgent|asap|maintenant|critique/.test(lower)) result.priority = 'urgent_important'
  else if (/important/.test(lower)) result.priority = 'important'

  // Due date
  const today = new Date()
  if (/demain/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    result.due_date = d.toISOString().slice(0, 10)
  } else if (/aujourd'?hui|auj/.test(lower)) {
    result.due_date = today.toISOString().slice(0, 10)
  }

  // Category from hashtag
  const catMatch = text.match(/#(ménage|menage|maintenance|commercial|voyageur|équipe|equipe|admin|personnel)/i)
  if (catMatch) {
    const cat = catMatch[1].toLowerCase().replace('é','e').replace('è','e')
    const map: Record<string, TaskCategory> = {
      menage: 'menage', maintenance: 'maintenance', commercial: 'commercial',
      voyageur: 'voyageur', equipe: 'equipe', admin: 'administratif', personnel: 'personnel',
    }
    result.category = map[cat] ?? 'autre'
    result.title = text.replace(/#\S+/g, '').trim()
  }

  return result
}
