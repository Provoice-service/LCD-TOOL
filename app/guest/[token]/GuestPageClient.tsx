'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { format, differenceInDays, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TRANSLATIONS, LANG_FLAG, type Lang } from '@/lib/guest-page/translations'
import {
  Copy, Check, MapPin, Phone, MessageCircle, Upload,
  ExternalLink, Send, Clock, Star, Wifi, Loader2,
} from 'lucide-react'
import ContractTab from './ContractTab'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Property {
  id: string; name: string; address: string | null; city: string | null; country: string | null
  wifi_name: string | null; wifi_pass: string | null
  house_rules: string | null; noise_rules: string | null; smoking_rules: string | null; pet_rules: string | null
  access_instructions_full: string | null; key_box_code: string | null; key_box_location: string | null
  floor_info: string | null; parking_info: string | null; elevator_info: string | null; trash_info: string | null
  nearby_info: string | null; bakery_nearby: string | null; local_events: string | null
  emergency_procedure: string | null; emergency_contacts: string | null; local_police_number: string | null
  concierge_phone: string | null; backup_phone: string | null
  appliances_info: string | null; heating_info: string | null; tv_instructions: string | null
  ac_instructions: string | null; cleaning_products_location: string | null
  check_in_time: string | null; check_out_time: string | null; inventory_notes: string | null
  syndic_required: boolean
  google_maps_url: string | null; airbnb_review_url: string | null
  booking_review_url: string | null; google_review_url: string | null
  access_code_delay_hours: number | null
}

interface Guest { id: string; full_name: string; phone: string | null; email: string | null; language: string }

export interface Reservation {
  id: string; check_in: string | null; check_out: string | null; platform: string
  status: string; total_amount: number; num_guests: number | null
  access_code: string | null; access_code_display_from: string | null
  contract_url: string | null; contract_signed: boolean
  id_received: boolean; id_document_url: string | null; id_document_uploaded_at: string | null
  extras_requested: object[]
  guest_page_language: string | null; guest_page_token: string
  guest: Guest | null; property: Property | null
}

export interface Upsell {
  id: string; name: string; description: string | null
  price: number; currency: string; icon: string
}

export interface GuestMessage {
  id: string; direction: 'guest' | 'host'; body: string
  read_at: string | null; created_at: string
}

// ── Constantes ─────────────────────────────────────────────────────────────────

type TabId = 'reservation' | 'checkin' | 'checkout' | 'wifi' | 'guide' | 'neighborhood' | 'emergency' | 'extras' | 'contract' | 'identity' | 'messages' | 'reviews'

const ALL_TABS: TabId[] = ['reservation', 'checkin', 'checkout', 'wifi', 'guide', 'neighborhood', 'emergency', 'extras', 'contract', 'identity', 'messages', 'reviews']

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  token: string
  reservation: Reservation
  upsells: Upsell[]
  initialMessages: GuestMessage[]
}

export function GuestPageClient({ token, reservation: res, upsells, initialMessages }: Props) {
  const detectedLang = (res.guest?.language ?? res.guest_page_language ?? 'fr') as Lang
  const [lang, setLang] = useState<Lang>((['fr', 'en', 'ar', 'es'] as Lang[]).includes(detectedLang) ? detectedLang : 'fr')
  const [activeTab, setActiveTab] = useState<TabId>('reservation')
  const [messages, setMessages] = useState<GuestMessage[]>(initialMessages)
  const [msgBody, setMsgBody] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedWifi, setCopiedWifi] = useState(false)
  const [idUploaded, setIdUploaded] = useState(res.id_received)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [extraOpen, setExtraOpen] = useState<string | null>(null)
  const [extraQty, setExtraQty] = useState(1)
  const [extraNote, setExtraNote] = useState('')
  const [extraSent, setExtraSent] = useState<Record<string, boolean>>({})
  const [sendingExtra, setSendingExtra] = useState(false)
  const [lateSent, setLateSent] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  const t = TRANSLATIONS[lang]
  const p = res.property
  const g = res.guest
  const isRtl = lang === 'ar'

  const checkIn  = res.check_in  ? new Date(res.check_in)  : null
  const checkOut = res.check_out ? new Date(res.check_out) : null
  const nights   = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : null
  const isPast   = checkOut ? new Date() > checkOut : false

  // Access code visibility
  const displayFrom = res.access_code_display_from ? new Date(res.access_code_display_from) : null
  const codeVisible = !displayFrom || new Date() >= displayFrom
  const hoursLeft   = displayFrom && !codeVisible ? differenceInHours(displayFrom, new Date()) : 0

  // Auto-refresh messages toutes les 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/guest/${token}/messages`)
        const data = await r.json()
        if (data.messages) setMessages(data.messages)
      } catch { /* silent */ }
    }, 30000)
    return () => clearInterval(interval)
  }, [token])

  async function sendMessage() {
    if (!msgBody.trim()) return
    setSendingMsg(true)
    await fetch(`/api/guest/${token}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: msgBody.trim() }),
    })
    setMessages(prev => [...prev, {
      id: Date.now().toString(), direction: 'guest', body: msgBody.trim(),
      read_at: null, created_at: new Date().toISOString(),
    }])
    setMsgBody('')
    setSendingMsg(false)
  }

  async function uploadId(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`/api/guest/${token}/upload-id`, { method: 'POST', body: fd })
    setIdUploaded(true)
    setUploadDone(true)
    setUploading(false)
  }

  async function sendExtra(upsell: Upsell) {
    setSendingExtra(true)
    await fetch(`/api/guest/${token}/extras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_id: upsell.id, name: upsell.name, quantity: extraQty, note: extraNote }),
    })
    setExtraSent(prev => ({ ...prev, [upsell.id]: true }))
    setExtraOpen(null)
    setExtraQty(1)
    setExtraNote('')
    setSendingExtra(false)
    // Refresh messages
    const r = await fetch(`/api/guest/${token}/messages`)
    const data = await r.json()
    if (data.messages) setMessages(data.messages)
  }

  async function requestLateCheckout() {
    await fetch(`/api/guest/${token}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '[Late Check-out] Demande de late check-out' }),
    })
    setLateSent(true)
    setActiveTab('messages')
  }

  function copy(text: string, setFn: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setFn(true)
      setTimeout(() => setFn(false), 2000)
    })
  }

  const address = [p?.address, p?.city].filter(Boolean).join(', ')
  const mapsUrl = p?.google_maps_url ?? (address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null)

  // ── Render helper ──────────────────────────────────────────────────────────

  function Info({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null
    return (
      <div className="py-3" style={{ borderBottom: '1px solid #F2F0EC' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#999999' }}>{label}</p>
        <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{value}</p>
      </div>
    )
  }

  // ── Tabs content ───────────────────────────────────────────────────────────

  function TabReservation() {
    const statusKey = `status_${res.status}` as keyof typeof t.common
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#C4A044' }}>
                {res.platform}
              </p>
              <p className="text-xl font-light" style={{ fontFamily: 'var(--font-heading), serif', color: '#1A1A1A' }}>
                {p?.name ?? '—'}
              </p>
              {p?.city && <p className="text-sm mt-0.5" style={{ color: '#666666' }}>{p.city}</p>}
            </div>
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{ background: 'rgba(46,125,82,0.10)', color: '#2E7D52' }}>
              {t.common[statusKey as keyof typeof t.common] ?? res.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {checkIn && (
              <div className="p-3 rounded-xl" style={{ background: '#F8F7F5' }}>
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#999999' }}>Check-in</p>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{format(checkIn, 'dd MMM yyyy', { locale: fr })}</p>
                {p?.check_in_time && <p className="text-xs" style={{ color: '#666666' }}>{p.check_in_time}</p>}
              </div>
            )}
            {checkOut && (
              <div className="p-3 rounded-xl" style={{ background: '#F8F7F5' }}>
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#999999' }}>Check-out</p>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{format(checkOut, 'dd MMM yyyy', { locale: fr })}</p>
                {p?.check_out_time && <p className="text-xs" style={{ color: '#666666' }}>{p.check_out_time}</p>}
              </div>
            )}
          </div>
          {(nights !== null || res.num_guests) && (
            <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid #F2F0EC' }}>
              {nights !== null && (
                <p className="text-xs" style={{ color: '#666666' }}>
                  <span className="font-semibold" style={{ color: '#1A1A1A' }}>{nights}</span> {t.common.nights}
                </p>
              )}
              {res.num_guests && (
                <p className="text-xs" style={{ color: '#666666' }}>
                  <span className="font-semibold" style={{ color: '#1A1A1A' }}>{res.num_guests}</span> {t.common.guests}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#999999' }}>Contact</p>
          <div className="flex gap-3">
            {p?.concierge_phone && (
              <a href={`tel:${p.concierge_phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#1A1A1A' }}>
                <Phone className="h-4 w-4" /> Appeler
              </a>
            )}
            {p?.concierge_phone && (
              <a href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  function TabCheckin() {
    return (
      <div className="space-y-4">
        {/* Adresse */}
        {address && (
          <Card title={t.checkin.address}>
            <p className="text-sm mb-3" style={{ color: '#1A1A1A' }}>{address}</p>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: 'rgba(196,160,68,0.10)', color: '#A88830', border: '1px solid rgba(196,160,68,0.25)' }}>
                <MapPin className="h-3.5 w-3.5" /> {t.checkin.mapsLink}
              </a>
            )}
            {/* Google Maps iframe */}
            {address && (
              <div className="mt-3 rounded-xl overflow-hidden" style={{ height: 160 }}>
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=15`}
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            )}
          </Card>
        )}

        {/* Instructions d'accès */}
        {p?.access_instructions_full && (
          <Card title={t.checkin.instructions}>
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.access_instructions_full}</p>
          </Card>
        )}

        {/* Étage */}
        {p?.floor_info && (
          <Card title={t.checkin.floor}>
            <p className="text-sm" style={{ color: '#1A1A1A' }}>{p.floor_info}</p>
          </Card>
        )}

        {/* Code d'accès */}
        {res.access_code && (
          <Card title={t.checkin.accessCode}>
            {codeVisible ? (
              <div>
                <div className="flex items-center justify-between p-4 rounded-xl mb-3"
                  style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>
                  <span className="text-3xl font-mono font-bold tracking-[0.2em]" style={{ color: '#1A1A1A' }}>
                    {res.access_code}
                  </span>
                  <button onClick={() => copy(res.access_code!, setCopiedCode)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: copiedCode ? 'rgba(46,125,82,0.10)' : 'rgba(196,160,68,0.10)', color: copiedCode ? '#2E7D52' : '#A88830' }}>
                    {copiedCode ? <><Check className="h-3.5 w-3.5" /> {t.checkin.copied}</> : <><Copy className="h-3.5 w-3.5" /> {t.checkin.copy}</>}
                  </button>
                </div>
                {p?.key_box_location && <p className="text-xs" style={{ color: '#666666' }}>{p.key_box_location}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#FFF8F0', border: '1px solid #FFDCB0' }}>
                <Clock className="h-5 w-5 shrink-0" style={{ color: '#C17C1A' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#C17C1A' }}>
                    {t.checkin.codeAvailableIn} {hoursLeft}{t.checkin.hours}
                  </p>
                  {displayFrom && (
                    <p className="text-xs mt-0.5" style={{ color: '#C17C1A' }}>
                      Disponible le {format(displayFrom, "dd MMM 'à' HH'h'mm", { locale: fr })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Heure check-in */}
        {p?.check_in_time && (
          <Card title={t.checkin.checkinTime}>
            <p className="text-2xl font-light" style={{ fontFamily: 'var(--font-heading), serif', color: '#1A1A1A' }}>
              {p.check_in_time}
            </p>
          </Card>
        )}
      </div>
    )
  }

  function TabCheckout() {
    return (
      <div className="space-y-4">
        {p?.check_out_time && (
          <Card title={t.checkout.checkoutTime}>
            <p className="text-2xl font-light" style={{ fontFamily: 'var(--font-heading), serif', color: '#1A1A1A' }}>
              {p.check_out_time}
            </p>
          </Card>
        )}
        {p?.inventory_notes && (
          <Card title={t.checkout.procedure}>
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.inventory_notes}</p>
          </Card>
        )}
        {!lateSent ? (
          <button onClick={requestLateCheckout}
            className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
            style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#666666' }}>
            {t.checkout.lateCheckout}
          </button>
        ) : (
          <div className="p-3 rounded-xl text-sm text-center" style={{ background: 'rgba(46,125,82,0.08)', color: '#2E7D52' }}>
            {t.checkout.lateRequest}
          </div>
        )}
      </div>
    )
  }

  function TabWifi() {
    return (
      <div className="space-y-4">
        {(p?.wifi_name || p?.wifi_pass) && (
          <Card title={t.wifi.network}>
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>
              <Wifi className="h-5 w-5 shrink-0" style={{ color: '#C4A044' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{p.wifi_name}</p>
                {p.wifi_pass && <p className="text-sm font-mono" style={{ color: '#666666' }}>{p.wifi_pass}</p>}
              </div>
              {p.wifi_pass && (
                <button onClick={() => copy(p.wifi_pass!, setCopiedWifi)}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: copiedWifi ? 'rgba(46,125,82,0.10)' : 'rgba(196,160,68,0.10)', color: copiedWifi ? '#2E7D52' : '#A88830' }}>
                  {copiedWifi ? t.checkin.copied : t.checkin.copy}
                </button>
              )}
            </div>
          </Card>
        )}
        {p?.appliances_info && <Card title={t.wifi.appliances}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.appliances_info}</p></Card>}
        {p?.tv_instructions && <Card title={t.wifi.tv}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.tv_instructions}</p></Card>}
        {(p?.heating_info || p?.ac_instructions) && (
          <Card title={t.wifi.heating}>
            {p.heating_info && <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: '#1A1A1A' }}>{p.heating_info}</p>}
            {p.ac_instructions && <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.ac_instructions}</p>}
          </Card>
        )}
      </div>
    )
  }

  function TabGuide() {
    return (
      <div className="space-y-4">
        {p?.house_rules && <Card title={t.guide.rules}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.house_rules}</p></Card>}
        {p?.noise_rules && <Card title={t.guide.noise}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.noise_rules}</p></Card>}
        {p?.smoking_rules && <Card title={t.guide.smoking}><p className="text-sm" style={{ color: '#1A1A1A' }}>{p.smoking_rules}</p></Card>}
        {p?.pet_rules && <Card title={t.guide.pets}><p className="text-sm" style={{ color: '#1A1A1A' }}>{p.pet_rules}</p></Card>}
        {p?.trash_info && <Card title={t.guide.trash}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.trash_info}</p></Card>}
        {p?.parking_info && <Card title={t.guide.parking}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.parking_info}</p></Card>}
        {p?.cleaning_products_location && <Card title={t.guide.cleaning}><p className="text-sm" style={{ color: '#1A1A1A' }}>{p.cleaning_products_location}</p></Card>}
      </div>
    )
  }

  function TabNeighborhood() {
    return (
      <div className="space-y-4">
        {p?.nearby_info && <Card title={t.neighborhood.info}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.nearby_info}</p></Card>}
        {p?.bakery_nearby && <Card title={t.neighborhood.bakery}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.bakery_nearby}</p></Card>}
        {p?.local_events && <Card title={t.neighborhood.events}><p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.local_events}</p></Card>}
        {address && (
          <div className="rounded-2xl overflow-hidden" style={{ height: 250 }}>
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=14`}
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>
        )}
        {!p?.nearby_info && !p?.bakery_nearby && !p?.local_events && !address && (
          <Empty text={t.common.noInfo} />
        )}
      </div>
    )
  }

  function TabEmergency() {
    return (
      <div className="space-y-4">
        <Card title={t.emergency.title}>
          {[
            { label: t.emergency.police, phone: p?.local_police_number ?? (p?.country === 'MA' ? '19' : '17'), icon: '🚔' },
            { label: t.emergency.samu, phone: p?.country === 'MA' ? '15' : '15', icon: '🚑' },
            { label: t.emergency.pompiers, phone: p?.country === 'MA' ? '15' : '18', icon: '🚒' },
          ].map(({ label, phone, icon }) => (
            <a key={label} href={`tel:${phone}`}
              className="flex items-center gap-3 py-3 -mx-1"
              style={{ borderBottom: '1px solid #F2F0EC' }}>
              <span className="text-xl">{icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{label}</p>
                <p className="text-sm" style={{ color: '#666666' }}>{phone}</p>
              </div>
              <Phone className="h-4 w-4" style={{ color: '#C4A044' }} />
            </a>
          ))}
        </Card>

        {(p?.concierge_phone || p?.backup_phone) && (
          <Card title={t.emergency.concierge}>
            {p?.concierge_phone && (
              <div className="flex gap-2 mb-2">
                <a href={`tel:${p.concierge_phone}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#1A1A1A' }}>
                  <Phone className="h-3.5 w-3.5" /> {p.concierge_phone}
                </a>
                <a href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {p?.backup_phone && (
              <a href={`tel:${p.backup_phone}`} className="text-sm flex items-center gap-2" style={{ color: '#666666' }}>
                <Phone className="h-3.5 w-3.5" /> {p.backup_phone}
              </a>
            )}
          </Card>
        )}

        {p?.emergency_contacts && (
          <Card title="">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.emergency_contacts}</p>
          </Card>
        )}

        {p?.emergency_procedure && (
          <Card title={t.emergency.procedure}>
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.emergency_procedure}</p>
          </Card>
        )}
      </div>
    )
  }

  function TabExtras() {
    if (upsells.length === 0) {
      return <Empty text="Aucun service disponible pour ce logement." />
    }
    return (
      <div className="space-y-3">
        {upsells.map(u => (
          <div key={u.id} className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{u.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{u.name}</p>
                {u.description && <p className="text-xs mt-0.5" style={{ color: '#666666' }}>{u.description}</p>}
                {u.price > 0 && (
                  <p className="text-xs mt-1 font-semibold" style={{ color: '#C4A044' }}>
                    {u.price} {u.currency}
                  </p>
                )}
              </div>
              {extraSent[u.id] ? (
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(46,125,82,0.10)', color: '#2E7D52' }}>✓ Envoyé</span>
              ) : (
                <button onClick={() => { setExtraOpen(u.id); setExtraQty(1); setExtraNote('') }}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-xl font-semibold"
                  style={{ background: 'rgba(196,160,68,0.10)', color: '#A88830', border: '1px solid rgba(196,160,68,0.25)' }}>
                  {t.extras.request}
                </button>
              )}
            </div>
            {extraOpen === u.id && (
              <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid #F2F0EC' }}>
                <div className="flex items-center gap-3">
                  <label className="text-xs" style={{ color: '#666666' }}>{t.extras.quantity}</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExtraQty(q => Math.max(1, q - 1))}
                      className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center"
                      style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>−</button>
                    <span className="w-6 text-center text-sm font-semibold" style={{ color: '#1A1A1A' }}>{extraQty}</span>
                    <button onClick={() => setExtraQty(q => q + 1)}
                      className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center"
                      style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>+</button>
                  </div>
                </div>
                <textarea
                  value={extraNote}
                  onChange={e => setExtraNote(e.target.value)}
                  placeholder={t.extras.note}
                  rows={2}
                  className="w-full text-sm rounded-xl px-3 py-2 resize-none outline-none"
                  style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setExtraOpen(null)}
                    className="flex-1 py-2 rounded-xl text-sm"
                    style={{ border: '1px solid #E8E4DC', color: '#666666' }}>Annuler</button>
                  <button onClick={() => sendExtra(u)} disabled={sendingExtra}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                    style={{ background: '#C4A044', color: '#FFFFFF' }}>
                    {sendingExtra ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t.extras.send}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  function TabContract() {
    return (
      <div className="space-y-4">
        <ContractTab token={token} lang={lang} />
      </div>
    )
  }

  function TabIdentity() {
    const showTab = p?.syndic_required || p?.country === 'MA'
    if (!showTab) {
      return <Empty text="Aucun document requis pour ce séjour." />
    }
    return (
      <div className="space-y-4">
        <Card title={t.identity.title}>
          {idUploaded ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm font-semibold" style={{ color: '#2E7D52' }}>{t.identity.received}</p>
              {uploadDone && (
                <p className="text-xs mt-1" style={{ color: '#666666' }}>{t.identity.thanks}</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: '#666666' }}>{t.identity.instruction}</p>
              <label className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl cursor-pointer transition-colors"
                style={{ border: '2px dashed #E8E4DC', background: '#F8F7F5' }}>
                {uploading
                  ? <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#C4A044' }} />
                  : <Upload className="h-8 w-8" style={{ color: '#C4A044' }} />
                }
                <span className="text-sm font-medium" style={{ color: '#666666' }}>
                  {uploading ? 'Upload en cours…' : t.identity.upload}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadId(f) }}
                  disabled={uploading}
                />
              </label>
            </>
          )}
        </Card>
      </div>
    )
  }

  function TabMessages() {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <Empty text="Aucun message pour le moment." />
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.direction === 'guest' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] rounded-2xl px-4 py-3"
                style={m.direction === 'guest'
                  ? { background: 'rgba(196,160,68,0.12)', borderBottomRightRadius: 4 }
                  : { background: '#F8F7F5', border: '1px solid #E8E4DC', borderBottomLeftRadius: 4 }
                }>
                <p className="text-xs font-semibold mb-1" style={{ color: m.direction === 'guest' ? '#A88830' : '#666666' }}>
                  {m.direction === 'guest' ? t.messages.you : t.messages.host}
                </p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{m.body}</p>
                <p className="text-[10px] mt-1" style={{ color: '#999999' }}>
                  {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #E8E4DC' }}>
          <textarea
            value={msgBody}
            onChange={e => setMsgBody(e.target.value)}
            placeholder={t.messages.placeholder}
            rows={2}
            className="flex-1 text-sm rounded-xl px-3 py-2 resize-none outline-none"
            style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          />
          <button onClick={sendMessage} disabled={sendingMsg || !msgBody.trim()}
            className="px-4 rounded-xl font-semibold disabled:opacity-40 shrink-0"
            style={{ background: '#C4A044', color: '#FFFFFF' }}>
            {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    )
  }

  function TabReviews() {
    if (!isPast) {
      return (
        <div className="rounded-2xl p-6 text-center" style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>
          <Star className="h-8 w-8 mx-auto mb-3" style={{ color: '#E8E4DC' }} />
          <p className="text-sm" style={{ color: '#999999' }}>
            Cette section sera disponible après votre départ.
          </p>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-5 text-center" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
          <div className="text-4xl mb-3">⭐</div>
          <p className="text-lg font-light mb-2" style={{ fontFamily: 'var(--font-heading), serif', color: '#1A1A1A' }}>
            {t.reviews.title}
          </p>
          <p className="text-sm" style={{ color: '#666666' }}>{t.reviews.message}</p>
        </div>
        {[
          { label: t.reviews.airbnb, url: p?.airbnb_review_url, emoji: '🏠' },
          { label: t.reviews.booking, url: p?.booking_review_url, emoji: '🌐' },
          { label: t.reviews.google, url: p?.google_review_url, emoji: '⭐' },
        ].filter(item => item.url).map(({ label, url, emoji }) => (
          <a key={label} href={url!} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A' }}>
            <span>{emoji}</span> {label} <ExternalLink className="h-3.5 w-3.5 ml-1" style={{ color: '#999999' }} />
          </a>
        ))}
        {!p?.airbnb_review_url && !p?.booking_review_url && !p?.google_review_url && (
          <p className="text-sm text-center" style={{ color: '#999999' }}>
            {t.common.noInfo}
          </p>
        )}
      </div>
    )
  }

  const TAB_CONTENT: Record<TabId, React.ReactNode> = {
    reservation:  <TabReservation />,
    checkin:      <TabCheckin />,
    checkout:     <TabCheckout />,
    wifi:         <TabWifi />,
    guide:        <TabGuide />,
    neighborhood: <TabNeighborhood />,
    emergency:    <TabEmergency />,
    extras:       <TabExtras />,
    contract:     <TabContract />,
    identity:     <TabIdentity />,
    messages:     <TabMessages />,
    reviews:      <TabReviews />,
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8F7F5' }} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20" style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E4DC' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-alma-keys.png" alt="Alma Keys" width={100} height={30} className="h-8 w-auto" />
            {g?.full_name && (
              <span className="text-sm font-medium truncate max-w-[140px]" style={{ color: '#1A1A1A' }}>
                {g.full_name.split(' ')[0]}
              </span>
            )}
          </div>
          {/* Language switcher */}
          <div className="flex gap-1">
            {(['fr', 'en', 'ar', 'es'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className="text-base px-1.5 py-0.5 rounded-lg transition-colors"
                style={lang === l ? { background: 'rgba(196,160,68,0.15)' } : {}}>
                {LANG_FLAG[l]}
              </button>
            ))}
          </div>
        </div>

        {/* Property name */}
        {p?.name && (
          <div className="max-w-lg mx-auto px-4 pb-2">
            <p className="text-base font-light truncate" style={{ fontFamily: 'var(--font-heading), serif', color: '#666666' }}>
              {p.name}{p.city ? ` · ${p.city}` : ''}
            </p>
          </div>
        )}

        {/* Tab bar */}
        <div ref={tabsRef} className="flex overflow-x-auto scrollbar-hide gap-0 max-w-lg mx-auto">
          {ALL_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="shrink-0 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2"
              style={activeTab === tab
                ? { color: '#C4A044', borderBottomColor: '#C4A044' }
                : { color: '#999999', borderBottomColor: 'transparent' }
              }
            >
              {t.tabs[tab]}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 py-5 pb-12">
        {TAB_CONTENT[activeTab]}
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
      {title && (
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#999999' }}>
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl py-12 text-center" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
      <p className="text-sm" style={{ color: '#999999' }}>{text}</p>
    </div>
  )
}
