'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SourceBadge } from '@/components/crm/SourceBadge'
import type { CrmLead, PipelineType } from '@/components/crm/types'
import { STAGES, PRIORITY_CONFIG } from '@/components/crm/types'
import { Calendar, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface KanbanBoardProps {
  pipeline: PipelineType
  leads: CrmLead[]
  onLeadClick: (lead: CrmLead) => void
  onLeadsUpdated: (leads: CrmLead[]) => void
}

export function KanbanBoard({ pipeline, leads, onLeadClick, onLeadsUpdated }: KanbanBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const stages = STAGES[pipeline]

  function leadsByStage(stageKey: string) {
    return leads.filter(l => l.stage === stageKey)
  }

  function totalValue(stageKey: string) {
    const sl = leadsByStage(stageKey)
    if (pipeline === 'service_client') {
      const sum = sl.reduce((acc, l) => acc + (l.monthly_revenue_potential ?? 0), 0)
      return sum > 0 ? `${sum.toLocaleString('fr')} €/mois` : null
    }
    if (pipeline === 'immobilier') {
      const sum = sl.reduce((acc, l) => acc + (l.property_budget ?? 0), 0)
      return sum > 0 ? `${(sum / 1000).toFixed(0)}k MAD` : null
    }
    return null
  }

  async function handleDrop(e: React.DragEvent, newStage: string) {
    e.preventDefault()
    if (!dragId) return
    const lead = leads.find(l => l.id === dragId)
    if (!lead || lead.stage === newStage) { setDragId(null); return }
    const supabase = createClient()
    await supabase.from('crm_leads').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', dragId)
    onLeadsUpdated(leads.map(l => l.id === dragId ? { ...l, stage: newStage } : l))
    setDragId(null)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 h-full">
      {stages.map((stage) => {
        const stageLeads = leadsByStage(stage.key)
        const val = totalValue(stage.key)
        return (
          <div
            key={stage.key}
            className="flex-shrink-0 w-60 flex flex-col rounded-lg bg-muted/30 border"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, stage.key)}
          >
            {/* Colonne header */}
            <div className="px-3 py-2.5 border-b flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold">{stage.label}</span>
                {val && <span className="ml-1.5 text-xs text-muted-foreground">{val}</span>}
              </div>
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-medium">
                {stageLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {stageLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => onLeadClick(lead)}
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                  isDragging={dragId === lead.id}
                />
              ))}
              {stageLeads.length === 0 && (
                <div className="h-16 flex items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
                  Déposer ici
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Carte lead ────────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: CrmLead
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
}

function LeadCard({ lead, onClick, onDragStart, onDragEnd, isDragging }: LeadCardProps) {
  const pcfg = PRIORITY_CONFIG[lead.priority]
  const isOverdue = lead.next_action_date && new Date(lead.next_action_date) < new Date()

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-background rounded-md border p-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all select-none ${
        isDragging ? 'opacity-40 rotate-1 scale-95' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="text-xs font-semibold leading-tight line-clamp-1">
          {lead.full_name ?? lead.company_name ?? '—'}
        </p>
        <span className={`shrink-0 text-xs ${pcfg.color}`}>●</span>
      </div>
      {lead.company_name && lead.full_name && (
        <p className="text-xs text-muted-foreground mb-1.5 line-clamp-1">{lead.company_name}</p>
      )}
      {lead.city && <p className="text-xs text-muted-foreground mb-1.5">{lead.city}</p>}

      {/* Valeur */}
      {lead.monthly_revenue_potential != null && (
        <p className="text-xs font-medium text-green-700 mb-1.5">{lead.monthly_revenue_potential.toLocaleString('fr')} €/m</p>
      )}
      {lead.property_budget != null && (
        <p className="text-xs font-medium text-blue-700 mb-1.5">{(lead.property_budget/1000).toFixed(0)}k MAD</p>
      )}

      <div className="flex items-center justify-between mt-1.5">
        <SourceBadge source={lead.source} detail={lead.source_detail} referralName={lead.referral_name} size="xs" />
        {lead.next_action_date && (
          <div className={`flex items-center gap-0.5 text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
            <Calendar className="h-3 w-3" />
            {format(new Date(lead.next_action_date), 'dd/MM', { locale: fr })}
          </div>
        )}
      </div>
      {lead.next_action && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1 flex items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" />{lead.next_action}
        </p>
      )}
    </div>
  )
}
