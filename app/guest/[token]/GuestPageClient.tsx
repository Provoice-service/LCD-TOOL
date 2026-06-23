'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { format, differenceInDays, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TRANSLATIONS, LANG_FLAG, type Lang } from '@/lib/guest-page/translations'
import {
  Copy, Check, MapPin, Phone, MessageCircle, Upload,
  ExternalLink, Send, Clock, Wifi, Loader2, Eye, EyeOff, ChevronLeft, ChevronDown,
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
  // Champs optionnels (future-ready)
  coffee_machine_type?: string | null
  vacuum_location?: string | null
  iron_location?: string | null
  washing_machine_info?: string | null
  restaurants_nearby?: string | null
  transport_info?: string | null
  pharmacy_nearby?: string | null
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

// ── Navigation ────────────────────────────────────────────────────────────────

type TabId = 'checkin' | 'wifi' | 'equipment' | 'parking' | 'trash' | 'guide'
           | 'neighborhood' | 'restaurants' | 'transport' | 'visits'
           | 'checkout' | 'emergency' | 'messages'
           | 'extras' | 'contract' | 'identity' | 'reservation'

interface NavItem { id: TabId; emoji: string; labelFr: string; labelEn: string }

const NAV_GRID: NavItem[] = [
  { id: 'checkin',      emoji: '🔑', labelFr: 'Accès',        labelEn: 'Access'    },
  { id: 'wifi',         emoji: '📶', labelFr: 'WiFi',          labelEn: 'WiFi'      },
  { id: 'equipment',    emoji: '❄️', labelFr: 'Équipements',  labelEn: 'Equipment' },
  { id: 'parking',      emoji: '🅿️', labelFr: 'Parking',      labelEn: 'Parking'   },
  { id: 'trash',        emoji: '🗑️', labelFr: 'Poubelles',    labelEn: 'Trash'     },
  { id: 'guide',        emoji: '📋', labelFr: 'Règles',        labelEn: 'Rules'     },
  { id: 'neighborhood', emoji: '🏪', labelFr: 'Quartier',      labelEn: 'Area'      },
  { id: 'restaurants',  emoji: '🍽️', labelFr: 'Restaurants',  labelEn: 'Eat'       },
  { id: 'transport',    emoji: '🚕', labelFr: 'Transport',     labelEn: 'Transport' },
  { id: 'visits',       emoji: '🏛️', labelFr: 'Visites',      labelEn: 'Visits'    },
  { id: 'checkout',     emoji: '🚪', labelFr: 'Départ',        labelEn: 'Checkout'  },
  { id: 'emergency',    emoji: '🆘', labelFr: 'Urgences',      labelEn: 'Emergency' },
]

const SECTION_TITLES: Record<TabId, { fr: string; en: string; emoji: string }> = {
  checkin:      { fr: 'Accès & Arrivée',   en: 'Access & Arrival', emoji: '🔑' },
  wifi:         { fr: 'WiFi',              en: 'WiFi',             emoji: '📶' },
  equipment:    { fr: 'Équipements',       en: 'Equipment',        emoji: '❄️' },
  parking:      { fr: 'Parking',           en: 'Parking',          emoji: '🅿️' },
  trash:        { fr: 'Poubelles & Tri',   en: 'Trash',            emoji: '🗑️' },
  guide:        { fr: 'Règlement',         en: 'House Rules',      emoji: '📋' },
  neighborhood: { fr: 'Quartier',          en: 'Area Guide',       emoji: '🏪' },
  restaurants:  { fr: 'Restaurants',       en: 'Restaurants',      emoji: '🍽️' },
  transport:    { fr: 'Transport',         en: 'Transport',        emoji: '🚕' },
  visits:       { fr: 'Visites',           en: 'Sightseeing',      emoji: '🏛️' },
  checkout:     { fr: 'Départ',            en: 'Checkout',         emoji: '🚪' },
  emergency:    { fr: 'Urgences',          en: 'Emergency',        emoji: '🆘' },
  messages:     { fr: 'Messages',          en: 'Messages',         emoji: '💬' },
  extras:       { fr: 'Services',          en: 'Services',         emoji: '✨' },
  contract:     { fr: 'Contrat',           en: 'Contract',         emoji: '📄' },
  identity:     { fr: 'Pièce d\'identité', en: 'Identity',         emoji: '🪪' },
  reservation:  { fr: 'Réservation',       en: 'Booking',          emoji: '🗓️' },
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  token: string
  reservation: Reservation
  upsells: Upsell[]
  initialMessages: GuestMessage[]
}

export function GuestPageClient({ token, reservation: res, upsells, initialMessages }: Props) {
  const detectedLang = (res.guest?.language ?? res.guest_page_language ?? 'fr') as Lang
  const [lang, setLang]               = useState<Lang>((['fr', 'en', 'ar', 'es'] as Lang[]).includes(detectedLang) ? detectedLang : 'fr')
  const [activeTab, setActiveTab]     = useState<TabId | null>(null)
  const [messages, setMessages]       = useState<GuestMessage[]>(initialMessages)
  const [msgBody, setMsgBody]         = useState('')
  const [sendingMsg, setSendingMsg]   = useState(false)
  const [copiedCode, setCopiedCode]   = useState(false)
  const [copiedWifiName, setCopiedWifiName] = useState(false)
  const [copiedWifiPass, setCopiedWifiPass] = useState(false)
  const [copiedDigicode, setCopiedDigicode] = useState(false)
  const [showPass, setShowPass]       = useState(false)
  const [idUploaded, setIdUploaded]   = useState(res.id_received)
  const [uploading, setUploading]     = useState(false)
  const [extraOpen, setExtraOpen]     = useState<string | null>(null)
  const [extraQty, setExtraQty]       = useState(1)
  const [extraNote, setExtraNote]     = useState('')
  const [extraSent, setExtraSent]     = useState<Record<string, boolean>>({})
  const [sendingExtra, setSendingExtra] = useState(false)
  const [lateSent, setLateSent]       = useState(false)
  const [checklistDone, setChecklistDone] = useState<Record<number, boolean>>({})
  const [openEquip, setOpenEquip]     = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const t = TRANSLATIONS[lang]
  const p = res.property
  const g = res.guest
  const isRtl = lang === 'ar'

  const checkIn  = res.check_in  ? new Date(res.check_in)  : null
  const checkOut = res.check_out ? new Date(res.check_out) : null
  const nights   = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : null
  const isPast   = checkOut ? new Date() > checkOut : false

  const displayFrom = res.access_code_display_from ? new Date(res.access_code_display_from) : null
  const codeVisible = !displayFrom || new Date() >= displayFrom
  const hoursLeft   = displayFrom && !codeVisible ? differenceInHours(displayFrom, new Date()) : 0

  const unreadCount = messages.filter(m => m.direction === 'host' && !m.read_at).length
  const address = [p?.address, p?.city].filter(Boolean).join(', ')
  const mapsUrl = p?.google_maps_url ?? (address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null)
  const city = p?.city ?? ''

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

  useEffect(() => {
    if (activeTab === 'messages') {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [messages, activeTab])

  // ── Actions ────────────────────────────────────────────────────────────────

  function copy(text: string, setFn: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => { setFn(true); setTimeout(() => setFn(false), 2000) })
  }

  async function sendMessage() {
    if (!msgBody.trim()) return
    setSendingMsg(true)
    await fetch(`/api/guest/${token}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: msgBody.trim() }),
    })
    setMessages(prev => [...prev, { id: Date.now().toString(), direction: 'guest', body: msgBody.trim(), read_at: null, created_at: new Date().toISOString() }])
    setMsgBody(''); setSendingMsg(false)
  }

  async function uploadId(file: File) {
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    await fetch(`/api/guest/${token}/upload-id`, { method: 'POST', body: fd })
    setIdUploaded(true); setUploading(false)
  }

  async function sendExtra(upsell: Upsell) {
    setSendingExtra(true)
    await fetch(`/api/guest/${token}/extras`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_id: upsell.id, name: upsell.name, quantity: extraQty, note: extraNote }),
    })
    setExtraSent(prev => ({ ...prev, [upsell.id]: true }))
    setExtraOpen(null); setExtraQty(1); setExtraNote(''); setSendingExtra(false)
  }

  async function requestLateCheckout() {
    await fetch(`/api/guest/${token}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '[Late Check-out] Demande de late check-out' }),
    })
    setLateSent(true); setActiveTab('messages')
  }

  // ── Composants utilitaires ────────────────────────────────────────────────

  function CopyBtn({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: () => void }) {
    return (
      <button onClick={onCopy}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors shrink-0"
        style={{ background: copied ? 'rgba(46,125,82,0.10)' : 'rgba(196,160,68,0.10)', color: copied ? '#2E7D52' : '#A88830' }}>
        {copied ? <><Check className="h-3.5 w-3.5" />Copié</> : <><Copy className="h-3.5 w-3.5" />Copier</>}
      </button>
    )
  }

  function InfoCard({ title, emoji, bg, borderColor, children }: {
    title: string; emoji?: string; bg?: string; borderColor?: string; children: React.ReactNode
  }) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-sm"
        style={{ background: bg ?? '#FFFFFF', border: `1px solid ${borderColor ?? '#E8E4DC'}` }}>
        {title && (
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${borderColor ?? '#F2F0EC'}` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2"
              style={{ color: borderColor ? '#A88830' : '#999999' }}>
              {emoji && <span className="text-sm">{emoji}</span>} {title}
            </p>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    )
  }

  function MapsBtn({ query }: { query: string }) {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query + (city ? ` ${city}` : ''))}`
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium shrink-0"
        style={{ background: '#E8F4FF', color: '#1a73e8', border: '1px solid #B8D8FF' }}>
        <MapPin className="h-3 w-3" />Maps
      </a>
    )
  }

  // ── Section Accès ─────────────────────────────────────────────────────────

  function SectionAccess() {
    return (
      <div className="space-y-4">
        {address && (
          <InfoCard title="Adresse" emoji="📍">
            <p className="text-sm font-medium mb-3" style={{ color: '#1A1A1A' }}>{address}</p>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#C4A044', color: '#fff' }}>
                <MapPin className="h-4 w-4" /> Ouvrir dans Maps
              </a>
            )}
            {address && (
              <div className="mt-3 rounded-xl overflow-hidden" style={{ height: 150 }}>
                <iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=15`}
                  className="w-full h-full border-0" loading="lazy" />
              </div>
            )}
          </InfoCard>
        )}

        {res.access_code && (
          <InfoCard title="Code d'accès" emoji="🔢">
            {codeVisible ? (
              <div>
                <div className="flex items-center justify-between p-4 rounded-xl mb-3"
                  style={{ background: '#F8F7F5', border: '2px solid #C4A044' }}>
                  <span className="text-4xl font-mono font-bold tracking-[0.3em]" style={{ color: '#1A1A1A' }}>
                    {res.access_code}
                  </span>
                  <CopyBtn text={res.access_code} copied={copiedCode} onCopy={() => copy(res.access_code!, setCopiedCode)} />
                </div>
                {p?.key_box_location && (
                  <p className="text-xs" style={{ color: '#666666' }}>📍 {p.key_box_location}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#FFF8F0', border: '1px solid #FFDCB0' }}>
                <Clock className="h-5 w-5 shrink-0" style={{ color: '#C17C1A' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#C17C1A' }}>Code disponible dans {hoursLeft}h</p>
                  {displayFrom && (
                    <p className="text-xs mt-0.5" style={{ color: '#C17C1A' }}>
                      Disponible le {format(displayFrom, "dd MMM 'à' HH'h'mm", { locale: fr })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </InfoCard>
        )}

        {p?.access_instructions_full && (
          <InfoCard title="Instructions d'entrée" emoji="📝">
            <ol className="space-y-3">
              {p.access_instructions_full.split('\n').filter(l => l.trim()).map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: '#C4A044', color: '#fff' }}>{i + 1}</span>
                  <span className="text-sm pt-0.5" style={{ color: '#1A1A1A' }}>{line.replace(/^\d+[\.\)]\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </InfoCard>
        )}

        {/* Code immeuble / Digicode */}
        {p?.key_box_code && (
          <InfoCard title="Code immeuble / Digicode" emoji="🔏">
            <div className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: '#F8F7F5', border: '2px solid #C4A044' }}>
              <span className="text-3xl font-mono font-bold tracking-[0.25em]" style={{ color: '#1A1A1A' }}>
                {p.key_box_code}
              </span>
              <CopyBtn text={p.key_box_code} copied={copiedDigicode} onCopy={() => copy(p!.key_box_code!, setCopiedDigicode)} />
            </div>
          </InfoCard>
        )}

        <div className="grid grid-cols-2 gap-3">
          {p?.check_in_time && (
            <div className="rounded-2xl p-4 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#999999' }}>Check-in</p>
              <p className="text-3xl font-light" style={{ color: '#C4A044', fontFamily: 'var(--font-heading, serif)' }}>{p.check_in_time}</p>
            </div>
          )}
          {p?.floor_info && (
            <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#999999' }}>Étage & accès</p>
              <p className="text-sm" style={{ color: '#1A1A1A' }}>{p.floor_info}</p>
            </div>
          )}
        </div>

        {p?.concierge_phone && (
          <div className="flex gap-2">
            <a href={`tel:${p.concierge_phone}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#1A1A1A' }}>
              <Phone className="h-4 w-4" /> Appeler
            </a>
            <a href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`}
              target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        )}
      </div>
    )
  }

  // ── Section WiFi ──────────────────────────────────────────────────────────

  function SectionWifi() {
    if (!p?.wifi_name && !p?.wifi_pass) return <Empty text="Informations WiFi bientôt disponibles." />
    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#999999' }}>
          Connexion WiFi
        </p>
        <div className="grid grid-cols-2 gap-3">
          {p?.wifi_name && (
            <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
              <Wifi className="h-8 w-8" style={{ color: '#C4A044' }} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#999999' }}>Réseau</p>
                <p className="text-sm font-bold break-all" style={{ color: '#1A1A1A' }}>{p.wifi_name}</p>
              </div>
              <CopyBtn text={p.wifi_name} copied={copiedWifiName} onCopy={() => copy(p!.wifi_name!, setCopiedWifiName)} />
            </div>
          )}
          {p?.wifi_pass && (
            <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
              <span className="text-2xl leading-none">🔑</span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#999999' }}>Mot de passe</p>
                <p className="text-sm font-mono font-bold break-all" style={{ color: '#1A1A1A' }}>
                  {showPass ? p.wifi_pass : '•'.repeat(Math.min(p.wifi_pass.length, 8))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPass(!showPass)}
                  className="p-1.5 rounded-lg" style={{ background: '#F8F7F5', color: '#999999' }}>
                  {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <CopyBtn text={p.wifi_pass} copied={copiedWifiPass} onCopy={() => copy(p!.wifi_pass!, setCopiedWifiPass)} />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Section Équipements ───────────────────────────────────────────────────

  function SectionEquipment() {
    const items = [
      p?.ac_instructions          && { id: 'ac',      emoji: '❄️', name: 'Climatisation',    text: p.ac_instructions },
      p?.heating_info             && { id: 'heat',    emoji: '🔥', name: 'Chauffage',         text: p.heating_info },
      p?.coffee_machine_type      && { id: 'coffee',  emoji: '☕', name: 'Machine à café',   text: p.coffee_machine_type },
      p?.tv_instructions          && { id: 'tv',      emoji: '📺', name: 'Télévision',        text: p.tv_instructions },
      p?.washing_machine_info     && { id: 'wash',    emoji: '🫧', name: 'Lave-linge',        text: p.washing_machine_info },
      p?.appliances_info          && { id: 'app',     emoji: '🍳', name: 'Électroménager',    text: p.appliances_info },
      p?.cleaning_products_location && { id: 'clean', emoji: '🧴', name: 'Produits ménagers', text: p.cleaning_products_location },
      p?.vacuum_location          && { id: 'vacuum',  emoji: '🧹', name: 'Aspirateur',        text: p.vacuum_location },
      p?.iron_location            && { id: 'iron',    emoji: '👔', name: 'Fer à repasser',    text: p.iron_location },
    ].filter(Boolean) as { id: string; emoji: string; name: string; text: string }[]

    if (items.length === 0) return <Empty text="Informations équipements bientôt disponibles." />

    return (
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl overflow-hidden shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
            <button className="w-full flex items-center gap-4 px-5 py-4"
              onClick={() => setOpenEquip(openEquip === item.id ? null : item.id)}>
              <span className="text-4xl">{item.emoji}</span>
              <span className="flex-1 text-left text-sm font-semibold" style={{ color: '#1A1A1A' }}>{item.name}</span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200"
                style={{ color: '#999999', transform: openEquip === item.id ? 'rotate(180deg)' : 'none' }} />
            </button>
            {openEquip === item.id && (
              <div className="px-5 pb-4" style={{ borderTop: '1px solid #F2F0EC' }}>
                <div className="space-y-1.5 pt-3">
                  {item.text.split('\n').filter(l => l.trim()).map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-sm shrink-0 font-bold" style={{ color: '#C4A044' }}>›</span>
                      <p className="text-sm" style={{ color: '#1A1A1A' }}>{line.replace(/^[-•*\d.)\s]+/, '')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ── Section Parking ───────────────────────────────────────────────────────

  function SectionParking() {
    if (!p?.parking_info && !p?.elevator_info)
      return <Empty text="Aucune information parking pour ce logement." />
    return (
      <div className="space-y-4">
        {p?.parking_info && (
          <InfoCard title="Parking & Stationnement" emoji="🅿️">
            <div className="space-y-2 mb-3">
              {p.parking_info.split('\n').filter(l => l.trim()).map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="shrink-0 mt-0.5" style={{ color: '#C4A044' }}>›</span>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>{line.replace(/^[-•*]\s*/, '')}</p>
                </div>
              ))}
            </div>
            {city && (
              <a href={`https://www.google.com/maps/search/parking+${encodeURIComponent(city)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: '#1a73e8' }}>
                <MapPin className="h-3 w-3" />Voir parkings sur Maps
              </a>
            )}
          </InfoCard>
        )}
        {p?.elevator_info && (
          <InfoCard title="Ascenseur" emoji="🛗">
            <p className="text-sm" style={{ color: '#1A1A1A' }}>{p.elevator_info}</p>
          </InfoCard>
        )}
      </div>
    )
  }

  // ── Section Poubelles ─────────────────────────────────────────────────────

  function SectionTrash() {
    if (!p?.trash_info) return <Empty text="Informations poubelles bientôt disponibles." />
    return (
      <div className="space-y-4">
        <InfoCard title="Poubelles & Tri sélectif" emoji="🗑️">
          <div className="space-y-2">
            {p.trash_info.split('\n').filter(l => l.trim()).map((line, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-base shrink-0">🗑️</span>
                <p className="text-sm" style={{ color: '#1A1A1A' }}>{line.replace(/^[-•*]\s*/, '')}</p>
              </div>
            ))}
          </div>
        </InfoCard>
      </div>
    )
  }

  // ── Section Règlement ─────────────────────────────────────────────────────

  function SectionGuide() {
    return (
      <div className="space-y-4">
        {p?.house_rules && (
          <InfoCard title="Règlement intérieur" emoji="📋">
            <div className="space-y-2">
              {p.house_rules.split('\n').filter(l => l.trim()).map((line, i) => {
                const text = line.replace(/^[-•*]\s*/, '')
                const isNo = text.toLowerCase().includes('interdit') || text.toLowerCase().includes('pas de') || text.toLowerCase().includes('no ')
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-sm mt-0.5 shrink-0">{isNo ? '❌' : '✅'}</span>
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>{text}</p>
                  </div>
                )
              })}
            </div>
          </InfoCard>
        )}
        {[
          p?.noise_rules   && { icon: '🔕', text: p.noise_rules },
          p?.smoking_rules && { icon: '🚬', text: p.smoking_rules },
          p?.pet_rules     && { icon: '🐾', text: p.pet_rules },
        ].filter(Boolean).length > 0 && (
          <InfoCard title="Règles spécifiques" emoji="ℹ️">
            <div className="space-y-3">
              {[
                p?.noise_rules   && { icon: '🔕', text: p.noise_rules },
                p?.smoking_rules && { icon: '🚬', text: p.smoking_rules },
                p?.pet_rules     && { icon: '🐾', text: p.pet_rules },
              ].filter(Boolean).map((r, i) => {
                const rule = r as { icon: string; text: string }
                return (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-xl shrink-0">{rule.icon}</span>
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>{rule.text}</p>
                  </div>
                )
              })}
            </div>
          </InfoCard>
        )}
        {p?.noise_rules && (
          <div className="rounded-2xl p-5 text-center shadow-sm" style={{ background: '#FFF3E0', border: '1px solid #FFCC80' }}>
            <p className="text-xl font-bold" style={{ color: '#E65100' }}>🔕 Silence après 22h</p>
            <p className="text-xs mt-1" style={{ color: '#BF360C' }}>Merci de respecter le voisinage</p>
          </div>
        )}
      </div>
    )
  }

  // ── Section Quartier ──────────────────────────────────────────────────────

  function SectionNeighborhood() {
    const nearbyLines = (p?.nearby_info ?? '').split('\n').filter(l => l.trim())
    return (
      <div className="space-y-4">
        {nearbyLines.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#999999' }}>
              🏪 Commerces & Services
            </p>
            <div className="space-y-2">
              {nearbyLines.map((line, i) => {
                const clean = line.replace(/^[-•*]\s*/, '')
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl shadow-sm"
                    style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                    <span className="text-lg shrink-0">📍</span>
                    <p className="flex-1 text-sm" style={{ color: '#1A1A1A' }}>{clean}</p>
                    <MapsBtn query={clean} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {p?.bakery_nearby && (
          <InfoCard title="Boulangerie & Épicerie" emoji="🥐">
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm" style={{ color: '#1A1A1A' }}>{p.bakery_nearby}</p>
              <MapsBtn query={p.bakery_nearby} />
            </div>
          </InfoCard>
        )}

        {p?.pharmacy_nearby && (
          <InfoCard title="Pharmacie" emoji="💊">
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm" style={{ color: '#1A1A1A' }}>{p.pharmacy_nearby}</p>
              <MapsBtn query={p.pharmacy_nearby} />
            </div>
          </InfoCard>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#999999' }}>
            🚗 Services en ligne
          </p>
          <div className="space-y-2">
            {[
              { name: 'Jumia Food', emoji: '🍕', desc: 'Livraison de repas à domicile', url: 'https://food.jumia.ma' },
              { name: 'InDrive',    emoji: '🚗', desc: 'Taxi & livraison',              url: 'https://indriver.com'  },
            ].map(item => (
              <a key={item.name} href={item.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl shadow-sm"
                style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{item.name}</p>
                  <p className="text-xs" style={{ color: '#999999' }}>{item.desc}</p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0" style={{ color: '#999999' }} />
              </a>
            ))}
          </div>
        </div>

        {address && (
          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: 220, border: '1px solid #E8E4DC' }}>
            <iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=14`}
              className="w-full h-full border-0" loading="lazy" />
          </div>
        )}

        {!nearbyLines.length && !p?.bakery_nearby && <Empty text="Informations quartier bientôt disponibles." />}
      </div>
    )
  }

  // ── Section Restaurants ───────────────────────────────────────────────────

  function SectionRestaurants() {
    const keywords = ['restaurant', 'café', 'coffee', 'pizza', 'burger', 'repas', 'manger', 'cuisine', 'tajine', 'couscous', 'grill', 'snack', 'brasserie', 'trattoria']
    const restaurantLines = (p?.nearby_info ?? '').split('\n')
      .filter(l => keywords.some(kw => l.toLowerCase().includes(kw)))
      .map(l => l.replace(/^[-•*]\s*/, ''))

    const fromField = (p?.restaurants_nearby ?? '').split('\n').filter(l => l.trim())
    const allLines = [...new Set([...fromField, ...restaurantLines])].filter(Boolean)

    return (
      <div className="space-y-4">
        {allLines.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#999999' }}>
              🍽️ Restaurants à proximité
            </p>
            <div className="space-y-2">
              {allLines.map((line, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl shadow-sm"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                  <span className="text-xl shrink-0">🍽️</span>
                  <p className="flex-1 text-sm" style={{ color: '#1A1A1A' }}>{line}</p>
                  <MapsBtn query={line} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
            <p className="text-sm mb-3" style={{ color: '#666666' }}>Découvrez les restaurants du quartier</p>
            <a href={`https://www.google.com/maps/search/restaurants+${encodeURIComponent(city)}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{ background: '#C4A044', color: '#fff' }}>
              <MapPin className="h-4 w-4" />Voir sur Maps
            </a>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#999999' }}>
            🛵 Commander en ligne
          </p>
          <div className="space-y-2">
            {[
              { name: 'Jumia Food', emoji: '🍕', desc: 'Livraison rapide à domicile', url: 'https://food.jumia.ma' },
              { name: 'InDrive',    emoji: '🛵', desc: 'Livraison & courses',          url: 'https://indriver.com'  },
            ].map(item => (
              <a key={item.name} href={item.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl shadow-sm"
                style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{item.name}</p>
                  <p className="text-xs" style={{ color: '#999999' }}>{item.desc}</p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0" style={{ color: '#999999' }} />
              </a>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Section Transport ─────────────────────────────────────────────────────

  function SectionTransport() {
    return (
      <div className="space-y-4">
        {p?.transport_info && (
          <InfoCard title="Transports locaux" emoji="🚌">
            <div className="space-y-2">
              {p.transport_info.split('\n').filter(l => l.trim()).map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 mt-0.5 font-bold" style={{ color: '#C4A044' }}>›</span>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>{line.replace(/^[-•*]\s*/, '')}</p>
                </div>
              ))}
            </div>
          </InfoCard>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#999999' }}>
            🚕 Réserver un taxi
          </p>
          <div className="space-y-2">
            <a href="https://indriver.com" target="_blank" rel="noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl shadow-sm"
              style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
              <span className="text-2xl">🚗</span>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>InDrive</p>
                <p className="text-xs" style={{ color: '#999999' }}>Taxi économique — prix négocié</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0" style={{ color: '#999999' }} />
            </a>
            <div className="flex items-center gap-3 p-4 rounded-xl shadow-sm"
              style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
              <span className="text-2xl">🚕</span>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Petit taxi</p>
                <p className="text-xs" style={{ color: '#999999' }}>Taxis locaux disponibles partout</p>
              </div>
            </div>
          </div>
        </div>

        {p?.concierge_phone && (
          <InfoCard title="Navette & Transferts" emoji="✈️">
            <p className="text-sm mb-3" style={{ color: '#666666' }}>
              Votre conciergerie organise transferts aéroport et navettes sur demande.
            </p>
            <a href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }}>
              <MessageCircle className="h-4 w-4" />Demander via WhatsApp
            </a>
          </InfoCard>
        )}
      </div>
    )
  }

  // ── Section Visites ───────────────────────────────────────────────────────

  function SectionVisits() {
    return (
      <div className="space-y-4">
        {p?.local_events ? (
          <InfoCard title="À ne pas manquer" emoji="🎭">
            <div className="space-y-2">
              {p.local_events.split('\n').filter(l => l.trim()).map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm shrink-0 mt-0.5">🌟</span>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>{line.replace(/^[-•*]\s*/, '')}</p>
                </div>
              ))}
            </div>
          </InfoCard>
        ) : (
          <Empty text="Informations touristiques bientôt disponibles." />
        )}

        {city && (
          <InfoCard title={`Explorer ${city}`} emoji="🗺️">
            <a href={`https://www.google.com/maps/search/attractions+${encodeURIComponent(city)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#C4A044', color: '#fff' }}>
              <MapPin className="h-4 w-4" />Voir les sites touristiques
            </a>
          </InfoCard>
        )}
      </div>
    )
  }

  // ── Section Urgences ──────────────────────────────────────────────────────

  function SectionEmergency() {
    return (
      <div className="space-y-4">

        {/* 1 — Alma Keys — fond or */}
        {(p?.concierge_phone || p?.backup_phone) && (
          <div className="rounded-2xl overflow-hidden shadow-sm"
            style={{ background: '#FFFBF0', border: '1px solid #F0D080' }}>
            <div className="px-5 pt-4 pb-2" style={{ borderBottom: '1px solid #F0D080' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A88830' }}>
                🏠 Votre conciergerie Alma Keys
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {p?.concierge_phone && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: '#A88830' }}>Concierge principal</p>
                  <div className="flex gap-2">
                    <a href={`tel:${p.concierge_phone}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                      style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#1A1A1A' }}>
                      <Phone className="h-4 w-4" />Appeler
                    </a>
                    <a href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`}
                      target="_blank" rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                      style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }}>
                      <MessageCircle className="h-4 w-4" />WhatsApp
                    </a>
                  </div>
                </div>
              )}
              {p?.backup_phone && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: '#A88830' }}>Numéro de secours</p>
                  <a href={`tel:${p.backup_phone}`}
                    className="flex items-center gap-3 py-3 px-4 rounded-xl"
                    style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>
                    <Phone className="h-4 w-4 shrink-0" style={{ color: '#C4A044' }} />
                    <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{p.backup_phone}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2 — Urgences locales — fond rouge */}
        <div className="rounded-2xl overflow-hidden shadow-sm"
          style={{ background: '#FFF5F5', border: '1px solid #FFCDD2' }}>
          <div className="px-5 pt-4 pb-2" style={{ borderBottom: '1px solid #FFCDD2' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#C62828' }}>
              🆘 Numéros d'urgence
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: '#FFCDD2' }}>
            {[
              { label: 'Police / Gendarmerie', phone: '19',  icon: '🚔' },
              { label: 'SAMU / Urgences',      phone: '150', icon: '🚑' },
              { label: 'Pompiers',             phone: '15',  icon: '🚒' },
            ].map(({ label, phone, icon }) => (
              <div key={label} className="px-5 py-4 flex items-center gap-4">
                <span className="text-3xl">{icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#C62828' }}>{label}</p>
                  <p className="text-3xl font-bold" style={{ color: '#1A1A1A', fontFamily: 'var(--font-heading, serif)' }}>{phone}</p>
                </div>
                <a href={`tel:${phone}`}
                  className="flex items-center justify-center w-12 h-12 rounded-full"
                  style={{ background: '#C62828', color: '#fff' }}>
                  <Phone className="h-5 w-5" />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* 3 — Contacts utiles (hôpital, pharmacie) */}
        {p?.emergency_contacts && (
          <InfoCard title="Hôpital & Contacts utiles" emoji="🏥">
            <div className="space-y-3">
              {p.emergency_contacts.split('\n').filter(l => l.trim()).map((line, i) => {
                const phoneMatch = line.match(/(\+?[\d\s\-().]{7,})/)?.[1]?.trim()
                const label = line.replace(/(\+?[\d\s\-().]{7,})/, '').replace(/[-:·|]+$/, '').trim()
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xl shrink-0">📞</span>
                    <div className="flex-1 min-w-0">
                      {label && <p className="text-xs" style={{ color: '#666666' }}>{label}</p>}
                      <p className="text-sm font-bold" style={{ color: '#1A1A1A' }}>
                        {phoneMatch ?? line}
                      </p>
                    </div>
                    {phoneMatch && (
                      <a href={`tel:${phoneMatch.replace(/[\s()-]/g, '')}`}
                        className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                        style={{ background: '#E8F5E9', color: '#2E7D32' }}>
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </InfoCard>
        )}

        {p?.emergency_procedure && (
          <InfoCard title="Procédure d'urgence" emoji="📢">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.emergency_procedure}</p>
          </InfoCard>
        )}
      </div>
    )
  }

  // ── Section Départ ────────────────────────────────────────────────────────

  function SectionCheckout() {
    const keyNote = p?.key_box_location
      ? `Déposer les clés dans la boîte à clé (${p.key_box_location})`
      : 'Laisser les clés sur la table'

    const items = [
      'Fermer toutes les fenêtres et volets',
      'Éteindre climatisation et chauffage',
      'Éteindre toutes les lumières',
      'Fermer les robinets',
      'Vider le réfrigérateur',
      'Déposer les poubelles dans le local',
      keyNote,
      'Vérifier que vous n\'avez rien oublié',
    ]

    const doneCount = Object.values(checklistDone).filter(Boolean).length

    return (
      <div className="space-y-4">
        {/* Heure de départ */}
        {p?.check_out_time && (
          <div className="rounded-2xl p-7 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#999999' }}>
              Heure de départ
            </p>
            <p className="text-6xl font-light" style={{ color: '#C4A044', fontFamily: 'var(--font-heading, serif)' }}>
              {p.check_out_time}
            </p>
            <p className="text-xs mt-2" style={{ color: '#666666' }}>Merci de respecter l'heure de départ</p>
          </div>
        )}

        {/* Checklist interactive */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
          <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F2F0EC' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: '#999999' }}>
              ✅ Checklist avant de partir
            </p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: doneCount === items.length ? '#E8F5E9' : '#F3F4F6',
                color: doneCount === items.length ? '#2E7D32' : '#666666',
              }}>
              {doneCount}/{items.length}
            </span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 cursor-pointer"
                onClick={() => setChecklistDone(prev => ({ ...prev, [i]: !prev[i] }))}>
                <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                  style={{
                    background: checklistDone[i] ? '#C4A044' : '#fff',
                    border: `2px solid ${checklistDone[i] ? '#C4A044' : '#D0C8B8'}`,
                  }}>
                  {checklistDone[i] && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <p className="text-sm flex-1"
                  style={{ color: checklistDone[i] ? '#B0A898' : '#1A1A1A', textDecoration: checklistDone[i] ? 'line-through' : 'none' }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        {!lateSent ? (
          <button onClick={requestLateCheckout}
            className="w-full py-3.5 rounded-xl text-sm font-medium"
            style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#666666' }}>
            🕐 Demander un late check-out
          </button>
        ) : (
          <div className="p-4 rounded-xl text-sm text-center"
            style={{ background: 'rgba(46,125,82,0.08)', color: '#2E7D52', border: '1px solid rgba(46,125,82,0.2)' }}>
            ✓ Votre demande a été envoyée. Nous vous répondons rapidement.
          </div>
        )}
      </div>
    )
  }

  // ── Section Messages ──────────────────────────────────────────────────────

  function SectionMessages() {
    return (
      <div className="flex flex-col gap-4" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <p className="text-xs py-2 px-4 rounded-full inline-block" style={{ background: '#F8F7F5', color: '#999999' }}>
            💬 Réponse sous 30 min · 8h–23h
          </p>
        </div>
        <div className="flex-1 space-y-3 min-h-[200px]">
          {messages.length === 0 && <Empty text="Aucun message. Envoyez-nous un message !" />}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.direction === 'guest' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm"
                style={m.direction === 'guest'
                  ? { background: 'rgba(196,160,68,0.12)', borderBottomRightRadius: 4 }
                  : { background: '#FFFFFF', border: '1px solid #E8E4DC', borderBottomLeftRadius: 4 }}>
                <p className="text-[10px] font-semibold mb-1" style={{ color: m.direction === 'guest' ? '#A88830' : '#666666' }}>
                  {m.direction === 'guest' ? 'Vous' : 'Alma Keys'}
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
        <div className="flex gap-2 pt-2 sticky bottom-0" style={{ background: '#F8F7F5' }}>
          <textarea
            value={msgBody}
            onChange={e => setMsgBody(e.target.value)}
            placeholder="Votre message…"
            rows={2}
            className="flex-1 text-sm rounded-xl px-3 py-2 resize-none outline-none"
            style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FFFFFF' }}
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

  // ── Section Services ──────────────────────────────────────────────────────

  function SectionExtras() {
    if (upsells.length === 0) return <Empty text="Aucun service disponible pour ce logement." />
    return (
      <div className="space-y-3">
        {upsells.map(u => (
          <div key={u.id} className="rounded-2xl p-4 shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">{u.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{u.name}</p>
                {u.description && <p className="text-xs mt-0.5" style={{ color: '#666666' }}>{u.description}</p>}
                {u.price > 0
                  ? <p className="text-xs mt-1 font-semibold" style={{ color: '#C4A044' }}>{u.price} {u.currency}</p>
                  : <p className="text-xs mt-1" style={{ color: '#999999' }}>Prix sur demande</p>}
              </div>
              {extraSent[u.id] ? (
                <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0"
                  style={{ background: 'rgba(46,125,82,0.10)', color: '#2E7D52' }}>✓ Envoyé</span>
              ) : (
                <button onClick={() => { setExtraOpen(u.id); setExtraQty(1); setExtraNote('') }}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-xl font-semibold"
                  style={{ background: 'rgba(196,160,68,0.10)', color: '#A88830', border: '1px solid rgba(196,160,68,0.25)' }}>
                  Demander
                </button>
              )}
            </div>
            {extraOpen === u.id && (
              <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid #F2F0EC' }}>
                <div className="flex items-center gap-3">
                  <p className="text-xs" style={{ color: '#666666' }}>Quantité</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExtraQty(q => Math.max(1, q - 1))}
                      className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center"
                      style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>−</button>
                    <span className="w-6 text-center text-sm font-semibold">{extraQty}</span>
                    <button onClick={() => setExtraQty(q => q + 1)}
                      className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center"
                      style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>+</button>
                  </div>
                </div>
                <textarea value={extraNote} onChange={e => setExtraNote(e.target.value)}
                  placeholder="Note ou précision (optionnel)…" rows={2}
                  className="w-full text-sm rounded-xl px-3 py-2 resize-none outline-none"
                  style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }} />
                <div className="flex gap-2">
                  <button onClick={() => setExtraOpen(null)}
                    className="flex-1 py-2 rounded-xl text-sm"
                    style={{ border: '1px solid #E8E4DC', color: '#666666' }}>Annuler</button>
                  <button onClick={() => sendExtra(u)} disabled={sendingExtra}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                    style={{ background: '#C4A044', color: '#FFFFFF' }}>
                    {sendingExtra ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Envoyer la demande'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  function SectionContract() { return <ContractTab token={token} lang={lang} /> }

  function SectionIdentity() {
    if (!p?.syndic_required && p?.country !== 'MA') return <Empty text="Aucun document requis pour ce séjour." />
    return (
      <div className="space-y-4">
        <InfoCard title="Pièce d'identité requise" emoji="🪪">
          {idUploaded ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-sm font-semibold" style={{ color: '#2E7D52' }}>Document reçu — merci !</p>
            </div>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: '#666666' }}>
                La réglementation marocaine impose la collecte d'une pièce d'identité par voyageur.
              </p>
              <label className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl cursor-pointer"
                style={{ border: '2px dashed #E8E4DC', background: '#F8F7F5' }}>
                {uploading
                  ? <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#C4A044' }} />
                  : <Upload className="h-8 w-8" style={{ color: '#C4A044' }} />}
                <span className="text-sm font-medium" style={{ color: '#666666' }}>
                  {uploading ? 'Upload en cours…' : 'Photographier ou sélectionner un fichier'}
                </span>
                <input type="file" accept="image/*,.pdf" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadId(f) }} disabled={uploading} />
              </label>
            </>
          )}
        </InfoCard>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#F8F7F5' }} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* Header */}
      <header className="sticky top-0 z-30 shadow-sm" style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E4DC' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {activeTab ? (
            <button onClick={() => setActiveTab(null)}
              className="flex items-center gap-1 text-sm font-medium shrink-0"
              style={{ color: '#C4A044' }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <Image src="/logo-alma-keys.png" alt="Alma Keys" width={90} height={28} className="h-7 w-auto shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {activeTab ? (
              <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>
                {SECTION_TITLES[activeTab].emoji} {SECTION_TITLES[activeTab][lang === 'en' ? 'en' : 'fr']}
              </p>
            ) : (
              <div>
                <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{p?.name ?? 'Alma Keys'}</p>
                {(checkIn && checkOut) && (
                  <p className="text-xs truncate" style={{ color: '#999999' }}>
                    {format(checkIn, 'd MMM', { locale: fr })} → {format(checkOut, 'd MMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {p?.concierge_phone && !activeTab && (
              <a href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-full"
                style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}>
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            <div className="flex gap-0.5">
              {(['fr', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className="text-base px-1 py-0.5 rounded-lg"
                  style={lang === l ? { background: 'rgba(196,160,68,0.15)' } : {}}>
                  {LANG_FLAG[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-lg mx-auto px-4 pb-12">

        {/* HOME */}
        {!activeTab && (
          <div>
            {g?.full_name && (
              <div className="pt-5 pb-4 text-center">
                <p className="text-xl font-light" style={{ fontFamily: 'var(--font-heading, serif)', color: '#1A1A1A' }}>
                  Bonjour, {g.full_name.split(' ')[0]} 👋
                </p>
                {checkIn && (
                  <p className="text-xs mt-1" style={{ color: '#999999' }}>
                    {isPast ? 'Merci pour votre séjour !' : `Votre séjour commence le ${format(checkIn, 'd MMMM', { locale: fr })}`}
                  </p>
                )}
              </div>
            )}

            {res.access_code && codeVisible && (
              <div className="mb-4 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                style={{ background: '#FFFFFF', border: '2px solid #C4A044' }}>
                <span className="text-2xl">🔑</span>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#C4A044' }}>Code d'accès</p>
                  <p className="text-2xl font-bold font-mono tracking-widest" style={{ color: '#1A1A1A' }}>{res.access_code}</p>
                </div>
                <button onClick={() => copy(res.access_code!, setCopiedCode)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ background: copiedCode ? 'rgba(46,125,82,0.10)' : 'rgba(196,160,68,0.10)', color: copiedCode ? '#2E7D52' : '#A88830' }}>
                  {copiedCode ? <><Check className="h-3.5 w-3.5" />Copié</> : <><Copy className="h-3.5 w-3.5" />Copier</>}
                </button>
              </div>
            )}

            {/* Grille 12 items 4×3 */}
            <div className="grid grid-cols-3 gap-3 py-2">
              {NAV_GRID.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all active:scale-95 shadow-sm"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                  <span className="text-[40px] leading-none">{item.emoji}</span>
                  <span className="text-[11px] font-medium text-center leading-tight" style={{ color: '#1A1A1A' }}>
                    {lang === 'en' ? item.labelEn : item.labelFr}
                  </span>
                </button>
              ))}
            </div>

            {/* Messages seul centré */}
            <div className="flex justify-center mt-3">
              <button onClick={() => setActiveTab('messages')}
                className="relative flex flex-col items-center justify-center gap-2 px-10 py-4 rounded-2xl transition-all active:scale-95 shadow-sm"
                style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                <span className="text-[40px] leading-none">💬</span>
                <span className="text-[11px] font-medium" style={{ color: '#1A1A1A' }}>
                  {lang === 'en' ? 'Messages' : 'Messages'}
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: '#C62828', color: '#fff' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Section active */}
        {activeTab && (
          <div className="pt-5">
            {activeTab === 'checkin'      && <SectionAccess />}
            {activeTab === 'wifi'         && <SectionWifi />}
            {activeTab === 'equipment'    && <SectionEquipment />}
            {activeTab === 'parking'      && <SectionParking />}
            {activeTab === 'trash'        && <SectionTrash />}
            {activeTab === 'guide'        && <SectionGuide />}
            {activeTab === 'neighborhood' && <SectionNeighborhood />}
            {activeTab === 'restaurants'  && <SectionRestaurants />}
            {activeTab === 'transport'    && <SectionTransport />}
            {activeTab === 'visits'       && <SectionVisits />}
            {activeTab === 'checkout'     && <SectionCheckout />}
            {activeTab === 'emergency'    && <SectionEmergency />}
            {activeTab === 'messages'     && <SectionMessages />}
            {activeTab === 'extras'       && <SectionExtras />}
            {activeTab === 'contract'     && <SectionContract />}
            {activeTab === 'identity'     && <SectionIdentity />}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Composant vide ────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl py-12 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
      <p className="text-sm" style={{ color: '#999999' }}>{text}</p>
    </div>
  )
}
