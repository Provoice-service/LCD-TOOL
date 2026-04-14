import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function completionBadge(rate: number) {
  if (rate >= 80) return { label: `${rate}%`, variant: 'default' as const, cls: 'bg-green-600 hover:bg-green-600 text-white' }
  if (rate >= 40) return { label: `${rate}%`, variant: 'secondary' as const, cls: 'bg-amber-500 hover:bg-amber-500 text-white' }
  return { label: `${rate}%`, variant: 'destructive' as const, cls: '' }
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Logements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {list.length} logement{list.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Home className="h-12 w-12 opacity-20" />
          <p className="text-sm">Aucun logement — lancez le seed pour des données de démo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((p) => {
            const rate = completionRate(p as Record<string, unknown>)
            const badge = completionBadge(rate)
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                {/* Icône */}
                <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Home className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold truncate">{p.name}</span>
                    {!p.is_active && (
                      <Badge variant="outline" className="text-[10px]">Inactif</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {p.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.city}{p.country ? `, ${p.country}` : ''}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <KeyRound className="h-3 w-3" />
                      {ACCESS_LABEL[p.access_type] ?? p.access_type}
                    </span>
                  </div>
                </div>

                {/* Taux de complétion */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <Badge className={badge.cls} variant={badge.variant}>
                    Fiche {badge.label}
                  </Badge>
                  <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        rate >= 80 ? 'bg-green-600' : rate >= 40 ? 'bg-amber-500' : 'bg-destructive'
                      }`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>

                {/* Bouton */}
                <Link href={`/properties/${p.id}`} className="shrink-0">
                  <Button variant="outline" size="sm" className="gap-1">
                    Voir la fiche
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
