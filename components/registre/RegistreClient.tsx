'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle2, AlertTriangle, XCircle, Clock, Search, Filter } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AiResult {
  is_valid_document: boolean
  document_type: string
  is_expired: boolean | null
  full_name: string | null
  nationality: string | null
  document_number: string | null
  birth_date: string | null
  image_quality: string
  rejection_reason: string | null
}

interface IdentityDoc {
  adult_index: number
  adult_name?: string
  doc_type?: string
  url?: string
  extraction_status?: string
  validated_at?: string
  ai_result?: AiResult
}

export interface RegistreRow {
  id: string
  check_in: string | null
  check_out: string | null
  platform: string
  nb_adults: number
  identity_documents: IdentityDoc[]
  onboarding_completed_at: string | null
  guest: { full_name: string; email: string | null } | null
  property: { name: string; city: string | null } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type AiStatus = 'verified' | 'manual_review' | 'invalid' | 'expired' | 'poor_quality' | 'pending' | 'none'

function resolveStatus(docs: IdentityDoc[], nbAdults: number): AiStatus {
  if (docs.length === 0) return 'none'
  if (docs.length < nbAdults) return 'pending'
  const statuses = docs.map(d => d.extraction_status ?? 'pending')
  if (statuses.some(s => s === 'invalid' || s === 'expired' || s === 'poor_quality')) return 'invalid'
  if (statuses.some(s => s === 'manual_review')) return 'manual_review'
  if (statuses.every(s => s === 'verified')) return 'verified'
  return 'pending'
}

function StatusBadge({ status }: { status: AiStatus }) {
  const map: Record<AiStatus, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
    verified:      { label: 'Vérifié IA',         icon: <CheckCircle2 size={13} />, bg: '#E8F5E9', color: '#2E7D32' },
    manual_review: { label: 'Vérif. manuelle',     icon: <AlertTriangle size={13} />, bg: '#FFF8E1', color: '#F57F17' },
    invalid:       { label: 'Document invalide',   icon: <XCircle size={13} />,      bg: '#FFEBEE', color: '#C62828' },
    expired:       { label: 'Document expiré',     icon: <XCircle size={13} />,      bg: '#FFEBEE', color: '#C62828' },
    poor_quality:  { label: 'Qualité insuffisante', icon: <AlertTriangle size={13} />, bg: '#FFF3E0', color: '#E65100' },
    pending:       { label: 'En attente',          icon: <Clock size={13} />,         bg: '#F3F4F6', color: '#6B7280' },
    none:          { label: 'Aucun document',      icon: <Clock size={13} />,         bg: '#F3F4F6', color: '#9CA3AF' },
  }
  const cfg = map[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function DocTypeLabel(type: string): string {
  const map: Record<string, string> = {
    passeport: 'Passeport', cni: 'CNI', carte_sejour: 'Carte de séjour',
  }
  return map[type] ?? type
}

// ── Composant principal ────────────────────────────────────────────────────────

export function RegistreClient({ rows }: { rows: RegistreRow[] }) {
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilter]   = useState<AiStatus | 'all'>('all')
  const [expandedId, setExpanded]   = useState<string | null>(null)

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q ||
      (r.guest?.full_name ?? '').toLowerCase().includes(q) ||
      (r.property?.name ?? '').toLowerCase().includes(q)
    const status = resolveStatus(r.identity_documents, r.nb_adults || 1)
    const matchStatus = filterStatus === 'all' || status === filterStatus
    return matchQ && matchStatus
  })

  // Compteurs
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const s = resolveStatus(r.identity_documents, r.nb_adults || 1)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const filterOptions: { value: AiStatus | 'all'; label: string }[] = [
    { value: 'all',          label: `Tous (${rows.length})` },
    { value: 'verified',     label: `✓ Vérifié (${counts.verified ?? 0})` },
    { value: 'manual_review', label: `⚠ Manuelle (${counts.manual_review ?? 0})` },
    { value: 'invalid',      label: `✗ Invalide (${counts.invalid ?? 0})` },
    { value: 'pending',      label: `⏳ En attente (${(counts.pending ?? 0) + (counts.none ?? 0)})` },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light" style={{ fontFamily: 'var(--font-heading, serif)', color: '#1A1A1A' }}>
            Registre des voyageurs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#666666' }}>
            Conformité réglementaire · Documents d'identité collectés
          </p>
        </div>
        {/* Badges résumé */}
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
            <CheckCircle2 className="inline w-3 h-3 mr-1" />
            {counts.verified ?? 0} vérifiés IA
          </span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#FFF8E1', color: '#F57F17' }}>
            <AlertTriangle className="inline w-3 h-3 mr-1" />
            {counts.manual_review ?? 0} manuels
          </span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#FFEBEE', color: '#C62828' }}>
            <XCircle className="inline w-3 h-3 mr-1" />
            {(counts.invalid ?? 0) + (counts.expired ?? 0)} invalides
          </span>
        </div>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#999999' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un voyageur ou logement…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FFFFFF' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} style={{ color: '#999999' }} />
          <select value={filterStatus} onChange={e => setFilter(e.target.value as AiStatus | 'all')}
            className="px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FFFFFF' }}>
            {filterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E4DC' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid #E8E4DC' }}>
              {['Voyageur', 'Logement', 'Séjour', 'Documents', 'Validation IA', 'Détails'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: '#999999' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#F0EDE8' }}>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-sm" style={{ color: '#999999' }}>
                  Aucune réservation trouvée
                </td>
              </tr>
            )}
            {filtered.map(r => {
              const status = resolveStatus(r.identity_documents, r.nb_adults || 1)
              const isExpanded = expandedId === r.id
              const docsCount = r.identity_documents.length
              const docsNeeded = r.nb_adults || 1
              return (
                <>
                  <tr key={r.id} style={{ background: '#FFFFFF' }}
                    className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
                        {r.guest?.full_name ?? '—'}
                      </p>
                      <p className="text-xs" style={{ color: '#999999' }}>{r.guest?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm" style={{ color: '#1A1A1A' }}>{r.property?.name ?? '—'}</p>
                      <p className="text-xs" style={{ color: '#999999' }}>{r.property?.city ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs" style={{ color: '#666666' }}>
                        {r.check_in ? format(new Date(r.check_in), 'd MMM yy', { locale: fr }) : '—'}
                        {' → '}
                        {r.check_out ? format(new Date(r.check_out), 'd MMM yy', { locale: fr }) : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: docsCount >= docsNeeded ? '#2E7D32' : '#999999' }}>
                        {docsCount}/{docsNeeded} doc{docsNeeded > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3">
                      {r.identity_documents.length > 0 && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : r.id)}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium"
                          style={{ background: '#F8F7F5', color: '#666666', border: '1px solid #E8E4DC' }}>
                          {isExpanded ? 'Masquer' : 'Voir'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && r.identity_documents.length > 0 && (
                    <tr key={`${r.id}-detail`} style={{ background: '#F8F7F5' }}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {r.identity_documents.map((doc, idx) => (
                            <div key={idx} className="rounded-xl p-3 space-y-1.5"
                              style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold" style={{ color: '#1A1A1A' }}>
                                  Voyageur {doc.adult_index + 1}
                                  {doc.adult_name ? ` — ${doc.adult_name}` : ''}
                                </p>
                                <StatusBadge status={(doc.extraction_status as AiStatus) ?? 'pending'} />
                              </div>
                              {doc.doc_type && (
                                <p className="text-xs" style={{ color: '#666666' }}>
                                  {DocTypeLabel(doc.doc_type)}
                                </p>
                              )}
                              {doc.ai_result?.full_name && (
                                <p className="text-xs" style={{ color: '#1A1A1A' }}>
                                  Nom extrait : <span className="font-medium">{doc.ai_result.full_name}</span>
                                </p>
                              )}
                              {doc.ai_result?.document_number && (
                                <p className="text-xs" style={{ color: '#666666' }}>
                                  N° : {doc.ai_result.document_number}
                                </p>
                              )}
                              {doc.ai_result?.nationality && (
                                <p className="text-xs" style={{ color: '#666666' }}>
                                  Nationalité : {doc.ai_result.nationality}
                                </p>
                              )}
                              {doc.ai_result?.birth_date && (
                                <p className="text-xs" style={{ color: '#666666' }}>
                                  Né(e) le : {doc.ai_result.birth_date}
                                </p>
                              )}
                              {doc.ai_result?.rejection_reason && (
                                <p className="text-xs" style={{ color: '#C62828' }}>
                                  ⚠ {doc.ai_result.rejection_reason}
                                </p>
                              )}
                              {doc.validated_at && (
                                <p className="text-xs" style={{ color: '#BBBBBB' }}>
                                  Validé le {format(new Date(doc.validated_at), 'd MMM à HH:mm', { locale: fr })}
                                </p>
                              )}
                              {doc.url && (
                                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs inline-block mt-1 font-medium"
                                  style={{ color: '#C4A044' }}>
                                  Voir le document ↗
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
