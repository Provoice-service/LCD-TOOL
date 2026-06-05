import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select('id, property:properties(syndic_required, syndic_phone, id)')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `id-documents/${res.id}_${Date.now()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { data: upload, error: uploadErr } = await svc.storage
    .from('property-documents')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = svc.storage.from('property-documents').getPublicUrl(upload.path)

  await svc.from('reservations').update({
    id_received: true,
    id_document_url: urlData.publicUrl,
    id_document_uploaded_at: new Date().toISOString(),
  }).eq('id', res.id)

  // Créer entrée dans property_documents
  await svc.from('property_documents').insert({
    reservation_id: res.id,
    document_type: 'passport',
    file_url: urlData.publicUrl,
    file_name: file.name,
    received_via: 'guest_page',
    verified: false,
  })

  // Déclencher syndic si configuré
  const property = res.property as unknown as { syndic_required: boolean; syndic_phone: string | null; id: string } | null
  if (property?.syndic_required) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/syndic/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservation_id: res.id, force: false }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, url: urlData.publicUrl })
}
