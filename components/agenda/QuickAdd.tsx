'use client'

import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { parseQuickAdd } from '@/components/agenda/types'
import type { Task, TaskPriority, TaskCategory } from '@/components/agenda/types'

interface QuickAddProps {
  defaultPriority?: TaskPriority
  defaultCategory?: TaskCategory
  defaultDate?: string
  placeholder?: string
  onAdd: (partial: Partial<Task>) => Promise<void>
}

export function QuickAdd({
  defaultPriority = 'neither',
  defaultCategory,
  defaultDate,
  placeholder = 'Nouvelle tâche… (Entrée pour créer, #ménage, urgent, demain)',
  onAdd
}: QuickAddProps) {
  const [text, setText]   = useState('')
  const [busy, setBusy]   = useState(false)
  const inputRef          = useRef<HTMLInputElement>(null)

  async function submit() {
    const trimmed = text.trim()
    if (!trimmed) return
    setBusy(true)
    const parsed = parseQuickAdd(trimmed)
    await onAdd({
      title:    parsed.title ?? trimmed,
      priority: parsed.priority ?? defaultPriority,
      category: parsed.category ?? defaultCategory ?? undefined,
      due_date: parsed.due_date ?? defaultDate ?? undefined,
    })
    setText('')
    setBusy(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background hover:border-primary/50 focus-within:border-primary/70 focus-within:ring-1 focus-within:ring-ring transition-colors">
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/60"
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !busy) { e.preventDefault(); submit() }
          if (e.key === 'Escape') setText('')
        }}
        disabled={busy}
      />
      {text && (
        <span className="text-xs text-muted-foreground">Entrée ↵</span>
      )}
    </div>
  )
}
