import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select('id, identity_documents')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const formData = await req.formData()
  const file        = formData.get('file') as File | null
  const adultName   = (formData.get('adult_name') as string | null) ?? 'Voyageur'
  const docType     = (formData.get('doc_type') as string | null)   ?? 'passeport'
  const adultIndex  = parseInt((formData.get('adult_index') as string | null) ?? '0', 10)

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const ext      = file.name.split('.').pop() ?? 'jpg'
  const filename = `${token}/${adultIndex}_${Date.now()}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { data: upload, error: upErr } = await svc.storage
    .from('guest-documents')
    .upload(filename, buffer, { contentType: file.type || 'image/jpeg', upsert: true })

  if (upErr || !upload) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  const { data: urlData } = svc.storage.from('guest-documents').getPublicUrl(upload.path)
  const url = urlData.publicUrl

  // Append to identity_documents array
  const existing = (res.identity_documents as object[] | null) ?? []
  const newDoc = { adult_name: adultName, doc_type: docType, url, uploaded_at: new Date().toISOString(), adult_index: adultIndex }
  const updated = [...existing.filter((d: unknown) => (d as { adult_index: number }).adult_index !== adultIndex), newDoc]

  const resUpdate: Record<string, unknown> = { identity_documents: updated }
  // Premier document : mettre aussi id_received + id_document_url
  if (adultIndex === 0) {
    resUpdate.id_received = true
    resUpdate.id_document_url = url
    resUpdate.id_document_uploaded_at = new Date().toISOString()
  }

  await svc.from('reservations').update(resUpdate).eq('id', res.id)

  return NextResponse.json({ ok: true, url })
}
