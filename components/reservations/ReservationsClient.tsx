'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ReservationDetail } from '@/components/reservations/ReservationDetail'
import {
  FileText,
  CreditCard,
  Shield,
  KeyRound,
  Calendar,
  Home,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReservationRow {
  id: string
  check_in: string | null
  check_out: string | null
  platform: string
  status: string
  total_amount: number
  contract_signed: boolean
  id_received: boolean
  deposit_ok: boolean
  access_code_sent: boolean
  access_code: string | null
  access_type_override: string | null
  guest: { id: string; full_name: string; phone: string | null; language: string } | null
  property: {
    id: string
    name: string
    city: string | null
    access_type: string
    tuya_device_id: string | null
    wifi_name: string | null
    wifi_pass: string | null
    house_rules: string | null
    syndic_required: boolean
    syndic_name: string | null
    syndic_phone: string | null
  } | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  confirmed:  'default',
  pending:    'secondary',
  cancelled:  'destructive',
  completed:  'outline',
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmée',
  pending:   'En attente',
  cancelled: 'Annulée',
  completed: 'Terminée',
}

const PLATFORM_DOT: Record<string, string> = {
  airbnb:  'bg-red-500',
  booking: 'bg-blue-500',
  direct:  'bg-green-500',
}

const ALL_STATUSES = ['all', 'confirmed', 'pending', 'completed', 'cancelled']

function dateRange(checkIn: string | null, checkOut: string | null) {
  if (!checkIn) return '—'
  const inStr  = format(new Date(checkIn),  'dd MMM', { locale: fr })
  const outStr = checkOut ? format(new Date(checkOut), 'dd MMM yyyy', { locale: fr }) : '?'
  return `${inStr} → ${outStr}`
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface ReservationsClientProps {
  initialReservations: ReservationRow[]
}

export function ReservationsClient({ initialReservations }: ReservationsClientProps) {
  const [reservations, setReservations] = useState<ReservationRow[]>(initialReservations)
  const [selected, setSelected] = useState<ReservationRow | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = reservations.filter(
    (r) => statusFilter === 'all' || r.status === statusFilter
  )

  function handleUpdated(updated: ReservationRow) {
    setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelected(updated)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Panneau gauche : liste ──────────────────────────────────────────── */}
      <aside className="w-[340px] shrink-0 border-r flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="font-semibold text-sm">Réservations</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {filtered.length}
          </Badge>
        </div>

        {/* Filtres statut */}
        <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto shrink-0">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {s === 'all' ? 'Toutes' : STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              Aucune réservation
            </p>
          ) : (
            filtered.map((res) => {
              const isSelected = selected?.id === res.id
              const checklist = [
                res.contract_signed,
                res.id_received,
                res.deposit_ok,
                res.access_code_sent,
              ]
              const doneCount = checklist.filter(Boolean).length

              return (
                <button
                  key={res.id}
                  onClick={() => setSelected(res)}
                  className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors ${
                    isSelected ? 'bg-muted' : ''
                  }`}
                >
                  {/* Ligne 1 : voyageur + statut */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold truncate">
                      {res.guest?.full_name ?? 'Inconnu'}
                    </span>
                    <Badge
                      variant={STATUS_VARIANT[res.status] ?? 'secondary'}
                      className="text-[10px] px-1.5 py-0 h-4 shrink-0 ml-1"
                    >
                      {STATUS_LABEL[res.status] ?? res.status}
                    </Badge>
                  </div>

                  {/* Ligne 2 : logement + dates */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        PLATFORM_DOT[res.platform] ?? 'bg-gray-400'
                      }`}
                    />
                    <Home className="h-3 w-3 shrink-0" />
                    <span className="truncate">{res.property?.name ?? '—'}</span>
                    <span>·</span>
                    <span className="shrink-0">{dateRange(res.check_in, res.check_out)}</span>
                  </div>

                  {/* Ligne 3 : checklist icons */}
                  <div className="flex items-center gap-2">
                    {[
                      { Icon: FileText,   done: res.contract_signed,  label: 'Contrat' },
                      { Icon: CreditCard, done: res.id_received,      label: 'Pièce id' },
                      { Icon: Shield,     done: res.deposit_ok,       label: 'Caution' },
                      { Icon: KeyRound,   done: res.access_code_sent, label: 'Accès' },
                    ].map(({ Icon, done, label }) => (
                      <div
                        key={label}
                        title={label}
                        className={done ? 'text-green-600' : 'text-muted-foreground/30'}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    ))}
                    <span
                      className={`ml-auto text-[10px] font-medium ${
                        doneCount === 4 ? 'text-green-600' : 'text-muted-foreground'
                      }`}
                    >
                      {doneCount}/4
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ── Panneau droit : détail ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Calendar className="h-10 w-10 opacity-20" />
            <p className="text-sm">Sélectionnez une réservation</p>
          </div>
        ) : (
          <>
            <Separator orientation="vertical" className="hidden" />
            <ReservationDetail
              reservation={selected}
              onUpdated={handleUpdated}
            />
          </>
        )}
      </main>
    </div>
  )
}
