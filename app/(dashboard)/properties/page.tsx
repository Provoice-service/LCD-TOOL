import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Home, MapPin, KeyRound, ChevronRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Taux de complétion
// ---------------------------------------------------------------------------

const COMPLETION_FIELDS = [
  'check_in_time', 'check_out_time', 'max_guests',
  'wifi_name', 'wifi_pass',
  'access_instructions_full',
  'appliances_info', 'heating_info',
  'parking_info', 'trash_info',
  'noise_rules', 'house_rules',
  'nearby_info',
  'emergency_procedure', 'owner_contact',
] as const

function completionRate(property: Record<string, unknown>): number {
  const filled = COMPLETION_FIELDS.filter((f) => {
    const v = property[f]
    return v !== null && v !== undefined && v !== ''
  }).length
  return Math.round((filled / COMPLETION_FIELDS.length) * 100)
}

const ACCESS_LABEL: Record<string, string> = {
  tuya:      'Tuya',
  smartlife: 'SmartLife',
  nuki:      'Nuki',
  key_box:   'Boîte à clés',
  manual:    'Manuel',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PropertiesPage() {
  const supabase = await createClient()

  const { data: properties, error } = await supabase
    .from('properties')
    .select('*')
    .order('name', { ascending: true })

  if (error) console.error('[Properties] Erreur:', error.message)

  const list = properties ?? []

  return (
    <div className="p-8" style={{ maxWidth: 840 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-heading), Georgia, serif',
              fontSize: 28,
              fontWeight: 500,
              color: '#1A1A1A',
              letterSpacing: '0.01em',
            }}
          >
            Logements
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#666666' }}>
            {list.length} logement{list.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: '#CCCCCC' }}>
          <Home className="h-12 w-12 opacity-20" />
          <p className="text-sm">Aucun logement — lancez le seed pour des données de démo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((p) => {
            const rate = completionRate(p as Record<string, unknown>)
            const barColor = rate >= 80 ? '#2E7D52' : rate >= 40 ? '#C17C1A' : '#C0392B'
            const badgeColor = rate >= 80
              ? { bg: 'rgba(46,125,82,0.10)', text: '#2E7D52', border: 'rgba(46,125,82,0.25)' }
              : rate >= 40
              ? { bg: 'rgba(193,124,26,0.10)', text: '#C17C1A', border: 'rgba(193,124,26,0.25)' }
              : { bg: 'rgba(192,57,43,0.10)', text: '#C0392B', border: 'rgba(192,57,43,0.25)' }

            const countryBadge = p.country === 'MA'
              ? { bg: 'rgba(76,175,114,0.12)', text: '#4CAF72', border: 'rgba(76,175,114,0.3)' }
              : p.country === 'FR'
              ? { bg: 'rgba(91,155,213,0.12)', text: '#5B9BD5', border: 'rgba(91,155,213,0.3)' }
              : null

            return (
              <div
                key={p.id}
                className="flex items-center gap-4 p-4 rounded-xl transition-colors duration-200"
                style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}
              >
                {/* Icône */}
                <div
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(196,160,68,0.08)', border: '1px solid rgba(196,160,68,0.2)' }}
                >
                  <Home className="h-4.5 w-4.5" style={{ color: '#C4A044' }} />
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-medium text-sm truncate" style={{ color: '#1A1A1A' }}>
                      {p.name}
                    </span>
                    {!p.is_active && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: '#F2F0EC', color: '#999999', border: '1px solid #E8E4DC' }}
                      >
                        Inactif
                      </span>
                    )}
                    {countryBadge && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          background: countryBadge.bg,
                          color: countryBadge.text,
                          border: `1px solid ${countryBadge.border}`,
                        }}
                      >
                        {p.country}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: '#999999' }}>
                    {p.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.city}{p.country && p.country !== 'FR' ? `, ${p.country}` : ''}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <KeyRound className="h-3 w-3" />
                      {ACCESS_LABEL[p.access_type] ?? p.access_type}
                    </span>
                  </div>
                </div>

                {/* Complétion */}
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{
                      background: badgeColor.bg,
                      color: badgeColor.text,
                      border: `1px solid ${badgeColor.border}`,
                    }}
                  >
                    Fiche {rate}%
                  </span>
                  <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: '#2A2A2A' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${rate}%`, background: barColor }}
                    />
                  </div>
                </div>

                {/* Bouton */}
                <Link href={`/properties/${p.id}`} className="shrink-0">
                  <button
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: 'transparent',
                      border: '1px solid #E8E4DC',
                      color: '#666666',
                    }}
                  >
                    Voir la fiche
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
