'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen, Building2, Plus, Edit2, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Download, ArrowLeft, Loader2, Check,
  Sparkles, Clock, Wrench, User, Bot,
} from 'lucide-react'

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
  // new fields
  is_template: boolean
  property_id: string | null
  parent_process_id: string | null
  access_type_applicable: string[]
  country_applicable: string[]
  content: string | null
  variables_used: string[]
  last_updated_at: string | null
}

export interface ProcessStep {
  id: string
  process_id: string
  step_number: number
  title: string
  instruction: string
  responsible: 'agent_service_client' | 'equipe_menage' | 'gestionnaire' | 'voyageur' | 'automatique'
  tool_needed: string | null
  estimated_minutes: number
  is_automated: boolean
  automation_module: string | null
}

export interface ProcessVariable {
  id: string
  process_id: string
  variable_name: string
  source_column: string
  display_label: string
  is_required: boolean
}

export interface PropertyOption {
  id: string
  name: string
  city: string | null
  country: string | null
  access_type: string
  [key: string]: unknown
}

type View = 'library' | 'by_property' | 'editor'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const PRIORITY_STYLE: Record<string, string> = {
  Haute:   'bg-red-100 text-red-700',
  Moyenne: 'bg-amber-100 text-amber-700',
  Basse:   'bg-slate-100 text-slate-600',
}

const STATUS_STYLE: Record<string, string> = {
  'À documenter': 'bg-slate-100 text-slate-600',
  'En cours':     'bg-blue-100 text-blue-700',
  'Documenté':    'bg-green-100 text-green-700',
  'Automatisé':   'bg-purple-100 text-purple-700',
}

const RESPONSIBLE_LABEL: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  agent_service_client: { label: 'Agent SC',    color: 'text-blue-600',   icon: User },
  equipe_menage:        { label: 'Équipe ménage', color: 'text-yellow-600', icon: Wrench },
  gestionnaire:         { label: 'Gestionnaire', color: 'text-purple-600', icon: User },
  voyageur:             { label: 'Voyageur',     color: 'text-teal-600',   icon: User },
  automatique:          { label: 'Automatique',  color: 'text-green-600',  icon: Bot },
}

const ACCESS_TYPE_LABELS: Record<string, string> = {
  tuya:      'Tuya',
  smartlife: 'SmartLife',
  nuki:      'Nuki',
  key_box:   'Boîte à clé',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryBadge(category: string) {
  const cls = CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {category}
    </span>
  )
}

function replaceVariables(text: string, property: PropertyOption | null): string {
  if (!property) return text
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = property[key as keyof PropertyOption]
    return val ? String(val) : `{{${key}}}`
  })
}

function variablesComplete(variables: ProcessVariable[], property: PropertyOption | null): boolean {
  if (!property || variables.length === 0) return true
  return variables.filter((v) => v.is_required).every((v) => {
    const val = property[v.source_column as keyof PropertyOption]
    return val !== null && val !== undefined && val !== ''
  })
}

function exportCSV(rows: ProcessRow[]) {
  const headers = ['N°', 'Catégorie', 'Nom du process', 'Template?', 'Types accès', 'Pays', 'Priorité', 'Statut']
  const escape  = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`
  const lines   = [
    headers.join(';'),
    ...rows.map((r) => [
      r.number, escape(r.category), escape(r.process_name),
      r.is_template ? 'Oui' : 'Non',
      escape(r.access_type_applicable?.join(', ')),
      escape(r.country_applicable?.join(', ')),
      r.priority, r.status,
    ].join(';')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = 'process_library.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepsView({
  steps,
  variables,
  property,
}: {
  steps: ProcessStep[]
  variables: ProcessVariable[]
  property: PropertyOption | null
}) {
  if (steps.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Aucune étape définie pour ce process.</p>
  }

  return (
    <ol className="space-y-3">
      {steps.map((step) => {
        const resp = RESPONSIBLE_LABEL[step.responsible]
        const Icon = resp?.icon ?? User
        const instruction = property
          ? replaceVariables(step.instruction, property)
          : step.instruction
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                {step.step_number}
              </span>
              {steps.indexOf(step) < steps.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>
            <div className="pb-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-medium">{step.title}</span>
                {step.is_automated && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium flex items-center gap-0.5">
                    <Bot className="h-2.5 w-2.5" /> Auto
                  </span>
                )}
                <span className={`text-[10px] flex items-center gap-0.5 ${resp?.color ?? 'text-muted-foreground'}`}>
                  <Icon className="h-2.5 w-2.5" /> {resp?.label}
                </span>
                {step.estimated_minutes > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" /> {step.estimated_minutes} min
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{instruction}</p>
              {step.tool_needed && (
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Wrench className="h-2.5 w-2.5" /> {step.tool_needed}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function VariablesStatus({
  variables,
  property,
}: {
  variables: ProcessVariable[]
  property: PropertyOption | null
}) {
  if (!property || variables.length === 0) return null
  const missing = variables.filter((v) => {
    const val = property[v.source_column as keyof PropertyOption]
    return v.is_required && (val === null || val === undefined || val === '')
  })
  if (missing.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Toutes les variables sont remplies
      </div>
    )
  }
  return (
    <div className="text-xs text-red-600 space-y-1">
      <div className="flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{missing.length} variable{missing.length > 1 ? 's' : ''} manquante{missing.length > 1 ? 's' : ''} dans la fiche logement :</span>
      </div>
      <ul className="pl-5 list-disc space-y-0.5">
        {missing.map((v) => (
          <li key={v.id} className="text-red-500">{v.display_label} ({v.source_column})</li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface ProcessLibraryClientProps {
  initialProcesses: ProcessRow[]
  properties: PropertyOption[]
}

export function ProcessLibraryClient({ initialProcesses, properties }: ProcessLibraryClientProps) {
  const [view, setView]                         = useState<View>('library')
  const [processes, setProcesses]               = useState<ProcessRow[]>(initialProcesses)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [expandedId, setExpandedId]             = useState<string | null>(null)
  const [stepsCache, setStepsCache]             = useState<Record<string, ProcessStep[]>>({})
  const [variablesCache, setVariablesCache]     = useState<Record<string, ProcessVariable[]>>({})
  const [loadingSteps, setLoadingSteps]         = useState<string | null>(null)
  const [filterCategory, setFilterCategory]     = useState('all')
  const [filterAccessType, setFilterAccessType] = useState('all')
  const [filterCountry, setFilterCountry]       = useState('all')
  const [search, setSearch]                     = useState('')
  // editor state
  const [editingProcess, setEditingProcess]     = useState<Partial<ProcessRow> | null>(null)
  const [editSteps, setEditSteps]               = useState<Partial<ProcessStep>[]>([])
  const [savingEditor, setSavingEditor]         = useState(false)

  const supabase = createClient()

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId]
  )

  // Process templates (vue bibliothèque)
  const templates = useMemo(() => processes.filter((p) => p.is_template), [processes])
  // Process personnalisés pour le logement sélectionné
  const propertyProcesses = useMemo(
    () => processes.filter((p) => !p.is_template && p.property_id === selectedPropertyId),
    [processes, selectedPropertyId]
  )

  const categories = useMemo(() => Array.from(new Set(templates.map((p) => p.category))), [templates])

  const filteredTemplates = useMemo(() => templates.filter((p) => {
    if (filterCategory  !== 'all' && p.category !== filterCategory) return false
    if (filterAccessType !== 'all' && !(p.access_type_applicable ?? []).includes(filterAccessType)) return false
    if (filterCountry   !== 'all' && !(p.country_applicable ?? []).includes(filterCountry)) return false
    if (search && !p.process_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [templates, filterCategory, filterAccessType, filterCountry, search])

  // Combien de logements ont une version perso d'un process template
  const customCountByTemplate = useMemo(() => {
    const counts: Record<string, number> = {}
    processes.filter((p) => !p.is_template && p.parent_process_id).forEach((p) => {
      counts[p.parent_process_id!] = (counts[p.parent_process_id!] ?? 0) + 1
    })
    return counts
  }, [processes])

  async function loadSteps(processId: string) {
    if (stepsCache[processId]) return
    setLoadingSteps(processId)
    const { data: steps }     = await supabase.from('process_steps').select('*').eq('process_id', processId).order('step_number')
    const { data: variables } = await supabase.from('process_variables').select('*').eq('process_id', processId)
    setStepsCache((c) => ({ ...c, [processId]: (steps ?? []) as ProcessStep[] }))
    setVariablesCache((c) => ({ ...c, [processId]: (variables ?? []) as ProcessVariable[] }))
    setLoadingSteps(null)
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadSteps(id)
    }
  }

  async function generateFromTemplate(template: ProcessRow) {
    if (!selectedPropertyId) return
    const { data: newProcess } = await supabase.from('process_library').insert({
      number: template.number + 1000,
      category: template.category,
      process_name: `${template.process_name} — ${selectedProperty?.name}`,
      description: template.description,
      priority: template.priority,
      status: template.status,
      is_template: false,
      property_id: selectedPropertyId,
      parent_process_id: template.id,
      access_type_applicable: template.access_type_applicable,
      country_applicable: template.country_applicable,
      content: template.content,
      variables_used: template.variables_used,
    }).select().single()

    if (newProcess) {
      // Dupliquer les étapes
      const templateSteps = stepsCache[template.id] ?? []
      if (templateSteps.length > 0) {
        await supabase.from('process_steps').insert(
          templateSteps.map((s) => ({
            process_id: (newProcess as ProcessRow).id,
            step_number: s.step_number,
            title: s.title,
            instruction: s.instruction,
            responsible: s.responsible,
            tool_needed: s.tool_needed,
            estimated_minutes: s.estimated_minutes,
            is_automated: s.is_automated,
            automation_module: s.automation_module,
          }))
        )
      }
      setProcesses((prev) => [...prev, newProcess as ProcessRow])
      setView('by_property')
    }
  }

  function openEditor(process?: ProcessRow) {
    if (process) {
      setEditingProcess({ ...process })
      loadSteps(process.id).then(() => {
        setEditSteps(stepsCache[process.id] ?? [])
      })
    } else {
      setEditingProcess({
        category: 'Check-in',
        process_name: '',
        description: '',
        priority: 'Moyenne',
        status: 'À documenter',
        is_template: !selectedPropertyId,
        property_id: selectedPropertyId || null,
        access_type_applicable: [],
        country_applicable: [],
        content: '',
        variables_used: [],
      })
      setEditSteps([])
    }
    setView('editor')
  }

  async function saveEditor() {
    if (!editingProcess?.process_name) return
    setSavingEditor(true)
    try {
      let processId = editingProcess.id
      if (processId) {
        await supabase.from('process_library').update({
          ...editingProcess,
          last_updated_at: new Date().toISOString(),
        }).eq('id', processId)
      } else {
        const { data } = await supabase.from('process_library').insert({
          ...editingProcess,
          number: editingProcess.number ?? 999,
        }).select().single()
        processId = (data as ProcessRow)?.id
        if (data) setProcesses((prev) => [...prev, data as ProcessRow])
      }
      if (processId && editSteps.length > 0) {
        await supabase.from('process_steps').delete().eq('process_id', processId)
        await supabase.from('process_steps').insert(
          editSteps.map((s, i) => ({
            process_id: processId,
            step_number: i + 1,
            title: s.title ?? '',
            instruction: s.instruction ?? '',
            responsible: s.responsible ?? 'agent_service_client',
            tool_needed: s.tool_needed ?? null,
            estimated_minutes: s.estimated_minutes ?? 5,
            is_automated: s.is_automated ?? false,
            automation_module: s.automation_module ?? null,
          }))
        )
        setStepsCache((c) => ({ ...c, [processId!]: editSteps as ProcessStep[] }))
      }
      setView(editingProcess.is_template ? 'library' : 'by_property')
    } finally {
      setSavingEditor(false)
    }
  }

  // ── Rendu VUE 1 : Bibliothèque ────────────────────────────────────────────

  function renderLibrary() {
    const grouped: Record<string, ProcessRow[]> = {}
    filteredTemplates.forEach((p) => {
      if (!grouped[p.category]) grouped[p.category] = []
      grouped[p.category].push(p)
    })

    return (
      <>
        {/* Header filtres */}
        <div className="px-6 py-4 border-b shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <h1 className="text-xl font-semibold">Bibliothèque des Process</h1>
              <Badge variant="secondary">{templates.length} templates</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV(filteredTemplates)} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" onClick={() => openEditor()} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nouveau process
              </Button>
            </div>
          </div>
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
              value={filterAccessType}
              onChange={(e) => setFilterAccessType(e.target.value)}
            >
              <option value="all">Tous types d'accès</option>
              {Object.entries(ACCESS_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              className="text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
            >
              <option value="all">Tous pays</option>
              <option value="FR">France</option>
              <option value="MA">Maroc</option>
              <option value="BE">Belgique</option>
              <option value="ES">Espagne</option>
            </select>
            {(filterCategory !== 'all' || filterAccessType !== 'all' || filterCountry !== 'all' || search) && (
              <button
                onClick={() => { setFilterCategory('all'); setFilterAccessType('all'); setFilterCountry('all'); setSearch('') }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Réinitialiser
              </button>
            )}
            <span className="text-xs text-muted-foreground self-center">{filteredTemplates.length} process</span>
          </div>
        </div>

        {/* Liste groupée */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
          {Object.entries(grouped).map(([category, rows]) => (
            <div key={category}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {category} ({rows.length})
              </h2>
              <div className="space-y-1">
                {rows.map((p) => {
                  const isExpanded = expandedId === p.id
                  const customCount = customCountByTemplate[p.id] ?? 0
                  const steps = stepsCache[p.id] ?? []
                  const vars  = variablesCache[p.id] ?? []

                  return (
                    <div key={p.id} className="rounded-lg border bg-card overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => toggleExpand(p.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{p.process_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border font-medium">
                              Template
                            </span>
                            {(p.access_type_applicable ?? []).map((at) => (
                              <span key={at} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                                {ACCESS_TYPE_LABELS[at] ?? at}
                              </span>
                            ))}
                            {(p.country_applicable ?? []).map((c) => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200 font-medium">
                                {c}
                              </span>
                            ))}
                            {customCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-medium">
                                {customCount} logement{customCount > 1 ? 's' : ''} personnalisé{customCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[p.priority]}`}>
                            {p.priority}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status]}`}>
                            {p.status}
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t bg-muted/10">
                          <div className="flex items-center justify-between py-3 mb-3">
                            <p className="text-xs text-muted-foreground">{p.content ?? p.description}</p>
                            <div className="flex gap-2 shrink-0 ml-4">
                              <Button size="sm" variant="outline" onClick={() => openEditor(p)} className="gap-1.5 text-xs">
                                <Edit2 className="h-3 w-3" /> Modifier
                              </Button>
                              {selectedPropertyId && (
                                <Button size="sm" onClick={() => generateFromTemplate(p)} className="gap-1.5 text-xs">
                                  <Plus className="h-3 w-3" /> Personnaliser pour {selectedProperty?.name}
                                </Button>
                              )}
                            </div>
                          </div>
                          {loadingSteps === p.id ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des étapes…
                            </div>
                          ) : (
                            <StepsView steps={steps} variables={vars} property={null} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <BookOpen className="h-10 w-10 opacity-20" />
              <p className="text-sm">Aucun process correspondant aux filtres</p>
            </div>
          )}
        </div>
      </>
    )
  }

  // ── Rendu VUE 2 : Par logement ────────────────────────────────────────────

  function renderByProperty() {
    const grouped: Record<string, ProcessRow[]> = {}
    propertyProcesses.forEach((p) => {
      if (!grouped[p.category]) grouped[p.category] = []
      grouped[p.category].push(p)
    })

    return (
      <>
        <div className="px-6 py-4 border-b shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <h1 className="text-xl font-semibold">Process par logement</h1>
            </div>
            <Button size="sm" onClick={() => openEditor()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nouveau process
            </Button>
          </div>
          <div className="flex gap-3 items-center">
            <select
              className="text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
            >
              <option value="">— Sélectionner un logement —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.city ? ` — ${p.city}` : ''}{p.country ? ` (${p.country})` : ''}
                </option>
              ))}
            </select>
            {selectedProperty && (
              <span className="text-xs text-muted-foreground">
                Accès : <strong>{ACCESS_TYPE_LABELS[selectedProperty.access_type] ?? selectedProperty.access_type}</strong>
                {selectedProperty.country && ` — ${selectedProperty.country}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {!selectedPropertyId ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Building2 className="h-10 w-10 opacity-20" />
              <p className="text-sm">Sélectionnez un logement pour voir ses process personnalisés</p>
            </div>
          ) : propertyProcesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Sparkles className="h-10 w-10 opacity-20" />
              <p className="text-sm">Aucun process personnalisé pour ce logement</p>
              <p className="text-xs">Allez dans la Bibliothèque et cliquez "Personnaliser pour ce logement" sur les templates applicables.</p>
              <Button variant="outline" size="sm" onClick={() => setView('library')} className="gap-1.5 mt-2">
                <BookOpen className="h-3.5 w-3.5" /> Voir la bibliothèque
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, rows]) => (
                <div key={category}>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {category} ({rows.length})
                  </h2>
                  <div className="space-y-1">
                    {rows.map((p) => {
                      const isExpanded = expandedId === p.id
                      const steps = stepsCache[p.id] ?? []
                      const vars  = variablesCache[p.id] ?? []
                      const allFilled = variablesComplete(vars, selectedProperty)

                      return (
                        <div key={p.id} className="rounded-lg border bg-card overflow-hidden">
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleExpand(p.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{p.process_name}</span>
                                {allFilled ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </div>
                              {p.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={(e) => { e.stopPropagation(); openEditor(p) }}
                              >
                                <Edit2 className="h-3 w-3" /> Modifier
                              </Button>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t bg-muted/10 pt-3 space-y-3">
                              <VariablesStatus variables={vars} property={selectedProperty} />
                              {loadingSteps === p.id ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
                                </div>
                              ) : (
                                <StepsView steps={steps} variables={vars} property={selectedProperty} />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  // ── Rendu VUE 3 : Éditeur ────────────────────────────────────────────────

  function renderEditor() {
    if (!editingProcess) return null
    const isNew = !editingProcess.id

    return (
      <>
        <div className="px-6 py-4 border-b shrink-0 flex items-center gap-3">
          <Button
            variant="ghost" size="sm"
            onClick={() => setView(editingProcess.is_template ? 'library' : 'by_property')}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-xl font-semibold">
            {isNew ? 'Nouveau process' : `Modifier — ${editingProcess.process_name}`}
          </h1>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 space-y-6 max-w-3xl">

          {/* Infos générales */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informations générales</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Titre du process</label>
                <input
                  className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editingProcess.process_name ?? ''}
                  onChange={(e) => setEditingProcess((p) => ({ ...p, process_name: e.target.value }))}
                  placeholder="Ex : Check-in autonome Tuya"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Catégorie</label>
                <select
                  className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editingProcess.category ?? 'Check-in'}
                  onChange={(e) => setEditingProcess((p) => ({ ...p, category: e.target.value }))}
                >
                  {Object.keys(CATEGORY_COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Description courte</label>
              <textarea
                className="w-full text-sm rounded-md border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={editingProcess.description ?? ''}
                onChange={(e) => setEditingProcess((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Priorité</label>
                <select
                  className="w-full text-sm rounded-md border bg-background px-3 py-2"
                  value={editingProcess.priority ?? 'Moyenne'}
                  onChange={(e) => setEditingProcess((p) => ({ ...p, priority: e.target.value as ProcessRow['priority'] }))}
                >
                  <option>Haute</option><option>Moyenne</option><option>Basse</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Statut</label>
                <select
                  className="w-full text-sm rounded-md border bg-background px-3 py-2"
                  value={editingProcess.status ?? 'À documenter'}
                  onChange={(e) => setEditingProcess((p) => ({ ...p, status: e.target.value as ProcessRow['status'] }))}
                >
                  <option>À documenter</option><option>En cours</option><option>Documenté</option><option>Automatisé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Logement lié</label>
                <select
                  className="w-full text-sm rounded-md border bg-background px-3 py-2"
                  value={editingProcess.property_id ?? ''}
                  onChange={(e) => setEditingProcess((p) => ({
                    ...p,
                    property_id: e.target.value || null,
                    is_template: !e.target.value,
                  }))}
                >
                  <option value="">— Aucun (template) —</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Types d'accès applicables</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ACCESS_TYPE_LABELS).map(([k, label]) => {
                    const selected = (editingProcess.access_type_applicable ?? []).includes(k)
                    return (
                      <button
                        key={k}
                        onClick={() => setEditingProcess((p) => p ? ({
                          ...p,
                          access_type_applicable: selected
                            ? (p.access_type_applicable ?? []).filter((x) => x !== k)
                            : [...(p.access_type_applicable ?? []), k],
                        }) : p)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          selected ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Pays applicables</label>
                <div className="flex flex-wrap gap-2">
                  {['FR', 'MA', 'BE', 'ES'].map((country) => {
                    const selected = (editingProcess.country_applicable ?? []).includes(country)
                    return (
                      <button
                        key={country}
                        onClick={() => setEditingProcess((p) => p ? ({
                          ...p,
                          country_applicable: selected
                            ? (p.country_applicable ?? []).filter((x) => x !== country)
                            : [...(p.country_applicable ?? []), country],
                        }) : p)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          selected ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'
                        }`}
                      >
                        {country}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Étapes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Étapes ({editSteps.length})
              </h2>
              <Button
                size="sm" variant="outline"
                onClick={() => setEditSteps((s) => [...s, {
                  step_number: s.length + 1, title: '', instruction: '',
                  responsible: 'agent_service_client', estimated_minutes: 5, is_automated: false,
                }])}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une étape
              </Button>
            </div>

            {editSteps.map((step, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Étape {i + 1}</span>
                  <button
                    onClick={() => setEditSteps((s) => s.filter((_, j) => j !== i))}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Titre</label>
                    <input
                      className="w-full text-sm rounded-md border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                      value={step.title ?? ''}
                      onChange={(e) => setEditSteps((s) => s.map((st, j) => j === i ? { ...st, title: e.target.value } : st))}
                      placeholder="Vérifier la checklist"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Responsable</label>
                    <select
                      className="w-full text-sm rounded-md border bg-background px-2.5 py-1.5"
                      value={step.responsible ?? 'agent_service_client'}
                      onChange={(e) => setEditSteps((s) => s.map((st, j) => j === i ? { ...st, responsible: e.target.value as ProcessStep['responsible'] } : st))}
                    >
                      <option value="agent_service_client">Agent SC</option>
                      <option value="equipe_menage">Équipe ménage</option>
                      <option value="gestionnaire">Gestionnaire</option>
                      <option value="voyageur">Voyageur</option>
                      <option value="automatique">Automatique</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{'Instruction (utilisez {{variable_name}} pour les variables)'}</label>
                  <textarea
                    className="w-full text-sm rounded-md border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={2}
                    value={step.instruction ?? ''}
                    onChange={(e) => setEditSteps((s) => s.map((st, j) => j === i ? { ...st, instruction: e.target.value } : st))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Outil</label>
                    <input
                      className="w-full text-sm rounded-md border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                      value={step.tool_needed ?? ''}
                      onChange={(e) => setEditSteps((s) => s.map((st, j) => j === i ? { ...st, tool_needed: e.target.value || null } : st))}
                      placeholder="LCD Tool / WhatsApp"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Durée (min)</label>
                    <input
                      type="number" min={0}
                      className="w-full text-sm rounded-md border bg-background px-2.5 py-1.5"
                      value={step.estimated_minutes ?? 5}
                      onChange={(e) => setEditSteps((s) => s.map((st, j) => j === i ? { ...st, estimated_minutes: Number(e.target.value) } : st))}
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step.is_automated ?? false}
                        onChange={(e) => setEditSteps((s) => s.map((st, j) => j === i ? { ...st, is_automated: e.target.checked } : st))}
                      />
                      Étape automatisée
                    </label>
                  </div>
                </div>
              </div>
            ))}

            {editSteps.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Aucune étape. Cliquez "Ajouter une étape" pour commencer.</p>
            )}
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t">
            <Button onClick={saveEditor} disabled={savingEditor || !editingProcess.process_name} className="gap-1.5">
              {savingEditor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {isNew ? 'Créer le process' : 'Enregistrer'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setView(editingProcess.is_template ? 'library' : 'by_property')}
            >
              Annuler
            </Button>
          </div>
        </div>
      </>
    )
  }

  // ── Navigation principale ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Onglets de navigation */}
      {view !== 'editor' && (
        <div className="px-6 pt-3 border-b shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => setView('library')}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
                view === 'library'
                  ? 'bg-background border border-b-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="h-4 w-4" /> Bibliothèque
            </button>
            <button
              onClick={() => setView('by_property')}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
                view === 'by_property'
                  ? 'bg-background border border-b-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="h-4 w-4" /> Par logement
            </button>
          </div>
        </div>
      )}

      {view === 'library'      && renderLibrary()}
      {view === 'by_property'  && renderByProperty()}
      {view === 'editor'       && renderEditor()}

    </div>
  )
}
