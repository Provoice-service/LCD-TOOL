'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, formatDistanceToNow, differenceInDays, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  X, ExternalLink, Phone, MessageCircle, Trash2, Send,
  CheckCircle, AlertTriangle, Clock,
} from 'lucide-react'
import type { Incident, IncidentComment, IncidentStatus, IndemnisationType, IndemnisationStatus } from './types'
import {
  PRIORITY_CONFIG, STATUS_CONFIG, SAV_TYPE_CONFIG,
  INDEMNISATION_STATUS_CONFIG,
} from './types'
import { ProviderSearch } from '@/components/contacts/ProviderSearch'

interface Props {
  incident: Incident
  onClose: () => void
  onPatch: (patch: Partial<Incident>) => void
  onDelete: () => void
}

export function IncidentDetail({ incident, onClose, onPatch, onDelete }: Props) {
  const [comments, setComments] = useState<IncidentComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentType, setCommentType] = useState<IncidentComment['type']>('comment')
  const [addingComment, setAddingComment] = useState(false)

  const pcfg = PRIORITY_CONFIG[incident.priority]
  const scfg = STATUS_CONFIG[incident.status]
  const country = incident.property?.country

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('incident_comments')
      .select('*')
      .eq('incident_id', incident.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments((data ?? []) as IncidentComment[]))
  }, [incident.id])

  async function addComment() {
    if (!newComment.trim()) return
    setAddingComment(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('incident_comments')
      .insert({ incident_id: incident.id, author: 'Gestionnaire', content: newComment, type: commentType })
      .select()
      .single()
    if (data) setComments(prev => [...prev, data as IncidentComment])
    setNewComment('')
    setAddingComment(false)
  }

  async function deleteIncident() {
    if (!confirm('Supprimer cet incident définitivement ?')) return
    const supabase = createClient()
    await supabase.from('incidents').delete().eq('id', incident.id)
    onDelete()
  }

  // Deadlines indemnisation
  const checkout = incident.reservation?.check_out
  const airCoverDeadline = checkout ? addDays(new Date(checkout), 14) : null
  const bookingDeadline  = checkout ? addDays(new Date(checkout), 7)  : null
  const indDeadlineDays  = incident.indemnisation_deadline
    ? differenceInDays(new Date(incident.indemnisation_deadline), new Date())
    : null

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.3)' }}>
      {/* Overlay cliquable */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer */}
      <div
        className="w-[600px] max-w-full flex flex-col overflow-hidden"
        style={{ background: '#FFFFFF', borderLeft: '1px solid #E8E4DC', boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-5 py-4 flex items-start justify-between gap-3"
          style={{ borderBottom: '1px solid #E8E4DC' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded"
                style={{ background: pcfg.bg, color: pcfg.color, border: `1px solid ${pcfg.border}` }}
              >
                {pcfg.label}
              </span>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded"
                style={{ background: scfg.bg, color: scfg.color }}
              >
                {scfg.label}
              </span>
              {incident.sav_type && (
                <span className="text-xs text-muted-foreground">
                  {SAV_TYPE_CONFIG[incident.sav_type].icon} {SAV_TYPE_CONFIG[incident.sav_type].label}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold truncate" style={{ color: '#1A1A1A' }}>
              {incident.title || 'Incident sans titre'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={deleteIncident} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer">
              <Trash2 className="h-4 w-4" style={{ color: '#C0392B' }} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F2F0EC] transition-colors">
              <X className="h-4 w-4" style={{ color: '#666666' }} />
            </button>
          </div>
        </div>

        {/* ── Corps scrollable ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Section : Infos générales */}
          <Section title="Informations">
            <Row label="Logement">
              {incident.property ? (
                <a href={`/properties/${incident.property.id}`} className="text-sm flex items-center gap-1 hover:underline" style={{ color: '#C4A044' }}>
                  {incident.property.name}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : '—'}
            </Row>
            {incident.reservation && (
              <Row label="Réservation">
                <span className="text-sm" style={{ color: '#1A1A1A' }}>
                  {incident.reservation.guest?.full_name ?? '—'}
                  {incident.reservation.check_in && ` · ${format(new Date(incident.reservation.check_in), 'dd/MM')} → ${incident.reservation.check_out ? format(new Date(incident.reservation.check_out), 'dd/MM/yy') : '?'}`}
                </span>
              </Row>
            )}
            <Row label="Signalé par">
              <span className="text-sm capitalize" style={{ color: '#1A1A1A' }}>{incident.reported_by}</span>
            </Row>
            <Row label="Date">
              <span className="text-sm" style={{ color: '#666666' }}>
                {format(new Date(incident.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
              </span>
            </Row>
            {incident.description && (
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid #F2F0EC' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#999999' }}>Description</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{incident.description}</p>
              </div>
            )}
          </Section>

          {/* Section : Prise en charge */}
          <Section title="Prise en charge">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => onPatch({
                  taken_in_charge: !incident.taken_in_charge,
                  taken_in_charge_at: !incident.taken_in_charge ? new Date().toISOString() : null,
                })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: incident.taken_in_charge ? 'rgba(46,125,82,0.10)' : '#F8F7F5',
                  color: incident.taken_in_charge ? '#2E7D52' : '#666666',
                  border: `1px solid ${incident.taken_in_charge ? 'rgba(46,125,82,0.3)' : '#E8E4DC'}`,
                }}
              >
                <CheckCircle className="h-4 w-4" />
                {incident.taken_in_charge ? 'Pris en charge' : 'Marquer pris en charge'}
              </button>
              {incident.taken_in_charge_at && (
                <span className="text-xs" style={{ color: '#999999' }}>
                  {format(new Date(incident.taken_in_charge_at), 'dd/MM à HH:mm', { locale: fr })}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#666666' }}>Intervenant</label>
              <ProviderSearch
                value={incident.assigned_provider ?? ''}
                providerId={null}
                onChange={(name, _id, phone) => onPatch({ assigned_provider: name, provider_phone: phone ?? incident.provider_phone ?? '' })}
                savType={incident.sav_type}
                propertyId={incident.property?.id}
              />
            </div>

            {incident.provider_phone && (
              <div className="flex gap-2 mt-2">
                <a
                  href={`tel:${incident.provider_phone}`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                >
                  <Phone className="h-3 w-3" /> Appeler
                </a>
                <a
                  href={`https://wa.me/${incident.provider_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }}
                >
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              </div>
            )}
          </Section>

          {/* Section : Avancement */}
          <Section title="Avancement">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: '#666666' }}>
                <span>Signalé</span><span>Pris en charge</span><span>En cours</span><span>Presque résolu</span><span>Résolu</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={25}
                value={incident.progress}
                onChange={e => {
                  const p = parseInt(e.target.value)
                  onPatch({
                    progress: p,
                    status: p === 100 ? 'resolved' : p >= 25 ? 'in_progress' : 'open',
                    resolved_at: p === 100 ? new Date().toISOString() : null,
                  })
                }}
                className="w-full accent-[#C4A044]"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: '#C4A044' }}>{incident.progress}%</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ background: STATUS_CONFIG[incident.status].bg, color: STATUS_CONFIG[incident.status].color }}
                >
                  {STATUS_CONFIG[incident.status].label}
                </span>
              </div>
            </div>
          </Section>

          {/* Section : Coûts */}
          <Section title="Coûts">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={`Coût estimé (${country === 'MA' ? 'MAD' : '€'})`}
                value={incident.estimated_cost}
                onChange={v => onPatch({ estimated_cost: v })}
              />
              <NumberField
                label={`Coût réel (${country === 'MA' ? 'MAD' : '€'})`}
                value={incident.actual_cost}
                onChange={v => onPatch({ actual_cost: v })}
              />
            </div>
            <div className="flex gap-4 mt-3">
              <Toggle
                label="Refacturable propriétaire"
                value={incident.billable_to_owner}
                onChange={v => onPatch({ billable_to_owner: v })}
              />
              <Toggle
                label="Notifier propriétaire"
                value={incident.owner_notified}
                onChange={v => onPatch({ owner_notified: v })}
              />
              <Toggle
                label="Notifier voyageur"
                value={incident.guest_notified}
                onChange={v => onPatch({ guest_notified: v })}
              />
            </div>
            {incident.billable_to_owner && (incident.actual_cost ?? 0) > 0 && (
              <div className="mt-3">
                <a
                  href={`/finance/depenses?incident=${incident.id}&amount=${incident.actual_cost}&property=${incident.property?.id ?? ''}&title=${encodeURIComponent(incident.title ?? 'Incident SAV')}`}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  style={{ background: 'rgba(196,160,68,0.10)', color: '#A88830', border: '1px solid rgba(196,160,68,0.3)' }}
                >
                  + Créer une dépense liée
                </a>
              </div>
            )}
          </Section>

          {/* Section : Indemnisation & Caution */}
          <Section title="Indemnisation & Caution">
            {/* Caution */}
            <div className="mb-4 pb-4" style={{ borderBottom: '1px solid #F2F0EC' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#999999' }}>CAUTION</p>
              <div className="flex items-center gap-3 mb-2">
                <Toggle
                  label="Actionner la caution"
                  value={incident.caution_actioned}
                  onChange={v => onPatch({ caution_actioned: v, caution_actioned_at: v ? new Date().toISOString() : null })}
                />
                {incident.caution_actioned_at && (
                  <span className="text-xs" style={{ color: '#999999' }}>
                    {format(new Date(incident.caution_actioned_at), 'dd/MM HH:mm', { locale: fr })}
                  </span>
                )}
              </div>
              <NumberField
                label="Montant caution (€)"
                value={incident.caution_amount}
                onChange={v => onPatch({ caution_amount: v })}
              />
              {checkout && (
                <div className="flex gap-3 mt-2 text-xs" style={{ color: '#666666' }}>
                  {airCoverDeadline && (
                    <span className={differenceInDays(airCoverDeadline, new Date()) <= 3 ? 'text-red-600 font-semibold' : ''}>
                      AirCover deadline: {format(airCoverDeadline, 'dd/MM/yy')}
                      {differenceInDays(airCoverDeadline, new Date()) <= 3 && ` (${differenceInDays(airCoverDeadline, new Date())}j restants)`}
                    </span>
                  )}
                  {bookingDeadline && (
                    <span className={differenceInDays(bookingDeadline, new Date()) <= 3 ? 'text-red-600 font-semibold' : ''}>
                      Booking deadline: {format(bookingDeadline, 'dd/MM/yy')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* AirCover / Assurance */}
            <p className="text-xs font-semibold mb-2" style={{ color: '#999999' }}>DEMANDE D&apos;INDEMNISATION</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#666666' }}>Type</label>
                <select
                  value={incident.indemnisation_type ?? ''}
                  onChange={e => onPatch({ indemnisation_type: (e.target.value || null) as IndemnisationType })}
                  className="w-full text-sm rounded-md px-3 py-1.5 outline-none"
                  style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                >
                  <option value="">— Choisir —</option>
                  <option value="aircover">AirCover</option>
                  <option value="caution_airbnb">Caution Airbnb</option>
                  <option value="caution_booking">Caution Booking</option>
                  <option value="caution_directe">Caution directe</option>
                  <option value="assurance">Assurance</option>
                  <option value="aucune">Aucune</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#666666' }}>Statut demande</label>
                <select
                  value={incident.indemnisation_status}
                  onChange={e => onPatch({ indemnisation_status: e.target.value as IndemnisationStatus })}
                  className="w-full text-sm rounded-md px-3 py-1.5 outline-none"
                  style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                >
                  <option value="non_demandee">Non demandée</option>
                  <option value="a_declarer">À déclarer</option>
                  <option value="en_cours">En cours</option>
                  <option value="acceptee">Acceptée</option>
                  <option value="refusee">Refusée</option>
                  <option value="partiellement_acceptee">Part. acceptée</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumberField
                label="Montant réclamé (€)"
                value={incident.indemnisation_amount_claimed}
                onChange={v => onPatch({ indemnisation_amount_claimed: v })}
              />
              <NumberField
                label="Montant reçu (€)"
                value={incident.indemnisation_amount_received}
                onChange={v => onPatch({ indemnisation_amount_received: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field
                label="Référence dossier"
                value={incident.indemnisation_reference ?? ''}
                onChange={v => onPatch({ indemnisation_reference: v })}
                placeholder="Ex: ARC-2024-XXXX"
              />
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#666666' }}>Date limite déclaration</label>
                <input
                  type="date"
                  value={incident.indemnisation_deadline ?? ''}
                  onChange={e => onPatch({ indemnisation_deadline: e.target.value || null })}
                  className="w-full text-sm rounded-md px-3 py-1.5 outline-none"
                  style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                />
              </div>
            </div>

            {indDeadlineDays !== null && incident.indemnisation_status === 'a_declarer' && (
              <div
                className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={indDeadlineDays <= 0
                  ? { background: 'rgba(192,57,43,0.10)', color: '#C0392B', border: '1px solid rgba(192,57,43,0.3)' }
                  : indDeadlineDays <= 3
                  ? { background: 'rgba(193,124,26,0.10)', color: '#C17C1A', border: '1px solid rgba(193,124,26,0.3)' }
                  : { background: '#F8F7F5', color: '#666666', border: '1px solid #E8E4DC' }
                }
              >
                {indDeadlineDays <= 0
                  ? <><AlertTriangle className="h-4 w-4" /> DÉLAI EXPIRÉ — déclaration impossible</>
                  : <><Clock className="h-4 w-4" /> {indDeadlineDays} jour{indDeadlineDays > 1 ? 's' : ''} restant{indDeadlineDays > 1 ? 's' : ''} pour déclarer</>
                }
              </div>
            )}

            {incident.indemnisation_type === 'aircover' && (
              <a
                href="https://www.airbnb.fr/resolutions"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-1.5 text-xs"
                style={{ color: '#C4A044' }}
              >
                <ExternalLink className="h-3 w-3" /> Déclarer via AirCover
              </a>
            )}

            <div className="mt-3">
              <label className="text-xs font-medium block mb-1" style={{ color: '#666666' }}>Notes</label>
              <textarea
                value={incident.indemnisation_notes ?? ''}
                onChange={e => onPatch({ indemnisation_notes: e.target.value })}
                rows={2}
                className="w-full text-sm rounded-md px-3 py-2 outline-none resize-none"
                style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                placeholder="Notes libres sur le dossier…"
              />
            </div>
          </Section>

          {/* Section : Résolution */}
          {incident.status !== 'resolved' ? (
            <Section title="Résolution">
              <button
                onClick={() => onPatch({
                  status: 'resolved',
                  resolved_at: new Date().toISOString(),
                  progress: 100,
                })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: 'rgba(46,125,82,0.10)', color: '#2E7D52', border: '1px solid rgba(46,125,82,0.3)' }}
              >
                <CheckCircle className="h-4 w-4" />
                Marquer comme résolu
              </button>
            </Section>
          ) : (
            <Section title="Résolution">
              <p className="text-xs font-semibold mb-1" style={{ color: '#999999' }}>
                Résolu le {incident.resolved_at ? format(new Date(incident.resolved_at), 'dd/MM/yyyy à HH:mm', { locale: fr }) : '—'}
              </p>
              <p className="text-xs mb-3" style={{ color: '#666666' }}>Résultat satisfaisant ?</p>
              <div className="flex gap-2 mb-3">
                {[
                  { v: true,  label: '👍 Oui' },
                  { v: false, label: '👎 Non' },
                  { v: null,  label: '🤷 Partiellement' },
                ].map(({ v, label }) => (
                  <button
                    key={String(v)}
                    onClick={() => onPatch({ resolution_satisfactory: v ?? undefined })}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={incident.resolution_satisfactory === v
                      ? { background: '#C4A044', color: '#FFFFFF' }
                      : { background: '#F8F7F5', color: '#666666', border: '1px solid #E8E4DC' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                value={incident.resolution_comment ?? ''}
                onChange={e => onPatch({ resolution_comment: e.target.value })}
                rows={2}
                className="w-full text-sm rounded-md px-3 py-2 outline-none resize-none"
                style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                placeholder="Commentaire de résolution…"
              />
            </Section>
          )}

          {/* Section : Timeline commentaires */}
          <Section title={`Historique (${comments.length})`}>
            <div className="space-y-3 mb-4">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun commentaire</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                    style={{ background: COMMENT_COLORS[c.type].bg, color: COMMENT_COLORS[c.type].color }}
                  >
                    {COMMENT_ICONS[c.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold" style={{ color: '#1A1A1A' }}>{c.author}</span>
                      <span className="text-[10px]" style={{ color: '#999999' }}>
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      <span
                        className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: COMMENT_COLORS[c.type].bg, color: COMMENT_COLORS[c.type].color }}
                      >
                        {c.type}
                      </span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap" style={{ color: '#666666' }}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Formulaire ajout commentaire */}
            <div className="pt-3" style={{ borderTop: '1px solid #F2F0EC' }}>
              <div className="flex gap-2 mb-2">
                {(['comment', 'action', 'reminder', 'escalation'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setCommentType(t)}
                    className="text-[10px] px-2 py-0.5 rounded font-semibold"
                    style={commentType === t
                      ? { background: '#C4A044', color: '#FFFFFF' }
                      : { background: '#F8F7F5', color: '#666666', border: '1px solid #E8E4DC' }
                    }
                  >
                    {COMMENT_ICONS[t]} {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire…"
                  rows={2}
                  className="flex-1 text-sm rounded-md px-3 py-2 outline-none resize-none"
                  style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                />
                <button
                  onClick={addComment}
                  disabled={addingComment || !newComment.trim()}
                  className="px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                  style={{ background: '#C4A044', color: '#FFFFFF' }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

// ── Helpers UI ─────────────────────────────────────────────────────────────────

const COMMENT_ICONS: Record<string, string> = {
  comment: '💬', action: '⚡', reminder: '🔔', resolution: '✅', escalation: '🚨',
}
const COMMENT_COLORS: Record<string, { bg: string; color: string }> = {
  comment:    { bg: '#F8F7F5',               color: '#666666' },
  action:     { bg: 'rgba(196,160,68,0.10)', color: '#A88830' },
  reminder:   { bg: 'rgba(37,99,168,0.10)',  color: '#2563A8' },
  resolution: { bg: 'rgba(46,125,82,0.10)',  color: '#2E7D52' },
  escalation: { bg: 'rgba(192,57,43,0.10)',  color: '#C0392B' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ border: '1px solid #E8E4DC' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#999999' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5" style={{ borderBottom: '1px solid #F2F0EC' }}>
      <span className="text-xs font-medium w-28 shrink-0" style={{ color: '#999999' }}>{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: '#666666' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm rounded-md px-3 py-1.5 outline-none"
        style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
      />
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: '#666666' }}>{label}</label>
      <input
        type="number"
        min={0}
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full text-sm rounded-md px-3 py-1.5 outline-none"
        style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
        placeholder="0"
      />
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 text-xs"
      style={{ color: value ? '#2E7D52' : '#999999' }}
    >
      <span
        className="w-8 h-4 rounded-full relative transition-colors"
        style={{ background: value ? '#2E7D52' : '#E8E4DC' }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </span>
      {label}
    </button>
  )
}
