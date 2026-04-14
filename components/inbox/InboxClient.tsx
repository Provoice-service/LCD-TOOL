'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AISuggestion } from '@/components/inbox/AISuggestion'
import {
  FileText,
  CreditCard,
  Shield,
  KeyRound,
  MessageSquare,
  Calendar,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageWithContext {
  id: string
  body: string | null
  channel: string
  direction: string
  status: string
  priority: string
  created_at: string
  reservation_id: string | null
  reservation: {
    id: string
    check_in: string | null
    check_out: string | null
    platform: string
    contract_signed: boolean
    id_received: boolean
    deposit_ok: boolean
    access_code_sent: boolean
    guest: { id: string; full_name: string; phone: string | null } | null
    property: { id: string; name: string; city: string | null } | null
  } | null
}

interface ThreadMessage {
  id: string
  body: string | null
  direction: string
  created_at: string
  status: string
  ai_suggestion: string | null
  ai_used: boolean | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_DOT: Record<string, string> = {
  airbnb: 'bg-red-500',
  booking: 'bg-blue-500',
  direct: 'bg-green-500',
}

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  urgent: 'destructive',
  high: 'default',
  normal: 'secondary',
}

function timeLabel(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diffHours = (now.getTime() - date.getTime()) / 3_600_000
  if (diffHours < 24) return format(date, 'HH:mm')
  if (diffHours < 168) return format(date, 'EEE', { locale: fr })
  return format(date, 'dd/MM')
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface InboxClientProps {
  initialMessages: MessageWithContext[]
}

export function InboxClient({ initialMessages }: InboxClientProps) {
  const [messages, setMessages] = useState<MessageWithContext[]>(initialMessages)
  const [selected, setSelected] = useState<MessageWithContext | null>(null)
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [loadingThread, setLoadingThread] = useState(false)

  // Tri : pending en premier, puis date décroissante
  const sorted = [...messages].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Charger le thread complet quand un message est sélectionné
  useEffect(() => {
    if (!selected?.reservation_id) return

    setLoadingThread(true)
    const supabase = createClient()

    supabase
      .from('messages')
      .select('id, body, direction, created_at, status, ai_suggestion, ai_used')
      .eq('reservation_id', selected.reservation_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setThread((data as ThreadMessage[]) ?? [])
        setLoadingThread(false)
      })
  }, [selected?.reservation_id])

  function handleSent() {
    // Rafraîchir la liste après envoi
    const supabase = createClient()
    supabase
      .from('messages')
      .select(`
        id, body, channel, direction, status, priority, created_at, reservation_id,
        reservation:reservations(
          id, check_in, check_out, platform,
          contract_signed, id_received, deposit_ok, access_code_sent,
          guest:guests(id, full_name, phone),
          property:properties(id, name, city)
        )
      `)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setMessages(data as unknown as MessageWithContext[])
      })
  }

  const unreadCount = messages.filter((m) => m.status === 'pending').length

  return (
    <div className="flex h-full overflow-hidden">
      {/* ─── Panneau gauche : liste ────────────────────────────────────────── */}
      <aside className="w-[280px] shrink-0 border-r flex flex-col overflow-hidden">
        {/* Header liste */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-semibold text-sm">Inbox</span>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
              {unreadCount}
            </Badge>
          )}
        </div>

        {/* Liste scrollable */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Aucun message</p>
          ) : (
            sorted.map((msg) => {
              const isSelected = selected?.id === msg.id
              const guest = msg.reservation?.guest
              const property = msg.reservation?.property
              const platform = msg.reservation?.platform ?? 'other'
              const isUnread = msg.status === 'pending'

              return (
                <button
                  key={msg.id}
                  onClick={() => setSelected(msg)}
                  className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors ${
                    isSelected ? 'bg-muted' : ''
                  }`}
                >
                  {/* Ligne 1 : nom + heure */}
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                      <span
                        className={`text-sm truncate ${
                          isUnread ? 'font-semibold' : 'font-medium text-muted-foreground'
                        }`}
                      >
                        {guest?.full_name ?? 'Inconnu'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-1">
                      {timeLabel(msg.created_at)}
                    </span>
                  </div>

                  {/* Ligne 2 : preview */}
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {msg.body ?? '…'}
                  </p>

                  {/* Ligne 3 : logement + plateforme + priorité */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        PLATFORM_DOT[platform] ?? 'bg-gray-400'
                      }`}
                    />
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {property?.name ?? '—'}
                    </span>
                    {msg.priority !== 'normal' && (
                      <Badge
                        variant={PRIORITY_VARIANT[msg.priority] ?? 'secondary'}
                        className="text-[10px] px-1 py-0 h-4"
                      >
                        {msg.priority}
                      </Badge>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ─── Panneau droit : thread ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <MessageSquare className="h-10 w-10 opacity-20" />
            <p className="text-sm">Sélectionnez un message</p>
          </div>
        ) : (
          <>
            {/* Header thread */}
            <ThreadHeader message={selected} />
            <Separator />

            {/* Messages du thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingThread ? (
                <p className="text-sm text-muted-foreground text-center pt-8">Chargement…</p>
              ) : (
                thread.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
            </div>

            {/* Suggestion IA */}
            <AISuggestion
              messageId={selected.id}
              onSent={handleSent}
            />
          </>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ThreadHeader
// ---------------------------------------------------------------------------

function ThreadHeader({ message }: { message: MessageWithContext }) {
  const res = message.reservation
  const guest = res?.guest
  const property = res?.property

  const checkIn = res?.check_in
    ? format(new Date(res.check_in), 'dd MMM', { locale: fr })
    : '—'
  const checkOut = res?.check_out
    ? format(new Date(res.check_out), 'dd MMM yyyy', { locale: fr })
    : '—'

  const checklist = [
    { icon: FileText,  label: 'Contrat',      done: res?.contract_signed ?? false },
    { icon: CreditCard, label: 'Pièce id',    done: res?.id_received ?? false },
    { icon: Shield,    label: 'Caution',       done: res?.deposit_ok ?? false },
    { icon: KeyRound,  label: 'Accès envoyé', done: res?.access_code_sent ?? false },
  ]

  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4 bg-background">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold truncate">{guest?.full_name ?? 'Inconnu'}</h2>
          <Badge variant="secondary" className="text-xs shrink-0">
            {res?.platform ?? '—'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <Calendar className="h-3 w-3" />
          <span>{property?.name ?? '—'}</span>
          <span>·</span>
          <span>
            {checkIn} → {checkOut}
          </span>
        </div>
      </div>

      {/* Checklist arrivée */}
      <div className="flex items-center gap-3 shrink-0">
        {checklist.map(({ icon: Icon, label, done }) => (
          <div
            key={label}
            title={label}
            className={`flex flex-col items-center gap-0.5 ${
              done ? 'text-green-600' : 'text-muted-foreground/40'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[9px] leading-none">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ThreadMessage }) {
  const isInbound = message.direction === 'inbound'

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isInbound
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p
          className={`text-[10px] mt-1 ${
            isInbound ? 'text-muted-foreground' : 'text-primary-foreground/70'
          }`}
        >
          {formatDistanceToNow(new Date(message.created_at), {
            addSuffix: true,
            locale: fr,
          })}
          {message.ai_used && ' · IA'}
        </p>
      </div>
    </div>
  )
}
