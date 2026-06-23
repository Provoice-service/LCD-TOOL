'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { format, differenceInDays, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TRANSLATIONS, LANG_FLAG, type Lang } from '@/lib/guest-page/translations'
import {
  Copy, Check, MapPin, Phone, MessageCircle, Upload,
  ExternalLink, Send, Clock, Star, Wifi, Loader2, Eye, EyeOff, ChevronLeft,
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

// ── Nav items ─────────────────────────────────────────────────────────────────

type TabId = 'reservation' | 'checkin' | 'checkout' | 'wifi' | 'guide' | 'neighborhood'
           | 'emergency' | 'extras' | 'contract' | 'identity' | 'messages' | 'reviews'

interface NavItem { id: TabId; emoji: string; labelFr: string; labelEn: string }

const NAV_ITEMS: NavItem[] = [
  { id: 'checkin',      emoji: '🔑', labelFr: 'Accès',        labelEn: 'Access'      },
  { id: 'wifi',         emoji: '📶', labelFr: 'WiFi & Équip.', labelEn: 'WiFi & Tech' },
  { id: 'guide',        emoji: '📋', labelFr: 'Règlement',     labelEn: 'House Rules' },
  { id: 'neighborhood', emoji: '🏪', labelFr: 'Quartier',      labelEn: 'Area'        },
  { id: 'extras',       emoji: '✨', labelFr: 'Services',      labelEn: 'Services'    },
  { id: 'emergency',    emoji: '🆘', labelFr: 'Urgences',      labelEn: 'Emergency'   },
  { id: 'checkout',     emoji: '🚪', labelFr: 'Départ',        labelEn: 'Checkout'    },
  { id: 'messages',     emoji: '💬', labelFr: 'Messages',      labelEn: 'Messages'    },
  { id: 'reviews',      emoji: '⭐', labelFr: 'Avis',          labelEn: 'Reviews'     },
  { id: 'contract',     emoji: '📄', labelFr: 'Contrat',       labelEn: 'Contract'    },
  { id: 'identity',     emoji: '🪪', labelFr: 'Identité',      labelEn: 'Identity'    },
  { id: 'reservation',  emoji: '🗓️', labelFr: 'Réservation',   labelEn: 'Booking'     },
]

const SECTION_TITLES: Record<TabId, { fr: string; en: string; emoji: string }> = {
  reservation:  { fr: 'Ma réservation',    en: 'My booking',       emoji: '🗓️' },
  checkin:      { fr: 'Accès & Arrivée',   en: 'Access & Arrival', emoji: '🔑' },
  checkout:     { fr: 'Départ',            en: 'Check-out',        emoji: '🚪' },
  wifi:         { fr: 'WiFi & Équipements', en: 'WiFi & Equipment', emoji: '📶' },
  guide:        { fr: 'Règlement',         en: 'House Rules',      emoji: '📋' },
  neighborhood: { fr: 'Quartier',          en: 'Area Guide',       emoji: '🏪' },
  emergency:    { fr: 'Urgences',          en: 'Emergency',        emoji: '🆘' },
  extras:       { fr: 'Services',          en: 'Services',         emoji: '✨' },
  contract:     { fr: 'Contrat',           en: 'Contract',         emoji: '📄' },
  identity:     { fr: 'Pièce d\'identité', en: 'Identity',         emoji: '🪪' },
  messages:     { fr: 'Messages',          en: 'Messages',         emoji: '💬' },
  reviews:      { fr: 'Laisser un avis',   en: 'Leave a review',   emoji: '⭐' },
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
  const [lang, setLang] = useState<Lang>((['fr', 'en', 'ar', 'es'] as Lang[]).includes(detectedLang) ? detectedLang : 'fr')
  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const [messages, setMessages]   = useState<GuestMessage[]>(initialMessages)
  const [msgBody, setMsgBody]     = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedWifi, setCopiedWifi] = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [idUploaded, setIdUploaded] = useState(res.id_received)
  const [uploading, setUploading]   = useState(false)
  const [extraOpen, setExtraOpen]   = useState<string | null>(null)
  const [extraQty, setExtraQty]     = useState(1)
  const [extraNote, setExtraNote]   = useState('')
  const [extraSent, setExtraSent]   = useState<Record<string, boolean>>({})
  const [sendingExtra, setSendingExtra] = useState(false)
  const [lateSent, setLateSent]     = useState(false)
  const [checklistDone, setChecklistDone] = useState<Record<string, boolean>>({})
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

  // Auto-refresh messages
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

  // Scroll to bottom on messages
  useEffect(() => {
    if (activeTab === 'messages') {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [messages, activeTab])

  // ── Actions ────────────────────────────────────────────────────────────────

  function copy(text: string, setFn: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setFn(true); setTimeout(() => setFn(false), 2000)
    })
  }

  async function sendMessage() {
    if (!msgBody.trim()) return
    setSendingMsg(true)
    await fetch(`/api/guest/${token}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: msgBody.trim() }),
    })
    setMessages(prev => [...prev, {
      id: Date.now().toString(), direction: 'guest', body: msgBody.trim(),
      read_at: null, created_at: new Date().toISOString(),
    }])
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

  // ── Sous-composants ────────────────────────────────────────────────────────

  function CopyBtn({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: () => void }) {
    return (
      <button onClick={onCopy}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors shrink-0"
        style={{ background: copied ? 'rgba(46,125,82,0.10)' : 'rgba(196,160,68,0.10)', color: copied ? '#2E7D52' : '#A88830' }}>
        {copied ? <><Check className="h-3.5 w-3.5" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
      </button>
    )
  }

  function ActionBtn({ href, icon, label, variant = 'gold' }: { href: string; icon: React.ReactNode; label: string; variant?: 'gold' | 'green' | 'ghost' }) {
    const styles = {
      gold:  { background: '#C4A044',                             color: '#fff' },
      green: { background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' },
      ghost: { background: '#F8F7F5',               border: '1px solid #E8E4DC',              color: '#1A1A1A' },
    }
    return (
      <a href={href} target={href.startsWith('tel:') ? undefined : '_blank'} rel="noreferrer"
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
        style={styles[variant]}>
        {icon} {label}
      </a>
    )
  }

  function InfoCard({ title, emoji, children }: { title: string; emoji?: string; children: React.ReactNode }) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
        {title && (
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #F2F0EC' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: '#999999' }}>
              {emoji && <span className="text-sm">{emoji}</span>} {title}
            </p>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    )
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  function SectionAccess() {
    return (
      <div className="space-y-4">
        {/* Adresse + Maps */}
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
              <div className="mt-3 rounded-xl overflow-hidden" style={{ height: 160 }}>
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=15`}
                  className="w-full h-full border-0" loading="lazy"
                />
              </div>
            )}
          </InfoCard>
        )}

        {/* Code d'accès */}
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
                  <p className="text-sm font-semibold" style={{ color: '#C17C1A' }}>
                    Code disponible dans {hoursLeft}h
                  </p>
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

        {/* Instructions numérotées */}
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

        {/* Heure + étage */}
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

        {/* Contacts */}
        {p?.concierge_phone && (
          <div className="flex gap-2">
            <ActionBtn href={`tel:${p.concierge_phone}`} icon={<Phone className="h-4 w-4" />} label="Appeler" variant="ghost" />
            <ActionBtn href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`} icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" variant="green" />
          </div>
        )}
      </div>
    )
  }

  function SectionWifi() {
    return (
      <div className="space-y-4">
        {(p?.wifi_name || p?.wifi_pass) && (
          <InfoCard title="Réseau WiFi" emoji="📶">
            <div className="space-y-3">
              {p?.wifi_name && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4" style={{ color: '#C4A044' }} />
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{p.wifi_name}</p>
                  </div>
                  <CopyBtn text={p.wifi_name} copied={false} onCopy={() => navigator.clipboard.writeText(p!.wifi_name!)} />
                </div>
              )}
              {p?.wifi_pass && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>
                  <p className="text-sm font-mono" style={{ color: '#1A1A1A' }}>
                    {showPass ? p.wifi_pass : '•'.repeat(Math.min(p.wifi_pass.length, 10))}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowPass(!showPass)} className="p-1" style={{ color: '#999999' }}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <CopyBtn text={p.wifi_pass} copied={copiedWifi} onCopy={() => copy(p!.wifi_pass!, setCopiedWifi)} />
                  </div>
                </div>
              )}
            </div>
          </InfoCard>
        )}

        {p?.appliances_info && (
          <InfoCard title="Électroménager" emoji="🍳">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.appliances_info}</p>
          </InfoCard>
        )}
        {p?.tv_instructions && (
          <InfoCard title="Télévision" emoji="📺">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.tv_instructions}</p>
          </InfoCard>
        )}
        {(p?.heating_info || p?.ac_instructions) && (
          <InfoCard title="Chauffage & Climatisation" emoji="❄️">
            {p?.heating_info && <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: '#1A1A1A' }}>{p.heating_info}</p>}
            {p?.ac_instructions && <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.ac_instructions}</p>}
          </InfoCard>
        )}
      </div>
    )
  }

  function SectionGuide() {
    const rules = [
      p?.noise_rules   && { icon: '🔕', text: p.noise_rules },
      p?.smoking_rules && { icon: '🚬', text: p.smoking_rules },
      p?.pet_rules     && { icon: '🐾', text: p.pet_rules },
      p?.trash_info    && { icon: '🗑️', text: p.trash_info },
      p?.parking_info  && { icon: '🅿️', text: p.parking_info },
      p?.elevator_info && { icon: '🛗', text: p.elevator_info },
      p?.cleaning_products_location && { icon: '🧹', text: p.cleaning_products_location },
    ].filter(Boolean) as { icon: string; text: string }[]

    return (
      <div className="space-y-4">
        {p?.house_rules && (
          <InfoCard title="Règlement intérieur" emoji="📋">
            <div className="space-y-2">
              {p.house_rules.split('\n').filter(l => l.trim()).map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm mt-0.5 shrink-0">
                    {line.toLowerCase().includes('interdit') || line.toLowerCase().includes('pas de') || line.toLowerCase().includes('no ')
                      ? '❌' : '✅'}
                  </span>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>{line.replace(/^[-•*]\s*/, '')}</p>
                </div>
              ))}
            </div>
          </InfoCard>
        )}

        {rules.length > 0 && (
          <InfoCard title="Informations pratiques" emoji="ℹ️">
            <div className="space-y-3">
              {rules.map((r, i) => (
                <div key={i} className="flex gap-3 items-start pb-3" style={{ borderBottom: i < rules.length - 1 ? '1px solid #F2F0EC' : 'none' }}>
                  <span className="text-lg shrink-0">{r.icon}</span>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>{r.text}</p>
                </div>
              ))}
            </div>
          </InfoCard>
        )}

        {/* Heure de silence en grand */}
        {p?.noise_rules && (
          <div className="rounded-2xl p-5 text-center shadow-sm" style={{ background: '#FFF3E0', border: '1px solid #FFCC80' }}>
            <p className="text-2xl font-bold mb-1" style={{ color: '#E65100', fontFamily: 'var(--font-heading, serif)' }}>
              🔕 Silence après 22h
            </p>
            <p className="text-xs" style={{ color: '#BF360C' }}>Merci de respecter le voisinage</p>
          </div>
        )}
      </div>
    )
  }

  function SectionNeighborhood() {
    return (
      <div className="space-y-4">
        {p?.nearby_info && (
          <InfoCard title="Commerces & Services" emoji="🏪">
            <div className="space-y-2">
              {p.nearby_info.split('\n').filter(l => l.trim()).map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm mt-0.5 shrink-0">📍</span>
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>{line.replace(/^[-•*]\s*/, '')}</p>
                </div>
              ))}
            </div>
          </InfoCard>
        )}
        {p?.bakery_nearby && (
          <InfoCard title="Boulangerie / Épicerie" emoji="🥐">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.bakery_nearby}</p>
          </InfoCard>
        )}
        {p?.local_events && (
          <InfoCard title="À ne pas manquer" emoji="🎭">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.local_events}</p>
          </InfoCard>
        )}
        {address && (
          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: 250, border: '1px solid #E8E4DC' }}>
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=14`}
              className="w-full h-full border-0" loading="lazy"
            />
          </div>
        )}
        {!p?.nearby_info && !p?.bakery_nearby && !p?.local_events && (
          <Empty text="Informations quartier bientôt disponibles." />
        )}
      </div>
    )
  }

  function SectionEmergency() {
    const emergencyNumbers = [
      { label: 'Police / Gendarmerie', phone: p?.local_police_number ?? '19', icon: '🚔' },
      { label: 'SAMU / Ambulance',     phone: '150',                          icon: '🚑' },
      { label: 'Pompiers',             phone: '15',                           icon: '🚒' },
    ]
    return (
      <div className="space-y-4">
        {/* Numéros d'urgence — fond rouge clair */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: '#FFF5F5', border: '1px solid #FFCDD2' }}>
          <div className="px-5 pt-4 pb-2" style={{ borderBottom: '1px solid #FFCDD2' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#C62828' }}>
              🆘 Numéros d'urgence
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: '#FFCDD2' }}>
            {emergencyNumbers.map(({ label, phone, icon }) => (
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

        {/* Contact Alma Keys */}
        {(p?.concierge_phone || p?.backup_phone) && (
          <InfoCard title="Votre concierge Alma Keys" emoji="🏠">
            {p?.concierge_phone && (
              <div className="flex gap-2 mb-3">
                <ActionBtn href={`tel:${p.concierge_phone}`} icon={<Phone className="h-4 w-4" />} label={p.concierge_phone} variant="ghost" />
                <ActionBtn href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`} icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" variant="green" />
              </div>
            )}
            {p?.backup_phone && (
              <a href={`tel:${p.backup_phone}`} className="text-sm flex items-center gap-2" style={{ color: '#666666' }}>
                <Phone className="h-3.5 w-3.5" /> Numéro de secours : {p.backup_phone}
              </a>
            )}
          </InfoCard>
        )}

        {p?.emergency_procedure && (
          <InfoCard title="Procédure d'urgence" emoji="📢">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.emergency_procedure}</p>
          </InfoCard>
        )}
        {p?.emergency_contacts && (
          <InfoCard title="Contacts utiles" emoji="📞">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.emergency_contacts}</p>
          </InfoCard>
        )}
      </div>
    )
  }

  function SectionCheckout() {
    const checklistItems = [
      'Fermer tous les robinets et fenêtres',
      'Éteindre la climatisation / chauffage',
      'Rassembler vos affaires personnelles',
      'Laisser les clés à l\'emplacement indiqué',
      'Mettre les poubelles dans les bacs prévus',
      'Laisser le logement en bon état',
    ]
    return (
      <div className="space-y-4">
        {p?.check_out_time && (
          <div className="rounded-2xl p-6 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#999999' }}>
              Heure de départ
            </p>
            <p className="text-5xl font-light" style={{ color: '#C4A044', fontFamily: 'var(--font-heading, serif)' }}>
              {p.check_out_time}
            </p>
            <p className="text-xs mt-2" style={{ color: '#666666' }}>Merci de respecter l'heure de départ</p>
          </div>
        )}

        {/* Checklist interactive */}
        <InfoCard title="Checklist avant de partir" emoji="✅">
          <div className="space-y-3">
            {checklistItems.map((item, i) => (
              <div key={i}
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setChecklistDone(prev => ({ ...prev, [i]: !prev[i] }))}>
                <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-all"
                  style={{
                    background: checklistDone[i] ? '#C4A044' : '#fff',
                    border: `2px solid ${checklistDone[i] ? '#C4A044' : '#C8C0B0'}`,
                  }}>
                  {checklistDone[i] && <Check className="h-3 w-3 text-white" />}
                </div>
                <p className="text-sm" style={{ color: checklistDone[i] ? '#999999' : '#1A1A1A', textDecoration: checklistDone[i] ? 'line-through' : 'none' }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </InfoCard>

        {p?.inventory_notes && (
          <InfoCard title="Procédure de départ" emoji="📋">
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A1A' }}>{p.inventory_notes}</p>
          </InfoCard>
        )}

        {!lateSent ? (
          <button onClick={requestLateCheckout}
            className="w-full py-3.5 rounded-xl text-sm font-medium"
            style={{ background: '#F8F7F5', border: '1px solid #E8E4DC', color: '#666666' }}>
            🕐 Demander un late check-out
          </button>
        ) : (
          <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(46,125,82,0.08)', color: '#2E7D52', border: '1px solid rgba(46,125,82,0.2)' }}>
            ✓ Votre demande a été envoyée. Nous vous répondons rapidement.
          </div>
        )}
      </div>
    )
  }

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
                {u.price > 0 && <p className="text-xs mt-1 font-semibold" style={{ color: '#C4A044' }}>{u.price} {u.currency}</p>}
                {u.price === 0 && <p className="text-xs mt-1" style={{ color: '#999999' }}>Prix sur demande</p>}
              </div>
              {extraSent[u.id] ? (
                <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0" style={{ background: 'rgba(46,125,82,0.10)', color: '#2E7D52' }}>✓ Envoyé</span>
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
                <textarea
                  value={extraNote}
                  onChange={e => setExtraNote(e.target.value)}
                  placeholder="Note ou précision (optionnel)…"
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

  function SectionMessages() {
    return (
      <div className="flex flex-col gap-4" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <p className="text-xs py-2 px-4 rounded-full inline-block" style={{ background: '#F8F7F5', color: '#999999' }}>
            💬 Réponse sous 30 min · 8h–23h
          </p>
        </div>
        <div className="flex-1 space-y-3 min-h-[200px]">
          {messages.length === 0 && <Empty text="Aucun message pour le moment. Envoyez-nous un message !" />}
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

  function SectionReservation() {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#C4A044' }}>{res.platform}</p>
          <p className="text-xl font-light mb-1" style={{ fontFamily: 'var(--font-heading, serif)', color: '#1A1A1A' }}>{p?.name ?? '—'}</p>
          {p?.city && <p className="text-sm mb-4" style={{ color: '#666666' }}>📍 {p.city}</p>}
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
          {nights !== null && (
            <p className="text-xs mt-3 pt-3" style={{ color: '#666666', borderTop: '1px solid #F2F0EC' }}>
              <span className="font-semibold" style={{ color: '#1A1A1A' }}>{nights}</span> nuit{nights > 1 ? 's' : ''}
              {res.num_guests ? ` · ${res.num_guests} voyageur${res.num_guests > 1 ? 's' : ''}` : ''}
            </p>
          )}
        </div>
        {p?.concierge_phone && (
          <div className="flex gap-2">
            <ActionBtn href={`tel:${p.concierge_phone}`} icon={<Phone className="h-4 w-4" />} label="Appeler" variant="ghost" />
            <ActionBtn href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`} icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" variant="green" />
          </div>
        )}
      </div>
    )
  }

  function SectionReviews() {
    if (!isPast) return (
      <div className="rounded-2xl p-8 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
        <Star className="h-8 w-8 mx-auto mb-3" style={{ color: '#E8E4DC' }} />
        <p className="text-sm" style={{ color: '#999999' }}>Cette section sera disponible après votre départ.</p>
      </div>
    )
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-6 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
          <div className="text-5xl mb-3">⭐</div>
          <p className="text-lg font-light mb-1" style={{ fontFamily: 'var(--font-heading, serif)', color: '#1A1A1A' }}>
            Votre avis compte beaucoup !
          </p>
          <p className="text-sm" style={{ color: '#666666' }}>Cela prend moins de 2 minutes et nous aide énormément.</p>
        </div>
        {[
          { label: 'Airbnb', url: p?.airbnb_review_url, emoji: '🏠' },
          { label: 'Booking.com', url: p?.booking_review_url, emoji: '🌐' },
          { label: 'Google', url: p?.google_review_url, emoji: '⭐' },
        ].filter(item => item.url).map(({ label, url, emoji }) => (
          <a key={label} href={url!} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-semibold shadow-sm"
            style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A' }}>
            <span className="text-lg">{emoji}</span> {label} <ExternalLink className="h-3.5 w-3.5 ml-1" style={{ color: '#999999' }} />
          </a>
        ))}
      </div>
    )
  }

  function SectionContract() {
    return <ContractTab token={token} lang={lang} />
  }

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

  const SECTION_CONTENT: Record<TabId, React.ReactNode> = {
    reservation:  <SectionReservation />,
    checkin:      <SectionAccess />,
    checkout:     <SectionCheckout />,
    wifi:         <SectionWifi />,
    guide:        <SectionGuide />,
    neighborhood: <SectionNeighborhood />,
    emergency:    <SectionEmergency />,
    extras:       <SectionExtras />,
    contract:     <SectionContract />,
    identity:     <SectionIdentity />,
    messages:     <SectionMessages />,
    reviews:      <SectionReviews />,
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#F8F7F5' }} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Header fixe ─────────────────────────────────────────────────────── */}
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
            {/* WhatsApp concierge */}
            {p?.concierge_phone && !activeTab && (
              <a href={`https://wa.me/${p.concierge_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-full"
                style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}>
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            {/* Language switcher */}
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

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 pb-12">

        {/* HOME — Grille d'icônes */}
        {!activeTab && (
          <div>
            {/* Greeting */}
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

            {/* Code d'accès rapide */}
            {res.access_code && codeVisible && (
              <div className="mb-4 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                style={{ background: '#FFFFFF', border: '2px solid #C4A044' }}>
                <span className="text-2xl">🔑</span>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#C4A044' }}>Code d'accès</p>
                  <p className="text-2xl font-bold font-mono tracking-widest" style={{ color: '#1A1A1A' }}>{res.access_code}</p>
                </div>
                <CopyBtn text={res.access_code} copied={copiedCode} onCopy={() => copy(res.access_code!, setCopiedCode)} />
              </div>
            )}

            {/* Grille navigation 3 colonnes */}
            <div className="grid grid-cols-3 gap-3 py-2">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all active:scale-95 shadow-sm"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
                  <span className="text-3xl">{item.emoji}</span>
                  <span className="text-[11px] font-medium text-center leading-tight"
                    style={{ color: '#1A1A1A' }}>
                    {lang === 'en' ? item.labelEn : item.labelFr}
                  </span>
                  {item.id === 'messages' && unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                      style={{ background: '#C62828', color: '#fff' }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION — Contenu de l'onglet actif */}
        {activeTab && (
          <div className="pt-5">
            {SECTION_CONTENT[activeTab]}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl py-12 text-center shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
      <p className="text-sm" style={{ color: '#999999' }}>{text}</p>
    </div>
  )
}
