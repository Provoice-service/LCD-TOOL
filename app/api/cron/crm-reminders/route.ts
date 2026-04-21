import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Vercel Cron : déclencher à 8h chaque matin
// vercel.json → { "crons": [{ "path": "/api/cron/crm-reminders", "schedule": "0 8 * * *" }] }

export async function GET(request: NextRequest) {
  // Vérification simple pour les crons Vercel
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)

    // Leads avec action due aujourd'hui ou dépassée
    const { data: leads } = await supabase
      .from('crm_leads')
      .select('id, full_name, company_name, pipeline_type, stage, priority, next_action, next_action_date, phone, email')
      .lte('next_action_date', today)
      .not('next_action_date', 'is', null)
      .not('stage', 'in', '("churned","lost","active","acte","launched")')
      .order('priority', { ascending: true })
      .order('next_action_date', { ascending: true })

    if (!leads || leads.length === 0) {
      console.log('[CRM Cron] Aucune action due aujourd\'hui')
      return Response.json({ sent: 0 })
    }

    // Construire le corps de l'email
    const PIPELINE_LABELS: Record<string, string> = {
      service_client: 'Service Client',
      immobilier:     'Immobilier',
      expansion:      'Expansion',
    }

    const rows = leads.map(l => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 12px;font-weight:600">${l.full_name ?? l.company_name ?? 'Sans nom'}</td>
        <td style="padding:10px 12px;color:#6b7280">${PIPELINE_LABELS[l.pipeline_type] ?? l.pipeline_type}</td>
        <td style="padding:10px 12px">${l.stage}</td>
        <td style="padding:10px 12px;color:${l.priority==='haute'?'#dc2626':l.priority==='normale'?'#2563eb':'#6b7280'}">${l.priority}</td>
        <td style="padding:10px 12px">${l.next_action ?? '—'}</td>
        <td style="padding:10px 12px;color:#6b7280">${l.phone ?? l.email ?? '—'}</td>
        <td style="padding:10px 12px;color:${l.next_action_date! < today ? '#dc2626' : '#16a34a'};font-weight:600">
          ${new Date(l.next_action_date!).toLocaleDateString('fr')}${l.next_action_date! < today ? ' ⚠ EN RETARD' : ''}
        </td>
      </tr>
    `).join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#111">
        <h2 style="color:#1e293b">📋 Actions CRM du jour — ${new Date().toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'long'})}</h2>
        <p style="color:#6b7280">${leads.length} action(s) à traiter aujourd'hui</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:20px;font-size:14px">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:10px 12px;text-align:left">Contact</th>
              <th style="padding:10px 12px;text-align:left">Pipeline</th>
              <th style="padding:10px 12px;text-align:left">Stage</th>
              <th style="padding:10px 12px;text-align:left">Priorité</th>
              <th style="padding:10px 12px;text-align:left">Action</th>
              <th style="padding:10px 12px;text-align:left">Contact</th>
              <th style="padding:10px 12px;text-align:left">Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#9ca3af">
          LCD Tool CRM — Récapitulatif automatique envoyé chaque matin à 8h
        </p>
      </body>
      </html>
    `

    // Envoi via Resend si configuré
    const RESEND_API_KEY    = process.env.RESEND_API_KEY
    const REMINDER_EMAIL_TO = process.env.CRM_REMINDER_EMAIL ?? 'morad.chliyah@gmail.com'

    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'LCD Tool CRM <crm@lcd-tool.com>',
          to:      [REMINDER_EMAIL_TO],
          subject: `📋 ${leads.length} action(s) CRM à traiter — ${new Date().toLocaleDateString('fr')}`,
          html,
        }),
      })
      const data = await res.json()
      console.log('[CRM Cron] Email envoyé:', data.id ?? JSON.stringify(data))
    } else {
      console.log('[CRM Cron] RESEND_API_KEY non configuré — email non envoyé')
      console.log('[CRM Cron] Leads dus:', leads.map(l=>`${l.full_name} (${l.next_action_date})`).join(', '))
    }

    return Response.json({ sent: leads.length, leads: leads.map(l => ({ id: l.id, name: l.full_name, date: l.next_action_date })) })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[CRM Cron] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
