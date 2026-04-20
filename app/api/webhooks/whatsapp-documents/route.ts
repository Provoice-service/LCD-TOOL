import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndSendSyndicDocuments } from '@/lib/syndic/sendSyndicDocuments'

export const dynamic  = 'force-dynamic'
export const runtime  = 'nodejs'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? 'lcd_tool_verify_2025'
const WA_TOKEN     = process.env.WHATSAPP_ACCESS_TOKEN
const WA_BASE      = 'https://graph.facebook.com/v18.0'
const PHONE_ID     = process.env.WHATSAPP_BUSINESS_PHONE_ID

// ---------------------------------------------------------------------------
// GET — Vérification webhook Meta
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WA Webhook] Vérification Meta réussie')
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ---------------------------------------------------------------------------
// POST — Réception message WhatsApp
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ── Extraire le message entrant ─────────────────────────────────────────
    const entry    = body?.entry?.[0]
    const changes  = entry?.changes?.[0]
    const value    = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      // Notification de statut (delivered/read) — pas d'action requise
      return Response.json({ ok: true })
    }

    const msg     = messages[0]
    const from    = msg.from   // numéro expéditeur e.g. "212612345678"
    const msgType = msg.type   // 'image', 'document', 'text', etc.

    console.log(`[WA Webhook] message de ${from}, type: ${msgType}`)

    // ── Identifier la réservation active par numéro de téléphone ────────────
    const supabase = await createClient()

    // Normaliser le numéro (enlever le + si présent, garder la version internationale)
    const normalizedPhone = from.startsWith('+') ? from : `+${from}`

    const { data: guest } = await supabase
      .from('guests')
      .select('id, full_name')
      .or(`phone.eq.${normalizedPhone},phone.eq.${from}`)
      .limit(1)
      .single()

    if (!guest) {
      console.warn(`[WA Webhook] Voyageur inconnu pour ${from}`)
      return Response.json({ ok: true })
    }

    const { data: reservation } = await supabase
      .from('reservations')
      .select(`
        id, check_in, check_out, contract_signed, id_received, deposit_ok,
        property:properties(id, name, syndic_required)
      `)
      .eq('guest_id', guest.id)
      .in('status', ['confirmed', 'checked_in'])
      .order('check_in', { ascending: true })
      .limit(1)
      .single()

    if (!reservation) {
      console.warn(`[WA Webhook] Aucune réservation active pour guest ${guest.id}`)
      return Response.json({ ok: true })
    }

    const p = reservation.property as any

    // ── Traitement selon le type de message ──────────────────────────────────
    if (msgType === 'image' || msgType === 'document') {
      const media   = msg[msgType]
      const mediaId = media?.id
      if (!mediaId) return Response.json({ ok: true })

      // Déterminer le type de document depuis la caption
      const caption       = media?.caption?.toLowerCase() ?? ''
      let documentType: string = 'other'
      if (/passeport|passport/.test(caption))     documentType = 'passport'
      else if (/cni|carte nationale|identité/.test(caption)) documentType = 'cni'
      else if (/contrat|contract/.test(caption))  documentType = 'contract'
      else if (msgType === 'image')               documentType = 'passport' // image sans caption = probablement passeport

      // Télécharger le media depuis WhatsApp
      const fileBuffer = await downloadWhatsAppMedia(mediaId)
      const fileName   = `${documentType}_${guest.id}_${Date.now()}.${msgType === 'image' ? 'jpg' : 'pdf'}`

      // Uploader dans Supabase Storage
      let fileUrl: string | null = null
      if (fileBuffer) {
        const storagePath = `${reservation.id}/${fileName}`
        const { data: uploaded, error: uploadErr } = await supabase.storage
          .from('property-documents')
          .upload(storagePath, fileBuffer, {
            contentType: msgType === 'image' ? 'image/jpeg' : 'application/pdf',
            upsert: true,
          })
        if (!uploadErr && uploaded) {
          const { data: urlData } = supabase.storage
            .from('property-documents')
            .getPublicUrl(storagePath)
          fileUrl = urlData?.publicUrl ?? null
        }
      }

      // Créer l'entrée dans property_documents
      await supabase.from('property_documents').insert({
        reservation_id: reservation.id,
        property_id:    p?.id ?? null,
        guest_id:       guest.id,
        document_type:  documentType,
        file_url:       fileUrl,
        file_name:      fileName,
        received_via:   'whatsapp',
        received_at:    new Date().toISOString(),
      })

      // Marquer id_received sur la réservation
      await supabase
        .from('reservations')
        .update({ id_received: true })
        .eq('id', reservation.id)

      // Log CRM
      await supabase.from('crm_activities').insert({
        guest_id:     guest.id,
        type:         'inbound',
        channel:      'whatsapp',
        description:  `Document reçu par WhatsApp : ${documentType} (${fileName})`,
        metadata:     { reservation_id: reservation.id, document_type: documentType, file_url: fileUrl },
      }).select().maybeSingle()

      // Envoyer confirmation au voyageur
      const firstName = guest.full_name.split(' ')[0]
      await sendConfirmationMessage(
        normalizedPhone,
        `Merci ${firstName}, votre pièce d'identité a bien été reçue ✅\nNous vous enverrons les instructions d'accès dès que votre dossier sera complet.`
      )

      // Vérifier si checklist complète → envoi syndic
      const updatedChecklist = {
        contract_signed: reservation.contract_signed,
        id_received:     true, // on vient de le marquer
        deposit_ok:      reservation.deposit_ok,
      }
      if (updatedChecklist.contract_signed && updatedChecklist.deposit_ok) {
        console.log('[WA Webhook] Checklist complète → envoi syndic')
        await checkAndSendSyndicDocuments(reservation.id)
      }
    }

    return Response.json({ ok: true })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WA Webhook] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer | null> {
  if (!WA_TOKEN) return null
  try {
    // 1. Récupérer l'URL du media
    const metaRes = await fetch(`${WA_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
    })
    const meta = await metaRes.json()
    if (!meta.url) return null

    // 2. Télécharger le fichier
    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
    })
    const arrayBuffer = await fileRes.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[WA Webhook] downloadMedia error:', err)
    return null
  }
}

async function sendConfirmationMessage(to: string, body: string): Promise<void> {
  if (!PHONE_ID || !WA_TOKEN) return
  await fetch(`${WA_BASE}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })
}
