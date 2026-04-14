'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  KeyRound, Wifi, Building2, BookOpen, MapPin,
  AlertTriangle, HelpCircle, Check, Loader2, Plus, Trash2,
  ChevronLeft, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FaqItem { question: string; answer: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Property = Record<string, any>

interface PropertyFormClientProps {
  property: Property
}

// ---------------------------------------------------------------------------
// Taux de complétion (mêmes champs que la page liste)
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
]

function completionRate(p: Property): number {
  const filled = COMPLETION_FIELDS.filter((f) => p[f] !== null && p[f] !== undefined && p[f] !== '').length
  return Math.round((filled / COMPLETION_FIELDS.length) * 100)
}

// ---------------------------------------------------------------------------
// Hooks autosave
// ---------------------------------------------------------------------------

function useAutosave(propertyId: string) {
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function save(field: string, value: unknown) {
    setSaving(field)
    if (timerRef.current) clearTimeout(timerRef.current)
    const supabase = createClient()
    await supabase.from('properties').update({ [field]: value }).eq('id', propertyId)
    setSaving(null)
    setSaved(field)
    timerRef.current = setTimeout(() => setSaved(null), 2500)
  }

  return { saving, saved, save }
}

// ---------------------------------------------------------------------------
// Sous-composants UI
// ---------------------------------------------------------------------------

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h2>
    </div>
  )
}

interface FieldProps {
  label: string
  field: string
  value: string | number | null | undefined
  type?: 'text' | 'textarea' | 'number' | 'time' | 'readonly'
  placeholder?: string
  rows?: number
  saving: string | null
  saved: string | null
  onBlur: (field: string, value: string | number) => void
  onChange: (field: string, value: string) => void
}

function Field({ label, field, value, type = 'text', placeholder, rows = 3, saving, saved, onBlur, onChange }: FieldProps) {
  const isReadonly = type === 'readonly'
  const isSaving   = saving === field
  const isSaved    = saved === field

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {isSaved  && <span className="text-xs text-green-600 flex items-center gap-0.5"><Check className="h-3 w-3" /> Sauvegardé</span>}
      </div>
      {isReadonly ? (
        <p className="text-sm px-3 py-2 rounded-md border bg-muted text-muted-foreground">
          {value ?? '—'}
        </p>
      ) : type === 'textarea' ? (
        <textarea
          className="w-full text-sm rounded-md border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          rows={rows}
          placeholder={placeholder}
          defaultValue={(value as string) ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          onBlur={(e) => onBlur(field, e.target.value)}
        />
      ) : (
        <input
          className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          type={type}
          placeholder={placeholder}
          defaultValue={(value as string) ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          onBlur={(e) => onBlur(field, type === 'number' ? Number(e.target.value) : e.target.value)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function PropertyFormClient({ property: initialProperty }: PropertyFormClientProps) {
  const [property, setProperty] = useState<Property>(initialProperty)
  const [faq, setFaq] = useState<FaqItem[]>(
    Array.isArray(initialProperty.custom_faq) ? initialProperty.custom_faq : []
  )
  const [tuyaTestResult, setTuyaTestResult] = useState<string | null>(null)
  const [nukiTestResult, setNukiTestResult] = useState<string | null>(null)
  const [testingTuya, setTestingTuya] = useState(false)
  const [testingNuki, setTestingNuki] = useState(false)

  const { saving, saved, save } = useAutosave(property.id)

  const rate = completionRate(property)
  const badgeCls = rate >= 80 ? 'bg-green-600 text-white' : rate >= 40 ? 'bg-amber-500 text-white' : ''
  const badgeVariant = rate >= 80 ? 'default' as const : rate >= 40 ? 'secondary' as const : 'destructive' as const

  function handleChange(field: string, value: string) {
    setProperty((prev) => ({ ...prev, [field]: value }))
  }

  function handleBlur(field: string, value: string | number) {
    save(field, value)
    setProperty((prev) => ({ ...prev, [field]: value }))
  }

  // ── Tuya test ──────────────────────────────────────────────────────────────
  async function testTuya() {
    const deviceId = property.tuya_device_id
    if (!deviceId) { setTuyaTestResult('❌ Aucun Device ID renseigné'); return }
    setTestingTuya(true)
    setTuyaTestResult(null)
    try {
      const res = await fetch(`/api/tuya/test?device_id=${encodeURIComponent(deviceId)}`)
      const data = await res.json()
      if (data.test_mode) setTuyaTestResult(`⚠️ ${data.message}`)
      else if (data.online) setTuyaTestResult(`✅ En ligne — ${data.device_name}${data.battery !== undefined ? ` · Batterie ${data.battery}%` : ''}`)
      else setTuyaTestResult(`❌ Hors ligne — ${data.device_name}`)
    } catch { setTuyaTestResult('❌ Erreur de connexion') }
    setTestingTuya(false)
  }

  // ── Nuki test ──────────────────────────────────────────────────────────────
  async function testNuki() {
    const smartlockId = property.nuki_smartlock_id
    if (!smartlockId) { setNukiTestResult('❌ Aucun Smartlock ID renseigné'); return }
    setTestingNuki(true)
    setNukiTestResult(null)
    try {
      const res = await fetch(`/api/nuki/test?smartlock_id=${encodeURIComponent(smartlockId)}`)
      const data = await res.json()
      if (data.test_mode) setNukiTestResult(`⚠️ ${data.message}`)
      else if (data.online) setNukiTestResult(`✅ En ligne — ${data.lock_state}${data.battery_critical ? ' · ⚠️ Batterie faible' : ''}`)
      else setNukiTestResult(`❌ Hors ligne`)
    } catch { setNukiTestResult('❌ Erreur de connexion') }
    setTestingNuki(false)
  }

  // ── FAQ ────────────────────────────────────────────────────────────────────
  async function saveFaq(newFaq: FaqItem[]) {
    const supabase = createClient()
    await supabase.from('properties').update({ custom_faq: newFaq }).eq('id', property.id)
  }

  function addFaq() {
    const newFaq = [...faq, { question: '', answer: '' }]
    setFaq(newFaq)
  }

  function removeFaq(idx: number) {
    const newFaq = faq.filter((_, i) => i !== idx)
    setFaq(newFaq)
    saveFaq(newFaq)
  }

  function updateFaq(idx: number, key: 'question' | 'answer', value: string) {
    const newFaq = faq.map((item, i) => i === idx ? { ...item, [key]: value } : item)
    setFaq(newFaq)
  }

  function blurFaq() {
    saveFaq(faq)
    setProperty((prev) => ({ ...prev, custom_faq: faq }))
  }

  const fieldProps = { saving, saved, onBlur: handleBlur, onChange: handleChange }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">

        {/* ── En-tête ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link href="/properties">
              <Button variant="ghost" size="sm" className="gap-1 -ml-2">
                <ChevronLeft className="h-4 w-4" /> Logements
              </Button>
            </Link>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{property.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {property.address}{property.city ? `, ${property.city}` : ''}{property.country ? ` · ${property.country}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className={badgeCls} variant={badgeVariant}>Fiche {rate}%</Badge>
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-green-600' : rate >= 40 ? 'bg-amber-500' : 'bg-destructive'}`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 1 — Accès & arrivée                                        */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={KeyRound} title="Accès & arrivée" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Heure check-in" field="check_in_time" value={property.check_in_time} type="time" placeholder="15:00" {...fieldProps} />
            <Field label="Heure check-out" field="check_out_time" value={property.check_out_time} type="time" placeholder="11:00" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Nombre max de voyageurs" field="max_guests" value={property.max_guests} type="number" placeholder="4" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Type d'accès" field="access_type" value={property.access_type} type="readonly" {...fieldProps} />
          </div>

          {/* Tuya */}
          <div className="mb-2">
            <Field label="ID Serrure Tuya / SmartLife (device_id)" field="tuya_device_id" value={property.tuya_device_id} placeholder="bfXXXXXXXXX" {...fieldProps} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={testTuya} disabled={testingTuya}>
              {testingTuya ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
              Tester connexion Tuya
            </Button>
            {tuyaTestResult && <span className="text-xs">{tuyaTestResult}</span>}
          </div>

          {/* Nuki */}
          <div className="mb-2">
            <Field label="ID Serrure Nuki (smartlock_id)" field="nuki_smartlock_id" value={property.nuki_smartlock_id} placeholder="12345678" {...fieldProps} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={testNuki} disabled={testingNuki}>
              {testingNuki ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
              Tester connexion Nuki
            </Button>
            {nukiTestResult && <span className="text-xs">{nukiTestResult}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Code boîte à clés" field="key_box_code" value={property.key_box_code} placeholder="1234" {...fieldProps} />
            <Field label="Emplacement boîte à clés" field="key_box_location" value={property.key_box_location} placeholder="Sous la boîte aux lettres" {...fieldProps} />
          </div>
          <Field label="Instructions d'entrée complètes (envoyées aux voyageurs)" field="access_instructions_full" value={property.access_instructions_full} type="textarea" rows={5} placeholder="Ex: Le logement se trouve au 2ème étage…" {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 2 — WiFi & équipements                                     */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={Wifi} title="WiFi & équipements" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Nom WiFi" field="wifi_name" value={property.wifi_name} placeholder="MonWiFi_5G" {...fieldProps} />
            <Field label="Mot de passe WiFi" field="wifi_pass" value={property.wifi_pass} placeholder="motdepasse123" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Équipements & appareils" field="appliances_info" value={property.appliances_info} type="textarea" rows={4} placeholder="Lave-linge (programme coton 40°) : bouton gauche…&#10;TV : télécommande sur la table basse…" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Chauffage" field="heating_info" value={property.heating_info} type="textarea" rows={3} placeholder="Radiateurs électriques. Thermostat dans le couloir, régler à 21°C." {...fieldProps} />
          </div>
          <Field label="Produits ménagers (emplacement)" field="cleaning_products_location" value={property.cleaning_products_location} placeholder="Sous l'évier de la cuisine" {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 3 — Immeuble & stationnement                               */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={Building2} title="Immeuble & stationnement" />
          <div className="mb-4">
            <Field label="Parking" field="parking_info" value={property.parking_info} type="textarea" rows={3} placeholder="Parking gratuit en rue. Pas de restriction." {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Ascenseur" field="elevator_info" value={property.elevator_info} placeholder="Oui, code 1234 pour déverrouiller" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Étage & accès immeuble" field="floor_info" value={property.floor_info} placeholder="2ème étage, porte B. Interphone : DUPONT" {...fieldProps} />
          </div>
          <Field label="Local poubelles" field="trash_info" value={property.trash_info} type="textarea" rows={3} placeholder="Local poubelles au rez-de-chaussée. Collecte lundi et jeudi. Tri : jaune = plastique, vert = verre." {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 4 — Règles de la maison                                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={BookOpen} title="Règles de la maison" />
          <div className="mb-4">
            <Field label="Règles bruit" field="noise_rules" value={property.noise_rules} type="textarea" rows={2} placeholder="Silence obligatoire après 22h. Pas de musique forte." {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Règles fumée" field="smoking_rules" value={property.smoking_rules} placeholder="Non-fumeur dans le logement et sur le balcon." {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Règles animaux" field="pet_rules" value={property.pet_rules} placeholder="Animaux non acceptés." {...fieldProps} />
          </div>
          <Field label="Règlement intérieur complet" field="house_rules" value={property.house_rules} type="textarea" rows={5} placeholder="1. Respecter le voisinage…" {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 5 — Quartier & proximité                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={MapPin} title="Quartier & proximité" />
          <Field label="Commerces, restaurants, transports, activités" field="nearby_info" value={property.nearby_info} type="textarea" rows={6} placeholder="🛒 Supermarché : Carrefour à 200m (ouvert 8h-22h)&#10;🍽 Restaurant : Le Bistrot (rue Victor Hugo) — excellent couscous&#10;🚇 Métro : Ligne 2, station République à 5 min à pied&#10;🎭 Musée des Beaux-Arts à 10 min" {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 6 — Urgences & contacts                                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={AlertTriangle} title="Urgences & contacts" />
          <div className="mb-4">
            <Field label="Procédure d'urgence" field="emergency_procedure" value={property.emergency_procedure} type="textarea" rows={4} placeholder="Coupure électrique : disjoncteur dans l'entrée (boîte grise).&#10;Fuite d'eau : robinet d'arrêt sous l'évier.&#10;Urgence : appeler le 15 (SAMU) / 17 (Police) / 18 (Pompiers)" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Contact propriétaire" field="owner_contact" value={property.owner_contact} placeholder="+33 6 12 34 56 78 — Morad" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Contacts d'urgence locaux" field="emergency_contacts" value={property.emergency_contacts} type="textarea" rows={3} placeholder="Plombier : Jean Dupont +33 6 XX&#10;Électricien : Paul Martin +33 6 XX" {...fieldProps} />
          </div>
          <Field label="Inventaire & état du logement" field="inventory_notes" value={property.inventory_notes} type="textarea" rows={4} placeholder="2 clés remises. Légère rayure sur le canapé (antérieure). Lave-vaisselle à réparer." {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 7 — FAQ personnalisée                                       */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={HelpCircle} title="FAQ personnalisée" />
          <p className="text-xs text-muted-foreground mb-4">
            Ces questions/réponses sont injectées dans le prompt de l&apos;IA pour qu&apos;elle puisse répondre automatiquement.
          </p>

          <div className="space-y-3 mb-4">
            {faq.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      className="w-full text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                      placeholder="Question (ex: Comment fonctionne la machine à laver ?)"
                      value={item.question}
                      onChange={(e) => updateFaq(idx, 'question', e.target.value)}
                      onBlur={blurFaq}
                    />
                    <textarea
                      className="w-full text-sm rounded-md border bg-background px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={2}
                      placeholder="Réponse (ex: Appuyez sur le bouton gauche, choisir programme Coton 40°…)"
                      value={item.answer}
                      onChange={(e) => updateFaq(idx, 'answer', e.target.value)}
                      onBlur={blurFaq}
                    />
                  </div>
                  <button
                    onClick={() => removeFaq(idx)}
                    className="mt-1 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addFaq} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Ajouter une question
          </Button>

          {faq.length === 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">Exemples à ajouter :</p>
              {[
                'Comment fonctionne la machine à laver ?',
                'Où sont les serviettes ?',
                'Y a-t-il un sèche-cheveux ?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    const newFaq = [...faq, { question: q, answer: '' }]
                    setFaq(newFaq)
                  }}
                  className="block text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  + {q}
                </button>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
