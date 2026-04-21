'use client'

import { useState, useRef } from 'react'
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
  IdCard,
  Upload,
  Send,
  Users,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  ClipboardList,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface PropertyDocument {
  id: string
  document_type: 'passport' | 'cni' | 'contract' | 'other'
  file_url: string | null
  file_name: string | null
  received_via: string | null
  received_at: string
  verified: boolean
}

interface SyndicNotification {
  id: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  sent_at: string | null
  syndic_phone: string
  syndic_name: string | null
  documents_sent: string[]
  message_sent: string | null
  created_at: string
}

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
  const [documents, setDocuments]     = useState<PropertyDocument[]>([])
  const [syndicNotifs, setSyndicNotifs] = useState<SyndicNotification[]>([])
  const [docsLoaded, setDocsLoaded]   = useState(false)
  const [sendingSyndic, setSendingSyndic] = useState(false)
  const [syndicResult, setSyndicResult]   = useState<string | null>(null)
  const [uploading, setUploading]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function loadDocuments() {
    if (docsLoaded) return
    const supabase = createClient()
    const [{ data: docs }, { data: notifs }] = await Promise.all([
      supabase
        .from('property_documents')
        .select('id, document_type, file_url, file_name, received_via, received_at, verified')
        .eq('reservation_id', res.id)
        .order('received_at', { ascending: false }),
      supabase
        .from('syndic_notifications')
        .select('id, status, sent_at, syndic_phone, syndic_name, documents_sent, message_sent, created_at')
        .eq('reservation_id', res.id)
        .order('created_at', { ascending: false }),
    ])
    setDocuments((docs ?? []) as PropertyDocument[])
    setSyndicNotifs((notifs ?? []) as SyndicNotification[])
    setDocsLoaded(true)
  }

  async function uploadDocument(file: File, docType: string) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('reservation_id', res.id)
    fd.append('document_type', docType)
    fd.append('received_via', 'manual_upload')
    const r = await fetch('/api/documents/upload', { method: 'POST', body: fd })
    const data = await r.json()
    if (data.document_id) {
      setDocsLoaded(false)
      await loadDocuments()
    }
    setUploading(false)
  }

  async function sendSyndic(force: boolean) {
    setSendingSyndic(true)
    setSyndicResult(null)
    const r = await fetch('/api/syndic/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservation_id: res.id, force }),
    })
    const data = await r.json()
    setSyndicResult(
      data.success
        ? `✅ Envoyé avec succès (notification ${data.notification_id?.slice(0, 8)}…)`
        : data.skipped
          ? `⏭ Ignoré : ${data.skipped}`
          : `❌ Erreur : ${data.error}`
    )
    setSendingSyndic(false)
    setDocsLoaded(false)
    await loadDocuments()
  }

  const DOC_LABEL: Record<string, string> = { passport: 'Passeport', cni: 'CNI', contract: 'Contrat', other: 'Autre' }
  const VIA_LABEL: Record<string, string>  = { whatsapp: 'WhatsApp', airbnb_message: 'Airbnb', email: 'Email', manual_upload: 'Upload' }
  const SYNDIC_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary', sent: 'default', delivered: 'default', failed: 'destructive',
  }
  const SYNDIC_STATUS_LABEL: Record<string, string> = {
    pending: 'En attente', sent: 'Envoyé', delivered: 'Livré', failed: 'Échoué',
  }

  const latestNotif = syndicNotifs[0] ?? null
  const syndicRequired = res.property?.syndic_required ?? false

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

        {/* ── Créer une tâche ──────────────────────────────────────────────── */}
        <Separator />
        <div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={async () => {
              const supabase = createClient()
              await supabase.from('tasks').insert({
                title:          `Vérifier dossier — ${res.guest?.full_name ?? 'Voyageur'} · ${res.property?.name ?? ''}`,
                category:       'voyageur',
                priority:       'urgent_important',
                reservation_id: res.id,
                property_id:    res.property?.id ?? null,
                due_date:       res.check_in ? new Date(res.check_in).toISOString().slice(0, 10) : null,
                status:         'todo',
              })
            }}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Créer une tâche liée à cette réservation
          </Button>
        </div>

        {/* ── Documents & Syndic ───────────────────────────────────────────── */}
        <Separator />
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <IdCard className="h-4 w-4" />
              Documents &amp; Syndic
            </h3>
            {!docsLoaded && (
              <Button variant="outline" size="sm" onClick={loadDocuments}>
                Charger
              </Button>
            )}
          </div>

          {docsLoaded && (
            <div className="space-y-5">
              {/* ── Sous-section Documents reçus ──────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documents reçus</p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadDocument(f, 'passport')
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="gap-1.5 h-7 text-xs"
                    >
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      Upload manuel
                    </Button>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg">
                    Aucun document reçu pour cette réservation.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                          doc.document_type === 'contract' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {doc.document_type === 'contract'
                            ? <FileText className="h-4 w-4" />
                            : <IdCard className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{DOC_LABEL[doc.document_type] ?? doc.document_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {VIA_LABEL[doc.received_via ?? ''] ?? doc.received_via ?? '—'}
                            {' · '}
                            {format(new Date(doc.received_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {doc.verified && (
                            <Badge variant="outline" className="text-green-700 border-green-300 text-xs">Vérifié</Badge>
                          )}
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {doc.file_name?.match(/\.(jpg|jpeg|png|webp)$/i)
                                ? <ImageIcon className="h-4 w-4" />
                                : <ExternalLink className="h-4 w-4" />}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Sous-section Syndic ───────────────────────────────────── */}
              {syndicRequired && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Syndic / Gardien</p>
                  <div className="p-4 rounded-lg border space-y-3">
                    {/* Infos syndic */}
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {res.property?.syndic_name ?? 'Syndic / Gardien'}
                        </p>
                        <p className="text-xs text-muted-foreground">{res.property?.syndic_phone ?? '—'}</p>
                      </div>
                      {latestNotif && (
                        <Badge variant={SYNDIC_STATUS_VARIANT[latestNotif.status]} className="ml-auto">
                          {SYNDIC_STATUS_LABEL[latestNotif.status]}
                        </Badge>
                      )}
                      {!latestNotif && (
                        <Badge variant="secondary" className="ml-auto">En attente</Badge>
                      )}
                    </div>

                    {/* Dernier envoi */}
                    {latestNotif?.sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Envoyé le {format(new Date(latestNotif.sent_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        {latestNotif.documents_sent.length > 0 && (
                          <span> · {latestNotif.documents_sent.length} document(s)</span>
                        )}
                      </p>
                    )}

                    {/* Résultat action */}
                    {syndicResult && (
                      <p className="text-xs rounded-md bg-muted px-3 py-2">{syndicResult}</p>
                    )}

                    {/* Boutons */}
                    <div className="flex gap-2">
                      {!latestNotif || latestNotif.status === 'failed' ? (
                        <Button
                          size="sm"
                          onClick={() => sendSyndic(true)}
                          disabled={sendingSyndic}
                          className="gap-1.5"
                        >
                          {sendingSyndic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Envoyer maintenant
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendSyndic(true)}
                          disabled={sendingSyndic}
                          className="gap-1.5"
                        >
                          {sendingSyndic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Renvoyer
                        </Button>
                      )}
                    </div>

                    {/* Historique */}
                    {syndicNotifs.length > 1 && (
                      <details className="mt-1">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Historique ({syndicNotifs.length} envois)
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {syndicNotifs.map((n) => (
                            <div key={n.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant={SYNDIC_STATUS_VARIANT[n.status]} className="text-xs h-4 px-1.5">
                                {SYNDIC_STATUS_LABEL[n.status]}
                              </Badge>
                              <span>{n.sent_at ? format(new Date(n.sent_at), 'dd/MM HH:mm') : '—'}</span>
                              <span>· {n.documents_sent.length} doc(s)</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
