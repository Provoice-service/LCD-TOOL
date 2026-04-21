'use client'

import { useState } from 'react'
import { KanbanBoard } from '@/components/crm/KanbanBoard'
import { LeadsList } from '@/components/crm/LeadsList'
import { LeadDetail } from '@/components/crm/LeadDetail'
import { CrmDashboard } from '@/components/crm/CrmDashboard'
import { ExpansionMarkets } from '@/components/crm/ExpansionMarkets'
import { NewLeadForm } from '@/components/crm/NewLeadForm'
import type { CrmLead, CrmMarket, PipelineType } from '@/components/crm/types'
import { PIPELINE_LABELS } from '@/components/crm/types'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, List, BarChart2 } from 'lucide-react'

type TopTab  = 'pipeline' | 'dashboard' | 'expansion'
type ViewMode = 'kanban' | 'list'

interface CrmClientProps {
  initialLeads: CrmLead[]
  initialMarkets: CrmMarket[]
}

export function CrmClient({ initialLeads, initialMarkets }: CrmClientProps) {
  const [leads, setLeads]               = useState<CrmLead[]>(initialLeads)
  const [topTab, setTopTab]             = useState<TopTab>('pipeline')
  const [pipeline, setPipeline]         = useState<PipelineType>('service_client')
  const [view, setView]                 = useState<ViewMode>('kanban')
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null)
  const [showNewLead, setShowNewLead]   = useState(false)

  const pipelineLeads = leads.filter(l => l.pipeline_type === pipeline)

  function handleLeadUpdated(updated: CrmLead) {
    setLeads(ls => ls.map(l => l.id === updated.id ? updated : l))
    setSelectedLead(updated)
  }

  function handleLeadCreated(lead: CrmLead) {
    setLeads(ls => [lead, ...ls])
    setShowNewLead(false)
    setSelectedLead(lead)
    // Switch to the correct pipeline tab
    setPipeline(lead.pipeline_type)
    setTopTab('pipeline')
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Top navigation ───────────────────────────────────────────────── */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-2 gap-3">
          <div className="flex items-center gap-1">
            {([
              { key: 'pipeline',   label: 'Pipeline',        icon: LayoutGrid },
              { key: 'dashboard',  label: 'Dashboard & KPIs', icon: BarChart2  },
              { key: 'expansion',  label: 'Expansion',        icon: null        },
            ] as { key: TopTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTopTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  topTab === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowNewLead(true)} className="gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" /> Nouveau lead
          </Button>
        </div>

        {/* Pipeline sub-tabs */}
        {topTab === 'pipeline' && (
          <div className="flex items-center justify-between px-4 pb-2">
            <div className="flex gap-1">
              {(['service_client','immobilier','expansion'] as PipelineType[]).map(p => {
                const count = leads.filter(l=>l.pipeline_type===p && !['churned','lost'].includes(l.stage)).length
                return (
                  <button
                    key={p}
                    onClick={() => setPipeline(p)}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      pipeline === p
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {PIPELINE_LABELS[p]}
                    <span className="ml-1.5 text-xs bg-muted-foreground/20 rounded-full px-1.5 py-0.5">{count}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setView('kanban')}
                className={`p-1.5 rounded-md transition-colors ${view==='kanban' ? 'bg-muted' : 'text-muted-foreground hover:text-foreground'}`}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setView('list')}
                className={`p-1.5 rounded-md transition-colors ${view==='list' ? 'bg-muted' : 'text-muted-foreground hover:text-foreground'}`}>
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">
        <div className={`flex-1 overflow-auto transition-all ${selectedLead ? 'lg:flex-[2]' : ''}`}>
          {topTab === 'dashboard' && (
            <CrmDashboard leads={leads} onLeadClick={l => { setSelectedLead(l); setTopTab('pipeline') }} />
          )}
          {topTab === 'expansion' && (
            <ExpansionMarkets initialMarkets={initialMarkets} />
          )}
          {topTab === 'pipeline' && view === 'kanban' && (
            <div className="h-full p-4">
              <KanbanBoard
                pipeline={pipeline}
                leads={pipelineLeads}
                onLeadClick={setSelectedLead}
                onLeadsUpdated={updated => setLeads(ls => ls.map(l => {
                  const u = updated.find(x => x.id === l.id)
                  return u ?? l
                }))}
              />
            </div>
          )}
          {topTab === 'pipeline' && view === 'list' && (
            <LeadsList leads={leads} onLeadClick={setSelectedLead} />
          )}
        </div>

        {/* ── Panel détail lead ─────────────────────────────────────────── */}
        {selectedLead && (
          <div className="w-96 border-l flex-shrink-0 relative overflow-hidden">
            <LeadDetail
              lead={selectedLead}
              onClose={() => setSelectedLead(null)}
              onUpdated={handleLeadUpdated}
            />
          </div>
        )}
      </div>

      {/* ── Modal nouveau lead ────────────────────────────────────────────── */}
      {showNewLead && (
        <NewLeadForm onClose={() => setShowNewLead(false)} onCreated={handleLeadCreated} />
      )}
    </div>
  )
}
