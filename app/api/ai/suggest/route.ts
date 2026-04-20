import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Détection du type de situation pour matcher les response_examples ────────
function detectSituationType(messageBody: string): string[] {
  const body = messageBody.toLowerCase()
  const types: string[] = []
  if (/wifi|internet|connexion|mot de passe réseau/.test(body))         types.push('wifi')
  if (/accès|code|porte|clé|serrure|entrer|ouvrir/.test(body))         types.push('access_issue')
  if (/check.?in|arrivée|early|tôt|avant/.test(body))                  types.push('early_checkin')
  if (/check.?out|départ|tard|prolonger|late/.test(body))              types.push('late_checkout')
  if (/bruit|voisin|nuisance|plainte/.test(body))                      types.push('noise_complaint')
  if (/ménage|nettoyage|sale|propre/.test(body))                       types.push('cleaning')
  if (/remboursement|annulation|cancel|refund/.test(body))             types.push('refund')
  if (/urgence|fuite|panne|cassé|broken/.test(body))                   types.push('incident')
  if (/parking|voiture|stationnement/.test(body))                      types.push('parking')
  if (types.length === 0) types.push('general')
  return types
}

// ── Détection de complexité pour flag [ESCALADE] ────────────────────────────
function isComplex(messageBody: string): boolean {
  const body = messageBody.toLowerCase()
  return (
    /remboursement|rembours|refund|annul|litige|plainte officielle|juridique|avocat/.test(body) ||
    /blessé|accident|urgence médicale|police|pompier/.test(body) ||
    /jamais vu ça|inacceptable|scandaleux|honte|arnaque/.test(body)
  )
}

export async function POST(request: NextRequest) {
  try {
    const { message_id } = await request.json()
    if (!message_id) {
      return Response.json({ error: 'message_id requis' }, { status: 400 })
    }

    const supabase = await createClient()

    // ── 1. Message + contexte logement complet ───────────────────────────────
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .select(`
        id, body, language, reservation_id,
        reservation:reservations(
          id, check_in, check_out, platform, total_amount,
          property:properties(
            id, name, city, country, address,
            access_type, tuya_device_id, nuki_smartlock_id,
            lock_brand_model, lock_app_url,
            key_box_code, key_box_location,
            access_instructions_full,
            check_in_time, check_out_time, max_guests,
            wifi_name, wifi_pass,
            dishwasher_available,
            appliances_info, heating_info, cleaning_products_location,
            oven_microwave_info, tv_instructions, ac_instructions,
            parking_info, elevator_info, floor_info, trash_info,
            noise_rules, smoking_rules, pet_rules, house_rules,
            parties_allowed, silence_hour, specific_rules,
            nearby_info, bakery_nearby, local_events, digital_welcome_book_url,
            emergency_procedure, owner_contact, emergency_contacts,
            concierge_phone, backup_phone, local_police_number,
            inventory_notes, custom_faq,
            deposit_amount, price_low_season, price_high_season, direct_booking_url,
            cleaning_provider_contact, cleaning_cost, linen_kit_standard,
            currency, language_primary, language_secondary,
            ramadan_rules, alcohol_allowed, prayer_times_nearby,
            owner_id
          ),
          guest:guests(full_name, language, phone)
        )
      `)
      .eq('id', message_id)
      .single()

    if (msgErr || !message) {
      return Response.json({ error: `Message introuvable: ${msgErr?.message}` }, { status: 404 })
    }

    const res = message.reservation as any
    const p   = res?.property

    // ── 2. Client settings (brand, tone, escalade) depuis owner ─────────────
    let clientSettings: any = null
    if (p?.owner_id) {
      const { data: cs } = await supabase
        .from('client_settings')
        .select('*')
        .eq('owner_id', p.owner_id)
        .single()
      clientSettings = cs

      // Fallback : lire les colonnes owner directement
      if (!cs) {
        const { data: owner } = await supabase
          .from('owners')
          .select('communication_tone, brand_name, escalation_phone, escalation_hours, autonomy_level')
          .eq('id', p.owner_id)
          .single()
        if (owner) clientSettings = owner
      }
    }

    const brandName   = clientSettings?.brand_name ?? 'L\'équipe LCD'
    const tone        = clientSettings?.communication_tone ?? 'friendly'
    const escalPhone  = clientSettings?.escalation_phone ?? null
    const escalHours  = clientSettings?.escalation_hours ?? null

    // ── 3. Response examples (3 les plus pertinents) ─────────────────────────
    const situationTypes = detectSituationType(message.body ?? '')
    let responseExamples: any[] = []
    {
      const { data: examples } = await supabase
        .from('response_examples')
        .select('situation_type, good_response, explanation')
        .or(
          [
            `situation_type.in.(${situationTypes.map(t => `"${t}"`).join(',')})`,
            p?.id ? `property_id.eq.${p.id}` : '',
          ]
            .filter(Boolean)
            .join(',')
        )
        .limit(3)
      responseExamples = examples ?? []
    }

    // ── 4. Équipements conditionnels actifs ──────────────────────────────────
    let conditionalEquipment: any[] = []
    if (p?.id) {
      const { data: condInfo } = await supabase
        .from('property_conditional_info')
        .select('*')
        .eq('property_id', p.id)
        .eq('is_active', true)
      conditionalEquipment = condInfo ?? []
    }

    // ── 5. Historique des 5 derniers messages ────────────────────────────────
    const { data: history } = await supabase
      .from('messages')
      .select('body, direction, created_at')
      .eq('reservation_id', message.reservation_id!)
      .order('created_at', { ascending: false })
      .limit(5)

    const conversation = (history ?? []).reverse()

    // ── 6. Construire le prompt ──────────────────────────────────────────────
    const guest    = res?.guest
    const checkIn  = res?.check_in  ? format(new Date(res.check_in),  "dd MMMM yyyy 'à' HH'h'mm", { locale: fr }) : 'N/A'
    const checkOut = res?.check_out ? format(new Date(res.check_out), "dd MMMM yyyy 'à' HH'h'mm", { locale: fr }) : 'N/A'
    const currency = p?.currency ?? 'EUR'

    const faqItems: { question: string; answer: string }[] = Array.isArray(p?.custom_faq) ? p.custom_faq : []
    const faqSection = faqItems.length > 0
      ? faqItems.map((f: any, i: number) => `Q${i + 1}: ${f.question}\nR${i + 1}: ${f.answer}`).join('\n\n')
      : 'Aucune FAQ renseignée.'

    const condSection = conditionalEquipment.length > 0
      ? conditionalEquipment.map((e: any) =>
          `• ${e.equipment_name} (${e.trigger_condition === 'always' ? 'toujours disponible' : e.trigger_condition === 'min_guests' ? `si ≥ ${e.min_guests_threshold} voyageurs` : 'sur demande'})${e.instructions ? ` — ${e.instructions}` : ''}`
        ).join('\n')
      : null

    const examplesSection = responseExamples.length > 0
      ? responseExamples.map((ex: any, i: number) =>
          `Exemple ${i + 1} (${ex.situation_type}) :\n✅ ${ex.good_response}${ex.explanation ? `\n→ Pourquoi : ${ex.explanation}` : ''}`
        ).join('\n\n')
      : null

    // Ton de communication
    const toneMap: Record<string, string> = {
      formal:   'Ton formel et professionnel. Vouvoiement. Phrases soignées.',
      friendly: 'Ton chaleureux et accessible. Vouvoiement naturel. Empathique.',
      luxury:   'Ton raffiné, élégant, orienté expérience 5 étoiles. Superlatives bienvenus.',
    }
    const toneInstructions = toneMap[tone] ?? 'Ton chaleureux et professionnel.'

    // Langue de réponse
    const langCode = message.language ?? p?.language_primary ?? 'fr'
    const langInstruction = langCode !== 'fr'
      ? `Réponds dans la langue du message (${langCode}). Si langue inconnue, réponds en français.`
      : `Réponds en français.`

    function line(label: string, val: unknown) {
      if (!val && val !== 0) return ''
      return `${label} : ${val}\n`
    }

    const systemPrompt = `Tu es l'assistant de ${brandName}, spécialiste des locations courte durée (LCD).
Tu rédiges des réponses aux messages des voyageurs : ${toneInstructions}
Sois concis (2 à 4 phrases maximum). Ne te présente jamais. Signe toujours "${brandName}".
Objectif : répondre à 95% des questions sans intervention humaine en utilisant TOUTES les informations ci-dessous.

══════════════════════════════════════════════
LOGEMENT : ${p?.name ?? 'N/A'} — ${p?.city ?? ''}${p?.country ? `, ${p.country}` : ''}
${p?.address ? `Adresse : ${p.address}` : ''}
Devise : ${currency}${p?.language_primary ? ` | Langue principale : ${p.language_primary}` : ''}${p?.language_secondary ? ` | Langue secondaire : ${p.language_secondary}` : ''}
══════════════════════════════════════════════

── ARRIVÉE / DÉPART ──
${line('Check-in', p?.check_in_time)}${line('Check-out', p?.check_out_time)}${line('Capacité max', p?.max_guests ? `${p.max_guests} voyageurs` : null)}

── ACCÈS ──
${line('Type d\'accès', p?.access_type)}${line('Serrure', p?.lock_brand_model)}${line('App serrure', p?.lock_app_url)}
${p?.access_instructions_full ? `Instructions complètes :\n${p.access_instructions_full}\n` : ''}${line('Code boîte à clés', p?.key_box_code)}${line('Emplacement boîte', p?.key_box_location)}${p?.tuya_device_id ? `Serrure Tuya (device: ${p.tuya_device_id})\n` : ''}${p?.nuki_smartlock_id ? `Serrure Nuki (ID: ${p.nuki_smartlock_id})\n` : ''}

── WIFI & ÉQUIPEMENTS ──
${line('WiFi', p?.wifi_name ? `${p.wifi_name} / ${p.wifi_pass ?? ''}` : null)}${p?.dishwasher_available ? 'Lave-vaisselle : disponible\n' : ''}${p?.appliances_info ? `Appareils :\n${p.appliances_info}\n` : ''}${p?.oven_microwave_info ? `Four/micro-ondes :\n${p.oven_microwave_info}\n` : ''}${p?.tv_instructions ? `TV :\n${p.tv_instructions}\n` : ''}${p?.ac_instructions ? `Climatisation :\n${p.ac_instructions}\n` : ''}${p?.heating_info ? `Chauffage :\n${p.heating_info}\n` : ''}${line('Produits ménagers', p?.cleaning_products_location)}

── ÉQUIPEMENTS CONDITIONNELS ──
${condSection ?? 'Aucun équipement conditionnel renseigné.'}

── IMMEUBLE & STATIONNEMENT ──
${p?.floor_info ? `Étage/accès : ${p.floor_info}\n` : ''}${p?.elevator_info ? `Ascenseur : ${p.elevator_info}\n` : ''}${p?.parking_info ? `Parking :\n${p.parking_info}\n` : ''}${p?.trash_info ? `Poubelles :\n${p.trash_info}\n` : ''}

── RÈGLES DE LA MAISON ──
${p?.noise_rules ? `Bruit : ${p.noise_rules}\n` : ''}${p?.smoking_rules ? `Fumée : ${p.smoking_rules}\n` : ''}${p?.pet_rules ? `Animaux : ${p.pet_rules}\n` : ''}${p?.parties_allowed ? `Fêtes : ${p.parties_allowed}\n` : ''}${p?.silence_hour ? `Heure silence : ${p.silence_hour}\n` : ''}${p?.specific_rules ? `Règles spécifiques : ${p.specific_rules}\n` : ''}${p?.house_rules ? `Règlement complet :\n${p.house_rules}\n` : ''}${p?.alcohol_allowed === false ? 'Alcool : non autorisé dans le logement\n' : ''}${p?.ramadan_rules ? `Ramadan — règles spécifiques :\n${p.ramadan_rules}\n` : ''}

── QUARTIER & PROXIMITÉ ──
${p?.nearby_info ?? ''}${p?.bakery_nearby ? `\nBoulangerie : ${p.bakery_nearby}` : ''}${p?.local_events ? `\nÉvénements : ${p.local_events}` : ''}${p?.prayer_times_nearby ? `\nMosquées / horaires prière : ${p.prayer_times_nearby}` : ''}${p?.digital_welcome_book_url ? `\nLivret d'accueil : ${p.digital_welcome_book_url}` : ''}

── URGENCES & CONTACTS ──
${p?.emergency_procedure ? `Procédure urgence :\n${p.emergency_procedure}\n` : ''}${line('Concierge', p?.concierge_phone)}${line('Contact propriétaire', p?.owner_contact)}${line('Téléphone secours', p?.backup_phone)}${line('Police locale', p?.local_police_number)}${p?.emergency_contacts ? `Urgences locales : ${p.emergency_contacts}\n` : ''}

── TARIFS & ADMINISTRATIF ──
${line('Tarif basse saison', p?.price_low_season ? `${p.price_low_season} ${currency}/nuit` : null)}${line('Tarif haute saison', p?.price_high_season ? `${p.price_high_season} ${currency}/nuit` : null)}${line('Caution', p?.deposit_amount ? `${p.deposit_amount} ${currency}` : null)}${line('Réservation directe', p?.direct_booking_url)}

══════════════════════════════════════════════
RÉSERVATION
══════════════════════════════════════════════
${line('Voyageur', `${guest?.full_name ?? 'N/A'}${guest?.phone ? ` — ${guest.phone}` : ''}`)}${line('Plateforme', res?.platform)}${line('Arrivée', checkIn)}${line('Départ', checkOut)}${line('Montant', res?.total_amount ? `${res.total_amount} ${currency}` : null)}

══════════════════════════════════════════════
FAQ PERSONNALISÉE DU LOGEMENT
══════════════════════════════════════════════
${faqSection}
${examplesSection ? `\n══════════════════════════════════════════════\nEXEMPLES DE BONNES RÉPONSES (base de connaissances)\n══════════════════════════════════════════════\n${examplesSection}\n` : ''}
══════════════════════════════════════════════
CONSIGNES DE RÉPONSE
══════════════════════════════════════════════
- ${langInstruction}
- ${toneInstructions}
- Utilise directement les informations ci-dessus (WiFi, codes, horaires, règles, devise ${currency}, etc.).
- Si la question concerne l'accès, le WiFi ou les équipements, fournis l'information exacte immédiatement.
- Si la demande dépasse tes informations, dis que tu vas vérifier et recontacter rapidement.
- Ne mentionne pas les champs vides ou "N/A".
- Signe toujours avec "${brandName}".
- Si le message contient une demande complexe (litige, remboursement, incident grave, plainte officielle), ajoute [ESCALADE] en toute première ligne de ta réponse, puis rédige la réponse chaleureuse habituelle. Ce flag permet à l'équipe humaine d'intervenir.${escalPhone ? `\n- En cas d'escalade, le contact est ${escalPhone}${escalHours ? ` (${escalHours})` : ''}.` : ''}`

    // ── 7. Messages de contexte ──────────────────────────────────────────────
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

    // ── 8. Appel OpenAI ──────────────────────────────────────────────────────
    const escalade = isComplex(message.body ?? '')
    console.log(
      '[AI Suggest] gpt-4o — logement:', p?.name,
      '— tone:', tone,
      '— brand:', brandName,
      '— lang:', langCode,
      '— escalade_detect:', escalade,
      '— examples:', responseExamples.length,
      '— messages:', allMessages.length,
    )

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
    return Response.json({ text, escalade: text.startsWith('[ESCALADE]') })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[AI Suggest] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
