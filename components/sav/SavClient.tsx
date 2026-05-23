'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow, format, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertTriangle, Plus, Filter, RefreshCw, Bell } from 'lucide-react'
import type { Incident, IncidentPriority, IncidentStatus, SavType } from './types'
import {
  PRIORITY_CONFIG, STATUS_CONFIG, SAV_TYPE_CONFIG,
  INDEMNISATION_STATUS_CONFIG, REPORTED_BY_CONFIG, PRIORITY_ORDER,
} from './types'
import { IncidentDetail } from './IncidentDetail'
import { NewIncidentForm } from './NewIncidentForm'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialIncidents: Incident[]
  properties: { id: string; name: string; city: string | null; country: string | null }[]
}

// ── Composant principal ───────────────────────────────────────────────────────

export function SavClient({ initialIncidents, properties }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [showNew, setShowNew] = useState(false)

  // Filtres
  const [filterProperty, setFilterProperty] = useState('')
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<IncidentPriority | 'all'>('all')
  const [filterType, setFilterType] = useState<SavType | 'all'>('all')
  const [filterTakenInCharge, setFilterTakenInCharge] = useState<'all' | 'yes' | 'no'>('all')
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [sortCol, setSortCol] = useState<'priority' | 'created_at' | 'status' | 'progress'>('priority')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Métriques
  const urgent   = incidents.filter(i => i.priority === 'urgente' && i.status !== 'resolved').length
  const high     = incidents.filter(i => i.priority === 'haute'   && i.status !== 'resolved').length
  const open     = incidents.filter(i => i.status !== 'resolved').length
  const thisMonth = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0)
    return incidents.filter(i => i.status === 'resolved' && new Date(i.updated_at) >= start).length
  }, [incidents])

  // Filtre + tri
  const filtered = useMemo(() => {
    const now = new Date()
    let list = incidents.filter(i => {
      if (filterProperty && i.property_id !== filterProperty) return false
      if (filterStatus !== 'all' && i.status !== filterStatus) return false
      if (filterPriority !== 'all' && i.priority !== filterPriority) return false
      if (filterType !== 'all' && i.sav_type !== filterType) return false
      if (filterTakenInCharge === 'yes' && !i.taken_in_charge) return false
      if (filterTakenInCharge === 'no'  &&  i.taken_in_charge) return false
      if (filterPeriod !== 'all') {
        const d = new Date(i.created_at)
        if (filterPeriod === 'today') {
          const s = new Date(); s.setHours(0,0,0,0)
          if (d < s) return false
        } else if (filterPeriod === 'week') {
          const s = new Date(now); s.setDate(now.getDate() - 7)
          if (d < s) return false
        } else if (filterPeriod === 'month') {
          const s = new Date(now); s.setDate(1); s.setHours(0,0,0,0)
          if (d < s) return false
        }
      }
      return true
    })
    list = [...list].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      if (sortCol === 'priority') { va = PRIORITY_ORDER[a.priority]; vb = PRIORITY_ORDER[b.priority] }
      else if (sortCol === 'created_at') { va = a.created_at; vb = b.created_at }
      else if (sortCol === 'status') { va = a.status; vb = b.status }
      else if (sortCol === 'progress') { va = a.progress; vb = b.progress }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [incidents, filterProperty, filterStatus, filterPriority, filterType, filterTakenInCharge, filterPeriod, sortCol, sortDir])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  async function refresh() {
    const supabase = createClient()
    const { data } = await supabase
      .from('incidents')
      .select(`
        *,
        property:properties(id, name, city, country),
        reservation:reservations(id, check_in, check_out, platform, guest:guests(full_name, phone))
      `)
      .order('created_at', { ascending: false })
    if (data) setIncidents(data as unknown as Incident[])
  }

  async function patchIncident(id: string, patch: Partial<Incident>) {
    const supabase = createClient()
    await supabase.from('incidents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : prev)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderBottom: '1px solid #E8E4DC', background: '#FFFFFF' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h1 style={{ fontFamily: 'var(--font-heading), serif', fontSize: 22, fontWeight: 500, color: '#1A1A1A' }}>
            SAV & Incidents
          </h1>
          {urgent > 0 && <Metric n={urgent} label="urgents" color="#C0392B" />}
          {high > 0   && <Metric n={high}   label="haute"   color="#C17C1A" />}
          <Metric n={open}     label="ouverts" color="#666666" />
          <Metric n={thisMonth} label="résolus ce mois" color="#2E7D52" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-2 rounded-lg transition-colors"
            style={{ border: '1px solid #E8E4DC', color: '#999999' }}
            title="Actualiser"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#C4A044', color: '#FFFFFF' }}
          >
            <Plus className="h-4 w-4" />
            Nouvel incident
          </button>
        </div>
      </div>

      {/* ── Filtres ───────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-6 py-3 flex items-center gap-3 flex-wrap"
        style={{ borderBottom: '1px solid #E8E4DC', background: '#F8F7F5' }}
      >
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        <FilterSelect value={filterProperty} onChange={setFilterProperty} label="Logement">
          <option value="">Tous les logements</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FilterSelect>

        <FilterSelect value={filterStatus} onChange={v => setFilterStatus(v as IncidentStatus | 'all')} label="Statut">
          <option value="all">Tous statuts</option>
          <option value="open">Ouvert</option>
          <option value="in_progress">En cours</option>
          <option value="resolved">Résolu</option>
        </FilterSelect>

        <FilterSelect value={filterPriority} onChange={v => setFilterPriority(v as IncidentPriority | 'all')} label="Priorité">
          <option value="all">Toutes priorités</option>
          <option value="urgente">Urgente</option>
          <option value="haute">Haute</option>
          <option value="normale">Normale</option>
          <option value="basse">Basse</option>
        </FilterSelect>

        <FilterSelect value={filterType} onChange={v => setFilterType(v as SavType | 'all')} label="Type">
          <option value="all">Tous types</option>
          {(Object.entries(SAV_TYPE_CONFIG) as [SavType, { label: string; icon: string }][]).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect value={filterTakenInCharge} onChange={v => setFilterTakenInCharge(v as 'all' | 'yes' | 'no')} label="Pris en charge">
          <option value="all">Tous</option>
          <option value="yes">Pris en charge</option>
          <option value="no">Non pris en charge</option>
        </FilterSelect>

        <FilterSelect value={filterPeriod} onChange={v => setFilterPeriod(v as 'all' | 'today' | 'week' | 'month')} label="Période">
          <option value="all">Tout</option>
          <option value="today">Aujourd&apos;hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
        </FilterSelect>

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} incident{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Tableau ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 1400 }}>
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid #E8E4DC' }}>
              {[
                { key: 'priority',   label: 'Priorité',     sortable: true  },
                { key: 'property',   label: 'Logement',     sortable: false },
                { key: 'sav_type',   label: 'Type',         sortable: false },
                { key: 'title',      label: 'Titre',        sortable: false },
                { key: 'reported_by',label: 'Signalé par',  sortable: false },
                { key: 'provider',   label: 'Intervenant',  sortable: false },
                { key: 'taken',      label: 'Pris en ch.', sortable: false },
                { key: 'status',     label: 'Statut',       sortable: true  },
                { key: 'progress',   label: 'Avancement',   sortable: true  },
                { key: 'est_cost',   label: 'Coût est.',    sortable: false },
                { key: 'act_cost',   label: 'Coût réel',    sortable: false },
                { key: 'billable',   label: 'Rembours.',    sortable: false },
                { key: 'indem',      label: 'Indemn.',      sortable: false },
                { key: 'resolved',   label: 'Résolu',       sortable: false },
                { key: 'last_action',label: 'Dern. action', sortable: false },
                { key: 'actions',    label: 'Actions',      sortable: false },
              ].map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-[#C4A044]' : ''}`}
                  style={{ color: '#666666' }}
                  onClick={() => col.sortable && toggleSort(col.key as typeof sortCol)}
                >
                  {col.label}{col.sortable && sortCol === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={16} className="py-16 text-center text-sm text-muted-foreground">
                  Aucun incident
                </td>
              </tr>
            ) : filtered.map(incident => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                onSelect={() => setSelected(incident)}
                onPatch={(patch) => patchIncident(incident.id, patch)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Détail drawer ─────────────────────────────────────────────────── */}
      {selected && (
        <IncidentDetail
          incident={selected}
          onClose={() => setSelected(null)}
          onPatch={(patch) => patchIncident(selected.id, patch)}
          onDelete={() => {
            setIncidents(prev => prev.filter(i => i.id !== selected.id))
            setSelected(null)
          }}
        />
      )}

      {/* ── Formulaire nouvel incident ────────────────────────────────────── */}
      {showNew && (
        <NewIncidentForm
          properties={properties}
          onClose={() => setShowNew(false)}
          onCreate={(incident) => {
            setIncidents(prev => [incident as Incident, ...prev])
            setShowNew(false)
          }}
        />
      )}
    </div>
  )
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function Metric({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: `${color}14`, color, border: `1px solid ${color}40` }}
    >
      {n} {label}
    </span>
  )
}

function FilterSelect({
  value, onChange, label, children,
}: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs rounded-md px-2.5 py-1.5 outline-none"
      style={{ border: '1px solid #E8E4DC', background: '#FFFFFF', color: '#1A1A1A' }}
      aria-label={label}
    >
      {children}
    </select>
  )
}

// ── Ligne incident ─────────────────────────────────────────────────────────────

function IncidentRow({
  incident, onSelect, onPatch,
}: { incident: Incident; onSelect: () => void; onPatch: (p: Partial<Incident>) => void }) {
  const pcfg = PRIORITY_CONFIG[incident.priority]
  const scfg = STATUS_CONFIG[incident.status]
  const typecfg = incident.sav_type ? SAV_TYPE_CONFIG[incident.sav_type] : null
  const repCfg = REPORTED_BY_CONFIG[incident.reported_by]
  const indemCfg = INDEMNISATION_STATUS_CONFIG[incident.indemnisation_status]
  const country = incident.property?.country

  const indemnDeadlineSoon = incident.indemnisation_deadline &&
    differenceInDays(new Date(incident.indemnisation_deadline), new Date()) <= 3 &&
    incident.indemnisation_status === 'a_declarer'

  return (
    <tr
      className="border-b transition-colors hover:bg-[#F8F7F5]"
      style={{ borderColor: '#E8E4DC' }}
    >
      {/* Priorité */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${pcfg.pulse ? 'animate-pulse' : ''}`}
          style={{ background: pcfg.bg, color: pcfg.color, border: `1px solid ${pcfg.border}` }}
        >
          {pcfg.label}
        </span>
      </td>

      {/* Logement */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="text-xs font-medium" style={{ color: '#1A1A1A' }}>
          {incident.property?.name ?? '—'}
        </div>
        {incident.property?.city && (
          <div className="text-[10px]" style={{ color: '#999999' }}>
            {country === 'MA' ? '🇲🇦' : country === 'FR' ? '🇫🇷' : ''} {incident.property.city}
          </div>
        )}
      </td>

      {/* Type */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {typecfg ? (
          <span className="text-xs">{typecfg.icon} {typecfg.label}</span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>

      {/* Titre */}
      <td className="px-3 py-2.5">
        <button
          onClick={onSelect}
          className="text-xs font-medium text-left hover:underline max-w-[180px] truncate block"
          style={{ color: '#C4A044' }}
        >
          {incident.title || incident.description?.slice(0, 60) || 'Incident sans titre'}
        </button>
      </td>

      {/* Signalé par */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-[11px] font-medium" style={{ color: repCfg.color }}>
          {repCfg.label}
        </span>
      </td>

      {/* Intervenant */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {incident.assigned_provider ? (
          <div>
            <div className="text-xs" style={{ color: '#1A1A1A' }}>{incident.assigned_provider}</div>
            {incident.provider_phone && (
              <a href={`tel:${incident.provider_phone}`} className="text-[10px]" style={{ color: '#C4A044' }}>
                {incident.provider_phone}
              </a>
            )}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>

      {/* Pris en charge (toggle) */}
      <td className="px-3 py-2.5 text-center">
        <button
          onClick={() => onPatch({
            taken_in_charge: !incident.taken_in_charge,
            taken_in_charge_at: !incident.taken_in_charge ? new Date().toISOString() : null,
          })}
          className="w-10 h-5 rounded-full relative transition-colors"
          style={{ background: incident.taken_in_charge ? '#2E7D52' : '#E8E4DC' }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ transform: incident.taken_in_charge ? 'translateX(22px)' : 'translateX(2px)' }}
          />
        </button>
      </td>

      {/* Statut (dropdown inline) */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <select
          value={incident.status}
          onChange={e => onPatch({ status: e.target.value as IncidentStatus })}
          className="text-[11px] font-semibold rounded px-2 py-0.5 outline-none"
          style={{ background: scfg.bg, color: scfg.color, border: 'none' }}
        >
          <option value="open">Ouvert</option>
          <option value="in_progress">En cours</option>
          <option value="resolved">Résolu</option>
        </select>
      </td>

      {/* Avancement */}
      <td className="px-3 py-2.5 whitespace-nowrap" style={{ minWidth: 100 }}>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#E8E4DC' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${incident.progress}%`,
                background: incident.progress >= 100 ? '#2E7D52' : incident.progress >= 50 ? '#C4A044' : '#C17C1A',
              }}
            />
          </div>
          <span className="text-[10px]" style={{ color: '#999999' }}>{incident.progress}%</span>
        </div>
      </td>

      {/* Coût estimé */}
      <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color: '#666666' }}>
        {incident.estimated_cost > 0
          ? `${incident.estimated_cost.toLocaleString('fr')} ${country === 'MA' ? 'MAD' : '€'}`
          : '—'
        }
      </td>

      {/* Coût réel */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <input
          type="number"
          min={0}
          value={incident.actual_cost || ''}
          onChange={e => onPatch({ actual_cost: parseFloat(e.target.value) || 0 })}
          className="w-20 text-xs rounded px-1.5 py-0.5 outline-none"
          style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
          placeholder="0"
        />
      </td>

      {/* Remboursable */}
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={incident.billable_to_owner}
          onChange={e => onPatch({ billable_to_owner: e.target.checked })}
          className="w-4 h-4 rounded accent-[#C4A044]"
        />
      </td>

      {/* Indemnisation */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {incident.indemnisation_type && incident.indemnisation_type !== 'aucune' ? (
          <div className="flex items-center gap-1">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: indemCfg.bg, color: indemCfg.color }}
            >
              {indemCfg.label}
            </span>
            {indemnDeadlineSoon && (
              <span title="Deadline proche !" style={{ color: '#C0392B' }}>
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>

      {/* Résolu */}
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={incident.status === 'resolved'}
          onChange={e => onPatch({
            status: e.target.checked ? 'resolved' : 'open',
            resolved_at: e.target.checked ? new Date().toISOString() : null,
            progress: e.target.checked ? 100 : incident.progress,
          })}
          className="w-4 h-4 rounded accent-[#2E7D52]"
        />
      </td>

      {/* Dernière action */}
      <td className="px-3 py-2.5 whitespace-nowrap text-[11px]" style={{ color: '#999999' }}>
        {formatDistanceToNow(new Date(incident.updated_at), { addSuffix: true, locale: fr })}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <ActionBtn title="Voir détail" onClick={onSelect}>🔍</ActionBtn>
          <ActionBtn title="Envoyer relance" onClick={async () => {
            await fetch('/api/sav/remind', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ incident_id: incident.id, message: 'Relance manuelle' }),
            })
          }}>
            <Bell className="h-3 w-3" />
          </ActionBtn>
        </div>
      </td>
    </tr>
  )
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-1.5 rounded text-xs transition-colors hover:bg-[#F2F0EC]"
      style={{ color: '#666666' }}
    >
      {children}
    </button>
  )
}
