'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  KeyRound, Wifi, Building2, BookOpen, MapPin,
  AlertTriangle, HelpCircle, Check, Loader2, Plus, Trash2,
  ChevronLeft, ExternalLink, Sofa, Sparkles, DollarSign, Globe,
} from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FaqItem { question: string; answer: string }

export interface ConditionalEquipment {
  id: string
  property_id: string
  equipment_name: string
  instructions: string | null
  condition_type: 'always' | 'min_guests' | 'on_request'
  condition_value: number | null
  is_active: boolean
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Property = Record<string, any>

interface PropertyFormClientProps {
  property: Property
  initialConditionalInfo: ConditionalEquipment[]
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const SOFA_THRESHOLD_OPTIONS = [
  { label: 'Toujours',                value: 0  },
  { label: 'À partir de 2 voyageurs', value: 2  },
  { label: 'À partir de 3 voyageurs', value: 3  },
  { label: 'À partir de 4 voyageurs', value: 4  },
  { label: 'Sur demande uniquement',  value: 99 },
]

const CONDITION_LABELS: Record<string, string> = {
  always:     'Toujours',
  min_guests: 'Si nb voyageurs ≥',
  on_request: 'Sur demande',
}

const EQUIPMENT_SUGGESTIONS = [
  'Lit bébé / lit parapluie',
  'Chaise haute',
  'Barbecue',
  'Table de ping-pong',
  'Vélos disponibles',
]

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function completionRate(p: Property): number {
  const filled = COMPLETION_FIELDS.filter((f) => p[f] !== null && p[f] !== undefined && p[f] !== '').length
  return Math.round((filled / COMPLETION_FIELDS.length) * 100)
}

// ---------------------------------------------------------------------------
// Hook autosave
// ---------------------------------------------------------------------------

function useAutosave(propertyId: string) {
  const [saving, setSaving] = useState<string | null>(null)
  const [saved,  setSaved]  = useState<string | null>(null)
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
// UI atoms
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
  saved:  string | null
  onBlur:   (field: string, value: string | number) => void
  onChange: (field: string, value: string) => void
}

function Field({ label, field, value, type = 'text', placeholder, rows = 3, saving, saved, onBlur, onChange }: FieldProps) {
  const isReadonly = type === 'readonly'
  const isSaving   = saving === field
  const isSaved    = saved  === field

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {isSaved  && <span className="text-xs text-green-600 flex items-center gap-0.5"><Check className="h-3 w-3" /> Sauvegardé</span>}
      </div>
      {isReadonly ? (
        <p className="text-sm px-3 py-2 rounded-md border bg-muted text-muted-foreground">{value ?? '—'}</p>
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

export function PropertyFormClient({ property: initialProperty, initialConditionalInfo }: PropertyFormClientProps) {
  const [property, setProperty] = useState<Property>(initialProperty)
  const [faq, setFaq] = useState<FaqItem[]>(
    Array.isArray(initialProperty.custom_faq) ? initialProperty.custom_faq : []
  )
  const [conditionalInfo, setConditionalInfo] = useState<ConditionalEquipment[]>(initialConditionalInfo)
  const [addingEquipment, setAddingEquipment] = useState(false)
  const [newEquipment, setNewEquipment] = useState({
    equipment_name: '',
    instructions:   '',
    condition_type:  'always' as ConditionalEquipment['condition_type'],
    condition_value: null as number | null,
  })

  const [tuyaTestResult, setTuyaTestResult] = useState<string | null>(null)
  const [nukiTestResult, setNukiTestResult] = useState<string | null>(null)
  const [testingTuya, setTestingTuya] = useState(false)
  const [testingNuki, setTestingNuki] = useState(false)

  const { saving, saved, save } = useAutosave(property.id)

  const rate = completionRate(property)
  const badgeCls     = rate >= 80 ? 'bg-green-600 text-white' : rate >= 40 ? 'bg-amber-500 text-white' : ''
  const badgeVariant = rate >= 80 ? 'default' as const      : rate >= 40 ? 'secondary' as const      : 'destructive' as const

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
    setTestingTuya(true); setTuyaTestResult(null)
    try {
      const res  = await fetch(`/api/tuya/test?device_id=${encodeURIComponent(deviceId)}`)
      const data = await res.json()
      if (data.test_mode)   setTuyaTestResult(`⚠️ ${data.message}`)
      else if (data.online) setTuyaTestResult(`✅ En ligne — ${data.device_name}${data.battery !== undefined ? ` · Batterie ${data.battery}%` : ''}`)
      else                  setTuyaTestResult(`❌ Hors ligne — ${data.device_name}`)
    } catch { setTuyaTestResult('❌ Erreur de connexion') }
    setTestingTuya(false)
  }

  // ── Nuki test ──────────────────────────────────────────────────────────────
  async function testNuki() {
    const smartlockId = property.nuki_smartlock_id
    if (!smartlockId) { setNukiTestResult('❌ Aucun Smartlock ID renseigné'); return }
    setTestingNuki(true); setNukiTestResult(null)
    try {
      const res  = await fetch(`/api/nuki/test?smartlock_id=${encodeURIComponent(smartlockId)}`)
      const data = await res.json()
      if (data.test_mode)   setNukiTestResult(`⚠️ ${data.message}`)
      else if (data.online) setNukiTestResult(`✅ En ligne — ${data.lock_state}${data.battery_critical ? ' · ⚠️ Batterie faible' : ''}`)
      else                  setNukiTestResult(`❌ Hors ligne`)
    } catch { setNukiTestResult('❌ Erreur de connexion') }
    setTestingNuki(false)
  }

  // ── FAQ ────────────────────────────────────────────────────────────────────
  async function saveFaq(newFaq: FaqItem[]) {
    const supabase = createClient()
    await supabase.from('properties').update({ custom_faq: newFaq }).eq('id', property.id)
  }
  function addFaq() { setFaq((f) => [...f, { question: '', answer: '' }]) }
  function removeFaq(idx: number) {
    const nf = faq.filter((_, i) => i !== idx); setFaq(nf); saveFaq(nf)
  }
  function updateFaq(idx: number, key: 'question' | 'answer', value: string) {
    setFaq((f) => f.map((item, i) => i === idx ? { ...item, [key]: value } : item))
  }
  function blurFaq() { saveFaq(faq); setProperty((prev) => ({ ...prev, custom_faq: faq })) }

  // ── Canapé lit toggle ──────────────────────────────────────────────────────
  async function toggleSofaBed() {
    const newVal = !property.sofa_bed_exists
    const supabase = createClient()
    await supabase.from('properties').update({ sofa_bed_exists: newVal }).eq('id', property.id)
    setProperty((prev) => ({ ...prev, sofa_bed_exists: newVal }))
  }

  // ── Équipements conditionnels ──────────────────────────────────────────────
  async function toggleEquipment(id: string, is_active: boolean) {
    const supabase = createClient()
    await supabase.from('property_conditional_info').update({ is_active }).eq('id', id)
    setConditionalInfo((prev) => prev.map((e) => e.id === id ? { ...e, is_active } : e))
  }

  async function deleteEquipment(id: string) {
    const supabase = createClient()
    await supabase.from('property_conditional_info').delete().eq('id', id)
    setConditionalInfo((prev) => prev.filter((e) => e.id !== id))
  }

  async function saveNewEquipment() {
    if (!newEquipment.equipment_name.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('property_conditional_info')
      .insert({
        property_id:     property.id,
        equipment_name:  newEquipment.equipment_name.trim(),
        instructions:    newEquipment.instructions || null,
        condition_type:  newEquipment.condition_type,
        condition_value: newEquipment.condition_type === 'min_guests' ? (newEquipment.condition_value ?? 2) : null,
        is_active:       true,
      })
      .select()
      .single()
    if (!error && data) {
      setConditionalInfo((prev) => [...prev, data as ConditionalEquipment])
      setNewEquipment({ equipment_name: '', instructions: '', condition_type: 'always', condition_value: null })
      setAddingEquipment(false)
    }
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
            <Field label="Heure check-in"  field="check_in_time"  value={property.check_in_time}  type="time" placeholder="15:00" {...fieldProps} />
            <Field label="Heure check-out" field="check_out_time" value={property.check_out_time} type="time" placeholder="11:00" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Nombre max de voyageurs" field="max_guests" value={property.max_guests} type="number" placeholder="4" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Type d'accès" field="access_type" value={property.access_type} type="readonly" {...fieldProps} />
          </div>
          <div className="mb-2">
            <Field label="ID Serrure Tuya / SmartLife (device_id)" field="tuya_device_id" value={property.tuya_device_id} placeholder="bfXXXXXXXXX" {...fieldProps} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={testTuya} disabled={testingTuya}>
              {testingTuya ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
              Tester Tuya
            </Button>
            {tuyaTestResult && <span className="text-xs">{tuyaTestResult}</span>}
          </div>
          <div className="mb-2">
            <Field label="ID Serrure Nuki (smartlock_id)" field="nuki_smartlock_id" value={property.nuki_smartlock_id} placeholder="12345678" {...fieldProps} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={testNuki} disabled={testingNuki}>
              {testingNuki ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
              Tester Nuki
            </Button>
            {nukiTestResult && <span className="text-xs">{nukiTestResult}</span>}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Code boîte à clés"       field="key_box_code"     value={property.key_box_code}     placeholder="1234"                      {...fieldProps} />
            <Field label="Emplacement boîte à clés" field="key_box_location" value={property.key_box_location} placeholder="Sous la boîte aux lettres" {...fieldProps} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Marque / modèle serrure" field="lock_brand_model" value={property.lock_brand_model} placeholder="Nuki Smart Lock 3.0" {...fieldProps} />
            <Field label="Lien app serrure"         field="lock_app_url"    value={property.lock_app_url}    placeholder="https://web.nuki.io"       {...fieldProps} />
          </div>
          <Field label="Instructions d'entrée complètes" field="access_instructions_full" value={property.access_instructions_full} type="textarea" rows={5} placeholder="Ex: Le logement se trouve au 2ème étage…" {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 2 — WiFi & équipements                                     */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={Wifi} title="WiFi & équipements" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Nom WiFi"          field="wifi_name" value={property.wifi_name} placeholder="MonWiFi_5G"    {...fieldProps} />
            <Field label="Mot de passe WiFi" field="wifi_pass" value={property.wifi_pass} placeholder="motdepasse123" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Équipements & appareils" field="appliances_info" value={property.appliances_info} type="textarea" rows={4} placeholder="Lave-linge (programme coton 40°)…&#10;TV : télécommande sur la table basse…" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Chauffage" field="heating_info" value={property.heating_info} type="textarea" rows={3} placeholder="Radiateurs électriques. Thermostat dans le couloir, régler à 21°C." {...fieldProps} />
          </div>
          <Field label="Produits ménagers (emplacement)" field="cleaning_products_location" value={property.cleaning_products_location} placeholder="Sous l'évier de la cuisine" {...fieldProps} />
          <div className="mt-4 flex items-center justify-between p-3 rounded-lg border">
            <span className="text-sm font-medium">Lave-vaisselle disponible</span>
            <button
              onClick={() => { const v = !property.dishwasher_available; save('dishwasher_available', v); setProperty((p) => ({ ...p, dishwasher_available: v })) }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${property.dishwasher_available ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${property.dishwasher_available ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="mt-4">
            <Field label="Four / micro-ondes (instructions)" field="oven_microwave_info" value={property.oven_microwave_info} type="textarea" rows={2} placeholder="Four : préchauffer à 180°C. Micro-ondes : bouton rond à droite." {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="TV (instructions)" field="tv_instructions" value={property.tv_instructions} type="textarea" rows={2} placeholder="Télé LG 55'. Bouton ON télécommande noire. Netflix : profil 'Voyageurs'." {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Climatisation (instructions)" field="ac_instructions" value={property.ac_instructions} type="textarea" rows={2} placeholder="Clim Daikin. Télécommande dans le tiroir. Ne pas descendre en dessous de 19°C." {...fieldProps} />
          </div>
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 3 — Immeuble & stationnement                               */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={Building2} title="Immeuble & stationnement" />
          <div className="mb-4">
            <Field label="Parking" field="parking_info" value={property.parking_info} type="textarea" rows={3} placeholder="Parking gratuit en rue." {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Ascenseur"           field="elevator_info" value={property.elevator_info} placeholder="Oui, code 1234"           {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Étage & accès immeuble" field="floor_info" value={property.floor_info} placeholder="2ème étage, porte B"      {...fieldProps} />
          </div>
          <Field label="Local poubelles" field="trash_info" value={property.trash_info} type="textarea" rows={3} placeholder="Rez-de-chaussée. Collecte lundi et jeudi." {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 4 — Règles de la maison                                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={BookOpen} title="Règles de la maison" />
          <div className="mb-4">
            <Field label="Règles bruit"   field="noise_rules"   value={property.noise_rules}   type="textarea" rows={2} placeholder="Silence obligatoire après 22h." {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Règles fumée"   field="smoking_rules" value={property.smoking_rules} placeholder="Non-fumeur."      {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Règles animaux" field="pet_rules"     value={property.pet_rules}     placeholder="Animaux non acceptés." {...fieldProps} />
          </div>
          <Field label="Règlement intérieur complet" field="house_rules" value={property.house_rules} type="textarea" rows={5} placeholder="1. Respecter le voisinage…" {...fieldProps} />
          <div className="mt-4">
            <Field label="Fêtes autorisées" field="parties_allowed" value={property.parties_allowed} placeholder="Non autorisées / Sur demande / Oui (max 10 personnes)" {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Heure de silence copropriété" field="silence_hour" value={property.silence_hour} placeholder="22h00" {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Règles spécifiques (piscine, terrasse, BBQ…)" field="specific_rules" value={property.specific_rules} type="textarea" rows={3} placeholder="Piscine ouverte 9h-21h. BBQ autorisé sur la terrasse. Nettoyer après usage." {...fieldProps} />
          </div>
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 5 — Quartier & proximité                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={MapPin} title="Quartier & proximité" />
          <Field label="Commerces, restaurants, transports, activités" field="nearby_info" value={property.nearby_info} type="textarea" rows={6} placeholder="🛒 Carrefour à 200m&#10;🍽 Le Bistrot (rue Victor Hugo)&#10;🚇 Ligne 2, station République à 5 min" {...fieldProps} />
          <div className="mt-4">
            <Field label="Boulangerie proche" field="bakery_nearby" value={property.bakery_nearby} placeholder="Boulangerie Paul, rue de la Paix, ouverte 7h-19h" {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Événements locaux récurrents" field="local_events" value={property.local_events} type="textarea" rows={2} placeholder="Marché dominical place du Général. Festival jazz en juillet." {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Mosquées / horaires de prière proches" field="prayer_times_nearby" value={property.prayer_times_nearby} placeholder="Mosquée Al-Nour à 300m, prière du vendredi 13h30" {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Lien livret d'accueil digital" field="digital_welcome_book_url" value={property.digital_welcome_book_url} placeholder="https://..." {...fieldProps} />
          </div>
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 6 — Urgences & contacts                                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={AlertTriangle} title="Urgences & contacts" />
          <div className="mb-4">
            <Field label="Procédure d'urgence" field="emergency_procedure" value={property.emergency_procedure} type="textarea" rows={4} placeholder="Coupure électrique : disjoncteur dans l'entrée.&#10;Fuite d'eau : robinet sous l'évier." {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Contact propriétaire"   field="owner_contact"      value={property.owner_contact}      placeholder="+33 6 12 34 56 78 — Morad"  {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Contacts d'urgence locaux" field="emergency_contacts" value={property.emergency_contacts} type="textarea" rows={3} placeholder="Plombier : Jean Dupont +33 6 XX" {...fieldProps} />
          </div>
          <Field label="Inventaire & état du logement" field="inventory_notes" value={property.inventory_notes} type="textarea" rows={4} placeholder="2 clés remises. Légère rayure sur le canapé (antérieure)." {...fieldProps} />
          <div className="mt-4">
            <Field label="Téléphone concierge / responsable" field="concierge_phone" value={property.concierge_phone} placeholder="+33 6 12 34 56 78" {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Téléphone de secours" field="backup_phone" value={property.backup_phone} placeholder="+33 6 XX XX XX XX" {...fieldProps} />
          </div>
          <div className="mt-4">
            <Field label="Police locale (numéro)" field="local_police_number" value={property.local_police_number} placeholder="17 (France) / 19 (Maroc)" {...fieldProps} />
          </div>
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 7 — Ménage                                                  */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={Sparkles} title="Ménage" />
          <div className="mb-4">
            <Field label="Prestataire ménage (nom + tél)" field="cleaning_provider_contact" value={property.cleaning_provider_contact} placeholder="Marie Dupont — +33 6 XX XX XX XX" {...fieldProps} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Tarif ménage (€)"          field="cleaning_cost"             value={property.cleaning_cost}             type="number" placeholder="60"  {...fieldProps} />
            <Field label="Durée moyenne (heures)"    field="cleaning_duration_hours"   value={property.cleaning_duration_hours}   type="number" placeholder="2.5" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Kit linge standard" field="linen_kit_standard" value={property.linen_kit_standard} placeholder="2 jeux de draps, 4 serviettes, 2 serviettes de bain, 1 tapis de bain" {...fieldProps} />
          </div>
          <Field label="Consignes spécifiques ménage" field="cleaning_specific_instructions" value={property.cleaning_specific_instructions} type="textarea" rows={4} placeholder="Ne pas utiliser de Javel sur le parquet. Vider le filtre du lave-linge à chaque passage." {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 8 — Tarifs & Administratif                                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={DollarSign} title="Tarifs & Administratif" />
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Devise</label>
            <select
              className="w-40 text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue={property.currency ?? 'EUR'}
              onBlur={(e) => save('currency', e.target.value)}
            >
              <option value="EUR">EUR — Euro (€)</option>
              <option value="MAD">MAD — Dirham marocain (DH)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Tarif nuit basse saison"  field="price_low_season"  value={property.price_low_season}  type="number" placeholder="80"  {...fieldProps} />
            <Field label="Tarif nuit haute saison"  field="price_high_season" value={property.price_high_season} type="number" placeholder="150" {...fieldProps} />
          </div>
          <div className="mb-4">
            <Field label="Caution / dépôt de garantie" field="deposit_amount" value={property.deposit_amount} type="number" placeholder="300" {...fieldProps} />
          </div>
          <Field label="Lien réservation directe" field="direct_booking_url" value={property.direct_booking_url} placeholder="https://..." {...fieldProps} />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 9 — FAQ personnalisée                                       */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={HelpCircle} title="FAQ personnalisée" />
          <p className="text-xs text-muted-foreground mb-4">
            Ces Q/R sont injectées dans le prompt IA pour que l&apos;assistant réponde automatiquement aux voyageurs.
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
                      placeholder="Réponse (ex: Bouton gauche, programme Coton 40°…)"
                      value={item.answer}
                      onChange={(e) => updateFaq(idx, 'answer', e.target.value)}
                      onBlur={blurFaq}
                    />
                  </div>
                  <button onClick={() => removeFaq(idx)} className="mt-1 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addFaq} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Ajouter une question
          </Button>
          {faq.length === 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">Exemples :</p>
              {['Comment fonctionne la machine à laver ?', 'Où sont les serviettes ?', 'Y a-t-il un sèche-cheveux ?'].map((q) => (
                <button key={q} onClick={() => setFaq((f) => [...f, { question: q, answer: '' }])}
                  className="block text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                  + {q}
                </button>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 10 — Langue & Culture                                       */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={Globe} title="Langue & Culture" />
          <p className="text-xs text-muted-foreground mb-4">
            Paramètres culturels injectés dans le prompt IA pour adapter le ton, la langue et les règles spécifiques.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Langue principale des voyageurs</label>
              <select
                className="w-full text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={property.language_primary ?? 'fr'}
                onBlur={(e) => save('language_primary', e.target.value)}
              >
                <option value="fr">Français</option>
                <option value="en">Anglais</option>
                <option value="ar">Arabe</option>
                <option value="es">Espagnol</option>
                <option value="de">Allemand</option>
                <option value="it">Italien</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Langue secondaire</label>
              <select
                className="w-full text-sm rounded-md border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={property.language_secondary ?? ''}
                onBlur={(e) => save('language_secondary', e.target.value || null)}
              >
                <option value="">Aucune</option>
                <option value="fr">Français</option>
                <option value="en">Anglais</option>
                <option value="ar">Arabe</option>
                <option value="es">Espagnol</option>
                <option value="de">Allemand</option>
                <option value="it">Italien</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Alcool autorisé dans le logement</label>
            <div className="flex gap-4">
              {[{ label: 'Oui', value: true }, { label: 'Non', value: false }].map(({ label, value }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name={`alcohol_allowed_${property.id}`}
                    defaultChecked={(property.alcohol_allowed ?? true) === value}
                    onChange={() => save('alcohol_allowed', value)}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Field
            label="Règles spécifiques Ramadan"
            field="ramadan_rules"
            value={property.ramadan_rules}
            type="textarea"
            rows={3}
            placeholder="Pas de musique après 22h. Cuisine halal. Respect de l'iftar (rupture du jeûne ~19h30)."
            {...fieldProps}
          />
        </section>

        <Separator />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* SECTION 11 — Équipements conditionnels                              */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section>
          <SectionTitle icon={Sofa} title="Équipements conditionnels" />
          <p className="text-xs text-muted-foreground mb-4">
            L&apos;IA mentionne ces équipements uniquement selon les conditions définies (nb voyageurs, sur demande, etc.).
          </p>

          {/* ── Canapé lit ─────────────────────────────────────────────────── */}
          <div className="mb-5 p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-sm">Canapé lit</span>
              <button
                onClick={toggleSofaBed}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  property.sofa_bed_exists ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    property.sofa_bed_exists ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {property.sofa_bed_exists && (
              <div className="space-y-3 pt-2 border-t">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Capacité (personnes)" field="sofa_bed_capacity" value={property.sofa_bed_capacity} type="number" placeholder="2" {...fieldProps} />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Seuil d&apos;envoi</label>
                    <select
                      className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      value={property.sofa_bed_min_guests ?? 2}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        save('sofa_bed_min_guests', val)
                        setProperty((prev) => ({ ...prev, sofa_bed_min_guests: val }))
                      }}
                    >
                      {SOFA_THRESHOLD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Field label="Instructions d'utilisation" field="sofa_bed_instructions" value={property.sofa_bed_instructions} type="textarea" rows={3} placeholder="Tirer le tiroir sous le canapé. Le matelas est dans le placard de l'entrée." {...fieldProps} />
              </div>
            )}
          </div>

          {/* ── Équipements additionnels ──────────────────────────────────── */}
          <div className="space-y-2 mb-4">
            {conditionalInfo.map((eq) => (
              <div key={eq.id} className={`p-3 rounded-lg border flex items-start gap-3 transition-opacity ${eq.is_active ? '' : 'opacity-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{eq.equipment_name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {CONDITION_LABELS[eq.condition_type] ?? eq.condition_type}
                      {eq.condition_type === 'min_guests' && eq.condition_value ? ` ${eq.condition_value}` : ''}
                    </Badge>
                  </div>
                  {eq.instructions && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{eq.instructions}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleEquipment(eq.id, !eq.is_active)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${eq.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${eq.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => deleteEquipment(eq.id)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Formulaire ajout ─────────────────────────────────────────── */}
          {addingEquipment ? (
            <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
              <input
                className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                placeholder="Nom de l'équipement (ex: Lit bébé)"
                value={newEquipment.equipment_name}
                onChange={(e) => setNewEquipment((n) => ({ ...n, equipment_name: e.target.value }))}
              />
              <textarea
                className="w-full text-sm rounded-md border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                placeholder="Instructions (optionnel)"
                value={newEquipment.instructions}
                onChange={(e) => setNewEquipment((n) => ({ ...n, instructions: e.target.value }))}
              />
              <div className="flex gap-2">
                <select
                  className="flex-1 text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  value={newEquipment.condition_type}
                  onChange={(e) => {
                    const ct = e.target.value as ConditionalEquipment['condition_type']
                    setNewEquipment((n) => ({ ...n, condition_type: ct, condition_value: ct === 'min_guests' ? 2 : null }))
                  }}
                >
                  <option value="always">Toujours mentionner</option>
                  <option value="min_guests">Si nb voyageurs ≥</option>
                  <option value="on_request">Sur demande uniquement</option>
                </select>
                {newEquipment.condition_type === 'min_guests' && (
                  <input
                    type="number"
                    className="w-20 text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    min={1} max={20}
                    value={newEquipment.condition_value ?? 2}
                    onChange={(e) => setNewEquipment((n) => ({ ...n, condition_value: Number(e.target.value) }))}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveNewEquipment} disabled={!newEquipment.equipment_name.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Ajouter
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingEquipment(false)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={() => setAddingEquipment(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Ajouter un équipement
              </Button>
              {conditionalInfo.length === 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground">Suggestions :</p>
                  {EQUIPMENT_SUGGESTIONS.map((name) => (
                    <button
                      key={name}
                      onClick={() => { setNewEquipment((n) => ({ ...n, equipment_name: name })); setAddingEquipment(true) }}
                      className="block text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
