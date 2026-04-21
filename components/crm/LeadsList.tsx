'use client'

import { useState, useMemo } from 'react'
import { SourceBadge } from '@/components/crm/SourceBadge'
import type { CrmLead, PipelineType, LeadSource } from '@/components/crm/types'
import { STAGES, PRIORITY_CONFIG, SOURCE_CONFIG, PIPELINE_LABELS } from '@/components/crm/types'
import { Download, ChevronUp, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface LeadsListProps {
  leads: CrmLead[]
  onLeadClick: (lead: CrmLead) => void
}

type SortKey = 'full_name' | 'stage' | 'priority' | 'city' | 'monthly_revenue_potential' | 'next_action_date' | 'created_at'

const ALL_STAGES = Object.values(STAGES).flat().reduce<Record<string,string>>((acc, s) => { acc[s.key]=s.label; return acc }, {})

export function LeadsList({ leads, onLeadClick }: LeadsListProps) {
  const [search, setSearch]           = useState('')
  const [filterPipeline, setFP]       = useState<PipelineType | 'all'>('all')
  const [filterStage, setFS]          = useState('all')
  const [filterSource, setFSrc]       = useState<LeadSource | 'all'>('all')
  const [filterPriority, setFPri]     = useState<'all'|'haute'|'normale'|'basse'>('all')
  const [sortKey, setSortKey]         = useState<SortKey>('created_at')
  const [sortDir, setSortDir]         = useState<'asc'|'desc'>('desc')

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let r = leads
    if (filterPipeline !== 'all') r = r.filter(l => l.pipeline_type === filterPipeline)
    if (filterStage !== 'all')    r = r.filter(l => l.stage === filterStage)
    if (filterSource !== 'all')   r = r.filter(l => l.source === filterSource)
    if (filterPriority !== 'all') r = r.filter(l => l.priority === filterPriority)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(l =>
        l.full_name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''
      const bv = (b as any)[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'fr')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, filterPipeline, filterStage, filterSource, filterPriority, search, sortKey, sortDir])

  function exportCSV() {
    const headers = ['Nom','Entreprise','Pipeline','Stage','Priorité','Source','Détail source','Ville','Valeur €','Prochaine action','Date action','Créé le']
    const rows = filtered.map(l => [
      l.full_name??'', l.company_name??'', PIPELINE_LABELS[l.pipeline_type],
      ALL_STAGES[l.stage]??l.stage, l.priority,
      SOURCE_CONFIG[l.source].label, l.source_detail??'',
      l.city??'',
      l.monthly_revenue_potential??l.property_budget??'',
      l.next_action??'',
      l.next_action_date ? format(new Date(l.next_action_date),'dd/MM/yyyy') : '',
      format(new Date(l.created_at),'dd/MM/yyyy'),
    ].map(v => `"${String(v).replace(/"/g,'""')}"`))
    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    a.download = `crm_leads_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filtres */}
      <div className="flex flex-wrap gap-2 p-3 border-b items-center">
        <input className="input-base text-sm h-8 w-44" placeholder="Rechercher…"
          value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="input-base text-xs h-8" value={filterPipeline} onChange={e=>setFP(e.target.value as any)}>
          <option value="all">Tous pipelines</option>
          {(['service_client','immobilier','expansion'] as PipelineType[]).map(p=>(
            <option key={p} value={p}>{PIPELINE_LABELS[p]}</option>
          ))}
        </select>
        <select className="input-base text-xs h-8" value={filterStage} onChange={e=>setFS(e.target.value)}>
          <option value="all">Tous stages</option>
          {Object.entries(ALL_STAGES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input-base text-xs h-8" value={filterSource} onChange={e=>setFSrc(e.target.value as any)}>
          <option value="all">Toutes sources</option>
          {(Object.entries(SOURCE_CONFIG) as [LeadSource, typeof SOURCE_CONFIG[LeadSource]][]).map(([k,v])=>(
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="input-base text-xs h-8" value={filterPriority} onChange={e=>setFPri(e.target.value as any)}>
          <option value="all">Priorité</option>
          <option value="haute">Haute</option>
          <option value="normale">Normale</option>
          <option value="basse">Basse</option>
        </select>
        <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2.5 py-1.5 ml-auto hover:bg-muted/50 transition-colors">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} leads</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b text-xs">
            <tr>
              {([
                ['full_name','Nom'],['stage','Stage'],['priority','Priorité'],
                [null,'Source'],[null,'Ville'],['monthly_revenue_potential','Valeur'],
                ['next_action_date','Prochaine action'],['created_at','Créé le'],
              ] as [SortKey|null, string][]).map(([k,h]) => (
                <th key={h} className={`text-left px-3 py-2.5 font-medium whitespace-nowrap ${k ? 'cursor-pointer hover:text-foreground' : ''}`}
                  onClick={k ? ()=>toggleSort(k) : undefined}>
                  {h} {k && <SortIcon k={k} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => {
              const pcfg = PRIORITY_CONFIG[lead.priority]
              const isOverdue = lead.next_action_date && new Date(lead.next_action_date) < new Date()
              return (
                <tr key={lead.id} onClick={()=>onLeadClick(lead)}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{lead.full_name ?? lead.company_name ?? '—'}</p>
                    {lead.company_name && lead.full_name && <p className="text-xs text-muted-foreground">{lead.company_name}</p>}
                    <span className="text-xs text-muted-foreground">{PIPELINE_LABELS[lead.pipeline_type]}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-md whitespace-nowrap">
                      {ALL_STAGES[lead.stage] ?? lead.stage}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium ${pcfg.color}`}>{pcfg.label}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <SourceBadge source={lead.source} detail={lead.source_detail} referralName={lead.referral_name} size="xs" />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{lead.city ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                    {lead.monthly_revenue_potential != null && `${lead.monthly_revenue_potential.toLocaleString('fr')} €/m`}
                    {lead.property_budget != null && `${(lead.property_budget/1000).toFixed(0)}k MAD`}
                  </td>
                  <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {lead.next_action && <p className="truncate max-w-32">{lead.next_action}</p>}
                    {lead.next_action_date && format(new Date(lead.next_action_date),'dd/MM/yy',{locale:fr})}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(lead.created_at),'dd/MM/yy',{locale:fr})}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">Aucun lead trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
