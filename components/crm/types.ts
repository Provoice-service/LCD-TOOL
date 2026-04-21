// =============================================================================
// CRM — Types partagés
// =============================================================================

export type PipelineType = 'service_client' | 'immobilier' | 'expansion'
export type LeadPriority  = 'haute' | 'normale' | 'basse'
export type LeadSource    =
  | 'meta_ads' | 'google_ads' | 'website_form' | 'organic_social' | 'linkedin'
  | 'referral' | 'cold_outreach' | 'event' | 'phone_inbound' | 'whatsapp_inbound'
  | 'email_inbound' | 'partner' | 'other'

export interface CrmLead {
  id: string
  pipeline_type: PipelineType
  full_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  country: string
  stage: string
  priority: LeadPriority
  nb_properties: number | null
  current_tools: string | null
  monthly_revenue_potential: number | null
  property_budget: number | null
  property_type_interest: string | null
  expansion_city: string | null
  source: LeadSource
  source_detail: string | null
  referral_name: string | null
  utm_campaign: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_content: string | null
  lead_cost: number | null
  notes: string | null
  next_action: string | null
  next_action_date: string | null
  lost_reason: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  // joined
  activities?: CrmActivity[]
}

export interface CrmActivity {
  id: string
  lead_id: string | null
  activity_type: string | null
  title: string | null
  content: string | null
  outcome: string | null
  next_step: string | null
  created_by: string | null
  created_at: string
}

export interface CrmMarket {
  id: string
  city: string
  country: string
  status: 'identified' | 'prospecting' | 'active' | 'paused'
  target_properties: number | null
  current_properties: number
  local_partners: string | null
  cleaning_providers: string | null
  regulatory_notes: string | null
  target_launch_date: string | null
  notes: string | null
  created_at: string
}

// ─── Stages par pipeline ──────────────────────────────────────────────────────

export const STAGES: Record<PipelineType, { key: string; label: string }[]> = {
  service_client: [
    { key: 'lead',        label: 'Lead'          },
    { key: 'contacted',   label: 'Contacté'      },
    { key: 'qualified',   label: 'Qualifié'      },
    { key: 'demo',        label: 'Démo'          },
    { key: 'offer_sent',  label: 'Offre envoyée' },
    { key: 'negotiation', label: 'Négociation'   },
    { key: 'signed',      label: 'Signé'         },
    { key: 'active',      label: 'Actif'         },
    { key: 'churned',     label: 'Perdu'         },
  ],
  immobilier: [
    { key: 'lead',          label: 'Lead'         },
    { key: 'qualified',     label: 'Qualifié'     },
    { key: 'visit_planned', label: 'Visite prévue'},
    { key: 'visit_done',    label: 'Visité'       },
    { key: 'offer',         label: 'Offre'        },
    { key: 'negotiation',   label: 'Négociation'  },
    { key: 'compromis',     label: 'Compromis'    },
    { key: 'acte',          label: 'Acte signé'   },
    { key: 'lost',          label: 'Perdu'        },
  ],
  expansion: [
    { key: 'identified',          label: 'Identifié'     },
    { key: 'prospecting',         label: 'Prospection'   },
    { key: 'partners_found',      label: 'Partenaires'   },
    { key: 'properties_sourced',  label: 'Biens sourcés' },
    { key: 'launched',            label: 'Lancé'         },
  ],
}

// ─── Couleurs sources ─────────────────────────────────────────────────────────

export const SOURCE_CONFIG: Record<LeadSource, { label: string; color: string; bg: string }> = {
  meta_ads:        { label: 'Meta Ads',     color: 'text-orange-700',   bg: 'bg-orange-100'   },
  google_ads:      { label: 'Google Ads',   color: 'text-blue-700',     bg: 'bg-blue-100'     },
  website_form:    { label: 'Site web',     color: 'text-violet-700',   bg: 'bg-violet-100'   },
  organic_social:  { label: 'Réseaux',      color: 'text-green-700',    bg: 'bg-green-100'    },
  linkedin:        { label: 'LinkedIn',     color: 'text-blue-900',     bg: 'bg-blue-200'     },
  referral:        { label: 'Référence',    color: 'text-teal-700',     bg: 'bg-teal-100'     },
  cold_outreach:   { label: 'Prospection',  color: 'text-gray-700',     bg: 'bg-gray-100'     },
  event:           { label: 'Événement',    color: 'text-amber-700',    bg: 'bg-amber-100'    },
  phone_inbound:   { label: 'Tél. entrant', color: 'text-emerald-700',  bg: 'bg-emerald-100'  },
  whatsapp_inbound:{ label: 'WhatsApp',     color: 'text-emerald-700',  bg: 'bg-emerald-100'  },
  email_inbound:   { label: 'Email',        color: 'text-emerald-700',  bg: 'bg-emerald-100'  },
  partner:         { label: 'Partenaire',   color: 'text-rose-700',     bg: 'bg-rose-100'     },
  other:           { label: 'Autre',        color: 'text-gray-500',     bg: 'bg-gray-50'      },
}

export const PRIORITY_CONFIG: Record<LeadPriority, { label: string; color: string }> = {
  haute:    { label: 'Haute',    color: 'text-red-600'    },
  normale:  { label: 'Normale',  color: 'text-blue-600'   },
  basse:    { label: 'Basse',    color: 'text-gray-500'   },
}

export const PIPELINE_LABELS: Record<PipelineType, string> = {
  service_client: 'Service Client',
  immobilier:     'Immobilier',
  expansion:      'Expansion',
}
