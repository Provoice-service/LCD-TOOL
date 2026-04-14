import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { message_id } = await request.json()
    if (!message_id) {
      return Response.json({ error: 'message_id requis' }, { status: 400 })
    }

    const supabase = await createClient()

    // ── 1. Récupérer le message + contexte complet ───────────────────────────
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .select(`
        id, body, language, reservation_id,
        reservation:reservations(
          id, check_in, check_out, platform, total_amount,
          property:properties(
            name, city, country, address,
            access_type, tuya_device_id, nuki_smartlock_id,
            key_box_code, key_box_location,
            access_instructions_full,
            check_in_time, check_out_time, max_guests,
            wifi_name, wifi_pass,
            appliances_info, heating_info, cleaning_products_location,
            parking_info, elevator_info, floor_info, trash_info,
            noise_rules, smoking_rules, pet_rules, house_rules,
            nearby_info,
            emergency_procedure, owner_contact, emergency_contacts,
            inventory_notes, custom_faq
          ),
          guest:guests(full_name, language, phone)
        )
      `)
      .eq('id', message_id)
      .single()

    if (msgErr || !message) {
      return Response.json({ error: `Message introuvable: ${msgErr?.message}` }, { status: 404 })
    }

    // ── 2. Historique des 5 derniers messages ────────────────────────────────
    const { data: history } = await supabase
      .from('messages')
      .select('body, direction, created_at')
      .eq('reservation_id', message.reservation_id!)
      .order('created_at', { ascending: false })
      .limit(5)

    const conversation = (history ?? []).reverse()

    // ── 3. Construire le contexte logement ───────────────────────────────────
    const res      = message.reservation as any
    const p        = res?.property
    const guest    = res?.guest

    const checkIn  = res?.check_in  ? format(new Date(res.check_in),  "dd MMMM yyyy 'à' HH'h'mm", { locale: fr }) : 'N/A'
    const checkOut = res?.check_out ? format(new Date(res.check_out), "dd MMMM yyyy 'à' HH'h'mm", { locale: fr }) : 'N/A'

    // FAQ personnalisée
    const faqItems: { question: string; answer: string }[] = Array.isArray(p?.custom_faq) ? p.custom_faq : []
    const faqSection = faqItems.length > 0
      ? faqItems.map((f, i) => `Q${i + 1}: ${f.question}\nR${i + 1}: ${f.answer}`).join('\n\n')
      : 'Aucune FAQ renseignée.'

    const systemPrompt = `Tu es l'assistant de Morad, gestionnaire de locations courte durée (LCD).
Tu rédiges des réponses aux messages des voyageurs : chaleureuses, professionnelles et concises (2 à 4 phrases maximum).
Ne te présente jamais. Signe toujours "L'équipe LCD".
Objectif : répondre à 95% des questions sans intervention humaine, en utilisant TOUTES les informations ci-dessous.

══════════════════════════════════════════════
LOGEMENT : ${p?.name ?? 'N/A'} — ${p?.city ?? ''}${p?.country ? `, ${p.country}` : ''}
${p?.address ? `Adresse : ${p.address}` : ''}
══════════════════════════════════════════════

── ARRIVÉE / DÉPART ──
Check-in : ${p?.check_in_time ?? 'N/A'} | Check-out : ${p?.check_out_time ?? 'N/A'}
Capacité max : ${p?.max_guests ? `${p.max_guests} voyageurs` : 'N/A'}

── ACCÈS ──
Type d'accès : ${p?.access_type ?? 'N/A'}
${p?.access_instructions_full ? `Instructions complètes :\n${p.access_instructions_full}` : ''}
${p?.key_box_code ? `Code boîte à clés : ${p.key_box_code} — Emplacement : ${p.key_box_location ?? 'Non précisé'}` : ''}
${p?.tuya_device_id ? `Serrure connectée Tuya (device: ${p.tuya_device_id})` : ''}
${p?.nuki_smartlock_id ? `Serrure connectée Nuki (ID: ${p.nuki_smartlock_id})` : ''}

── WIFI & ÉQUIPEMENTS ──
WiFi : ${p?.wifi_name ? `${p.wifi_name} / ${p.wifi_pass ?? ''}` : 'Non renseigné'}
${p?.appliances_info ? `Appareils :\n${p.appliances_info}` : ''}
${p?.heating_info ? `Chauffage :\n${p.heating_info}` : ''}
${p?.cleaning_products_location ? `Produits ménagers : ${p.cleaning_products_location}` : ''}

── IMMEUBLE & STATIONNEMENT ──
${p?.floor_info ? `Étage/accès : ${p.floor_info}` : ''}
${p?.elevator_info ? `Ascenseur : ${p.elevator_info}` : ''}
${p?.parking_info ? `Parking :\n${p.parking_info}` : ''}
${p?.trash_info ? `Poubelles :\n${p.trash_info}` : ''}

── RÈGLES DE LA MAISON ──
${p?.noise_rules ? `Bruit : ${p.noise_rules}` : ''}
${p?.smoking_rules ? `Fumée : ${p.smoking_rules}` : ''}
${p?.pet_rules ? `Animaux : ${p.pet_rules}` : ''}
${p?.house_rules ? `Règlement complet :\n${p.house_rules}` : ''}

── QUARTIER & PROXIMITÉ ──
${p?.nearby_info ?? 'Non renseigné'}

── URGENCES & CONTACTS ──
${p?.emergency_procedure ? `Procédure urgence :\n${p.emergency_procedure}` : ''}
${p?.owner_contact ? `Contact propriétaire : ${p.owner_contact}` : ''}
${p?.emergency_contacts ? `Urgences locales : ${p.emergency_contacts}` : ''}

══════════════════════════════════════════════
RÉSERVATION
══════════════════════════════════════════════
Voyageur : ${guest?.full_name ?? 'N/A'}${guest?.phone ? ` — ${guest.phone}` : ''}
Plateforme : ${res?.platform ?? 'N/A'}
Arrivée : ${checkIn}
Départ : ${checkOut}
${res?.total_amount ? `Montant : ${res.total_amount} €` : ''}

══════════════════════════════════════════════
FAQ PERSONNALISÉE DU LOGEMENT
══════════════════════════════════════════════
${faqSection}

══════════════════════════════════════════════
CONSIGNES DE RÉPONSE
══════════════════════════════════════════════
- Réponds en français, sois chaleureux et précis.
- Utilise directement les informations ci-dessus pour répondre (WiFi, codes, horaires, etc.).
- Si la question concerne l'accès ou le WiFi, donne l'information exacte.
- Si la demande dépasse tes informations, dis que tu vas vérifier et recontacter rapidement.
- Ne mentionne jamais les champs qui valent "N/A" ou "Non renseigné".
- Signe toujours avec "L'équipe LCD".`

    // ── 4. Messages de contexte ──────────────────────────────────────────────
    const contextMessages = conversation.map((m: any) => ({
      role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: m.body ?? '',
    }))

    const lastMessage = { role: 'user' as const, content: message.body ?? '' }
    const allMessages =
      contextMessages.length > 0 &&
      contextMessages[contextMessages.length - 1].content === message.body
        ? contextMessages
        : [...contextMessages, lastMessage]

    // ── 5. Appel OpenAI ──────────────────────────────────────────────────────
    console.log('[AI Suggest] OpenAI gpt-4o — logement:', p?.name, '— messages:', allMessages.length)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        ...allMessages,
      ],
    })

    console.log('[AI Suggest] stop_reason:', response.choices[0]?.finish_reason)

    const text = response.choices[0]?.message?.content ?? ''

    return Response.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[AI Suggest] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
