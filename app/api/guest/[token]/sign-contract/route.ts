import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  // Récupérer ip
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  const body = await req.json() as { signature_image: string }
  const { signature_image } = body

  if (!signature_image) return NextResponse.json({ error: 'signature_image required' }, { status: 400 })

  // Charger réservation via token
  const { data: res } = await svc
    .from('reservations')
    .select('id, guest_id, guest_page_token')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const signedAt = new Date().toISOString()

  // Enregistrer signature + marquer signé
  await svc.from('reservations').update({
    contract_signed:          true,
    contract_signed_at:       signedAt,
    contract_signed_ip:       ip,
    contract_signature_image: signature_image,
  }).eq('id', res.id)

  // Générer PDF via l'API interne
  const baseUrl = req.nextUrl.origin
  let pdfUrl: string | null = null

  try {
    const pdfRes = await fetch(`${baseUrl}/api/contract/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservation_id:  res.id,
        signature_image,
        signed_at:       signedAt,
        signed_ip:       ip,
      }),
    })
    if (pdfRes.ok) {
      const pdfData = await pdfRes.json() as { pdf_url?: string }
      pdfUrl = pdfData.pdf_url ?? null
    }
  } catch {
    // PDF non bloquant
  }

  // Envoyer email via Resend si configuré
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && pdfUrl) {
    try {
      const { data: guest } = await svc
        .from('guests')
        .select('full_name, email')
        .eq('id', res.guest_id)
        .single()

      if (guest?.email) {
        const { data: reservation } = await svc
          .from('reservations')
          .select('property:properties(name)')
          .eq('id', res.id)
          .single()

        const propertyName = (reservation?.property as unknown as { name: string } | null)?.name ?? 'votre logement'

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    'Alma Keys <noreply@almakeys.com>',
            to:      guest.email,
            subject: `Votre contrat signé — ${propertyName}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
                <h2 style="color:#C4A044;">ALMA KEYS</h2>
                <p>Bonjour ${guest.full_name},</p>
                <p>Votre contrat de location a été signé électroniquement le ${new Date(signedAt).toLocaleDateString('fr-FR')}.</p>
                <p>
                  <a href="${pdfUrl}" style="display:inline-block;background:#C4A044;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                    Télécharger votre contrat (PDF)
                  </a>
                </p>
                <p style="color:#666;font-size:12px;">Alma Keys — Gestion Immobilière Premium</p>
              </div>
            `,
          }),
        })
      }
    } catch {
      // Email non bloquant
    }
  }

  // Créer notification inbox
  void svc.from('messages').insert({
    content:    `Contrat signé électroniquement par le voyageur`,
    type:       'contract_signed',
    read:       false,
    meta:       { reservation_id: res.id, pdf_url: pdfUrl, signed_at: signedAt },
  })

  return NextResponse.json({ success: true, signed_at: signedAt, pdf_url: pdfUrl })
}
