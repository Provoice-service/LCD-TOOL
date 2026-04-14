'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ReservationRow } from '@/components/reservations/ReservationsClient'
import {
  FileText,
  CreditCard,
  Shield,
  KeyRound,
  Loader2,
  Copy,
  Check,
  Wifi,
  MapPin,
  Phone,
  Calendar,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccessResult {
  code: string
  lock_type: string
  instructions: string
  test_mode: boolean
}

interface ChecklistItem {
  key: keyof Pick<ReservationRow, 'contract_signed' | 'id_received' | 'deposit_ok' | 'access_code_sent'>
  label: string
  icon: React.ElementType
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: 'contract_signed',  label: 'Contrat signé',       icon: FileText  },
  { key: 'id_received',      label: "Pièce d'identité",    icon: CreditCard },
  { key: 'deposit_ok',       label: 'Caution encaissée',   icon: Shield    },
  { key: 'access_code_sent', label: 'Code accès envoyé',   icon: KeyRound  },
]

const LOCK_TYPE_LABEL: Record<string, string> = {
  tuya:      'Serrure Tuya',
  smartlife: 'Serrure SmartLife',
  nuki:      'Serrure Nuki',
  key_box:   'Boîte à clés',
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

interface ReservationDetailProps {
  reservation: ReservationRow
  onUpdated: (updated: ReservationRow) => void
}

export function ReservationDetail({ reservation: res, onUpdated }: ReservationDetailProps) {
  const [generatingCode, setGeneratingCode] = useState(false)
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const doneCount = CHECKLIST_ITEMS.filter((item) => res[item.key]).length
  const lockType = res.access_type_override ?? res.property?.access_type ?? 'key_box'

  const checkIn = res.check_in
    ? format(new Date(res.check_in), "dd MMMM yyyy 'à' HH'h'mm", { locale: fr })
    : '—'
  const checkOut = res.check_out
    ? format(new Date(res.check_out), "dd MMMM yyyy 'à' HH'h'mm", { locale: fr })
    : '—'

  async function toggleChecklist(
    key: keyof Pick<ReservationRow, 'contract_signed' | 'id_received' | 'deposit_ok' | 'access_code_sent'>
  ) {
    const newVal = !res[key]
    setUpdatingKey(key)
    const supabase = createClient()
    const { error } = await supabase
      .from('reservations')
      .update({ [key]: newVal })
      .eq('id', res.id)
    setUpdatingKey(null)
    if (!error) {
      onUpdated({ ...res, [key]: newVal })
    }
  }

  async function generateCode() {
    setGeneratingCode(true)
    setAccessResult(null)
    try {
      const response = await fetch('/api/access/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: res.id }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`)
      setAccessResult(data)
      onUpdated({ ...res, access_code: data.code, access_code_sent: true })
    } catch (err) {
      console.error('[ReservationDetail] Erreur génération code:', err)
      setAccessResult({
        code: 'ERREUR',
        lock_type: lockType,
        instructions: err instanceof Error ? err.message : String(err),
        test_mode: false,
      })
    } finally {
      setGeneratingCode(false)
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayedCode = accessResult?.code ?? res.access_code

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-2xl mx-auto">

        {/* ── En-tête ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                {res.guest?.full_name ?? 'Voyageur inconnu'}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {res.property?.name ?? '—'}{res.property?.city ? ` · ${res.property.city}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant="secondary">{res.platform}</Badge>
              <span className="text-sm font-medium">{res.total_amount} €</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Arrivée : <span className="text-foreground font-medium">{checkIn}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Départ : <span className="text-foreground font-medium">{checkOut}</span></span>
            </div>
            {res.guest?.phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{res.guest.phone}</span>
              </div>
            )}
            {res.property?.city && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{res.property.city}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Checklist arrivée ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Checklist arrivée</h3>
            <span
              className={`text-sm font-medium ${
                doneCount === 4 ? 'text-green-600' : 'text-muted-foreground'
              }`}
            >
              {doneCount}/4
            </span>
          </div>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map(({ key, label, icon: Icon }) => {
              const done = res[key] as boolean
              const isUpdating = updatingKey === key
              return (
                <button
                  key={key}
                  onClick={() => toggleChecklist(key)}
                  disabled={isUpdating}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                    done
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
                      : 'bg-background border-border hover:bg-muted/50'
                  }`}
                >
                  <div
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      done
                        ? 'border-green-600 bg-green-600'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {done && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      done ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                  />
                  <span
                    className={`text-sm flex-1 ${
                      done ? 'text-green-700 dark:text-green-400 font-medium' : 'text-foreground'
                    }`}
                  >
                    {label}
                  </span>
                  {isUpdating && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* ── Section accès ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Codes d'accès</h3>
            <Badge variant="outline" className="text-xs">
              {LOCK_TYPE_LABEL[lockType] ?? lockType}
            </Badge>
          </div>

          {/* Code existant ou généré */}
          {displayedCode && (
            <div className="mb-4 p-4 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Code d'accès
                  {(accessResult?.test_mode) && (
                    <span className="ml-2 text-amber-600 font-medium">(mode test)</span>
                  )}
                </span>
                <button
                  onClick={() => copyCode(displayedCode)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 text-green-600" /> Copié</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copier</>
                  )}
                </button>
              </div>
              <p className="text-2xl font-mono font-bold tracking-widest">{displayedCode}</p>
              {accessResult?.instructions && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {accessResult.instructions}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={generateCode}
            disabled={generatingCode}
            variant={displayedCode ? 'outline' : 'default'}
            className="w-full"
          >
            {generatingCode ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4 mr-2" />
                {displayedCode ? 'Regénérer le code' : 'Générer le code d\'accès'}
              </>
            )}
          </Button>
        </div>

        {/* ── Infos logement ────────────────────────────────────────────────── */}
        {(res.property?.wifi_name || res.property?.house_rules) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Informations logement</h3>
              {res.property.wifi_name && (
                <div className="flex items-start gap-2 text-sm">
                  <Wifi className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{res.property.wifi_name}</span>
                    {res.property.wifi_pass && (
                      <span className="text-muted-foreground"> / {res.property.wifi_pass}</span>
                    )}
                  </div>
                </div>
              )}
              {res.property.house_rules && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {res.property.house_rules}
                </p>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
