'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import ContractTab from './ContractTab'

// ── Types exportés ─────────────────────────────────────────────────────────────

export interface WizardGuest {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  language: string
  address: string | null
  city: string | null
  country_residence: string | null
}

export interface WizardProperty {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  syndic_required: boolean
  concierge_phone: string | null
}

export interface WizardReservation {
  id: string
  check_in: string | null
  check_out: string | null
  platform: string
  num_guests: number | null
  nb_adults: number
  arrival_time: string | null
  contract_signed: boolean
  onboarding_step: number
  identity_documents: object[]
}

export interface WizardUpsell {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  icon: string
  category: string | null
}

// ── Type interne document adulte ───────────────────────────────────────────────

type DocValidationStatus = 'idle' | 'uploading' | 'validating' | 'verified' | 'invalid' | 'expired' | 'poor_quality' | 'manual_review'

interface DocEntry {
  name: string
  docType: string
  uploaded: boolean
  url: string
  status: DocValidationStatus
  extractedName: string | null
  errorMessage: string | null
}

// ── Traductions inline ─────────────────────────────────────────────────────────

type Lang = 'fr' | 'en'

const T: Record<Lang, Record<string, string>> = {
  fr: {
    step1Label: 'Vos informations',
    step2Label: 'Pièces d\'identité',
    step3Label: 'Contrat',
    step4Label: 'Services',
    welcome: 'Bienvenue !',
    welcomeSub: 'Complétez votre dossier voyageur en quelques minutes pour préparer votre séjour.',
    fullName: 'Nom complet',
    email: 'Email',
    phone: 'Téléphone',
    address: 'Adresse de résidence',
    city: 'Ville',
    country: 'Pays',
    arrivalTime: 'Heure d\'arrivée prévue',
    nbAdults: 'Nombre d\'adultes',
    continue: 'Continuer →',
    saving: 'Enregistrement…',
    idTitle: 'Documents d\'identité',
    idSubtitle: 'La réglementation marocaine nous impose de collecter une pièce d\'identité par adulte.',
    adult: 'Voyageur',
    docType: 'Type de document',
    passport: 'Passeport',
    cni: 'Carte Nationale d\'Identité',
    residence: 'Carte de séjour',
    uploadPhoto: '📷 Ajouter une photo',
    uploading: 'Envoi en cours…',
    validating: '🔍 Vérification IA en cours…',
    docValid: '✓ Document valide',
    docReceived: '✓ Document reçu',
    retakePhoto: 'Reprendre une photo',
    contractTitle: 'Contrat de location',
    contractSub: 'Veuillez lire et signer votre contrat de location avant de poursuivre.',
    contractSigned: '✓ Contrat signé — vous pouvez continuer',
    extrasTitle: 'Améliorez votre séjour',
    extrasSub: 'Services optionnels disponibles dans ce logement',
    request: 'Demander',
    requested: '✓ Demandé',
    requesting: '…',
    finish: 'Terminer le dossier',
    finishing: 'Finalisation…',
    doneTitle: '✓ Dossier complet !',
    doneSub: 'Nous vous enverrons vos instructions d\'accès la veille de votre arrivée.',
    doneGuide: 'Accéder au guide du logement',
    step: 'Étape',
    of: 'sur',
    skip: 'Passer cette étape →',
    allDocsRequired: 'Tous les documents doivent être validés pour continuer',
  },
  en: {
    step1Label: 'Your Information',
    step2Label: 'Identity Documents',
    step3Label: 'Contract',
    step4Label: 'Services',
    welcome: 'Welcome!',
    welcomeSub: 'Complete your guest file in a few minutes to prepare for your stay.',
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Home Address',
    city: 'City',
    country: 'Country',
    arrivalTime: 'Expected Arrival Time',
    nbAdults: 'Number of Adults',
    continue: 'Continue →',
    saving: 'Saving…',
    idTitle: 'Identity Documents',
    idSubtitle: 'Moroccan regulations require us to collect one identity document per adult guest.',
    adult: 'Guest',
    docType: 'Document Type',
    passport: 'Passport',
    cni: 'National ID Card',
    residence: 'Residence Permit',
    uploadPhoto: '📷 Add a Photo',
    uploading: 'Uploading…',
    validating: '🔍 AI verification in progress…',
    docValid: '✓ Document valid',
    docReceived: '✓ Document received',
    retakePhoto: 'Retake Photo',
    contractTitle: 'Rental Contract',
    contractSub: 'Please read and sign your rental contract before proceeding.',
    contractSigned: '✓ Contract signed — you may continue',
    extrasTitle: 'Enhance Your Stay',
    extrasSub: 'Optional services available at this property',
    request: 'Request',
    requested: '✓ Requested',
    requesting: '…',
    finish: 'Complete My File',
    finishing: 'Finishing…',
    doneTitle: '✓ File Complete!',
    doneSub: 'We will send you your access instructions the day before your arrival.',
    doneGuide: 'View Property Guide',
    step: 'Step',
    of: 'of',
    skip: 'Skip this step →',
    allDocsRequired: 'All documents must be validated to continue',
  },
}

const UPSELL_CATEGORY_ICONS: Record<string, string> = {
  Transport: '🚗', Confort: '🛋️', 'Activités nautiques': '🤿', Sports: '⚽',
  Tourisme: '🏛️', Restauration: '🍽️', Autre: '✨',
}

function fmtDate(d: string | null, locale: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function initDoc(i: number, guestName: string, existing?: { doc_type?: string; extraction_status?: string }): DocEntry {
  return {
    name: i === 0 ? guestName : '',
    docType: existing?.doc_type ?? 'passeport',
    uploaded: !!existing,
    url: '',
    status: (existing?.extraction_status as DocValidationStatus | undefined) ?? (existing ? 'verified' : 'idle'),
    extractedName: null,
    errorMessage: null,
  }
}

// ── Composant principal ────────────────────────────────────────────────────────

interface Props {
  token: string
  reservation: WizardReservation
  guest: WizardGuest | null
  property: WizardProperty | null
  upsells: WizardUpsell[]
}

export default function OnboardingWizard({ token, reservation, guest, property, upsells }: Props) {
  const detectedLang: Lang = (['fr', 'en'] as Lang[]).includes(guest?.language as Lang) ? guest!.language as Lang : 'fr'
  const [lang, setLang] = useState<Lang>(detectedLang)
  const t = T[lang]

  const [step, setStep]   = useState<1 | 2 | 3 | 4>(reservation.onboarding_step === 0 ? 1 : Math.min(Math.max(reservation.onboarding_step, 1), 4) as 1 | 2 | 3 | 4)
  const [done, setDone]   = useState(false)

  // ── Step 1 ───────────────────────────────────────────────────────────────────
  const [fullName,    setFullName]    = useState(guest?.full_name ?? '')
  const [email,       setEmail]       = useState(guest?.email ?? '')
  const [phone,       setPhone]       = useState(guest?.phone ?? '')
  const [address,     setAddress]     = useState(guest?.address ?? '')
  const [city,        setCity]        = useState(guest?.city ?? '')
  const [countryRes,  setCountryRes]  = useState(guest?.country_residence ?? '')
  const [arrivalTime, setArrivalTime] = useState(reservation.arrival_time ?? '')
  const [nbAdults,    setNbAdults]    = useState(Math.max(reservation.nb_adults ?? 1, 1))
  const [savingInfo,  setSavingInfo]  = useState(false)

  // ── Step 2 — tableau d'adultes avec état indépendant ─────────────────────────
  const existingDocs = (reservation.identity_documents as Array<{ adult_index?: number; doc_type?: string; extraction_status?: string }>) ?? []

  const [adults, setAdults] = useState<DocEntry[]>(() =>
    Array.from({ length: Math.max(reservation.nb_adults ?? 1, 1) }, (_, i) => {
      const ex = existingDocs.find(d => d.adult_index === i)
      return initDoc(i, guest?.full_name ?? '', ex)
    })
  )

  // Sync quand nbAdults change (depuis step 1)
  useEffect(() => {
    setAdults(prev => {
      if (nbAdults === prev.length) return prev
      const next = [...prev]
      while (next.length < nbAdults) next.push(initDoc(next.length, '', undefined))
      return next.slice(0, nbAdults)
    })
  }, [nbAdults])

  const fileRefs = useRef<Array<HTMLInputElement | null>>([])

  // ── Step 3 ───────────────────────────────────────────────────────────────────
  const [contractSigned, setContractSigned] = useState(reservation.contract_signed)

  // ── Step 4 ───────────────────────────────────────────────────────────────────
  const [requested,  setRequested]  = useState<Record<string, boolean>>({})
  const [requesting, setRequesting] = useState<Record<string, boolean>>({})
  const [finishing,  setFinishing]  = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const saveStep1 = async () => {
    setSavingInfo(true)
    try {
      await fetch(`/api/guest/${token}/update-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName, email, phone, address, city,
          country_residence: countryRes, arrival_time: arrivalTime,
          num_guests: nbAdults, nb_adults: nbAdults, step: 1,
        }),
      })
      setStep(2)
    } finally {
      setSavingInfo(false)
    }
  }

  const uploadAndValidate = async (index: number, file: File) => {
    // Lire name/docType actuels via callback pour éviter les stale closures
    let docName = ''
    let docType = 'passeport'
    setAdults(prev => {
      docName = prev[index]?.name.trim() || `${t.adult} ${index + 1}`
      docType = prev[index]?.docType ?? 'passeport'
      return prev.map((d, i) => i === index ? { ...d, status: 'uploading', errorMessage: null } : d)
    })

    // 1. Upload
    const fd = new FormData()
    fd.append('file', file)
    fd.append('adult_name', docName)
    fd.append('doc_type', docType)
    fd.append('adult_index', String(index))

    const upRes = await fetch(`/api/guest/${token}/upload-doc`, { method: 'POST', body: fd })
    const upJson = await upRes.json() as { url?: string; ok?: boolean }
    const url = upJson.url ?? ''

    if (!upRes.ok || !url) {
      setAdults(prev => prev.map((d, i) => i === index ? { ...d, status: 'idle', errorMessage: 'Erreur d\'upload, réessayez.' } : d))
      return
    }

    setAdults(prev => prev.map((d, i) => i === index ? { ...d, uploaded: true, url, status: 'validating' } : d))

    // 2. Validation IA
    try {
      const valRes = await fetch(`/api/guest/${token}/validate-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_url: url, adult_name: docName, adult_index: index }),
      })
      const valJson = await valRes.json() as {
        valid?: boolean; extraction_status?: string
        message?: string; data?: { full_name?: string }
      }
      const status = (valJson.extraction_status ?? (valJson.valid ? 'verified' : 'invalid')) as DocValidationStatus
      setAdults(prev => prev.map((d, i) => i === index ? {
        ...d,
        status,
        extractedName: valJson.data?.full_name ?? null,
        errorMessage: valJson.valid ? null : (valJson.message ?? 'Erreur de validation'),
      } : d))
    } catch {
      // En cas d'erreur réseau, accepter le document (vérification manuelle)
      setAdults(prev => prev.map((d, i) => i === index ? { ...d, status: 'manual_review' } : d))
    }
  }

  const retakePhoto = (index: number) => {
    setAdults(prev => prev.map((d, i) => i === index ? { ...d, status: 'idle', uploaded: false, url: '', errorMessage: null } : d))
    setTimeout(() => fileRefs.current[index]?.click(), 50)
  }

  const saveStep2 = async () => {
    await fetch(`/api/guest/${token}/update-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 2 }),
    })
    setStep(3)
  }

  const saveStep3 = async () => {
    await fetch(`/api/guest/${token}/update-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 3 }),
    })
    setStep(4)
  }

  const requestExtra = async (upsell: WizardUpsell) => {
    setRequesting(p => ({ ...p, [upsell.id]: true }))
    await fetch(`/api/guest/${token}/extras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_id: upsell.id, name: upsell.name, quantity: 1 }),
    })
    setRequested(p => ({ ...p, [upsell.id]: true }))
    setRequesting(p => ({ ...p, [upsell.id]: false }))
  }

  const complete = async () => {
    setFinishing(true)
    try {
      await fetch(`/api/guest/${token}/complete`, { method: 'POST' })
      setDone(true)
    } finally {
      setFinishing(false)
    }
  }

  // ── Conditions CTA ────────────────────────────────────────────────────────────

  const canStep1 = fullName.trim().length > 1
  const allDocsValidated = adults.every(d => ['verified', 'manual_review'].includes(d.status))
  const anyDocUploaded   = adults.some(d => d.uploaded)
  const canStep2         = allDocsValidated
  const canStep3         = contractSigned

  // ── Sous-composants ───────────────────────────────────────────────────────────

  const STEP_LABELS = [t.step1Label, t.step2Label, t.step3Label, t.step4Label]

  function ProgressBar() {
    return (
      <div className="px-5 pb-4 pt-2">
        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full transition-all"
              style={{ background: s <= step ? '#C4A044' : '#E8E4DC' }} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold" style={{ color: '#C4A044' }}>
            {t.step} {step} {t.of} 4 — {STEP_LABELS[step - 1]}
          </p>
          <p className="text-xs" style={{ color: '#999999' }}>{Math.round((step / 4) * 100)}%</p>
        </div>
      </div>
    )
  }

  // ── Step 1 ───────────────────────────────────────────────────────────────────
  function Step1() {
    const fields = [
      { label: t.fullName,    value: fullName,    set: setFullName,    placeholder: 'Ahmed El Mansouri' },
      { label: t.email,       value: email,       set: setEmail,       type: 'email',  placeholder: 'votre@email.com' },
      { label: t.phone,       value: phone,       set: setPhone,       type: 'tel',    placeholder: '+212 6…' },
      { label: t.address,     value: address,     set: setAddress,     placeholder: '12 rue des Fleurs' },
      { label: t.city,        value: city,        set: setCity,        placeholder: 'Marrakech' },
      { label: t.country,     value: countryRes,  set: setCountryRes,  placeholder: 'Maroc' },
    ]
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(196,160,68,0.07)', border: '1px solid rgba(196,160,68,0.2)' }}>
          <p className="text-base font-semibold mb-1" style={{ color: '#1A1A1A', fontFamily: 'var(--font-heading, serif)' }}>
            {t.welcome} {guest?.full_name?.split(' ')[0] ?? ''}
          </p>
          <p className="text-xs" style={{ color: '#666666' }}>{t.welcomeSub}</p>
          {(reservation.check_in || reservation.check_out) && (
            <p className="text-xs mt-2 font-medium" style={{ color: '#C4A044' }}>
              {property?.name} · {fmtDate(reservation.check_in, lang)} → {fmtDate(reservation.check_out, lang)}
            </p>
          )}
        </div>
        {fields.map(f => (
          <div key={f.label}>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: '#666666' }}>{f.label}</label>
            <input type={(f as { type?: string }).type ?? 'text'} value={f.value}
              onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FFFFFF' }} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: '#666666' }}>{t.arrivalTime}</label>
            <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FFFFFF' }} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: '#666666' }}>{t.nbAdults}</label>
            <select value={nbAdults} onChange={e => setNbAdults(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FFFFFF' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2 — Documents avec état indépendant par adulte ───────────────────────
  function Step2() {
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-3" style={{ background: '#FFF8E7', border: '1px solid rgba(196,160,68,0.25)' }}>
          <p className="font-semibold text-xs mb-1" style={{ color: '#C4A044' }}>⚠️ {t.idTitle}</p>
          <p className="text-xs" style={{ color: '#666666' }}>{t.idSubtitle}</p>
        </div>

        {adults.map((adult, i) => (
          <div key={i} className="rounded-xl p-4 space-y-3" style={{ border: '1px solid #E8E4DC', background: '#FFFFFF' }}>
            <p className="text-xs font-semibold" style={{ color: '#999999' }}>
              {t.adult} {i + 1}
            </p>

            {/* Nom */}
            <input
              type="text"
              value={adult.name}
              onChange={e => setAdults(prev => prev.map((d, j) => j === i ? { ...d, name: e.target.value } : d))}
              placeholder={`${t.fullName}…`}
              disabled={adult.status === 'uploading' || adult.status === 'validating'}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FAFAFA' }}
            />

            {/* Type de document */}
            <select
              value={adult.docType}
              onChange={e => setAdults(prev => prev.map((d, j) => j === i ? { ...d, docType: e.target.value } : d))}
              disabled={adult.status === 'uploading' || adult.status === 'validating'}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FFFFFF' }}
            >
              <option value="passeport">{t.passport}</option>
              <option value="cni">{t.cni}</option>
              <option value="carte_sejour">{t.residence}</option>
            </select>

            {/* Zone statut upload/validation */}
            {adult.status === 'uploading' && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#C4A044' }}>
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#C4A044', borderTopColor: 'transparent' }} />
                {t.uploading}
              </div>
            )}

            {adult.status === 'validating' && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#666666' }}>
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#666666', borderTopColor: 'transparent' }} />
                {t.validating}
              </div>
            )}

            {adult.status === 'verified' && (
              <div className="rounded-lg px-3 py-2" style={{ background: '#E8F5E9', border: '1px solid #B8E6B8' }}>
                <p className="text-xs font-semibold" style={{ color: '#2E7D32' }}>
                  {t.docValid}{adult.extractedName ? ` — ${adult.extractedName}` : ''}
                </p>
              </div>
            )}

            {adult.status === 'manual_review' && (
              <div className="rounded-lg px-3 py-2" style={{ background: '#E8F5E9', border: '1px solid #B8E6B8' }}>
                <p className="text-xs font-semibold" style={{ color: '#2E7D32' }}>✓ {t.docReceived}</p>
              </div>
            )}

            {(['invalid', 'expired', 'poor_quality'] as DocValidationStatus[]).includes(adult.status) && (
              <div className="rounded-lg px-3 py-2 space-y-2" style={{ background: '#FFEBEE', border: '1px solid #FFCDD2' }}>
                <p className="text-xs font-medium" style={{ color: '#C62828' }}>
                  ❌ {adult.errorMessage ?? 'Document invalide'}
                </p>
                <button
                  onClick={() => retakePhoto(i)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: '#C62828', color: '#fff' }}
                >
                  {t.retakePhoto}
                </button>
              </div>
            )}

            {/* Input file caché */}
            <input
              ref={el => { fileRefs.current[i] = el }}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadAndValidate(i, file)
                // Reset input pour permettre re-upload du même fichier
                e.target.value = ''
              }}
            />

            {/* Bouton upload (visible seulement si pas encore uploadé ou en état idle) */}
            {adult.status === 'idle' && (
              <button
                onClick={() => fileRefs.current[i]?.click()}
                className="w-full py-2.5 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(196,160,68,0.1)', color: '#A88830', border: '1px solid rgba(196,160,68,0.3)' }}
              >
                {t.uploadPhoto}
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ── Step 3 ───────────────────────────────────────────────────────────────────
  function Step3() {
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-3" style={{ background: '#F8F7F5', border: '1px solid #E8E4DC' }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: '#1A1A1A' }}>{t.contractTitle}</p>
          <p className="text-xs" style={{ color: '#666666' }}>{t.contractSub}</p>
        </div>
        {contractSigned && (
          <div className="flex items-center gap-2 text-sm font-medium px-2" style={{ color: '#2E7D52' }}>
            <span>✓</span> {t.contractSigned}
          </div>
        )}
        <ContractTab token={token} lang={lang} onSigned={() => setContractSigned(true)} />
      </div>
    )
  }

  // ── Step 4 ───────────────────────────────────────────────────────────────────
  function Step4() {
    const byCategory = upsells.reduce<Record<string, WizardUpsell[]>>((acc, u) => {
      const cat = u.category ?? 'Confort'
      ;(acc[cat] ??= []).push(u)
      return acc
    }, {})
    return (
      <div className="space-y-5">
        <div>
          <p className="text-base font-semibold" style={{ color: '#1A1A1A', fontFamily: 'var(--font-heading, serif)' }}>{t.extrasTitle}</p>
          <p className="text-xs mt-0.5" style={{ color: '#666666' }}>{t.extrasSub}</p>
        </div>
        {upsells.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#999999' }}>Aucun service disponible</p>
        ) : Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#999999' }}>
              {UPSELL_CATEGORY_ICONS[cat] ?? '✨'} {cat}
            </p>
            <div className="space-y-2">
              {items.map(u => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl p-3"
                  style={{ border: '1px solid #E8E4DC', background: '#FFFFFF' }}>
                  <span className="text-xl flex-shrink-0">{u.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{u.name}</p>
                    {u.description && <p className="text-xs truncate" style={{ color: '#999999' }}>{u.description}</p>}
                    {u.price > 0 && <p className="text-xs font-semibold mt-0.5" style={{ color: '#C4A044' }}>{u.price} {u.currency}</p>}
                  </div>
                  <button
                    onClick={() => !requested[u.id] && requestExtra(u)}
                    disabled={!!requested[u.id] || !!requesting[u.id]}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={{
                      background: requested[u.id] ? '#E8F5E9' : 'rgba(196,160,68,0.1)',
                      color: requested[u.id] ? '#2E7D52' : '#A88830',
                      border: `1px solid ${requested[u.id] ? '#B8E6B8' : 'rgba(196,160,68,0.3)'}`,
                    }}>
                    {requesting[u.id] ? t.requesting : requested[u.id] ? t.requested : t.request}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Bouton CTA bas de page ────────────────────────────────────────────────────
  function CtaButton() {
    if (step === 1) return (
      <button onClick={saveStep1} disabled={!canStep1 || savingInfo}
        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
        style={{ background: canStep1 ? '#C4A044' : '#E8E4DC', color: canStep1 ? '#fff' : '#999999' }}>
        {savingInfo ? t.saving : t.continue}
      </button>
    )
    if (step === 2) return (
      <div className="space-y-2">
        <button onClick={saveStep2} disabled={!canStep2}
          className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: canStep2 ? '#C4A044' : '#E8E4DC', color: canStep2 ? '#fff' : '#999999' }}>
          {t.continue}
        </button>
        {!canStep2 && anyDocUploaded && (
          <p className="text-xs text-center" style={{ color: '#999999' }}>{t.allDocsRequired}</p>
        )}
        {!anyDocUploaded && (
          <button onClick={saveStep2} className="w-full py-2 text-xs" style={{ color: '#999999' }}>
            {t.skip}
          </button>
        )}
      </div>
    )
    if (step === 3) return (
      <button onClick={saveStep3} disabled={!canStep3}
        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
        style={{ background: canStep3 ? '#C4A044' : '#E8E4DC', color: canStep3 ? '#fff' : '#999999' }}>
        {t.continue}
      </button>
    )
    return (
      <button onClick={complete} disabled={finishing}
        className="w-full py-3.5 rounded-xl text-sm font-semibold"
        style={{ background: '#C4A044', color: '#FFFFFF' }}>
        {finishing ? t.finishing : t.finish}
      </button>
    )
  }

  // ── Écran completion ──────────────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#F8F7F5' }}>
      <Image src="/logo-alma-keys.png" alt="Alma Keys" width={120} height={36} className="h-9 w-auto mb-8" />
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 text-3xl"
        style={{ background: 'rgba(46,125,82,0.1)' }}>✓</div>
      <h1 className="text-2xl font-light mb-3" style={{ color: '#1A1A1A', fontFamily: 'var(--font-heading, serif)' }}>
        {t.doneTitle}
      </h1>
      <p className="text-sm max-w-xs mb-8" style={{ color: '#666666' }}>{t.doneSub}</p>
      <button onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-xl text-sm font-semibold"
        style={{ background: '#C4A044', color: '#FFFFFF' }}>
        {t.doneGuide}
      </button>
    </div>
  )

  // ── Layout principal ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F7F5' }}>
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: '1px solid #E8E4DC' }}>
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
          <Image src="/logo-alma-keys.png" alt="Alma Keys" width={100} height={30} className="h-8 w-auto" />
          <div className="flex gap-1">
            {(['fr', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className="text-xs px-2 py-1 rounded-md font-medium"
                style={{
                  background: lang === l ? '#C4A044' : 'transparent',
                  color: lang === l ? '#fff' : '#999999',
                  border: `1px solid ${lang === l ? '#C4A044' : '#E8E4DC'}`,
                }}>
                {l === 'fr' ? '🇫🇷' : '🇬🇧'} {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="max-w-lg mx-auto">
          <ProgressBar />
        </div>
      </header>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 py-6 pb-32">
          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
          {step === 3 && <Step3 />}
          {step === 4 && <Step4 />}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-4"
        style={{ background: '#F8F7F5', borderTop: '1px solid #E8E4DC' }}>
        <div className="max-w-lg mx-auto">
          <CtaButton />
        </div>
      </div>
    </div>
  )
}
