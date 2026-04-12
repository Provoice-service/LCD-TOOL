import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types — structure attendue du payload Superhote
// Ajuster les noms de champs selon la doc réelle de Superhote si nécessaire
// ---------------------------------------------------------------------------

interface SuperhoteGuest {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
}

interface SuperhoteReservationPayload {
  id: string | number          // external_id
  property_id: string          // correspond à properties.superhote_id
  guest?: SuperhoteGuest
  platform?: string            // 'airbnb' | 'booking' | ...
  check_in?: string            // ISO 8601
  check_out?: string           // ISO 8601
  total_price?: number
  status?: string              // 'confirmed' | 'cancelled' | ...
}

interface SuperhoteWebhookBody {
  event?: string               // 'reservation.created' | 'reservation.updated'
  reservation?: SuperhoteReservationPayload
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/superhote
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  console.log('[Superhote] ▶ Webhook reçu')

  try {
    // ------------------------------------------------------------------
    // 1. Vérification du secret
    // ------------------------------------------------------------------
    const secret = request.headers.get('x-superhote-secret')
    if (!process.env.SUPERHOTE_WEBHOOK_SECRET || secret !== process.env.SUPERHOTE_WEBHOOK_SECRET) {
      console.warn('[Superhote] ✗ Secret invalide ou manquant')
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[Superhote] ✓ Secret vérifié')

    // ------------------------------------------------------------------
    // 2. Parsing du body
    // ------------------------------------------------------------------
    const body: SuperhoteWebhookBody = await request.json()
    console.log('[Superhote] Payload reçu:', JSON.stringify(body, null, 2))

    const res = body.reservation
    if (!res) {
      console.warn('[Superhote] ✗ Champ "reservation" manquant dans le payload')
      return Response.json({ error: 'Missing reservation in payload' }, { status: 422 })
    }

    // ------------------------------------------------------------------
    // 3. Client Supabase
    // ------------------------------------------------------------------
    const supabase = await createClient()

    // ------------------------------------------------------------------
    // 4. Recherche du logement par superhote_id
    // ------------------------------------------------------------------
    console.log('[Superhote] Recherche du logement superhote_id =', res.property_id)
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('superhote_id', String(res.property_id))
      .maybeSingle()

    if (propError) {
      console.error('[Superhote] ✗ Erreur requête property:', propError.message)
      return Response.json({ error: propError.message }, { status: 500 })
    }
    if (!property) {
      console.error('[Superhote] ✗ Logement introuvable pour superhote_id:', res.property_id)
      return Response.json({ error: `Property not found: ${res.property_id}` }, { status: 422 })
    }
    console.log('[Superhote] ✓ Logement trouvé:', property.id)

    // ------------------------------------------------------------------
    // 5. Upsert du guest
    // ------------------------------------------------------------------
    const guestName = [res.guest?.first_name, res.guest?.last_name]
      .filter(Boolean)
      .join(' ') || 'Invité inconnu'

    let guestId: string

    if (res.guest?.email) {
      // Rechercher par email — évite les doublons
      console.log('[Superhote] Recherche guest par email:', res.guest.email)
      const { data: existing } = await supabase
        .from('guests')
        .select('id')
        .eq('email', res.guest.email)
        .maybeSingle()

      if (existing) {
        guestId = existing.id
        await supabase
          .from('guests')
          .update({ full_name: guestName, phone: res.guest.phone ?? null })
          .eq('id', guestId)
        console.log('[Superhote] ✓ Guest mis à jour:', guestId)
      } else {
        const { data: newGuest, error: insertErr } = await supabase
          .from('guests')
          .insert({ full_name: guestName, email: res.guest.email, phone: res.guest.phone ?? null })
          .select('id')
          .single()
        if (insertErr || !newGuest) throw new Error(`Guest insert: ${insertErr?.message}`)
        guestId = newGuest.id
        console.log('[Superhote] ✓ Guest créé:', guestId)
      }
    } else {
      // Pas d'email — insertion simple
      const { data: newGuest, error: insertErr } = await supabase
        .from('guests')
        .insert({ full_name: guestName, phone: res.guest?.phone ?? null })
        .select('id')
        .single()
      if (insertErr || !newGuest) throw new Error(`Guest insert (no email): ${insertErr?.message}`)
      guestId = newGuest.id
      console.log('[Superhote] ✓ Guest créé (sans email):', guestId)
    }

    // ------------------------------------------------------------------
    // 6. Upsert de la réservation
    // ------------------------------------------------------------------
    console.log('[Superhote] Upsert réservation external_id =', res.id)
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .upsert(
        {
          external_id:  String(res.id),
          property_id:  property.id,
          guest_id:     guestId,
          platform:     res.platform ?? 'airbnb',
          check_in:     res.check_in  ?? null,
          check_out:    res.check_out ?? null,
          total_amount: res.total_price ?? 0,
          status:       res.status ?? 'confirmed',
        },
        { onConflict: 'external_id' }
      )
      .select('id, check_out')
      .single()

    if (resError || !reservation) {
      console.error('[Superhote] ✗ Upsert réservation:', resError?.message)
      throw new Error(`Reservation upsert: ${resError?.message}`)
    }
    console.log('[Superhote] ✓ Réservation upsertée:', reservation.id)

    // ------------------------------------------------------------------
    // 7. Création de la tâche de ménage au check_out à 11h00 UTC
    //    (si elle n'existe pas déjà pour cette réservation)
    // ------------------------------------------------------------------
    if (reservation.check_out) {
      const co = new Date(reservation.check_out)
      // 11h00 UTC le jour du check_out
      const scheduledAt = new Date(
        Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate(), 11, 0, 0)
      ).toISOString()

      console.log('[Superhote] Vérification tâche ménage pour', scheduledAt)
      const { data: existing } = await supabase
        .from('cleaning_tasks')
        .select('id')
        .eq('reservation_id', reservation.id)
        .maybeSingle()

      if (!existing) {
        const { error: cleanErr } = await supabase
          .from('cleaning_tasks')
          .insert({
            reservation_id: reservation.id,
            property_id:    property.id,
            scheduled_at:   scheduledAt,
            status:         'pending',
          })
        if (cleanErr) {
          console.error('[Superhote] ✗ Création tâche ménage:', cleanErr.message)
        } else {
          console.log('[Superhote] ✓ Tâche ménage créée pour', scheduledAt)
        }
      } else {
        console.log('[Superhote] → Tâche ménage déjà existante, skipped')
      }
    } else {
      console.log('[Superhote] → Pas de check_out, tâche ménage ignorée')
    }

    // ------------------------------------------------------------------
    // 8. Succès
    // ------------------------------------------------------------------
    console.log('[Superhote] ✓ Traitement terminé')
    return Response.json({ success: true })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Superhote] ✗ Erreur inattendue:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
