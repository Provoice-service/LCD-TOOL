// =============================================================================
// Module Contacts / Intervenants — Types
// =============================================================================

export type Availability = 'disponible' | 'indisponible' | 'sur_rdv'

export interface Provider {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  whatsapp: string | null
  address: string | null
  city: string | null
  country: string
  category: string | null
  specialties: string[] | null
  intervention_zone: string[] | null
  hourly_rate: number | null
  fixed_rate: number | null
  currency: string
  availability: Availability
  response_time: string | null
  rating: number
  intervention_count: number
  is_preferred: boolean
  is_active: boolean
  languages: string[]
  iban: string | null
  siret: string | null
  notes: string | null
  last_intervention_at: string | null
  property_id: string | null
  created_at: string
}

export const SPECIALTY_OPTIONS = [
  'plomberie', 'electricite', 'serrurerie', 'menage', 'electromenager',
  'climatisation', 'peinture', 'maconnerie', 'jardinage', 'menuiserie',
  'vitrerie', 'piscine', 'informatique', 'securite', 'autre',
] as const

export const SPECIALTY_LABEL: Record<string, string> = {
  plomberie:     'Plomberie',
  electricite:   'Électricité',
  serrurerie:    'Serrurerie',
  menage:        'Ménage',
  electromenager:'Électroménager',
  climatisation: 'Climatisation',
  peinture:      'Peinture',
  maconnerie:    'Maçonnerie',
  jardinage:     'Jardinage',
  menuiserie:    'Menuiserie',
  vitrerie:      'Vitrerie',
  piscine:       'Piscine',
  informatique:  'Informatique',
  securite:      'Sécurité',
  autre:         'Autre',
}

export const SPECIALTY_COLOR: Record<string, { bg: string; color: string }> = {
  plomberie:     { bg: 'rgba(37,99,168,0.10)',  color: '#2563A8' },
  electricite:   { bg: 'rgba(193,124,26,0.10)', color: '#C17C1A' },
  serrurerie:    { bg: 'rgba(102,102,102,0.10)',color: '#666666' },
  menage:        { bg: 'rgba(46,125,82,0.10)',   color: '#2E7D52' },
  electromenager:{ bg: 'rgba(139,69,19,0.10)',   color: '#8B4513' },
  climatisation: { bg: 'rgba(0,188,212,0.10)',   color: '#00BCD4' },
  peinture:      { bg: 'rgba(156,39,176,0.10)',  color: '#9C27B0' },
  maconnerie:    { bg: 'rgba(121,85,72,0.10)',   color: '#795548' },
  jardinage:     { bg: 'rgba(76,175,80,0.10)',   color: '#4CAF50' },
  autre:         { bg: 'rgba(102,102,102,0.08)', color: '#999999' },
}

export const AVAILABILITY_CONFIG: Record<Availability, { label: string; color: string; bg: string }> = {
  disponible:   { label: 'Disponible',  color: '#2E7D52', bg: 'rgba(46,125,82,0.10)'  },
  sur_rdv:      { label: 'Sur RDV',     color: '#C17C1A', bg: 'rgba(193,124,26,0.10)' },
  indisponible: { label: 'Indisponible',color: '#999999', bg: 'rgba(102,102,102,0.08)'},
}

// Mapping type SAV → spécialités intervenants
export const SAV_TYPE_TO_SPECIALTY: Record<string, string[]> = {
  plomberie:     ['plomberie'],
  electricite:   ['electricite'],
  serrure:       ['serrurerie'],
  menage:        ['menage'],
  electromenager:['electromenager'],
  climatisation: ['climatisation'],
  chauffage:     ['climatisation', 'plomberie'],
  internet:      ['informatique'],
  nuisance:      ['serrurerie', 'autre'],
  degradation:   ['maconnerie', 'peinture', 'vitrerie'],
  autre:         [],
}
