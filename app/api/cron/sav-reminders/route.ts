import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Vercel Cron — toutes les heures : 0 * * * *
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const now = new Date()

  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, title, priority, status, taken_in_charge, updated_at, last_reminder_at, reminder_count, indemnisation_status, indemnisation_deadline')
    .neq('status', 'resolved')

  if (!incidents) return NextResponse.json({ processed: 0 })

  let created = 0

  for (const inc of incidents) {
    const age = (now.getTime() - new Date(inc.updated_at).getTime()) / 60_000 // minutes
    const lastReminder = inc.last_reminder_at
      ? (now.getTime() - new Date(inc.last_reminder_at).getTime()) / 3_600_000
      : Infinity

    let shouldRemind = false
    let reminderType: 'team' | 'provider' = 'team'
    let message = ''

    // Urgente non pris en charge depuis > 30 min
    if (inc.priority === 'urgente' && !inc.taken_in_charge && age > 30 && lastReminder > 1) {
      shouldRemind = true
      message = `⚠️ Incident URGENT non pris en charge depuis ${Math.round(age)} minutes !`
    }
    // Haute non pris en charge depuis > 2h
    else if (inc.priority === 'haute' && !inc.taken_in_charge && age > 120 && lastReminder > 2) {
      shouldRemind = true
      message = `Incident haute priorité non pris en charge depuis ${Math.round(age / 60)}h`
    }
    // Normale non pris en charge depuis > 24h
    else if (inc.priority === 'normale' && !inc.taken_in_charge && age > 1440 && lastReminder > 24) {
      shouldRemind = true
      message = `Incident sans prise en charge depuis ${Math.round(age / 60)}h`
    }
    // En cours sans mise à jour depuis > 48h
    else if (inc.status === 'in_progress' && age > 2880 && lastReminder > 48) {
      shouldRemind = true
      reminderType = 'provider'
      message = `Relance intervenant — incident en cours depuis ${Math.round(age / 1440)} jours sans mise à jour`
    }

    // Deadline indemnisation proche
    if (inc.indemnisation_status === 'a_declarer' && inc.indemnisation_deadline) {
      const daysLeft = Math.ceil(
        (new Date(inc.indemnisation_deadline).getTime() - now.getTime()) / 86_400_000,
      )
      if (daysLeft <= 3 && daysLeft >= 0 && lastReminder > 12) {
        shouldRemind = true
        reminderType = 'team'
        message = `⚠️ Deadline indemnisation dans ${daysLeft} jour(s) !`
      } else if (daysLeft < 0 && lastReminder > 24) {
        shouldRemind = true
        message = `🚨 DÉLAI EXPIRÉ — déclaration indemnisation impossible`
        // Log escalation
        await supabase.from('incident_comments').insert({
          incident_id: inc.id,
          author: 'Système',
          content: message,
          type: 'escalation',
        })
      }
    }

    if (shouldRemind) {
      await supabase.from('sav_reminders').insert({
        incident_id: inc.id,
        reminder_type: reminderType,
        scheduled_at: now.toISOString(),
        sent_at: now.toISOString(),
        message,
        status: 'sent',
      })
      await supabase.from('incident_comments').insert({
        incident_id: inc.id,
        author: 'Système',
        content: message,
        type: 'reminder',
      })
      await supabase
        .from('incidents')
        .update({ last_reminder_at: now.toISOString(), reminder_count: (inc.reminder_count ?? 0) + 1 })
        .eq('id', inc.id)
      created++
    }
  }

  // Envoyer email récap si RESEND_API_KEY configuré
  if (created > 0 && process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SAV Alma Keys <sav@almakeys.com>',
        to: process.env.ALERT_EMAIL ?? 'morad.chliyah@gmail.com',
        subject: `[SAV] ${created} relance(s) automatique(s) envoyée(s)`,
        text: `${created} rappel(s) SAV ont été générés automatiquement. Consultez le module SAV pour les détails.`,
      }),
    }).catch(() => null)
  }

  return NextResponse.json({ processed: incidents.length, reminders_created: created })
}
