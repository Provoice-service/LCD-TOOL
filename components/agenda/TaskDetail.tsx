'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskList } from '@/components/agenda/types'
import { QUADRANTS, CATEGORY_CONFIG } from '@/components/agenda/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { QuickAdd } from '@/components/agenda/QuickAdd'
import { TaskCard } from '@/components/agenda/TaskCard'
import {
  X, Calendar, Clock, Bell, Tag, Repeat, User,
  Loader2, Plus, Trash2, Home, Link as LinkIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface TaskDetailProps {
  task: Task
  lists: TaskList[]
  onClose: () => void
  onUpdated: (task: Task) => void
  onDeleted: (id: string) => void
}

export function TaskDetail({ task, lists, onClose, onUpdated, onDeleted }: TaskDetailProps) {
  const [form, setForm]           = useState<Task>(task)
  const [subtasks, setSubtasks]   = useState<Task[]>(task.subtasks ?? [])
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [tagInput, setTagInput]   = useState('')

  // Sync if parent updates
  useEffect(() => { setForm(task); setSubtasks(task.subtasks ?? []) }, [task.id])

  async function save(patch: Partial<Task>) {
    setSaving(true)
    const updated = { ...form, ...patch }
    setForm(updated)
    const supabase = createClient()
    await supabase.from('tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', task.id)
    onUpdated(updated)
    setSaving(false)
  }

  async function deleteTask() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', task.id)
    onDeleted(task.id)
  }

  async function addSubtask(partial: Partial<Task>) {
    const supabase = createClient()
    const { data } = await supabase.from('tasks').insert({
      title:          partial.title ?? 'Sous-tâche',
      priority:       partial.priority ?? 'neither',
      parent_task_id: task.id,
      status:         'todo',
    }).select('*').single()
    if (data) setSubtasks(s => [...s, data as Task])
  }

  async function toggleSubtask(id: string, done: boolean) {
    const supabase = createClient()
    const patch = { status: done ? 'done' : 'todo', completed_at: done ? new Date().toISOString() : null }
    await supabase.from('tasks').update(patch).eq('id', id)
    setSubtasks(s => s.map(t => t.id === id ? { ...t, ...patch } as Task : t))
  }

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed || form.tags.includes(trimmed)) return
    save({ tags: [...form.tags, trimmed] })
    setTagInput('')
  }

  function removeTag(tag: string) {
    save({ tags: form.tags.filter(t => t !== tag) })
  }

  const isDone = form.status === 'done'

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">Enregistrement automatique</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => save({ status: isDone ? 'todo' : 'done', completed_at: isDone ? null : new Date().toISOString() })}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              isDone ? 'bg-green-100 text-green-700' : 'border hover:bg-muted/50'
            }`}
          >
            {isDone ? '✓ Terminé' : 'Marquer terminé'}
          </button>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">

          {/* Titre */}
          <textarea
            className="w-full text-base font-semibold bg-transparent resize-none focus:outline-none leading-snug"
            rows={2}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onBlur={e => save({ title: e.target.value })}
          />

          {/* Description */}
          <div>
            <textarea
              className="w-full text-sm text-muted-foreground bg-transparent resize-none focus:outline-none focus:text-foreground transition-colors"
              rows={3}
              placeholder="Description (markdown supporté)…"
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              onBlur={e => save({ description: e.target.value || null })}
            />
          </div>

          <Separator />

          {/* Priorité — 4 quadrants visuels */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Priorité (Matrice Eisenhower)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(QUADRANTS) as [keyof typeof QUADRANTS, typeof QUADRANTS[keyof typeof QUADRANTS]][]).map(([key, q]) => (
                <button
                  key={key}
                  onClick={() => save({ priority: key })}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    form.priority === key
                      ? `${q.bg} ${q.border} ${q.color}`
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className={`w-2 h-2 rounded-full ${q.dot}`} />
                    <span className="text-xs font-medium">{q.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{q.sublabel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Catégorie */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Catégorie</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(CATEGORY_CONFIG) as [keyof typeof CATEGORY_CONFIG, typeof CATEGORY_CONFIG[keyof typeof CATEGORY_CONFIG]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => save({ category: key })}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                    form.category === key
                      ? `${cfg.bg} ${cfg.color} border-current/30`
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Date / Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Calendar className="h-3.5 w-3.5" /> Échéance
              </label>
              <input
                type="date"
                className="input-base w-full text-sm"
                value={form.due_date ?? ''}
                onChange={e => save({ due_date: e.target.value || null })}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Clock className="h-3.5 w-3.5" /> Heure
              </label>
              <input
                type="time"
                className="input-base w-full text-sm"
                value={form.due_time ?? ''}
                onChange={e => save({ due_time: e.target.value || null })}
              />
            </div>
          </div>

          {/* Rappel */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Bell className="h-3.5 w-3.5" /> Rappel
            </label>
            <input
              type="datetime-local"
              className="input-base w-full text-sm"
              value={form.reminder_at ? form.reminder_at.slice(0, 16) : ''}
              onChange={e => save({ reminder_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>

          {/* Récurrence */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Repeat className="h-3.5 w-3.5" /> Récurrence
            </label>
            <select
              className="input-base w-full text-sm"
              value={form.recurrence}
              onChange={e => save({ recurrence: e.target.value as Task['recurrence'] })}
            >
              <option value="none">Aucune</option>
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
              <option value="custom">Personnalisée</option>
            </select>
          </div>

          {/* Liste */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Liste</label>
            <select
              className="input-base w-full text-sm"
              value={form.task_list_id ?? ''}
              onChange={e => save({ task_list_id: e.target.value || null })}
            >
              <option value="">Aucune liste (Boîte de réception)</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Tags */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Tag className="h-3.5 w-3.5" /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-muted rounded-full">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <input
              className="input-base w-full text-sm"
              placeholder="Ajouter un tag (Entrée)"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
              }}
            />
          </div>

          {/* Liens contextuels */}
          {(task.property || task.reservation) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Liens
              </p>
              {task.property && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                  <Home className="h-3.5 w-3.5" />
                  <span>{task.property.name}</span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Sous-tâches */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Sous-tâches{subtasks.length > 0 && ` (${subtasks.filter(s=>s.status==='done').length}/${subtasks.length})`}
            </p>
            <div className="space-y-1 mb-2">
              {subtasks.map(st => (
                <TaskCard
                  key={st.id}
                  task={st}
                  compact
                  onClick={() => {}}
                  onToggle={toggleSubtask}
                />
              ))}
            </div>
            <QuickAdd
              placeholder="Ajouter une sous-tâche…"
              defaultPriority="neither"
              onAdd={addSubtask}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Créé {format(new Date(task.created_at), 'dd MMM yyyy', { locale: fr })}</span>
        <button
          onClick={deleteTask}
          disabled={deleting}
          className="flex items-center gap-1 text-destructive hover:underline"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Supprimer
        </button>
      </div>
    </div>
  )
}
