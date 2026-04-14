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

    // ── 1. Récupérer le message + contexte ──────────────────────────────────
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .select(`
        id, body, language, reservation_id,
        reservation:reservations(
          id, check_in, check_out, platform,
          property:properties(name, city, wifi_name, wifi_pass, access_type, house_rules),
          guest:guests(full_name, language)
        )
      `)
      .eq('id', message_id)
      .single()

    if (msgErr || !message) {
      return Response.json({ error: `Message introuvable: ${msgErr?.message}` }, { status: 404 })
    }

    // ── 2. Historique des 5 derniers messages de la conversation ────────────
    const { data: history } = await supabase
      .from('messages')
      .select('body, direction, created_at')
      .eq('reservation_id', message.reservation_id!)
      .order('created_at', { ascending: false })
      .limit(5)

    const conversation = (history ?? []).reverse()

    // ── 3. Construire le prompt système ─────────────────────────────────────
    const res = message.reservation as any
    const property = res?.property
    const guest = res?.guest

    const checkIn = res?.check_in
      ? format(new Date(res.check_in), 'dd MMMM yyyy', { locale: fr })
      : 'N/A'
    const checkOut = res?.check_out
      ? format(new Date(res.check_out), 'dd MMMM yyyy', { locale: fr })
      : 'N/A'

    const systemPrompt = `Tu es l'assistant de Morad, gestionnaire de locations courte durée (LCD).
Tu rédiges des réponses aux messages des voyageurs : chaleureuses, professionnelles et concises (2 à 4 phrases maximum).
Ne te présente jamais. Signe toujours "L'équipe LCD".

── LOGEMENT ──
Nom : ${property?.name ?? 'N/A'} — ${property?.city ?? ''}
Type d'accès : ${property?.access_type ?? 'N/A'}
WiFi : ${property?.wifi_name ? `${property.wifi_name} / ${property.wifi_pass}` : 'Non renseigné'}
Règles maison : ${property?.house_rules ?? 'Non renseignées'}

── RÉSERVATION ──
Voyageur : ${guest?.full_name ?? 'N/A'}
Plateforme : ${res?.platform ?? 'N/A'}
Arrivée : ${checkIn}
Départ : ${checkOut}

── CONSIGNES ──
Réponds en français, sois chaleureux et précis.
Si le voyageur pose une question sur l'accès ou le WiFi, fournis les informations directement.
Si la demande dépasse tes informations, dis que tu vas vérifier et recontacter rapidement.`

    // ── 4. Construire les messages de contexte ──────────────────────────────
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

    // ── 5. Appel OpenAI ─────────────────────────────────────────────────────
    console.log('[AI Suggest] Appel OpenAI gpt-4o, messages:', allMessages.length)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        ...allMessages,
      ],
    })

    console.log('[AI Suggest] Réponse OpenAI stop_reason:', response.choices[0]?.finish_reason)

    const text = response.choices[0]?.message?.content ?? ''

    return Response.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[AI Suggest] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
