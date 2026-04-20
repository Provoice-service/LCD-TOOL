'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, BookOpen } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessRow {
  id: string
  number: number
  category: string
  process_name: string
  description: string | null
  priority: 'Haute' | 'Moyenne' | 'Basse'
  status: 'À documenter' | 'En cours' | 'Documenté' | 'Automatisé'
  documentation_method: string | null
  resource_url: string | null
  notes: string | null
  assigned_to: string | null
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Constantes UI
// ---------------------------------------------------------------------------

const PRIORITY_STYLE: Record<string, string> = {
  Haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Basse:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_STYLE: Record<string, string> = {
  'À documenter': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  'En cours':     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Documenté':    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Automatisé':   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Avant la réservation':       'bg-orange-50  text-orange-700  border-orange-200',
  'Confirmation & préparation': 'bg-sky-50     text-sky-700     border-sky-200',
  'Check-in':                   'bg-teal-50    text-teal-700    border-teal-200',
  'Pendant le séjour':          'bg-indigo-50  text-indigo-700  border-indigo-200',
  'Check-out':                  'bg-violet-50  text-violet-700  border-violet-200',
  'Après le séjour':            'bg-pink-50    text-pink-700    border-pink-200',
  'Ménage & linge':             'bg-yellow-50  text-yellow-700  border-yellow-200',
  'Maintenance & technique':    'bg-red-50     text-red-700     border-red-200',
  'Gestion des annonces':       'bg-lime-50    text-lime-700    border-lime-200',
  'Revenue management':         'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Relation propriétaire':      'bg-cyan-50    text-cyan-700    border-cyan-200',
  'Administratif & financier':  'bg-blue-50    text-blue-700    border-blue-200',
  'Équipe & organisation':      'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'Conformité & réglementation':'bg-rose-50    text-rose-700    border-rose-200',
  'Automatisation & IA':        'bg-purple-50  text-purple-700  border-purple-200',
}

const ALL_STATUSES  = ['À documenter', 'En cours', 'Documenté', 'Automatisé'] as const
const ALL_PRIORITIES = ['Haute', 'Moyenne', 'Basse'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exportCSV(rows: ProcessRow[]) {
  const headers = ['N°', 'Catégorie', 'Nom du process', 'Description', 'Priorité', 'Statut', 'Méthode doc', 'Lien ressource', 'Notes', 'Assigné à']
  const escape  = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`
  const lines   = [
    headers.join(';'),
    ...rows.map((r) => [
      r.number, escape(r.category), escape(r.process_name), escape(r.description),
      r.priority, r.status, escape(r.documentation_method), escape(r.resource_url),
      escape(r.notes), escape(r.assigned_to),
    ].join(';')),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = 'process_library.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface ProcessLibraryClientProps {
  initialProcesses: ProcessRow[]
}

export function ProcessLibraryClient({ initialProcesses }: ProcessLibraryClientProps) {
  const [processes, setProcesses] = useState<ProcessRow[]>(initialProcesses)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterStatus,   setFilterStatus]   = useState('all')
  const [search, setSearch]                  = useState('')
  const [expandedId, setExpandedId]          = useState<string | null>(null)
  const [editingField, setEditingField]      = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue]            = useState('')

  const categories = useMemo(() => Array.from(new Set(processes.map((p) => p.category))), [processes])

  const filtered = useMemo(() => processes.filter((p) => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false
    if (filterPriority !== 'all' && p.priority !== filterPriority) return false
    if (filterStatus   !== 'all' && p.status   !== filterStatus)   return false
    if (search && !p.process_name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.description ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [processes, filterCategory, filterPriority, filterStatus, search])

  // Stats
  const totalDoc    = processes.filter((p) => p.status === 'Documenté' || p.status === 'Automatisé').length
  const totalAuto   = processes.filter((p) => p.status === 'Automatisé').length
  const docPct      = Math.round((totalDoc  / processes.length) * 100)
  const autoPct     = Math.round((totalAuto / processes.length) * 100)

  // ── Mise à jour Supabase ───────────────────────────────────────────────────
  async function updateField(id: string, field: string, value: string) {
    const supabase = createClient()
    await supabase.from('process_library').update({ [field]: value }).eq('id', id)
    setProcesses((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p))
  }

  async function updateStatus(id: string, status: ProcessRow['status']) {
    const supabase = createClient()
    await supabase.from('process_library').update({ status }).eq('id', id)
    setProcesses((prev) => prev.map((p) => p.id === id ? { ...p, status } : p))
  }

  function startEdit(id: string, field: string, current: string | null) {
    setEditingField({ id, field })
    setEditValue(current ?? '')
  }

  async function commitEdit() {
    if (!editingField) return
    await updateField(editingField.id, editingField.field, editValue)
    setEditingField(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Bibliothèque des Process</h1>
            <Badge variant="secondary" className="ml-1">{processes.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        {/* Barres de progression */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Documentés</span>
              <span>{totalDoc}/{processes.length} ({docPct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${docPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Automatisés</span>
              <span>{totalAuto}/{processes.length} ({autoPct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${autoPct}%` }} />
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <input
            className="text-sm rounded-md border bg-background px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">Toutes catégories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">Toutes priorités</option>
            {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className="text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tous statuts</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(filterCategory !== 'all' || filterPriority !== 'all' || filterStatus !== 'all' || search) && (
            <button
              onClick={() => { setFilterCategory('all'); setFilterPriority('all'); setFilterStatus('all'); setSearch('') }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Réinitialiser
            </button>
          )}
          <span className="text-xs text-muted-foreground self-center">{filtered.length} process</span>
        </div>
      </div>

      {/* ── Tableau ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10 border-b">N°</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-44 border-b">Catégorie</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground border-b">Nom du process</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20 border-b">Priorité</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32 border-b">Statut</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40 border-b">Méthode doc</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40 border-b">Lien / ressource</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isExpanded = expandedId === p.id
              return (
                <>
                  <tr
                    key={p.id}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{p.number}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[p.category] ?? 'bg-muted text-muted-foreground border-border'}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.process_name}</div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[p.priority]}`}>
                        {p.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${STATUS_STYLE[p.status]}`}
                        value={p.status}
                        onChange={(e) => updateStatus(p.id, e.target.value as ProcessRow['status'])}
                      >
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {editingField?.id === p.id && editingField.field === 'documentation_method' ? (
                        <input
                          autoFocus
                          className="w-full text-xs rounded border px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(p.id, 'documentation_method', p.documentation_method)}
                          className="text-xs text-left w-full text-muted-foreground hover:text-foreground"
                        >
                          {p.documentation_method ?? <span className="italic opacity-50">+ ajouter</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {editingField?.id === p.id && editingField.field === 'resource_url' ? (
                        <input
                          autoFocus
                          className="w-full text-xs rounded border px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                        />
                      ) : p.resource_url ? (
                        <a
                          href={p.resource_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:underline truncate block max-w-[140px]"
                        >
                          {p.resource_url.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <button
                          onClick={() => startEdit(p.id, 'resource_url', p.resource_url)}
                          className="text-xs text-muted-foreground hover:text-foreground italic opacity-50"
                        >
                          + ajouter lien
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Ligne détail expandée */}
                  {isExpanded && (
                    <tr key={`${p.id}-detail`} className="border-b bg-muted/10">
                      <td />
                      <td colSpan={6} className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                            <p className="text-sm">{p.description ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Notes internes</p>
                            {editingField?.id === p.id && editingField.field === 'notes' ? (
                              <textarea
                                autoFocus
                                rows={3}
                                className="w-full text-sm rounded border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                              />
                            ) : (
                              <button
                                onClick={() => startEdit(p.id, 'notes', p.notes)}
                                className="text-sm text-left w-full text-muted-foreground hover:text-foreground"
                              >
                                {p.notes ?? <span className="italic opacity-50">+ ajouter une note</span>}
                              </button>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Assigné à</p>
                            {editingField?.id === p.id && editingField.field === 'assigned_to' ? (
                              <input
                                autoFocus
                                className="w-full text-sm rounded border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                              />
                            ) : (
                              <button
                                onClick={() => startEdit(p.id, 'assigned_to', p.assigned_to)}
                                className="text-sm text-left w-full text-muted-foreground hover:text-foreground"
                              >
                                {p.assigned_to ?? <span className="italic opacity-50">+ assigner</span>}
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2 items-end">
                            <button
                              onClick={() => updateStatus(p.id, 'Automatisé')}
                              disabled={p.status === 'Automatisé'}
                              className="text-xs px-3 py-1.5 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              ✦ Marquer Automatisé
                            </button>
                            <button
                              onClick={() => updateStatus(p.id, 'Documenté')}
                              disabled={p.status === 'Documenté' || p.status === 'Automatisé'}
                              className="text-xs px-3 py-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              ✓ Marquer Documenté
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <BookOpen className="h-10 w-10 opacity-20" />
            <p className="text-sm">Aucun process correspondant aux filtres</p>
          </div>
        )}
      </div>
    </div>
  )
}
