// =============================================================================
// Module SAV — Types partagés
// =============================================================================

export type IncidentPriority = 'urgente' | 'haute' | 'normale' | 'basse'
export type IncidentStatus   = 'open' | 'in_progress' | 'resolved'
export type SavType =
  | 'plomberie' | 'electricite' | 'serrure' | 'menage' | 'electromenager'
  | 'climatisation' | 'chauffage' | 'internet' | 'nuisance' | 'degradation' | 'autre'
export type ReportedBy = 'voyageur' | 'equipe' | 'gestionnaire' | 'proprietaire'
export type IndemnisationType =
  | 'aircover' | 'caution_airbnb' | 'caution_booking' | 'caution_directe' | 'assurance' | 'aucune'
export type IndemnisationStatus =
  | 'non_demandee' | 'a_declarer' | 'en_cours' | 'acceptee' | 'refusee' | 'partiellement_acceptee'
export type CommentType = 'comment' | 'action' | 'reminder' | 'resolution' | 'escalation'

export interface Incident {
  id: string
  property_id: string
  reservation_id: string | null
  title: string | null
  category: string | null
  description: string | null
  status: IncidentStatus
  priority: IncidentPriority
  sav_type: SavType | null
  assigned_provider: string | null
  provider_phone: string | null
  taken_in_charge: boolean
  taken_in_charge_at: string | null
  resolved_at: string | null
  resolution_satisfactory: boolean | null
  resolution_comment: string | null
  estimated_cost: number
  actual_cost: number
  cost: number
  billable_to_owner: boolean
  photos: string[]
  progress: number
  last_reminder_at: string | null
  reminder_count: number
  reported_by: ReportedBy
  guest_notified: boolean
  owner_notified: boolean
  // indemnisation
  indemnisation_type: IndemnisationType | null
  indemnisation_status: IndemnisationStatus
  indemnisation_amount_claimed: number
  indemnisation_amount_received: number
  indemnisation_deadline: string | null
  indemnisation_reference: string | null
  indemnisation_notes: string | null
  caution_amount: number
  caution_actioned: boolean
  caution_actioned_at: string | null
  created_at: string
  updated_at: string
  // joined
  property?: { id: string; name: string; city: string | null; country: string | null } | null
  reservation?: {
    id: string
    check_in: string | null
    check_out: string | null
    platform: string | null
    guest?: { full_name: string; phone: string | null } | null
  } | null
}

export interface IncidentComment {
  id: string
  incident_id: string
  author: string
  content: string
  type: CommentType
  created_at: string
}

export interface SavReminder {
  id: string
  incident_id: string
  reminder_type: 'provider' | 'owner' | 'team' | 'guest'
  scheduled_at: string
  sent_at: string | null
  message: string | null
  status: 'pending' | 'sent' | 'cancelled'
  created_at: string
}

// ── UI config ─────────────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<IncidentPriority, {
  label: string; color: string; bg: string; border: string; pulse?: boolean
}> = {
  urgente: { label: 'Urgente', color: '#C0392B', bg: 'rgba(192,57,43,0.10)', border: 'rgba(192,57,43,0.3)', pulse: true },
  haute:   { label: 'Haute',   color: '#C17C1A', bg: 'rgba(193,124,26,0.10)', border: 'rgba(193,124,26,0.3)' },
  normale: { label: 'Normale', color: '#2563A8', bg: 'rgba(37,99,168,0.10)', border: 'rgba(37,99,168,0.3)' },
  basse:   { label: 'Basse',   color: '#666666', bg: 'rgba(102,102,102,0.08)', border: 'rgba(102,102,102,0.2)' },
}

export const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Ouvert',    color: '#C0392B', bg: 'rgba(192,57,43,0.08)' },
  in_progress: { label: 'En cours',  color: '#C17C1A', bg: 'rgba(193,124,26,0.08)' },
  resolved:    { label: 'Résolu',    color: '#2E7D52', bg: 'rgba(46,125,82,0.08)' },
}

export const SAV_TYPE_CONFIG: Record<SavType, { label: string; icon: string }> = {
  plomberie:     { label: 'Plomberie',      icon: '🔧' },
  electricite:   { label: 'Électricité',    icon: '⚡' },
  serrure:       { label: 'Serrure / Accès',icon: '🔐' },
  menage:        { label: 'Ménage',         icon: '🧹' },
  electromenager:{ label: 'Électroménager', icon: '🫙' },
  climatisation: { label: 'Climatisation',  icon: '❄️' },
  chauffage:     { label: 'Chauffage',      icon: '🔥' },
  internet:      { label: 'Internet / TV',  icon: '📶' },
  nuisance:      { label: 'Nuisance',       icon: '🔊' },
  degradation:   { label: 'Dégradation',    icon: '🏚️' },
  autre:         { label: 'Autre',          icon: '📋' },
}

export const INDEMNISATION_STATUS_CONFIG: Record<IndemnisationStatus, { label: string; color: string; bg: string }> = {
  non_demandee:          { label: 'Non demandée',         color: '#999999', bg: 'rgba(102,102,102,0.08)' },
  a_declarer:            { label: 'À déclarer',           color: '#C17C1A', bg: 'rgba(193,124,26,0.10)' },
  en_cours:              { label: 'En cours',             color: '#2563A8', bg: 'rgba(37,99,168,0.10)' },
  acceptee:              { label: 'Acceptée',             color: '#2E7D52', bg: 'rgba(46,125,82,0.10)' },
  refusee:               { label: 'Refusée',              color: '#C0392B', bg: 'rgba(192,57,43,0.10)' },
  partiellement_acceptee:{ label: 'Part. acceptée',       color: '#A88830', bg: 'rgba(196,160,68,0.10)' },
}

export const REPORTED_BY_CONFIG: Record<ReportedBy, { label: string; color: string }> = {
  voyageur:     { label: 'Voyageur',    color: '#2563A8' },
  equipe:       { label: 'Équipe',      color: '#2E7D52' },
  gestionnaire: { label: 'Gestionnaire',color: '#A88830' },
  proprietaire: { label: 'Propriétaire',color: '#666666' },
}

export const PRIORITY_ORDER: Record<IncidentPriority, number> = {
  urgente: 0, haute: 1, normale: 2, basse: 3,
}
