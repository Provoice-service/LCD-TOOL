import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Charger .env.local (tsx ne le fait pas automatiquement)
try {
  readFileSync('.env.local', 'utf-8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '')
  })
} catch { /* fichier absent */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role pour bypasser RLS
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(14, 0, 0, 0)
  return d.toISOString()
}

async function clearPreviousSeed() {
  console.log('🗑  Nettoyage des données de seed précédentes...')
  const { data: owner } = await supabase
    .from('owners')
    .select('id')
    .eq('email', 'morad.chliyah@gmail.com')
    .maybeSingle()

  if (!owner) return

  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', owner.id)

  if (properties?.length) {
    const propIds = properties.map((p) => p.id)
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id')
      .in('property_id', propIds)

    if (reservations?.length) {
      const resIds = reservations.map((r) => r.id)
      await supabase.from('messages').delete().in('reservation_id', resIds)
      await supabase.from('cleaning_tasks').delete().in('reservation_id', resIds)
      await supabase.from('reservations').delete().in('id', resIds)
    }
    await supabase.from('properties').delete().in('id', propIds)
  }

  await supabase
    .from('guests')
    .delete()
    .in('email', ['karim.benali@test.com', 'sophie.martin@test.com'])

  await supabase.from('owners').delete().eq('id', owner.id)
  console.log('✓ Nettoyage terminé')
}

// ---------------------------------------------------------------------------
// Seed principal
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\n🌱 Démarrage du seed LCD Tool...\n')

  await clearPreviousSeed()

  // ── 1. Owner ───────────────────────────────────────────────────────────────
  console.log('📋 Création du propriétaire...')
  const { data: owner, error: ownerErr } = await supabase
    .from('owners')
    .insert({
      full_name: 'Morad Chliyah',
      email: 'morad.chliyah@gmail.com',
      type: 'self',
      commission_rate: 0,
      billing_day: 1,
    })
    .select('id')
    .single()

  if (ownerErr || !owner) throw new Error(`Owner: ${ownerErr?.message}`)
  console.log(`  ✓ Owner créé : ${owner.id}`)

  // ── 2. Properties ──────────────────────────────────────────────────────────
  console.log('\n🏠 Création des logements...')
  const { data: properties, error: propErr } = await supabase
    .from('properties')
    .insert([
      {
        owner_id: owner.id,
        name: 'Appart Tanger Centre',
        address: '12 Rue Ibn Batouta',
        city: 'Tanger',
        country: 'MA',
        access_type: 'tuya',
        superhote_id: 'test-001',
        wifi_name: 'TangerApt_WiFi',
        wifi_pass: 'tanger2024!',
        house_rules: 'Non-fumeur. Pas d\'animaux. Silence après 22h.',
        is_active: true,
      },
      {
        owner_id: owner.id,
        name: 'Studio Lyon',
        address: '8 Rue de la République',
        city: 'Lyon',
        country: 'FR',
        access_type: 'key_box',
        superhote_id: 'test-002',
        wifi_name: 'LyonStudio_5G',
        wifi_pass: 'lyon@2024',
        house_rules: 'Respecter le voisinage. Pas de fête.',
        is_active: true,
      },
    ])
    .select('id, name')

  if (propErr || !properties) throw new Error(`Properties: ${propErr?.message}`)
  properties.forEach((p) => console.log(`  ✓ Logement créé : ${p.name} (${p.id})`))
  const [prop1, prop2] = properties

  // ── 3. Guests ──────────────────────────────────────────────────────────────
  console.log('\n👥 Création des voyageurs...')
  const { data: guests, error: guestErr } = await supabase
    .from('guests')
    .insert([
      {
        full_name: 'Karim Benali',
        email: 'karim.benali@test.com',
        phone: '+212612345678',
        language: 'fr',
        tag: 'normal',
      },
      {
        full_name: 'Sophie Martin',
        email: 'sophie.martin@test.com',
        phone: '+33612345678',
        language: 'fr',
        tag: 'normal',
      },
    ])
    .select('id, full_name')

  if (guestErr || !guests) throw new Error(`Guests: ${guestErr?.message}`)
  guests.forEach((g) => console.log(`  ✓ Voyageur créé : ${g.full_name} (${g.id})`))
  const [guest1, guest2] = guests

  // ── 4. Reservations ────────────────────────────────────────────────────────
  console.log('\n📅 Création des réservations...')
  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .insert([
      {
        property_id: prop1.id,
        guest_id: guest1.id,
        platform: 'airbnb',
        check_in: daysFromNow(2),
        check_out: daysFromNow(5),
        total_amount: 420,
        status: 'confirmed',
        external_id: 'seed-res-001',
      },
      {
        property_id: prop2.id,
        guest_id: guest2.id,
        platform: 'airbnb',
        check_in: daysFromNow(2),
        check_out: daysFromNow(5),
        total_amount: 315,
        status: 'confirmed',
        external_id: 'seed-res-002',
      },
    ])
    .select('id, external_id')

  if (resErr || !reservations) throw new Error(`Reservations: ${resErr?.message}`)
  reservations.forEach((r) => console.log(`  ✓ Réservation créée : ${r.external_id} (${r.id})`))
  const [res1, res2] = reservations

  // ── 5. Messages ────────────────────────────────────────────────────────────
  console.log('\n💬 Création des messages...')
  const { error: msgErr } = await supabase.from('messages').insert([
    // Réservation 1 — Karim, Tanger
    {
      reservation_id: res1.id,
      guest_id: guest1.id,
      property_id: prop1.id,
      channel: 'airbnb',
      direction: 'inbound',
      body: 'Bonjour, pourriez-vous m\'indiquer le code WiFi de l\'appartement ? Je vais avoir besoin de travailler à distance pendant mon séjour. Merci beaucoup !',
      language: 'fr',
      intent: 'wifi_request',
      priority: 'normal',
      status: 'pending',
    },
    {
      reservation_id: res1.id,
      guest_id: guest1.id,
      property_id: prop1.id,
      channel: 'airbnb',
      direction: 'inbound',
      body: 'Bonsoir ! Je suis devant la porte de l\'appartement depuis 20 minutes et le code d\'accès ne fonctionne pas 😟 Pouvez-vous m\'aider rapidement s\'il vous plaît ? Je commence à m\'inquiéter.',
      language: 'fr',
      intent: 'access_issue',
      priority: 'urgent',
      status: 'pending',
    },
    // Réservation 2 — Sophie, Lyon
    {
      reservation_id: res2.id,
      guest_id: guest2.id,
      property_id: prop2.id,
      channel: 'airbnb',
      direction: 'inbound',
      body: 'Bonjour ! Je voyage depuis Marseille et mon train arrive à Lyon vers 12h. Serait-il possible de faire un early check-in ? Je comprends si ce n\'est pas possible, mais ce serait super pratique 😊',
      language: 'fr',
      intent: 'early_checkin',
      priority: 'high',
      status: 'pending',
    },
    {
      reservation_id: res2.id,
      guest_id: guest2.id,
      property_id: prop2.id,
      channel: 'airbnb',
      direction: 'inbound',
      body: 'Je voulais juste vous laisser un message pour vous remercier chaleureusement. Le studio était absolument parfait — propre, bien équipé, et l\'emplacement idéal ! Je reviendrai sans hésiter et je vous recommande à tous mes amis 🙏',
      language: 'fr',
      intent: 'review_positive',
      priority: 'normal',
      status: 'pending',
    },
  ])

  if (msgErr) throw new Error(`Messages: ${msgErr.message}`)
  console.log('  ✓ 4 messages créés')

  console.log('\n✅ Seed terminé avec succès !\n')
  console.log('  → 1 owner')
  console.log('  → 2 logements (Tanger + Lyon)')
  console.log('  → 2 voyageurs (Karim + Sophie)')
  console.log('  → 2 réservations (check-in dans 2 jours)')
  console.log('  → 4 messages inbound non lus\n')
}

seed().catch((err) => {
  console.error('\n❌ Erreur seed :', err.message)
  process.exit(1)
})
