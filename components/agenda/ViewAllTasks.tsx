'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskList, TaskCategory, TaskPriority } from '@/components/agenda/types'
import { QUADRANTS, CATEGORY_CONFIG } from '@/components/agenda/types'
import { TaskCard } from '@/components/agenda/TaskCard'
import { Search, Download, CheckSquare, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ViewAllTasksProps {
  tasks: Task[]
  lists: TaskList[]
  onTaskClick: (task: Task) => void
  onToggle: (id: string, done: boolean) => void
  onTasksUpdated: (tasks: Task[]) => void
}

type GroupBy = 'none' | 'priority' | 'category' | 'list' | 'property'
type SortBy  = 'priority' | 'due_date' | 'category' | 'created_at'

export function ViewAllTasks({ tasks, lists, onTaskClick, onToggle, onTasksUpdated }: ViewAllTasksProps) {
  const [search, setSearch]           = useState('')
  const [filterStatus, setFS]         = useState<string>('active')
  const [filterCat, setFC]            = useState<TaskCategory | 'all'>('all')
  const [filterList, setFL]           = useState<string>('all')
  const [filterPriority, setFP]       = useState<TaskPriority | 'all'>('all')
  const [groupBy, setGroupBy]         = useState<GroupBy>('priority')
  const [sortBy, setSortBy]           = useState<SortBy>('priority')
  const [selected, setSelected]       = useState<Set<string>>(new Set())

  const listMap = useMemo(() => Object.fromEntries(lists.map(l => [l.id, l])), [lists])
  const PRIORITY_ORDER: TaskPriority[] = ['urgent_important', 'important', 'urgent', 'neither']

  const filtered = useMemo(() => {
    let r = tasks
    if (filterStatus === 'active')     r = r.filter(t => t.status !== 'done' && t.status !== 'cancelled')
    else if (filterStatus === 'done')  r = r.filter(t => t.status === 'done')
    if (filterCat !== 'all')           r = r.filter(t => t.category === filterCat)
    if (filterList !== 'all')          r = r.filter(t => t.task_list_id === filterList)
    if (filterPriority !== 'all')      r = r.filter(t => t.priority === filterPriority)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
    }
    return [...r].sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
      if (sortBy === 'due_date') return (a.due_date ?? '9') < (b.due_date ?? '9') ? -1 : 1
      if (sortBy === 'category') return (a.category ?? 'z').localeCompare(b.category ?? 'z')
      return b.created_at.localeCompare(a.created_at)
    })
  }, [tasks, filterStatus, filterCat, filterList, filterPriority, search, sortBy])

  function grouped(): { key: string; label: string; color?: string; tasks: Task[] }[] {
    if (groupBy === 'none') return [{ key: 'all', label: 'Toutes', tasks: filtered }]
    if (groupBy === 'priority') return PRIORITY_ORDER.map(p => ({
      key: p, label: QUADRANTS[p].label, color: QUADRANTS[p].dot,
      tasks: filtered.filter(t => t.priority === p),
    })).filter(g => g.tasks.length > 0)
    if (groupBy === 'category') {
      const catGroups: { key: string; label: string; tasks: Task[] }[] =
        (Object.keys(CATEGORY_CONFIG) as TaskCategory[]).map(c => ({
          key: c, label: CATEGORY_CONFIG[c].label,
          tasks: filtered.filter(t => t.category === c),
        })).filter(g => g.tasks.length > 0)
      const uncategorized = filtered.filter(t => !t.category)
      if (uncategorized.length > 0) catGroups.push({ key: 'none', label: 'Sans catégorie', tasks: uncategorized })
      return catGroups
    }
    if (groupBy === 'list') {
      const byList: Record<string, Task[]> = {}
      filtered.forEach(t => {
        const k = t.task_list_id ?? '__inbox__'
        ;(byList[k] ??= []).push(t)
      })
      return Object.entries(byList).map(([k, ts]) => ({
        key: k, label: k === '__inbox__' ? 'Boîte de réception' : (listMap[k]?.name ?? k),
        tasks: ts,
      }))
    }
    return [{ key: 'all', label: 'Toutes', tasks: filtered }]
  }

  function toggleSelect(id: string) {
    setSelected(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns })
  }

  async function bulkDone() {
    const supabase = createClient()
    const ids = Array.from(selected)
    await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).in('id', ids)
    onTasksUpdated(tasks.map(t => selected.has(t.id) ? { ...t, status: 'done' as const } : t))
    setSelected(new Set())
  }

  async function bulkDelete() {
    const supabase = createClient()
    const ids = Array.from(selected)
    await supabase.from('tasks').delete().in('id', ids)
    onTasksUpdated(tasks.filter(t => !selected.has(t.id)))
    setSelected(new Set())
  }

  function exportCSV() {
    const headers = ['Titre','Priorité','Statut','Catégorie','Échéance','Liste','Créé le']
    const rows = filtered.map(t => [
      t.title, QUADRANTS[t.priority].label, t.status,
      t.category ?? '', t.due_date ?? '',
      t.task_list_id ? (listMap[t.task_list_id]?.name ?? '') : '',
      format(new Date(t.created_at),'dd/MM/yyyy',{locale:fr}),
    ].map(v => `"${String(v).replace(/"/g,'""')}"`))
    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    a.download = `taches_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const groups = grouped()

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-background/95 sticky top-0 z-10">
        <div className="flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 flex-1 min-w-40">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input className="text-sm bg-transparent focus:outline-none w-full" placeholder="Rechercher…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-base text-xs h-8" value={filterStatus} onChange={e=>setFS(e.target.value)}>
          <option value="active">Actives</option>
          <option value="done">Terminées</option>
          <option value="all">Toutes</option>
        </select>
        <select className="input-base text-xs h-8" value={filterPriority} onChange={e=>setFP(e.target.value as any)}>
          <option value="all">Priorité</option>
          {(Object.entries(QUADRANTS) as [TaskPriority, typeof QUADRANTS[TaskPriority]][]).map(([k,v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="input-base text-xs h-8" value={filterCat} onChange={e=>setFC(e.target.value as any)}>
          <option value="all">Catégorie</option>
          {(Object.keys(CATEGORY_CONFIG) as TaskCategory[]).map(k => (
            <option key={k} value={k}>{CATEGORY_CONFIG[k].label}</option>
          ))}
        </select>
        <select className="input-base text-xs h-8" value={filterList} onChange={e=>setFL(e.target.value)}>
          <option value="all">Liste</option>
          {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className="input-base text-xs h-8" value={groupBy} onChange={e=>setGroupBy(e.target.value as any)}>
          <option value="priority">Groupe : Priorité</option>
          <option value="category">Groupe : Catégorie</option>
          <option value="list">Groupe : Liste</option>
          <option value="none">Sans groupe</option>
        </select>
        <button onClick={exportCSV} className="flex items-center gap-1 text-xs border rounded-md px-2 py-1.5 hover:bg-muted/50 text-muted-foreground">
          <Download className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length}</span>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border-b text-sm">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="font-medium">{selected.size} sélectionnée(s)</span>
          <button onClick={bulkDone} className="text-green-700 hover:underline ml-2">Marquer terminées</button>
          <button onClick={bulkDelete} className="text-destructive hover:underline">Supprimer</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-muted-foreground hover:text-foreground">
            Désélectionner
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {groups.map(group => (
          <section key={group.key}>
            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
              {group.color && <div className={`w-2.5 h-2.5 rounded-full ${group.color}`} />}
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
            </div>
            <div className="space-y-1">
              {group.tasks.map(task => (
                <div key={task.id} className="flex items-start gap-1.5">
                  <input
                    type="checkbox"
                    checked={selected.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-3 shrink-0 accent-primary"
                  />
                  <div className="flex-1">
                    <TaskCard task={task} onClick={() => onTaskClick(task)} onToggle={onToggle} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Aucune tâche trouvée.
          </div>
        )}
      </div>
    </div>
  )
}
