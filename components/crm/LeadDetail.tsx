'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SourceBadge } from '@/components/crm/SourceBadge'
import type { CrmLead, CrmActivity, PipelineType } from '@/components/crm/types'
import { STAGES, PRIORITY_CONFIG, SOURCE_CONFIG, PIPELINE_LABELS } from '@/components/crm/types'
import {
  X, Phone, Mail, MessageCircle, Calendar, ChevronDown,
  AlertTriangle, Plus, Loader2, Clock, CheckCircle2,
  FileText, Users, Megaphone, Video, MapPin, Send, ClipboardList,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Icônes par type d'activité ───────────────────────────────────────────────
const ACTIVITY_ICON: Record<string, React.ElementType> = {
  call: Phone, email: Mail, whatsapp: MessageCircle, sms: MessageCircle,
  demo: Video, meeting: Users, site_visit: MapPin,
  offer_sent: Send, contract_sent: FileText,
  note: FileText, stage_change: CheckCircle2, inbound: Megaphone,
}

interface LeadDetailProps {
  lead: CrmLead
  onClose: () => void
  onUpdated: (lead: CrmLead) => void
}

export function LeadDetail({ lead, onClose, onUpdated }: LeadDetailProps) {
  const [activities, setActivities] = useState<CrmActivity[]>(lead.activities ?? [])
  const [activitiesLoaded, setActivitiesLoaded] = useState(!!(lead.activities?.length))
  const [addingActivity, setAddingActivity] = useState(false)
  const [savingActivity, setSavingActivity] = useState(false)
  const [lostDialog, setLostDialog] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [actForm, setActForm] = useState({
    activity_type: 'note', title: '', content: '', outcome: '', next_step: ''
  })

  const pipeline = lead.pipeline_type
  const stages   = STAGES[pipeline]
  const currentStageIdx = stages.findIndex(s => s.key === lead.stage)

  async function changeStage(newStage: string) {
    const supabase = createClient()
    await supabase.from('crm_leads').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', lead.id)
    await supabase.from('crm_activities').insert({
      lead_id: lead.id, activity_type: 'stage_change',
      title: `Stage → ${stages.find(s=>s.key===newStage)?.label ?? newStage}`,
      content: `Changement depuis "${lead.stage}" vers "${newStage}"`
    })
    onUpdated({ ...lead, stage: newStage })
  }

  async function loadActivities() {
    if (activitiesLoaded) return
    const supabase = createClient()
    const { data } = await supabase
      .from('crm_activities')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
    setActivities((data ?? []) as CrmActivity[])
    setActivitiesLoaded(true)
  }

  async function saveActivity() {
    if (!actForm.title) return
    setSavingActivity(true)
    const supabase = createClient()
    const { data } = await supabase.from('crm_activities').insert({
      lead_id: lead.id,
      activity_type: actForm.activity_type,
      title:    actForm.title,
      content:  actForm.content  || null,
      outcome:  actForm.outcome  || null,
      next_step: actForm.next_step || null,
    }).select('*').single()
    if (data) setActivities(a => [data as CrmActivity, ...a])
    setAddingActivity(false)
    setActForm({ activity_type: 'note', title: '', content: '', outcome: '', next_step: '' })
    setSavingActivity(false)
  }

  async function markLost() {
    const supabase = createClient()
    const lostStage = pipeline === 'immobilier' ? 'lost' : pipeline === 'service_client' ? 'churned' : 'lost'
    await supabase.from('crm_leads').update({ stage: lostStage, lost_reason: lostReason, updated_at: new Date().toISOString() }).eq('id', lead.id)
    onUpdated({ ...lead, stage: lostStage, lost_reason: lostReason })
    setLostDialog(false)
  }

  const pcfg = PRIORITY_CONFIG[lead.priority]
  const scfg = SOURCE_CONFIG[lead.source]

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b px-5 py-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base truncate">{lead.full_name ?? lead.company_name ?? 'Sans nom'}</h2>
            <span className={`text-xs font-medium ${pcfg.color}`}>● {pcfg.label}</span>
          </div>
          {lead.company_name && lead.full_name && (
            <p className="text-sm text-muted-foreground">{lead.company_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="secondary" className="text-xs">{PIPELINE_LABELS[pipeline]}</Badge>
            <SourceBadge source={lead.source} detail={lead.source_detail} referralName={lead.referral_name} />
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* ── Stage pipeline ──────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Étape</p>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => changeStage(s.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    lead.stage === s.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : i < currentStageIdx
                        ? 'bg-muted text-muted-foreground border-border'
                        : 'border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Contact ─────────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</p>
            {lead.phone && (
              <div className="flex items-center gap-3">
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />{lead.phone}
                </a>
                <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full hover:bg-emerald-200 transition-colors">
                  WhatsApp
                </a>
              </div>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />{lead.email}
              </a>
            )}
            {(lead.city || lead.country) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />{[lead.city, lead.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Qualification ───────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Qualification</p>
            <div className="space-y-1.5 text-sm">
              {pipeline === 'service_client' && (<>
                {lead.nb_properties != null && <p><span className="text-muted-foreground">Logements :</span> {lead.nb_properties}</p>}
                {lead.monthly_revenue_potential != null && <p><span className="text-muted-foreground">MRR potentiel :</span> {lead.monthly_revenue_potential.toLocaleString('fr')} €</p>}
                {lead.current_tools && <p><span className="text-muted-foreground">Outils actuels :</span> {lead.current_tools}</p>}
              </>)}
              {pipeline === 'immobilier' && (<>
                {lead.property_budget != null && <p><span className="text-muted-foreground">Budget :</span> {lead.property_budget.toLocaleString('fr')} MAD</p>}
                {lead.property_type_interest && <p><span className="text-muted-foreground">Type :</span> {lead.property_type_interest}</p>}
              </>)}
              {pipeline === 'expansion' && (<>
                {lead.expansion_city && <p><span className="text-muted-foreground">Ville cible :</span> {lead.expansion_city}</p>}
              </>)}
            </div>
          </div>

          {/* ── Origine ─────────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Origine</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <SourceBadge source={lead.source} detail={lead.source_detail} referralName={lead.referral_name} />
                {lead.source_detail && <span className="text-muted-foreground text-xs">{lead.source_detail}</span>}
              </div>
              {lead.referral_name && <p><span className="text-muted-foreground">Référent :</span> {lead.referral_name}</p>}
              {lead.utm_campaign && <p><span className="text-muted-foreground">Campagne :</span> {lead.utm_campaign}</p>}
              {lead.lead_cost != null && <p><span className="text-muted-foreground">Coût acquisition :</span> {lead.lead_cost} €</p>}
            </div>
          </div>

          {/* ── Prochaine action ────────────────────────────────────────────── */}
          {(lead.next_action || lead.next_action_date) && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prochaine action</p>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    {lead.next_action && <p className="text-sm font-medium text-amber-800">{lead.next_action}</p>}
                    {lead.next_action_date && (
                      <p className="text-xs text-amber-600">
                        {format(new Date(lead.next_action_date), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {lead.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* ── Timeline activités ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activités</p>
              <div className="flex gap-2">
                {!activitiesLoaded && (
                  <button onClick={loadActivities} className="text-xs text-muted-foreground hover:text-foreground">Charger</button>
                )}
                <button onClick={() => setAddingActivity(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Ajouter
                </button>
              </div>
            </div>

            {/* Formulaire ajout activité */}
            {addingActivity && (
              <div className="mb-4 p-4 rounded-lg border bg-muted/20 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="col-span-2 input-base w-full text-sm"
                    value={actForm.activity_type}
                    onChange={e => setActForm(a=>({...a,activity_type:e.target.value}))}
                  >
                    {['call','email','whatsapp','sms','demo','meeting','site_visit','offer_sent','contract_sent','note'].map(t=>(
                      <option key={t} value={t}>{t.replace('_',' ')}</option>
                    ))}
                  </select>
                  <input className="col-span-2 input-base w-full text-sm" placeholder="Titre *"
                    value={actForm.title} onChange={e=>setActForm(a=>({...a,title:e.target.value}))} />
                  <textarea className="col-span-2 input-base w-full text-sm resize-none" rows={2} placeholder="Résumé / contenu"
                    value={actForm.content} onChange={e=>setActForm(a=>({...a,content:e.target.value}))} />
                  <input className="input-base w-full text-sm" placeholder="Résultat" value={actForm.outcome} onChange={e=>setActForm(a=>({...a,outcome:e.target.value}))} />
                  <input className="input-base w-full text-sm" placeholder="Prochaine étape" value={actForm.next_step} onChange={e=>setActForm(a=>({...a,next_step:e.target.value}))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveActivity} disabled={!actForm.title || savingActivity}>
                    {savingActivity ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Enregistrer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingActivity(false)}>Annuler</Button>
                </div>
              </div>
            )}

            {/* Liste activités */}
            <div className="space-y-2">
              {activities.length === 0 && activitiesLoaded && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune activité enregistrée.</p>
              )}
              {activities.map(act => {
                const Icon = ACTIVITY_ICON[act.activity_type ?? 'note'] ?? FileText
                return (
                  <div key={act.id} className="flex gap-3 py-2.5 border-b last:border-0">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{act.title}</p>
                      {act.content && <p className="text-xs text-muted-foreground mt-0.5">{act.content}</p>}
                      {act.outcome && <p className="text-xs text-green-700 mt-0.5">→ {act.outcome}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(act.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions rapides footer ───────────────────────────────────────────── */}
      <div className="border-t p-3 flex gap-2 flex-wrap">
        {lead.phone && (
          <a href={`tel:${lead.phone}`}>
            <Button size="sm" variant="outline" className="gap-1.5"><Phone className="h-3.5 w-3.5" />Appeler</Button>
          </a>
        )}
        {lead.phone && (
          <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700 border-emerald-300"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</Button>
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`}>
            <Button size="sm" variant="outline" className="gap-1.5"><Mail className="h-3.5 w-3.5" />Email</Button>
          </a>
        )}
        <Button size="sm" variant="outline" className="gap-1.5"
          onClick={async () => {
            const supabase = createClient()
            await supabase.from('tasks').insert({
              title: `Relance — ${lead.full_name ?? lead.company_name ?? 'Lead'}`,
              category: 'commercial',
              priority: lead.pipeline_type === 'service_client' ? 'urgent_important' : 'important',
              lead_id: lead.id,
              due_date: lead.next_action_date ?? new Date().toISOString().slice(0, 10),
              status: 'todo',
            })
          }}>
          <ClipboardList className="h-3.5 w-3.5" />Créer une tâche
        </Button>
        <Button size="sm" variant="destructive" className="gap-1.5 ml-auto" onClick={() => setLostDialog(true)}>
          <AlertTriangle className="h-3.5 w-3.5" />Marquer perdu
        </Button>
      </div>

      {/* ── Dialog raison perdu ──────────────────────────────────────────────── */}
      {lostDialog && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/20 rounded-xl">
          <div className="w-full bg-background border-t rounded-b-xl p-4 space-y-3">
            <p className="font-medium text-sm">Raison de la perte</p>
            <textarea className="input-base w-full resize-none text-sm" rows={3}
              placeholder="Prix trop élevé, concurrent, pas de budget, projet annulé…"
              value={lostReason} onChange={e=>setLostReason(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={markLost}>Confirmer</Button>
              <Button size="sm" variant="outline" onClick={()=>setLostDialog(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
