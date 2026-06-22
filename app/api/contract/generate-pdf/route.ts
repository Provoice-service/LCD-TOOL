import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildVars, personalize, parseArticles, type ContractVars } from '@/lib/contract/personalize'
import React from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Styles PDF
const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#1A1A1A' },
  header:      { marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E8E4DC' },
  brand:       { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#C4A044', marginBottom: 4 },
  title:       { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', marginBottom: 2 },
  subtitle:    { fontSize: 9, color: '#666666', marginBottom: 8 },
  parties:     { marginBottom: 12 },
  partyRow:    { flexDirection: 'row', marginBottom: 3 },
  partyLabel:  { width: 100, fontSize: 8, color: '#999999', fontFamily: 'Helvetica-Bold' },
  partyValue:  { flex: 1, fontSize: 8, color: '#1A1A1A' },
  article:     { marginBottom: 10 },
  articleNum:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#C4A044', marginBottom: 2 },
  articleTitle:{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', marginBottom: 3 },
  articleBody: { fontSize: 8, color: '#333333', lineHeight: 1.5 },
  highlight:   { backgroundColor: '#FFF8F0', padding: 4, borderLeftWidth: 2, borderLeftColor: '#C4A044' },
  sigPage:     { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#1A1A1A' },
  sigTitle:    { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 16, color: '#1A1A1A' },
  sigBox:      { border: 1, borderColor: '#E8E4DC', padding: 12, marginBottom: 12, borderRadius: 4 },
  sigLabel:    { fontSize: 8, color: '#999999', marginBottom: 8 },
  sigImg:      { height: 80, objectFit: 'contain' },
  sigInfo:     { fontSize: 8, color: '#666666', marginBottom: 4 },
  legal:       { marginTop: 24, padding: 10, backgroundColor: '#F8F7F5', borderRadius: 4 },
  legalText:   { fontSize: 7, color: '#999999', lineHeight: 1.5 },
  footer:      { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 7, color: '#999999', textAlign: 'center' },
})

const HIGHLIGHTED = [5, 7, 8, 15, 17]

interface PdfData {
  contentFr: string
  contentEn: string | null
  vars: ContractVars
  signatureImage: string
  signedAt: string
  signedIp: string
}

function ContractPdf({ data }: { data: PdfData }) {
  const articlesFr = parseArticles(data.contentFr)
  const todayStr = format(new Date(data.signedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })

  return React.createElement(Document, { title: `Contrat — ${data.vars.property_name}` },
    // Page 1+ : corps du contrat
    React.createElement(Page, { size: 'A4', style: S.page },
      // Header
      React.createElement(View, { style: S.header },
        React.createElement(Text, { style: S.brand }, 'ALMA KEYS'),
        React.createElement(Text, { style: S.title }, 'CONTRAT DE LOCATION MEUBLÉE COURTE DURÉE'),
        React.createElement(Text, { style: S.subtitle }, 'FURNISHED SHORT-TERM RENTAL AGREEMENT'),
      ),
      // Parties
      React.createElement(View, { style: S.parties },
        ...[
          ['Bailleur / Lessor', 'ALMA KEYS — Gestion Immobilière'],
          ['Locataire / Tenant', data.vars.guest_name],
          ['Logement / Property', `${data.vars.property_name} — ${data.vars.property_address}`],
          ['Période / Period', `${data.vars.check_in_date} → ${data.vars.check_out_date}`],
          ['Voyageurs / Guests', data.vars.nb_guests],
          ['Plateforme / Platform', data.vars.platform],
          ['Date signature', todayStr],
        ].map(([label, value]) =>
          React.createElement(View, { key: label, style: S.partyRow },
            React.createElement(Text, { style: S.partyLabel }, label + ' :'),
            React.createElement(Text, { style: S.partyValue }, value),
          )
        ),
      ),
      // Articles
      ...articlesFr.map(art =>
        React.createElement(View, {
          key: art.number,
          style: HIGHLIGHTED.includes(art.number) ? { ...S.article, ...S.highlight } : S.article,
        },
          React.createElement(Text, { style: S.articleTitle },
            `${art.number}. ${art.title}`
          ),
          React.createElement(Text, { style: S.articleBody }, art.body),
        )
      ),
      // Footer
      React.createElement(Text, { style: S.footer, fixed: true },
        `Contrat Alma Keys — Signé électroniquement le ${todayStr} — IP: ${data.signedIp}`
      ),
    ),
    // Page signature
    React.createElement(Page, { size: 'A4', style: S.sigPage },
      React.createElement(Text, { style: S.sigTitle }, 'PAGE DE SIGNATURE / SIGNATURE PAGE'),
      React.createElement(View, { style: S.sigBox },
        React.createElement(Text, { style: S.sigLabel }, 'Signature du locataire / Tenant signature'),
        data.signatureImage
          ? React.createElement('Image' as 'img', { style: S.sigImg, src: data.signatureImage })
          : React.createElement(Text, { style: S.articleBody }, '(signature électronique)'),
      ),
      React.createElement(Text, { style: S.sigInfo }, `Nom / Name : ${data.vars.guest_name}`),
      React.createElement(Text, { style: S.sigInfo }, `Signé le / Signed on : ${todayStr}`),
      React.createElement(Text, { style: S.sigInfo }, `Adresse IP / IP Address : ${data.signedIp}`),
      React.createElement(View, { style: S.legal },
        React.createElement(Text, { style: S.legalText },
          'Ce document constitue un contrat valide conformément au droit marocain. ' +
          'Articles 1 à 23 lus et acceptés. ' +
          'Signé électroniquement — valeur juridique équivalente à une signature manuscrite conformément à la loi n° 53-05 relative à l\'échange électronique de données juridiques.'
        ),
      ),
    ),
  )
}

export async function POST(req: NextRequest) {
  const svc = createServiceClient()
  const body = await req.json() as { reservation_id: string; signature_image?: string; signed_at?: string; signed_ip?: string }
  const { reservation_id, signature_image = '', signed_at, signed_ip = '' } = body

  if (!reservation_id) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })

  // Charger données réservation
  const { data: res } = await svc
    .from('reservations')
    .select(`
      id, platform, total_amount, num_guests, check_in, check_out,
      contract_signed_at, contract_signed_ip, contract_signature_image,
      guest:guests(full_name),
      property:properties(name, address, check_in_time, check_out_time, deposit_amount, country)
    `)
    .eq('id', reservation_id)
    .single()

  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const guest    = res.guest as unknown as { full_name: string } | null
  const property = res.property as unknown as { name: string; address: string | null; check_in_time: string | null; check_out_time: string | null; deposit_amount: number | null; country: string | null } | null

  const { data: template } = await svc
    .from('contract_templates')
    .select('content_fr, content_en')
    .eq('is_active', true)
    .eq('country', property?.country ?? 'MA')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!template) return NextResponse.json({ error: 'No template' }, { status: 404 })

  const vars = buildVars({
    guestName:       guest?.full_name ?? 'Voyageur',
    propertyName:    property?.name ?? '—',
    propertyAddress: property?.address ?? null,
    checkIn:         res.check_in,
    checkOut:        res.check_out,
    checkInTime:     property?.check_in_time ?? null,
    checkOutTime:    property?.check_out_time ?? null,
    numGuests:       res.num_guests,
    depositAmount:   property?.deposit_amount ?? null,
    totalAmount:     res.total_amount,
    platform:        res.platform,
  })

  const sigImage = signature_image || res.contract_signature_image || ''
  const sigAt    = signed_at || res.contract_signed_at || new Date().toISOString()
  const sigIp    = signed_ip || res.contract_signed_ip || ''

  const pdfData: PdfData = {
    contentFr:      personalize(template.content_fr, vars),
    contentEn:      template.content_en ? personalize(template.content_en, vars) : null,
    vars,
    signatureImage: sigImage,
    signedAt:       sigAt,
    signedIp:       sigIp,
  }

  const buffer = await renderToBuffer(
    React.createElement(ContractPdf, { data: pdfData }) as React.ReactElement<DocumentProps>
  )

  // Upload vers Supabase Storage
  const filename = `contract_${reservation_id}_${Date.now()}.pdf`
  const { data: upload } = await svc.storage
    .from('contracts')
    .upload(filename, buffer, { contentType: 'application/pdf', upsert: true })

  if (!upload) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  const { data: urlData } = svc.storage.from('contracts').getPublicUrl(upload.path)

  await svc.from('reservations').update({
    contract_pdf_url: urlData.publicUrl,
    contract_url:     urlData.publicUrl,
  }).eq('id', reservation_id)

  return NextResponse.json({ pdf_url: urlData.publicUrl, buffer: buffer.toString('base64') })
}
