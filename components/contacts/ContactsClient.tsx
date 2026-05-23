'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Star, Phone, MessageCircle, RefreshCw, Pencil } from 'lucide-react'
import type { Provider } from './types'
import { SPECIALTY_LABEL, SPECIALTY_COLOR, AVAILABILITY_CONFIG } from './types'
import { ProviderForm } from './ProviderForm'

interface Props {
  initialProviders: Provider[]
  properties: { id: string; name: string }[]
}

export function ContactsClient({ initialProviders, properties }: Props) {
  const [providers, setProviders] = useState<Provider[]>(initialProviders)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [query, setQuery] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterAvail, setFilterAvail] = useState('')
  const [filterPreferred, setFilterPreferred] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'interventions'>('rating')

  const cities = useMemo(() =>
    [...new Set(providers.map(p => p.city).filter(Boolean) as string[])].sort(),
    [providers])

  const allSpecialties = useMemo(() =>
    [...new Set(providers.flatMap(p => p.specialties ?? []))].sort(),
    [providers])

  const filtered = useMemo(() => {
    let list = providers.filter(p => p.is_active)
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.city ?? '').toLowerCase().includes(q) ||
        (p.specialties ?? []).some(s => (SPECIALTY_LABEL[s] ?? s).toLowerCase().includes(q))
      )
    }
    if (filterSpecialty) list = list.filter(p => (p.specialties ?? []).includes(filterSpecialty))
    if (filterCity) list = list.filter(p => p.city === filterCity)
    if (filterAvail) list = list.filter(p => p.availability === filterAvail)
    if (filterPreferred) list = list.filter(p => p.is_preferred)
    return [...list].sort((a, b) => {
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortBy === 'interventions') return (b.intervention_count ?? 0) - (a.intervention_count ?? 0)
      return a.name.localeCompare(b.name)
    })
  }, [providers, query, filterSpecialty, filterCity, filterAvail, filterPreferred, sortBy])

  async function refresh() {
    const supabase = createClient()
    const { data } = await supabase.from('providers').select('*').order('name')
    if (data) setProviders(data as Provider[])
  }

  function handleSaved(p: Provider) {
    setProviders(prev => {
      const exists = prev.find(x => x.id === p.id)
      return exists ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]
    })
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E4DC', background: '#FFFFFF' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading), serif', fontSize: 22, fontWeight: 500, color: '#1A1A1A' }}>
            Annuaire Intervenants
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#666666' }}>{providers.filter(p => p.is_active).length} intervenants actifs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 rounded-lg" style={{ border: '1px solid #E8E4DC', color: '#999999' }}>
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#C4A044', color: '#FFFFFF' }}>
            <Plus className="h-4 w-4" />
            Nouvel intervenant
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="shrink-0 px-6 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid #E8E4DC', background: '#F8F7F5' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="text-xs rounded-md pl-8 pr-3 py-1.5 outline-none"
            style={{ border: '1px solid #E8E4DC', background: '#FFFFFF', color: '#1A1A1A', width: 180 }} />
        </div>

        {[
          { value: filterSpecialty, onChange: setFilterSpecialty, label: 'Spécialité',
            options: [['', 'Toutes'], ...allSpecialties.map(s => [s, SPECIALTY_LABEL[s] ?? s])] },
          { value: filterCity, onChange: setFilterCity, label: 'Ville',
            options: [['', 'Toutes villes'], ...cities.map(c => [c, c])] },
          { value: filterAvail, onChange: setFilterAvail, label: 'Disponibilité',
            options: [['', 'Toutes'], ['disponible', 'Disponible'], ['sur_rdv', 'Sur RDV'], ['indisponible', 'Indisponible']] },
          { value: sortBy, onChange: (v: string) => setSortBy(v as typeof sortBy), label: 'Trier par',
            options: [['rating', 'Note'], ['interventions', 'Interventions'], ['name', 'Nom']] },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => f.onChange(e.target.value)}
            className="text-xs rounded-md px-2.5 py-1.5 outline-none"
            style={{ border: '1px solid #E8E4DC', background: '#FFFFFF', color: '#1A1A1A' }}>
            {(f.options as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}

        <button onClick={() => setFilterPreferred(!filterPreferred)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors"
          style={filterPreferred
            ? { background: 'rgba(196,160,68,0.15)', color: '#A88830', border: '1px solid rgba(196,160,68,0.3)' }
            : { border: '1px solid #E8E4DC', color: '#666666', background: '#FFFFFF' }
          }>
          <Star className={`h-3.5 w-3.5 ${filterPreferred ? 'fill-[#C4A044] text-[#C4A044]' : ''}`} />
          Préférés
        </button>

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} résultats</span>
      </div>

      {/* Grille */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: '#CCCCCC' }}>
            <Search className="h-10 w-10 opacity-30" />
            <p className="text-sm">Aucun intervenant trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                onEdit={() => { setEditing(p); setShowForm(true) }}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ProviderForm
          provider={editing}
          properties={properties}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ── Card intervenant ───────────────────────────────────────────────────────────

function ProviderCard({ provider: p, onEdit }: { provider: Provider; onEdit: () => void }) {
  const avail = AVAILABILITY_CONFIG[p.availability]

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 relative group transition-shadow hover:shadow-md"
      style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}
    >
      {/* Edit button */}
      <button
        onClick={onEdit}
        className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#F2F0EC]"
      >
        <Pencil className="h-3.5 w-3.5" style={{ color: '#999999' }} />
      </button>

      {/* Avatar + nom */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
          style={{ background: 'rgba(196,160,68,0.10)', color: '#C4A044', border: '1px solid rgba(196,160,68,0.2)' }}
        >
          {p.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{p.name}</span>
            {p.is_preferred && <Star className="h-3.5 w-3.5 fill-[#C4A044] text-[#C4A044] shrink-0" />}
          </div>
          {p.city && <p className="text-xs" style={{ color: '#999999' }}>{p.city}{p.country !== 'FR' ? ` · ${p.country}` : ''}</p>}
        </div>
      </div>

      {/* Spécialités */}
      {(p.specialties ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(p.specialties ?? []).slice(0, 3).map(s => {
            const col = SPECIALTY_COLOR[s] ?? SPECIALTY_COLOR.autre
            return (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: col.bg, color: col.color }}>
                {SPECIALTY_LABEL[s] ?? s}
              </span>
            )
          })}
          {(p.specialties ?? []).length > 3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F8F7F5', color: '#999999' }}>
              +{(p.specialties ?? []).length - 3}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: avail.bg, color: avail.color }}
        >
          {avail.label}
        </span>
        <div className="flex items-center gap-2 text-xs" style={{ color: '#999999' }}>
          {p.rating > 0 && <span style={{ color: '#C4A044' }}>★ {p.rating.toFixed(1)}</span>}
          {p.intervention_count > 0 && <span>{p.intervention_count} interv.</span>}
        </div>
      </div>

      {/* Tarif */}
      {(p.hourly_rate || p.fixed_rate) && (
        <p className="text-xs" style={{ color: '#666666' }}>
          {p.hourly_rate ? `${p.hourly_rate} ${p.currency}/h` : ''}
          {p.hourly_rate && p.fixed_rate ? ' · ' : ''}
          {p.fixed_rate ? `${p.fixed_rate} ${p.currency} forfait` : ''}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid #F2F0EC' }}>
        {p.phone && (
          <a href={`tel:${p.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-colors"
            style={{ background: '#F8F7F5', color: '#1A1A1A', border: '1px solid #E8E4DC' }}>
            <Phone className="h-3 w-3" /> Appeler
          </a>
        )}
        {(p.whatsapp ?? p.phone) && (
          <a href={`https://wa.me/${(p.whatsapp ?? p.phone ?? '').replace(/\D/g, '')}`}
            target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(37,211,102,0.08)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }}>
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
