import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendResult {
  success: boolean
  notification_id?: string
  skipped?: string
  error?: string
}

// ---------------------------------------------------------------------------
// WhatsApp Business API helpers
// ---------------------------------------------------------------------------

const WA_BASE = `https://graph.facebook.com/v18.0`
const PHONE_ID = process.env.WHATSAPP_BUSINESS_PHONE_ID
const TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN

async function sendTextMessage(to: string, body: string): Promise<string | null> {
  if (!PHONE_ID || !TOKEN) {
    console.warn('[Syndic] WhatsApp non configuré — mode test')
    return `test_msg_${Date.now()}`
  }
  const res = await fetch(`${WA_BASE}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })
  const data = await res.json()
  return data.messages?.[0]?.id ?? null
}

export async function sendDocumentViaWhatsApp(
  phone: string,
  fileUrl: string,
  fileName: string,
  caption: string
): Promise<string | null> {
  if (!PHONE_ID || !TOKEN) {
    console.warn('[Syndic] WhatsApp non configuré — mode test (sendDocument)')
    return `test_doc_${Date.now()}`
  }

  const isPdf = fileName.toLowerCase().endsWith('.pdf')
  const type  = isPdf ? 'document' : 'image'

  const payload = isPdf
    ? {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'document',
        document: { link: fileUrl, filename: fileName, caption },
      }
    : {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'image',
        image: { link: fileUrl, caption },
      }

  const res = await fetch(`${WA_BASE}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('[Syndic] sendDocument error:', JSON.stringify(data))
    return null
  }
  return data.messages?.[0]?.id ?? null
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

export async function checkAndSendSyndicDocuments(
  reservationId: string,
  force = false
): Promise<SendResult> {
  const supabase = await createClient()

  // ── 1. Récupérer la réservation + logement ─────────────────────────────
  const { data: res, error: resErr } = await supabase
    .from('reservations')
    .select(`
      id, check_in, check_out, contract_signed, id_received, deposit_ok,
      property:properties(
        id, name, syndic_required, syndic_phone, syndic_name,
        syndic_requires_contract, syndic_whatsapp_message, syndic_send_timing
      ),
      guest:guests(id, full_name, phone)
    `)
    .eq('id', reservationId)
    .single()

  if (resErr || !res) return { success: false, error: `Réservation introuvable: ${resErr?.message}` }

  const p = res.property as any
  const g = res.guest as any

  // ── 2. Vérifier syndic requis ───────────────────────────────────────────
  if (!p?.syndic_required) {
    return { success: false, skipped: 'syndic_not_required' }
  }
  if (!p.syndic_phone) {
    return { success: false, error: 'Numéro WhatsApp du syndic non renseigné' }
  }

  // ── 3. Vérifier checklist ───────────────────────────────────────────────
  const checklistOk = res.contract_signed && res.id_received && res.deposit_ok
  if (!checklistOk && !force) {
    return { success: false, skipped: 'checklist_incomplete' }
  }

  // ── 4. Vérifier doublon envoi ───────────────────────────────────────────
  if (!force) {
    const { data: existing } = await supabase
      .from('syndic_notifications')
      .select('id')
      .eq('reservation_id', reservationId)
      .in('status', ['sent', 'delivered'])
      .limit(1)
    if (existing && existing.length > 0) {
      return { success: false, skipped: 'already_sent' }
    }
  }

  // ── 5. Récupérer les documents disponibles ─────────────────────────────
  const requiredTypes = ['passport', 'cni', ...(p.syndic_requires_contract ? ['contract'] : [])]
  const { data: docs } = await supabase
    .from('property_documents')
    .select('id, document_type, file_url, file_name')
    .eq('reservation_id', reservationId)
    .in('document_type', requiredTypes)

  const availableDocs = docs ?? []
  if (availableDocs.length === 0 && !force) {
    return { success: false, skipped: 'no_documents' }
  }

  // ── 6. Construire le message ────────────────────────────────────────────
  const checkIn  = res.check_in  ? format(new Date(res.check_in),  'dd/MM/yyyy', { locale: fr }) : '?'
  const checkOut = res.check_out ? format(new Date(res.check_out), 'dd/MM/yyyy', { locale: fr }) : '?'

  const defaultMsg = `Bonjour ${p.syndic_name ? p.syndic_name : ''},\nVeuillez trouver ci-joint les documents du voyageur [voyageur] pour le séjour du [dates] — [nom_logement].\nMerci.`
  const template = p.syndic_whatsapp_message ?? defaultMsg

  const messageText = template
    .replace(/\[voyageur\]/g,      g?.full_name ?? 'le voyageur')
    .replace(/\[dates\]/g,         `${checkIn} → ${checkOut}`)
    .replace(/\[nom_logement\]/g,  p.name ?? 'le logement')
    .replace(/\[nom\]/g,           p.name ?? 'le logement')

  // ── 7. Créer notification (pending) ────────────────────────────────────
  const { data: notif, error: notifErr } = await supabase
    .from('syndic_notifications')
    .insert({
      reservation_id: reservationId,
      property_id:    p.id,
      syndic_phone:   p.syndic_phone,
      syndic_name:    p.syndic_name,
      documents_sent: availableDocs.map((d: any) => d.id),
      message_sent:   messageText,
      status:         'pending',
    })
    .select('id')
    .single()

  if (notifErr || !notif) return { success: false, error: `Erreur création notification: ${notifErr?.message}` }

  // ── 8. Envoyer le message texte ─────────────────────────────────────────
  console.log(`[Syndic] Envoi à ${p.syndic_phone} pour résa ${reservationId}`)
  const msgId = await sendTextMessage(p.syndic_phone, messageText)

  // ── 9. Envoyer chaque document ──────────────────────────────────────────
  for (const doc of availableDocs) {
    if (!doc.file_url) continue
    const docTypeLabel: Record<string, string> = {
      passport: 'Passeport',
      cni:      'Carte nationale d\'identité',
      contract: 'Contrat de location',
      other:    'Document',
    }
    const caption = `${docTypeLabel[doc.document_type] ?? 'Document'} — ${g?.full_name ?? ''}`
    await sendDocumentViaWhatsApp(p.syndic_phone, doc.file_url, doc.file_name ?? 'document', caption)
  }

  // ── 10. Mettre à jour le statut ────────────────────────────────────────
  await supabase
    .from('syndic_notifications')
    .update({ status: 'sent', sent_at: new Date().toISOString(), whatsapp_message_id: msgId })
    .eq('id', notif.id)

  console.log(`[Syndic] Envoi réussi — notification ${notif.id}`)
  return { success: true, notification_id: notif.id }
}
