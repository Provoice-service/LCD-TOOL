import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import OpenAI from 'openai'

interface AiResult {
  is_valid_document: boolean
  document_type: 'passeport' | 'cni' | 'carte_sejour' | 'inconnu'
  is_expired: boolean | null
  expiry_date: string | null
  full_name: string | null
  nationality: string | null
  document_number: string | null
  birth_date: string | null
  image_quality: 'bonne' | 'floue' | 'trop_sombre' | 'trop_claire'
  rejection_reason: string | null
}

const PROMPT = `Tu es un expert en vérification de documents d'identité.
Analyse cette image et réponds UNIQUEMENT en JSON strict avec ces champs :
{
  "is_valid_document": boolean,
  "document_type": "passeport" | "cni" | "carte_sejour" | "inconnu",
  "is_expired": boolean | null,
  "expiry_date": "YYYY-MM-DD" | null,
  "full_name": string | null,
  "nationality": string | null,
  "document_number": string | null,
  "birth_date": "YYYY-MM-DD" | null,
  "image_quality": "bonne" | "floue" | "trop_sombre" | "trop_claire",
  "rejection_reason": string | null
}
Si l'image ne montre pas un document d'identité (photo de pieds, selfie, paysage, etc.), mettre is_valid_document: false et rejection_reason: "Image non reconnue comme document d identité".`

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select('id, identity_documents')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const body = await req.json() as { document_url: string; adult_name?: string; adult_index?: number }
  const { document_url, adult_name = 'Voyageur', adult_index = 0 } = body

  if (!document_url) return NextResponse.json({ error: 'document_url required' }, { status: 400 })

  if (!process.env.OPENAI_API_KEY) {
    // Pas de clé API → validation manuelle requise
    return NextResponse.json({
      valid: true,
      extraction_status: 'manual_review',
      message: 'Vérification manuelle requise',
      data: null,
    })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let aiResult: AiResult
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: document_url, detail: 'high' } },
        ],
      }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    })
    aiResult = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as AiResult
  } catch {
    return NextResponse.json({
      valid: false,
      extraction_status: 'error',
      message: 'Erreur lors de l\'analyse IA. Veuillez réessayer.',
      data: null,
    }, { status: 500 })
  }

  // Déterminer statut
  let extractionStatus: string
  let message: string
  let valid: boolean

  if (!aiResult.is_valid_document) {
    extractionStatus = 'invalid'
    message = aiResult.rejection_reason ?? 'Document non reconnu — veuillez uploader votre passeport ou CNI'
    valid = false
  } else if (aiResult.is_expired === true) {
    extractionStatus = 'expired'
    message = 'Document expiré — veuillez utiliser un document valide'
    valid = false
  } else if (aiResult.image_quality === 'floue') {
    extractionStatus = 'poor_quality'
    message = 'Image floue — veuillez reprendre la photo avec plus de lumière'
    valid = false
  } else if (aiResult.image_quality === 'trop_sombre') {
    extractionStatus = 'poor_quality'
    message = 'Image trop sombre — veuillez reprendre la photo dans un endroit mieux éclairé'
    valid = false
  } else if (aiResult.image_quality === 'trop_claire') {
    extractionStatus = 'poor_quality'
    message = 'Image trop claire — évitez les reflets et la sur-exposition'
    valid = false
  } else {
    extractionStatus = 'verified'
    message = `Document valide${aiResult.full_name ? ` — ${aiResult.full_name}` : ''}`
    valid = true
  }

  // Mise à jour identity_documents avec le résultat IA
  const existingDocs = (res.identity_documents as Array<Record<string, unknown>>) ?? []
  const updatedDocs = existingDocs.map(d => {
    if (d.adult_index === adult_index) {
      return { ...d, extraction_status: extractionStatus, ai_result: aiResult, validated_at: new Date().toISOString() }
    }
    return d
  })
  // Si le doc n'est pas encore dans le tableau (ne devrait pas arriver)
  if (!updatedDocs.find(d => d.adult_index === adult_index)) {
    updatedDocs.push({ adult_index, adult_name, extraction_status: extractionStatus, ai_result: aiResult, validated_at: new Date().toISOString() })
  }

  await svc.from('reservations').update({ identity_documents: updatedDocs }).eq('id', res.id)

  return NextResponse.json({ valid, extraction_status: extractionStatus, message, data: aiResult })
}
