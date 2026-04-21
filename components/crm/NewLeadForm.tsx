'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { X, Loader2 } from 'lucide-react'
import type { CrmLead, PipelineType, LeadSource } from '@/components/crm/types'
import { SOURCE_CONFIG, PIPELINE_LABELS } from '@/components/crm/types'

interface NewLeadFormProps {
  onClose: () => void
  onCreated: (lead: CrmLead) => void
}

const SOURCE_DETAIL_PLACEHOLDER: Partial<Record<LeadSource, string>> = {
  referral:      'Recommandé par (nom, entreprise)',
  event:         'Nom de l\'événement',
  cold_outreach: 'Via LinkedIn / email / téléphone',
  meta_ads:      'Nom de la campagne',
  google_ads:    'Nom de la campagne',
}

export function NewLeadForm({ onClose, onCreated }: NewLeadFormProps) {
  const [pipeline, setPipeline]         = useState<PipelineType>('service_client')
  const [source, setSource]             = useState<LeadSource>('other')
  const [loading, setLoading]           = useState(false)
  const [form, setForm]                 = useState<Record<string, string>>({
    full_name: '', company_name: '', email: '', phone: '', city: '', country: 'MA',
    source_detail: '', referral_name: '', notes: '', next_action: '', next_action_date: '',
    nb_properties: '', monthly_revenue_potential: '', property_budget: '',
    property_type_interest: '', expansion_city: '', priority: 'normale', current_tools: '',
  })

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  const showReferralName  = source === 'referral'
  const showUTM           = ['meta_ads','google_ads','website_form'].includes(source)
  const detailPlaceholder = SOURCE_DETAIL_PLACEHOLDER[source] ?? 'Précision libre'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name && !form.company_name) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('crm_leads')
      .insert({
        pipeline_type: pipeline,
        full_name:     form.full_name || null,
        company_name:  form.company_name || null,
        email:         form.email || null,
        phone:         form.phone || null,
        city:          form.city || null,
        country:       form.country,
        source,
        source_detail:  form.source_detail || null,
        referral_name:  showReferralName ? (form.referral_name || null) : null,
        notes:          form.notes || null,
        next_action:    form.next_action || null,
        next_action_date: form.next_action_date || null,
        priority:       form.priority,
        nb_properties:  form.nb_properties ? parseInt(form.nb_properties) : null,
        monthly_revenue_potential: form.monthly_revenue_potential ? parseFloat(form.monthly_revenue_potential) : null,
        property_budget: form.property_budget ? parseFloat(form.property_budget) : null,
        property_type_interest: form.property_type_interest || null,
        expansion_city: form.expansion_city || null,
      })
      .select('*')
      .single()
    setLoading(false)
    if (!error && data) onCreated(data as CrmLead)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b flex items-center justify-between px-5 py-3.5 z-10">
          <h2 className="font-semibold text-base">Nouveau lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">

          {/* Pipeline */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Pipeline *</label>
            <div className="flex gap-2">
              {(['service_client','immobilier','expansion'] as PipelineType[]).map((p) => (
                <button
                  key={p} type="button"
                  onClick={() => setPipeline(p)}
                  className={`flex-1 py-2 rounded-md text-sm border transition-colors ${pipeline === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/50'}`}
                >
                  {PIPELINE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Nom</label>
              <input className="input-base w-full" value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="Morad Chliyah" /></div>
            <div><label className="block text-xs font-medium mb-1">Entreprise</label>
              <input className="input-base w-full" value={form.company_name} onChange={e=>set('company_name',e.target.value)} placeholder="LCD Maroc SARL" /></div>
            <div><label className="block text-xs font-medium mb-1">Téléphone</label>
              <input className="input-base w-full" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+212 6 XX XX XX XX" /></div>
            <div><label className="block text-xs font-medium mb-1">Email</label>
              <input className="input-base w-full" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="contact@example.com" /></div>
            <div><label className="block text-xs font-medium mb-1">Ville</label>
              <input className="input-base w-full" value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Tanger" /></div>
            <div>
              <label className="block text-xs font-medium mb-1">Pays</label>
              <select className="input-base w-full" value={form.country} onChange={e=>set('country',e.target.value)}>
                <option value="MA">Maroc</option>
                <option value="FR">France</option>
                <option value="BE">Belgique</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Source</label>
            <select className="input-base w-full" value={source} onChange={e=>setSource(e.target.value as LeadSource)}>
              {(Object.entries(SOURCE_CONFIG) as [LeadSource, typeof SOURCE_CONFIG[LeadSource]][]).map(([k,v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {showReferralName && (
            <div><label className="block text-xs font-medium mb-1">Recommandé par</label>
              <input className="input-base w-full" value={form.referral_name} onChange={e=>set('referral_name',e.target.value)} placeholder="Nom du référent" /></div>
          )}
          {source !== 'other' && (
            <div><label className="block text-xs font-medium mb-1">Précision source</label>
              <input className="input-base w-full" value={form.source_detail} onChange={e=>set('source_detail',e.target.value)} placeholder={detailPlaceholder} /></div>
          )}

          {/* Qualification selon pipeline */}
          {pipeline === 'service_client' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium mb-1">Nb logements actuels</label>
                <input type="number" className="input-base w-full" value={form.nb_properties} onChange={e=>set('nb_properties',e.target.value)} placeholder="5" /></div>
              <div><label className="block text-xs font-medium mb-1">MRR potentiel (€/MAD)</label>
                <input type="number" className="input-base w-full" value={form.monthly_revenue_potential} onChange={e=>set('monthly_revenue_potential',e.target.value)} placeholder="3000" /></div>
              <div className="col-span-2"><label className="block text-xs font-medium mb-1">Outils actuels</label>
                <input className="input-base w-full" value={form.current_tools} onChange={e=>set('current_tools',e.target.value)} placeholder="Superhote, Hostaway, rien…" /></div>
            </div>
          )}
          {pipeline === 'immobilier' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium mb-1">Budget (MAD)</label>
                <input type="number" className="input-base w-full" value={form.property_budget} onChange={e=>set('property_budget',e.target.value)} placeholder="1500000" /></div>
              <div><label className="block text-xs font-medium mb-1">Type de bien</label>
                <input className="input-base w-full" value={form.property_type_interest} onChange={e=>set('property_type_interest',e.target.value)} placeholder="Appartement T2, studio…" /></div>
            </div>
          )}
          {pipeline === 'expansion' && (
            <div><label className="block text-xs font-medium mb-1">Ville cible</label>
              <input className="input-base w-full" value={form.expansion_city} onChange={e=>set('expansion_city',e.target.value)} placeholder="Casablanca" /></div>
          )}

          {/* Priorité */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Priorité</label>
            <div className="flex gap-2">
              {['haute','normale','basse'].map((p) => (
                <button key={p} type="button" onClick={() => set('priority',p)}
                  className={`flex-1 py-1.5 rounded-md text-sm border transition-colors ${form.priority===p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/50'}`}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes + prochaine action */}
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea className="input-base w-full resize-none" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Contexte, douleurs, remarques…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Prochaine action</label>
              <input className="input-base w-full" value={form.next_action} onChange={e=>set('next_action',e.target.value)} placeholder="Rappeler, envoyer devis…" /></div>
            <div><label className="block text-xs font-medium mb-1">Date</label>
              <input type="date" className="input-base w-full" value={form.next_action_date} onChange={e=>set('next_action_date',e.target.value)} /></div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || (!form.full_name && !form.company_name)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Créer le lead
          </Button>
        </form>
      </div>
    </div>
  )
}
