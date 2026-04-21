import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // ── Vérification secret ──────────────────────────────────────────────────
    const authHeader = request.headers.get('x-webhook-secret') ?? request.headers.get('authorization')
    const expected   = process.env.CRM_WEBHOOK_SECRET
    if (expected && authHeader !== expected && authHeader !== `Bearer ${expected}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      full_name, email, phone, source = 'other', source_detail,
      pipeline_type = 'service_client', utm_campaign, utm_source,
      utm_medium, utm_content, notes, company_name, city, country,
      referral_name, nb_properties, monthly_revenue_potential, priority = 'normale',
    } = body

    if (!full_name && !email && !phone) {
      return Response.json({ error: 'Au moins un champ identifiant requis (full_name, email ou phone)' }, { status: 400 })
    }

    const supabase = await createClient()

    // ── Créer le lead ────────────────────────────────────────────────────────
    const { data: lead, error: leadErr } = await supabase
      .from('crm_leads')
      .insert({
        pipeline_type,
        full_name:     full_name ?? null,
        company_name:  company_name ?? null,
        email:         email ?? null,
        phone:         phone ?? null,
        city:          city ?? null,
        country:       country ?? 'MA',
        source,
        source_detail: source_detail ?? null,
        referral_name: referral_name ?? null,
        utm_campaign:  utm_campaign ?? null,
        utm_source:    utm_source ?? null,
        utm_medium:    utm_medium ?? null,
        utm_content:   utm_content ?? null,
        notes:         notes ?? null,
        nb_properties: nb_properties ?? null,
        monthly_revenue_potential: monthly_revenue_potential ?? null,
        priority,
        stage: 'lead',
      })
      .select('id')
      .single()

    if (leadErr || !lead) {
      return Response.json({ error: leadErr?.message }, { status: 500 })
    }

    // ── Créer activité inbound ───────────────────────────────────────────────
    await supabase.from('crm_activities').insert({
      lead_id:       lead.id,
      activity_type: 'inbound',
      title:         `Lead entrant via ${source}`,
      content:       [
        notes && `Notes: ${notes}`,
        source_detail && `Source detail: ${source_detail}`,
        utm_campaign && `Campagne: ${utm_campaign}`,
        utm_source && `UTM source: ${utm_source}`,
      ].filter(Boolean).join('\n') || null,
    })

    console.log(`[CRM Webhook] Nouveau lead créé: ${lead.id} — source: ${source} — pipeline: ${pipeline_type}`)
    return Response.json({ success: true, lead_id: lead.id })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[CRM Webhook] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
