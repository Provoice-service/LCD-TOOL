'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import type { Incident, IncidentPriority, SavType, ReportedBy } from './types'
import { SAV_TYPE_CONFIG, PRIORITY_CONFIG } from './types'
import { addDays, format } from 'date-fns'

interface Props {
  properties: { id: string; name: string; city: string | null; country: string | null }[]
  onClose: () => void
  onCreate: (incident: Partial<Incident>) => void
}

export function NewIncidentForm({ properties, onClose, onCreate }: Props) {
  const [propertyId, setPropertyId] = useState('')
  const [title, setTitle] = useState('')
  const [savType, setSavType] = useState<SavType | ''>('')
  const [priority, setPriority] = useState<IncidentPriority>('normale')
  const [reportedBy, setReportedBy] = useState<ReportedBy>('voyageur')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState('')
  const [providerPhone, setProviderPhone] = useState('')
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [billable, setBillable] = useState(false)
  const [createTask, setCreateTask] = useState(billable)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProperty = properties.find(p => p.id === propertyId)
  const isAirbnb  = false // pourrait venir de la réservation liée
  const isBooking = false

  async function handleSubmit(e: React.FormEvent, notify: boolean) {
    e.preventDefault()
    if (!propertyId) { setError('Choisissez un logement'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data: incident, error: err } = await supabase
      .from('incidents')
      .insert({
        property_id: propertyId,
        title: title || null,
        sav_type: savType || null,
        priority,
        reported_by: reportedBy,
        description: description || null,
        assigned_provider: provider || null,
        provider_phone: providerPhone || null,
        estimated_cost: estimatedCost,
        billable_to_owner: billable,
        status: 'open',
        progress: 0,
        guest_notified: notify,
        indemnisation_status: 'non_demandee',
      })
      .select(`
        *,
        property:properties(id, name, city, country)
      `)
      .single()

    if (err || !incident) {
      setError(err?.message ?? 'Erreur création')
      setLoading(false)
      return
    }

    // Créer tâche agenda si remboursable
    if (billable && createTask && title) {
      const dueDate = format(addDays(new Date(), 12), 'yyyy-MM-dd')
      await supabase.from('tasks').insert({
        title: `Déclarer AirCover — ${selectedProperty?.name ?? ''}`,
        category: 'administratif',
        priority: 'urgent_important',
        due_date: dueDate,
        description: `Montant estimé : ${estimatedCost} €. Lien : https://www.airbnb.fr/resolutions`,
        status: 'todo',
        recurrence: 'none',
        tags: [],
        sort_order: 0,
      })
    }

    onCreate(incident as Partial<Incident>)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl"
        style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', boxShadow: '0 16px 64px rgba(0,0,0,0.10)' }}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E4DC' }}>
          <h2 style={{ fontFamily: 'var(--font-heading), serif', fontSize: 20, fontWeight: 500, color: '#1A1A1A' }}>
            Nouvel incident
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F2F0EC]">
            <X className="h-4 w-4" style={{ color: '#666666' }} />
          </button>
        </div>

        {/* Corps */}
        <form className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Logement */}
          <FormField label="Logement *">
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
            >
              <option value="">— Choisir un logement —</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ''}</option>
              ))}
            </select>
          </FormField>

          {/* Titre */}
          <FormField label="Titre">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Fuite sous l'évier cuisine"
              className="w-full text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
            />
          </FormField>

          {/* Type SAV */}
          <FormField label="Type SAV">
            <select
              value={savType}
              onChange={e => setSavType(e.target.value as SavType | '')}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
            >
              <option value="">— Choisir —</option>
              {(Object.entries(SAV_TYPE_CONFIG) as [SavType, { label: string; icon: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </FormField>

          {/* Priorité */}
          <FormField label="Priorité">
            <div className="grid grid-cols-4 gap-2">
              {(['urgente', 'haute', 'normale', 'basse'] as IncidentPriority[]).map(p => {
                const cfg = PRIORITY_CONFIG[p]
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className="text-xs font-semibold px-2 py-2 rounded-lg transition-all"
                    style={priority === p
                      ? { background: cfg.color, color: '#FFFFFF' }
                      : { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }
                    }
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </FormField>

          {/* Signalé par */}
          <FormField label="Signalé par">
            <select
              value={reportedBy}
              onChange={e => setReportedBy(e.target.value as ReportedBy)}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
            >
              <option value="voyageur">Voyageur</option>
              <option value="equipe">Équipe</option>
              <option value="gestionnaire">Gestionnaire</option>
              <option value="proprietaire">Propriétaire</option>
            </select>
          </FormField>

          {/* Description */}
          <FormField label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Décrivez le problème en détail…"
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
            />
          </FormField>

          {/* Intervenant */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Intervenant pressenti">
              <input
                type="text"
                value={provider}
                onChange={e => setProvider(e.target.value)}
                placeholder="Nom prestataire"
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
              />
            </FormField>
            <FormField label="Téléphone">
              <input
                type="tel"
                value={providerPhone}
                onChange={e => setProviderPhone(e.target.value)}
                placeholder="+212 6..."
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
              />
            </FormField>
          </div>

          {/* Coût estimé */}
          <FormField label="Coût estimé (€)">
            <input
              type="number"
              min={0}
              value={estimatedCost || ''}
              onChange={e => setEstimatedCost(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
            />
          </FormField>

          {/* Refacturable */}
          <div className="flex items-center gap-3">
            <input
              id="billable"
              type="checkbox"
              checked={billable}
              onChange={e => { setBillable(e.target.checked); setCreateTask(e.target.checked) }}
              className="w-4 h-4 rounded accent-[#C4A044]"
            />
            <label htmlFor="billable" className="text-sm" style={{ color: '#1A1A1A' }}>
              Refacturable au propriétaire
            </label>
          </div>

          {/* Créer tâche agenda */}
          {billable && (
            <div
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(196,160,68,0.08)', border: '1px solid rgba(196,160,68,0.2)' }}
            >
              <input
                id="createTask"
                type="checkbox"
                checked={createTask}
                onChange={e => setCreateTask(e.target.checked)}
                className="w-4 h-4 rounded accent-[#C4A044]"
              />
              <label htmlFor="createTask" className="text-sm" style={{ color: '#A88830' }}>
                Créer une tâche agenda AirCover (deadline automatique)
              </label>
            </div>
          )}

          {/* Alertes AirCover/Booking */}
          {propertyId && estimatedCost > 0 && isAirbnb && (
            <div className="p-3 rounded-lg text-sm flex items-start gap-2" style={{ background: '#FFF8F0', border: '1px solid #FFDCB0', color: '#C17C1A' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Logement Airbnb — déclarer via AirCover (14j après check-out)
            </div>
          )}
          {propertyId && estimatedCost > 0 && isBooking && (
            <div className="p-3 rounded-lg text-sm flex items-start gap-2" style={{ background: '#F0F7FF', border: '1px solid #B0D4FF', color: '#2563A8' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Logement Booking — actionner la caution (7j après check-out)
            </div>
          )}

          {error && <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>}
        </form>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid #E8E4DC' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #E8E4DC', color: '#666666' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={e => handleSubmit(e, false)}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
            Créer sans notifier
          </button>
          <button
            type="button"
            onClick={e => handleSubmit(e, true)}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: '#C4A044', color: '#FFFFFF' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
            Créer et notifier
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: '#666666' }}>{label}</label>
      {children}
    </div>
  )
}
