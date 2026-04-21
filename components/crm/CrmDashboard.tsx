'use client'

import type { CrmLead } from '@/components/crm/types'
import { SOURCE_CONFIG, PIPELINE_LABELS, PRIORITY_CONFIG } from '@/components/crm/types'
import { SourceBadge } from '@/components/crm/SourceBadge'
import { AlertCircle, TrendingUp, Users, Calendar } from 'lucide-react'
import { format, isToday, isPast, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

interface CrmDashboardProps {
  leads: CrmLead[]
  onLeadClick: (lead: CrmLead) => void
}

export function CrmDashboard({ leads, onLeadClick }: CrmDashboardProps) {
  const activeLeads = leads.filter(l => !['churned','lost','active'].includes(l.stage))
  const scLeads     = leads.filter(l => l.pipeline_type === 'service_client')
  const immoLeads   = leads.filter(l => l.pipeline_type === 'immobilier')

  const mrrNego = scLeads
    .filter(l => ['negotiation','offer_sent','demo'].includes(l.stage))
    .reduce((s, l) => s + (l.monthly_revenue_potential ?? 0), 0)

  const immoPipeline = immoLeads
    .reduce((s, l) => s + (l.property_budget ?? 0), 0)

  const since7days = leads.filter(l => new Date(l.created_at) >= subDays(new Date(),7))

  const totalConverted = leads.filter(l => ['signed','active','acte','launched'].includes(l.stage)).length
  const convRate = leads.length > 0 ? Math.round((totalConverted / leads.length) * 100) : 0

  // Leads avec action due aujourd'hui ou dépassée
  const dueActions = leads
    .filter(l => l.next_action_date && (isToday(new Date(l.next_action_date)) || isPast(new Date(l.next_action_date))) && !['churned','lost'].includes(l.stage))
    .sort((a, b) => {
      const pOrder = { haute: 0, normale: 1, basse: 2 }
      return (pOrder[a.priority]??1) - (pOrder[b.priority]??1)
    })

  // Stats par source
  type SourceStat = { nb: number; converted: number; revenue: number }
  const sourceStats: Partial<Record<string, SourceStat>> = {}
  for (const l of leads) {
    if (!sourceStats[l.source]) sourceStats[l.source] = { nb: 0, converted: 0, revenue: 0 }
    sourceStats[l.source]!.nb++
    if (['signed','active','acte','launched'].includes(l.stage)) {
      sourceStats[l.source]!.converted++
      sourceStats[l.source]!.revenue += l.monthly_revenue_potential ?? 0
    }
  }
  const sortedSources = Object.entries(sourceStats)
    .sort(([,a],[,b]) => b!.nb - a!.nb)

  const maxNb = Math.max(...sortedSources.map(([,s])=>s!.nb), 1)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,     label: 'Leads actifs',        value: activeLeads.length,            sub: `${leads.length} total` },
          { icon: TrendingUp,label: 'MRR en négociation',  value: mrrNego > 0 ? `${mrrNego.toLocaleString('fr')} €/m` : '—', sub: 'service client' },
          { icon: TrendingUp,label: 'Pipeline immo',       value: immoPipeline > 0 ? `${(immoPipeline/1000).toFixed(0)}k MAD` : '—', sub: 'valeur totale' },
          { icon: Calendar,  label: 'Taux de conversion',  value: `${convRate}%`, sub: `${since7days.length} leads cette semaine` },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Actions à faire ─────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Actions à faire aujourd&apos;hui</h3>
            {dueActions.length > 0 && (
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                {dueActions.length}
              </span>
            )}
          </div>
          {dueActions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune action en attente 🎉</p>
          ) : (
            <div className="space-y-2">
              {dueActions.slice(0,8).map(lead => {
                const pcfg = PRIORITY_CONFIG[lead.priority]
                const overdue = lead.next_action_date && isPast(new Date(lead.next_action_date)) && !isToday(new Date(lead.next_action_date))
                return (
                  <button key={lead.id} onClick={() => onLeadClick(lead)}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">{lead.full_name ?? lead.company_name}</p>
                        <span className={`text-xs ${pcfg.color}`}>●</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lead.next_action}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <SourceBadge source={lead.source} size="xs" />
                      <p className={`text-xs mt-1 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {lead.next_action_date ? format(new Date(lead.next_action_date),'dd/MM',{locale:fr}) : ''}
                        {overdue && ' ⚠'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Sources ─────────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold text-sm mb-3">Leads par source</h3>
          <div className="space-y-2.5">
            {sortedSources.map(([src, stat]) => {
              const rate = stat!.nb > 0 ? Math.round((stat!.converted / stat!.nb) * 100) : 0
              const barW = Math.round((stat!.nb / maxNb) * 100)
              return (
                <div key={src}>
                  <div className="flex items-center justify-between mb-1">
                    <SourceBadge source={src as any} size="xs" />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{stat!.nb} leads</span>
                      <span className="text-green-700">{rate}% conv.</span>
                      {stat!.revenue > 0 && <span className="text-blue-700">{stat!.revenue.toLocaleString('fr')} €</span>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${barW}%` }} />
                  </div>
                </div>
              )
            })}
            {sortedSources.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun lead.</p>}
          </div>
        </div>
      </div>

      {/* ── Leads récents ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">Leads récents (7 jours)</h3>
        {since7days.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun lead cette semaine.</p>
        ) : (
          <div className="space-y-1">
            {since7days.slice(0,10).map(l => (
              <button key={l.id} onClick={() => onLeadClick(l)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{l.full_name ?? l.company_name ?? '—'}</span>
                  <span className="text-xs text-muted-foreground ml-2">{PIPELINE_LABELS[l.pipeline_type]}</span>
                </div>
                <SourceBadge source={l.source} size="xs" />
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(l.created_at),'dd/MM',{locale:fr})}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
