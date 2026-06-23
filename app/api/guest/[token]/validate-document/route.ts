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
  name_matches: boolean
  name_match_confidence: 'exact' | 'probable' | 'different' | 'illisible'
}

function buildPrompt(declaredName?: string): string {
  const nameInstruction = declaredName
    ? `\nLe voyageur a déclaré s'appeler : "${declaredName}". Compare ce nom avec le nom lu sur le document et remplis les champs name_matches et name_match_confidence.`
    : '\nAucun nom déclaré — mets name_matches: true et name_match_confidence: "exact" par défaut.'

  return `Tu es un expert en vérification de documents d'identité.
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
  "rejection_reason": string | null,
  "name_matches": boolean,
  "name_match_confidence": "exact" | "probable" | "different" | "illisible"
}
Règles pour name_match_confidence :
- "exact" : le nom sur le document est identique ou très proche (accentuation, ordre prénom/nom)
- "probable" : ressemblance partielle, probablement la même personne
- "different" : les noms sont clairement différents, il s'agit de personnes différentes
- "illisible" : le nom sur le document n'est pas lisible
Si l'image ne montre pas un document d'identité (photo de pieds, selfie, paysage, etc.), mettre is_valid_document: false et rejection_reason: "Image non reconnue comme document d identité".${nameInstruction}`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const svc = createServiceClient()

  const { data: res } = await svc
    .from('reservations')
    .select('id, identity_documents')
    .eq('guest_page_token', token)
    .single()

  if (!res) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const body = await req.json() as {
    document_url: string
    adult_name?: string
    adult_index?: number
    declared_name?: string
  }
  const { document_url, adult_name = 'Voyageur', adult_index = 0, declared_name } = body

  if (!document_url) return NextResponse.json({ error: 'document_url required' }, { status: 400 })

  if (!process.env.OPENAI_API_KEY) {
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
          { type: 'text', text: buildPrompt(declared_name) },
          { type: 'image_url', image_url: { url: document_url, detail: 'high' } },
        ],
      }],
      response_format: { type: 'json_object' },
      max_tokens: 600,
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

  // ── Statut & message ────────────────────────────────────────────────────────
  let extractionStatus: string
  let message: string
  let valid: boolean

  if (!aiResult.is_valid_document) {
    extractionStatus = 'invalid'
    message = aiResult.rejection_reason ?? 'Document non reconnu — veuillez uploader votre passeport ou CNI'
    valid = false
  } else if (aiResult.name_match_confidence === 'illisible') {
    // Nom illisible → accepté mais revue manuelle
    extractionStatus = 'manual_review'
    message = 'Le nom sur le document n\'est pas lisible — vérification manuelle requise'
    valid = true
  } else if (
    declared_name &&
    aiResult.name_matches === false &&
    aiResult.name_match_confidence === 'different'
  ) {
    extractionStatus = 'invalid'
    const docName = aiResult.full_name ?? 'inconnu'
    message = `Le nom sur le document (${docName}) ne correspond pas au nom déclaré (${declared_name}).`
    valid = false
  } else if (aiResult.is_expired === true) {
    extractionStatus = 'expired'
    const expiry = aiResult.expiry_date
      ? ` (expiré le ${new Date(aiResult.expiry_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })})`
      : ''
    message = `Document expiré${expiry} — veuillez utiliser un document valide`
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

  // ── Mise à jour identity_documents ─────────────────────────────────────────
  const existingDocs = (res.identity_documents as Array<Record<string, unknown>>) ?? []
  const updatedDocs = existingDocs.map(d => {
    if (d.adult_index === adult_index) {
      return { ...d, extraction_status: extractionStatus, ai_result: aiResult, validated_at: new Date().toISOString() }
    }
    return d
  })
  if (!updatedDocs.find(d => d.adult_index === adult_index)) {
    updatedDocs.push({ adult_index, adult_name, extraction_status: extractionStatus, ai_result: aiResult, validated_at: new Date().toISOString() })
  }

  // ── Mise à jour guest_documents ────────────────────────────────────────────
  await svc.from('guest_documents')
    .update({
      extraction_status: extractionStatus,
      extracted_data: aiResult as unknown as Record<string, unknown>,
    })
    .eq('reservation_id', res.id)
    .eq('adult_index', adult_index)

  await svc.from('reservations').update({ identity_documents: updatedDocs }).eq('id', res.id)

  return NextResponse.json({ valid, extraction_status: extractionStatus, message, data: aiResult })
}
