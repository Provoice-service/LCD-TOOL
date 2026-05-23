import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { incident_id, message, reminder_type = 'team' } = await req.json()

  if (!incident_id) {
    return NextResponse.json({ error: 'incident_id requis' }, { status: 400 })
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const [reminder, comment] = await Promise.all([
    supabase.from('sav_reminders').insert({
      incident_id,
      reminder_type,
      scheduled_at: now,
      sent_at: now,
      message: message ?? 'Relance manuelle',
      status: 'sent',
    }),
    supabase.from('incident_comments').insert({
      incident_id,
      author: 'Gestionnaire',
      content: message ?? 'Relance manuelle envoyée',
      type: 'reminder',
    }),
  ])

  await supabase
    .from('incidents')
    .update({ last_reminder_at: now })
    .eq('id', incident_id)

  if (reminder.error) {
    return NextResponse.json({ error: reminder.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
