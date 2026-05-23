'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Star } from 'lucide-react'
import type { Provider, Availability } from './types'
import { SPECIALTY_OPTIONS, SPECIALTY_LABEL, AVAILABILITY_CONFIG } from './types'

interface Props {
  provider?: Provider | null
  properties: { id: string; name: string }[]
  onClose: () => void
  onSaved: (p: Provider) => void
}

export function ProviderForm({ provider, properties, onClose, onSaved }: Props) {
  const isEdit = !!provider

  const [name, setName] = useState(provider?.name ?? '')
  const [phone, setPhone] = useState(provider?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(provider?.whatsapp ?? '')
  const [email, setEmail] = useState(provider?.email ?? '')
  const [city, setCity] = useState(provider?.city ?? '')
  const [country, setCountry] = useState(provider?.country ?? 'MA')
  const [category, setCategory] = useState(provider?.category ?? '')
  const [specialties, setSpecialties] = useState<string[]>(provider?.specialties ?? [])
  const [interventionZone, setInterventionZone] = useState((provider?.intervention_zone ?? []).join(', '))
  const [hourlyRate, setHourlyRate] = useState(provider?.hourly_rate ?? 0)
  const [fixedRate, setFixedRate] = useState(provider?.fixed_rate ?? 0)
  const [currency, setCurrency] = useState(provider?.currency ?? 'MAD')
  const [availability, setAvailability] = useState<Availability>(provider?.availability ?? 'disponible')
  const [responseTime, setResponseTime] = useState(provider?.response_time ?? '')
  const [isPreferred, setIsPreferred] = useState(provider?.is_preferred ?? false)
  const [notes, setNotes] = useState(provider?.notes ?? '')
  const [iban, setIban] = useState(provider?.iban ?? '')
  const [siret, setSiret] = useState(provider?.siret ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSpecialty(s: string) {
    setSpecialties(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est obligatoire'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      name: name.trim(),
      phone: phone || null,
      whatsapp: whatsapp || null,
      email: email || null,
      city: city || null,
      country,
      category: category || null,
      specialties: specialties.length ? specialties : null,
      intervention_zone: interventionZone
        ? interventionZone.split(',').map(s => s.trim()).filter(Boolean)
        : null,
      hourly_rate: hourlyRate || null,
      fixed_rate: fixedRate || null,
      currency,
      availability,
      response_time: responseTime || null,
      is_preferred: isPreferred,
      is_active: true,
      notes: notes || null,
      iban: iban || null,
      siret: siret || null,
    }

    let data: Provider | null = null
    if (isEdit && provider) {
      const { data: d, error: err } = await supabase
        .from('providers').update(payload).eq('id', provider.id).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      data = d as Provider
    } else {
      const { data: d, error: err } = await supabase
        .from('providers').insert(payload).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      data = d as Provider
    }

    onSaved(data!)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl"
        style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', boxShadow: '0 16px 64px rgba(0,0,0,0.10)' }}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E4DC' }}>
          <h2 style={{ fontFamily: 'var(--font-heading), serif', fontSize: 20, fontWeight: 500, color: '#1A1A1A' }}>
            {isEdit ? 'Modifier l\'intervenant' : 'Nouvel intervenant'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F2F0EC]">
            <X className="h-4 w-4" style={{ color: '#666666' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Identité */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nom complet / Entreprise *">
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: Rachid Plomberie" className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="Disponibilité">
              <div className="grid grid-cols-3 gap-1.5">
                {(['disponible', 'sur_rdv', 'indisponible'] as Availability[]).map(a => {
                  const cfg = AVAILABILITY_CONFIG[a]
                  return (
                    <button key={a} type="button" onClick={() => setAvailability(a)}
                      className="text-[11px] font-semibold px-2 py-1.5 rounded-lg"
                      style={availability === a
                        ? { background: cfg.color, color: '#FFFFFF' }
                        : { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }
                      }
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </FormField>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Téléphone">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+212 6..." className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="WhatsApp">
              <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                placeholder="+212 6..." className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="contact@..." className={inputCls} style={inputStyle} />
            </FormField>
          </div>

          {/* Localisation */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Ville">
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Ex: Marrakech" className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="Pays">
              <select value={country} onChange={e => setCountry(e.target.value)} className={inputCls} style={inputStyle}>
                <option value="MA">🇲🇦 Maroc</option>
                <option value="FR">🇫🇷 France</option>
                <option value="ES">🇪🇸 Espagne</option>
              </select>
            </FormField>
            <FormField label="Zones intervention">
              <input type="text" value={interventionZone} onChange={e => setInterventionZone(e.target.value)}
                placeholder="Guéliz, Hivernage, Palmeraie" className={inputCls} style={inputStyle} />
            </FormField>
          </div>

          {/* Spécialités */}
          <FormField label="Spécialités">
            <div className="flex flex-wrap gap-1.5">
              {SPECIALTY_OPTIONS.map(s => (
                <button
                  key={s} type="button"
                  onClick={() => toggleSpecialty(s)}
                  className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                  style={specialties.includes(s)
                    ? { background: '#C4A044', color: '#FFFFFF' }
                    : { background: '#F8F7F5', color: '#666666', border: '1px solid #E8E4DC' }
                  }
                >
                  {SPECIALTY_LABEL[s] ?? s}
                </button>
              ))}
            </div>
          </FormField>

          {/* Tarifs */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tarif horaire">
              <input type="number" min={0} value={hourlyRate || ''} onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
                placeholder="0" className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="Tarif forfait">
              <input type="number" min={0} value={fixedRate || ''} onChange={e => setFixedRate(parseFloat(e.target.value) || 0)}
                placeholder="0" className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="Devise">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls} style={inputStyle}>
                <option value="MAD">MAD</option>
                <option value="EUR">EUR</option>
              </select>
            </FormField>
          </div>

          {/* Délai + Préféré */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Délai de réponse habituel">
              <input type="text" value={responseTime} onChange={e => setResponseTime(e.target.value)}
                placeholder="Ex: < 2h, sous 24h..." className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="Statut">
              <button
                type="button"
                onClick={() => setIsPreferred(!isPreferred)}
                className="flex items-center gap-2 text-sm"
                style={{ color: isPreferred ? '#C4A044' : '#999999' }}
              >
                <Star className={`h-5 w-5 ${isPreferred ? 'fill-[#C4A044] text-[#C4A044]' : ''}`} />
                {isPreferred ? 'Intervenant préféré' : 'Marquer comme préféré'}
              </button>
            </FormField>
          </div>

          {/* Administratif */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="IBAN">
              <input type="text" value={iban} onChange={e => setIban(e.target.value)}
                placeholder="FR76..." className={inputCls} style={inputStyle} />
            </FormField>
            <FormField label="SIRET / RC">
              <input type="text" value={siret} onChange={e => setSiret(e.target.value)}
                placeholder="123 456 789 00012" className={inputCls} style={inputStyle} />
            </FormField>
          </div>

          {/* Notes */}
          <FormField label="Notes internes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
              placeholder="Qualité de travail, horaires, recommandations…" />
          </FormField>

          {error && <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>}
        </form>

        <div className="shrink-0 px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid #E8E4DC' }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #E8E4DC', color: '#666666' }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: '#C4A044', color: '#FFFFFF' }}>
            {loading && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
            {isEdit ? 'Enregistrer' : 'Créer l\'intervenant'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full text-sm rounded-lg px-3 py-1.5 outline-none'
const inputStyle = { border: '1px solid #E8E4DC', color: '#1A1A1A' }

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: '#666666' }}>{label}</label>
      {children}
    </div>
  )
}
