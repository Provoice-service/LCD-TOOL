import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Charger .env.local
try {
  readFileSync('.env.local', 'utf-8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '')
  })
} catch { /* fichier absent */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface UpsellSeed {
  name: string
  category: string
  description: string
  icon: string
  price: number
  currency: string
  is_active: boolean
  sort_order: number
  property_id: null
}

const upsells: UpsellSeed[] = [
  // Transport
  { name: 'Navette aéroport — arrivée',  category: 'Transport', description: 'Prise en charge à l\'aéroport Tanger Ibn Battouta', icon: '✈️', price: 0, currency: 'MAD', is_active: true, sort_order: 10, property_id: null },
  { name: 'Navette aéroport — départ',   category: 'Transport', description: 'Dépôt à l\'aéroport Tanger Ibn Battouta',           icon: '✈️', price: 0, currency: 'MAD', is_active: true, sort_order: 11, property_id: null },
  { name: 'Location de voiture',          category: 'Transport', description: 'Véhicule mis à disposition pour votre séjour',       icon: '🚗', price: 0, currency: 'MAD', is_active: true, sort_order: 12, property_id: null },
  { name: 'Taxi privé',                   category: 'Transport', description: 'Transferts privés à la demande',                     icon: '🚕', price: 0, currency: 'MAD', is_active: true, sort_order: 13, property_id: null },

  // Confort
  { name: 'Check-in anticipé avant 15h',  category: 'Confort', description: 'Accès au logement avant 15h selon disponibilité',      icon: '🔑', price: 0, currency: 'MAD', is_active: true, sort_order: 20, property_id: null },
  { name: 'Check-out tardif après 11h',   category: 'Confort', description: 'Départ repoussé après 11h selon disponibilité',        icon: '🕐', price: 0, currency: 'MAD', is_active: true, sort_order: 21, property_id: null },
  { name: 'Lit bébé / lit parapluie',     category: 'Confort', description: 'Lit de voyage pour bébé (0-3 ans)',                    icon: '🛏️', price: 0, currency: 'MAD', is_active: true, sort_order: 22, property_id: null },
  { name: 'Chaise haute bébé',            category: 'Confort', description: 'Chaise haute pour repas',                              icon: '🪑', price: 0, currency: 'MAD', is_active: true, sort_order: 23, property_id: null },
  { name: 'Panier de bienvenue',          category: 'Confort', description: 'Fruits, boissons et produits locaux à votre arrivée',  icon: '🧺', price: 0, currency: 'MAD', is_active: true, sort_order: 24, property_id: null },
  { name: 'Petit-déjeuner livré',         category: 'Confort', description: 'Petit-déjeuner marocain livré chaque matin',          icon: '🥐', price: 0, currency: 'MAD', is_active: true, sort_order: 25, property_id: null },

  // Activités nautiques
  { name: 'Plongée sous-marine',           category: 'Activités nautiques', description: 'Baptême ou exploration avec moniteur certifié',   icon: '🤿', price: 0, currency: 'MAD', is_active: true, sort_order: 30, property_id: null },
  { name: 'Surf — cours ou location',      category: 'Activités nautiques', description: 'Cours initiation ou location de planche',         icon: '🏄', price: 0, currency: 'MAD', is_active: true, sort_order: 31, property_id: null },
  { name: 'Bateau privé — excursion mer',  category: 'Activités nautiques', description: 'Sortie en mer, baignade et snorkeling',            icon: '⛵', price: 0, currency: 'MAD', is_active: true, sort_order: 32, property_id: null },
  { name: 'Paddle / Kayak',               category: 'Activités nautiques', description: 'Location ou sortie guidée sur la côte',           icon: '🛶', price: 0, currency: 'MAD', is_active: true, sort_order: 33, property_id: null },
  { name: 'Jet ski',                       category: 'Activités nautiques', description: 'Session jet ski sur le détroit de Gibraltar',       icon: '🌊', price: 0, currency: 'MAD', is_active: true, sort_order: 34, property_id: null },

  // Activités terrestres
  { name: 'Quad ou buggy — excursion dunes',  category: 'Activités terrestres', description: 'Balade en quad dans les dunes et la campagne', icon: '🏜️', price: 0, currency: 'MAD', is_active: true, sort_order: 40, property_id: null },
  { name: 'VTT — location ou excursion',      category: 'Activités terrestres', description: 'Vélos tout-terrain pour explorer les environs', icon: '🚵', price: 0, currency: 'MAD', is_active: true, sort_order: 41, property_id: null },
  { name: 'Randonnée guidée Tanger',          category: 'Activités terrestres', description: 'Trekking dans les collines autour de Tanger',   icon: '🥾', price: 0, currency: 'MAD', is_active: true, sort_order: 42, property_id: null },

  // Sports
  { name: 'Padel — réservation terrain', category: 'Sports', description: 'Terrain de padel réservé pour 1h30',          icon: '🏓', price: 0, currency: 'MAD', is_active: true, sort_order: 50, property_id: null },
  { name: 'Tennis — réservation terrain', category: 'Sports', description: 'Court de tennis réservé pour 1h',            icon: '🎾', price: 0, currency: 'MAD', is_active: true, sort_order: 51, property_id: null },
  { name: 'Golf — green fee',            category: 'Sports', description: 'Accès au parcours golf de Tanger',            icon: '⛳', price: 0, currency: 'MAD', is_active: true, sort_order: 52, property_id: null },

  // Tourisme
  { name: 'Guide touristique privé Tanger',              category: 'Tourisme', description: 'Découverte de Tanger avec un guide francophone',         icon: '🏛️', price: 0, currency: 'MAD', is_active: true, sort_order: 60, property_id: null },
  { name: 'Visite guidée Médina et Kasbah',              category: 'Tourisme', description: 'Visite historique de la Médina et la Kasbah de Tanger',  icon: '🕌', price: 0, currency: 'MAD', is_active: true, sort_order: 61, property_id: null },
  { name: 'Excursion Chefchaouen',                       category: 'Tourisme', description: 'Journée dans la ville bleue du Rif',                      icon: '💙', price: 0, currency: 'MAD', is_active: true, sort_order: 62, property_id: null },
  { name: 'Excursion Cap Spartel + Grottes Hercule',     category: 'Tourisme', description: 'Visite du cap et des grottes légendaires d\'Hercule',     icon: '🌅', price: 0, currency: 'MAD', is_active: true, sort_order: 63, property_id: null },
  { name: 'Excursion Tétouan',                           category: 'Tourisme', description: 'Découverte de la ville blanche, patrimoine UNESCO',        icon: '🏘️', price: 0, currency: 'MAD', is_active: true, sort_order: 64, property_id: null },
  { name: 'Soirée Fantasia + dîner marocain',            category: 'Tourisme', description: 'Spectacle équestre traditionnel et repas gastronomique',  icon: '🎪', price: 0, currency: 'MAD', is_active: true, sort_order: 65, property_id: null },

  // Restauration
  { name: 'Dîner gastronomique marocain à domicile', category: 'Restauration', description: 'Menu complet préparé et servi dans le logement',       icon: '🍽️', price: 0, currency: 'MAD', is_active: true, sort_order: 70, property_id: null },
  { name: 'Chef privé',                              category: 'Restauration', description: 'Chef à domicile pour un repas sur mesure',              icon: '👨‍🍳', price: 0, currency: 'MAD', is_active: true, sort_order: 71, property_id: null },
  { name: 'Commande tajine ou couscous livré',       category: 'Restauration', description: 'Plats marocains traditionnels livrés au logement',      icon: '🥘', price: 0, currency: 'MAD', is_active: true, sort_order: 72, property_id: null },
]

async function main() {
  console.log(`Insertion de ${upsells.length} upsells…`)

  // On supprime d'abord les upsells globaux (property_id IS NULL) pour éviter les doublons
  const { error: delErr } = await supabase
    .from('upsells')
    .delete()
    .is('property_id', null)

  if (delErr) {
    console.error('Erreur suppression:', delErr.message)
    process.exit(1)
  }

  const { data, error } = await supabase
    .from('upsells')
    .insert(upsells)
    .select('id, name')

  if (error) {
    console.error('Erreur insertion:', error.message)
    process.exit(1)
  }

  console.log(`✓ ${data?.length ?? 0} upsells insérés avec succès`)
  data?.forEach(u => console.log(`  · ${u.name}`))
}

main()
