import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndSendSyndicDocuments } from '@/lib/syndic/sendSyndicDocuments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData      = await request.formData()
    const file          = formData.get('file') as File | null
    const reservationId = formData.get('reservation_id') as string | null
    const documentType  = (formData.get('document_type') as string | null) ?? 'other'
    const receivedVia   = (formData.get('received_via')  as string | null) ?? 'manual_upload'

    if (!file || !reservationId) {
      return Response.json({ error: 'file et reservation_id requis' }, { status: 400 })
    }

    const supabase = await createClient()

    // ── Vérifier la réservation ──────────────────────────────────────────────
    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .select(`
        id, contract_signed, id_received, deposit_ok,
        property:properties(id, syndic_required),
        guest:guests(id)
      `)
      .eq('id', reservationId)
      .single()

    if (resErr || !reservation) {
      return Response.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    const p = reservation.property as any
    const g = reservation.guest as any

    // ── Upload dans Supabase Storage ─────────────────────────────────────────
    const ext          = file.name.split('.').pop() ?? 'jpg'
    const fileName     = `${documentType}_${g?.id ?? 'unknown'}_${Date.now()}.${ext}`
    const storagePath  = `${reservationId}/${fileName}`
    const arrayBuffer  = await file.arrayBuffer()
    const buffer       = Buffer.from(arrayBuffer)

    const { data: uploaded, error: uploadErr } = await supabase.storage
      .from('property-documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (uploadErr || !uploaded) {
      return Response.json({ error: `Erreur upload: ${uploadErr?.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('property-documents')
      .getPublicUrl(storagePath)
    const fileUrl = urlData?.publicUrl ?? null

    // ── Créer l'entrée dans property_documents ───────────────────────────────
    const { data: doc, error: docErr } = await supabase
      .from('property_documents')
      .insert({
        reservation_id: reservationId,
        property_id:    p?.id ?? null,
        guest_id:       g?.id ?? null,
        document_type:  documentType,
        file_url:       fileUrl,
        file_name:      fileName,
        received_via:   receivedVia,
        received_at:    new Date().toISOString(),
      })
      .select('id')
      .single()

    if (docErr || !doc) {
      return Response.json({ error: `Erreur création document: ${docErr?.message}` }, { status: 500 })
    }

    // Marquer id_received si c'est un passeport ou CNI
    if (documentType === 'passport' || documentType === 'cni') {
      await supabase
        .from('reservations')
        .update({ id_received: true })
        .eq('id', reservationId)
    }

    // ── Déclencher envoi syndic si checklist complète ────────────────────────
    const idReceived = reservation.id_received || documentType === 'passport' || documentType === 'cni'
    if (reservation.contract_signed && idReceived && reservation.deposit_ok) {
      checkAndSendSyndicDocuments(reservationId).catch(console.error)
    }

    return Response.json({ document_id: doc.id, file_url: fileUrl })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Documents Upload] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
