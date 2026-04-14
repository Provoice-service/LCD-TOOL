import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTempCode as tuyaGenerate } from '@/lib/locks/tuya'
import { createAccessCode as nukiCreate } from '@/lib/locks/nuki'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface AccessResponse {
  code: string
  lock_type: string
  instructions: string
  test_mode: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { reservation_id } = await request.json()
    if (!reservation_id) {
      return Response.json({ error: 'reservation_id requis' }, { status: 400 })
    }

    const supabase = await createClient()

    // ── 1. Récupérer réservation + logement ──────────────────────────────────
    const { data: res, error: resErr } = await supabase
      .from('reservations')
      .select(`
        id, check_in, check_out, access_type_override,
        guest:guests(full_name),
        property:properties(
          id, name, access_type, tuya_device_id, house_rules,
          wifi_name, wifi_pass
        )
      `)
      .eq('id', reservation_id)
      .single()

    if (resErr || !res) {
      return Response.json({ error: `Réservation introuvable: ${resErr?.message}` }, { status: 404 })
    }

    const property = res.property as any
    const guest    = res.guest as any
    const checkIn  = res.check_in  ? new Date(res.check_in)  : new Date()
    const checkOut = res.check_out ? new Date(res.check_out) : new Date(Date.now() + 86_400_000 * 3)

    const lockType: string = res.access_type_override ?? property?.access_type ?? 'key_box'

    // ── 2. Générer le code selon le type ─────────────────────────────────────
    let code        = ''
    let instructions = ''
    let testMode    = false

    if (lockType === 'tuya' || lockType === 'smartlife') {
      const deviceId = property?.tuya_device_id

      if (!deviceId || !process.env.TUYA_CLIENT_ID || !process.env.TUYA_CLIENT_SECRET) {
        console.warn('[Access] TUYA_NOT_CONFIGURED')
        testMode = true
        code = Math.floor(100000 + Math.random() * 900000).toString()
      } else {
        const result = await tuyaGenerate(deviceId, checkIn, checkOut)
        code = result.code
      }

      instructions = `Code valable du ${checkIn.toLocaleDateString('fr-FR')} au ${checkOut.toLocaleDateString('fr-FR')}.\nEntrez le code sur le clavier de la serrure puis appuyez sur #.`

    } else if (lockType === 'nuki') {
      const smartlockId = property?.tuya_device_id // réutilise le champ device_id pour Nuki

      if (!smartlockId || !process.env.NUKI_API_TOKEN) {
        console.warn('[Access] NUKI_NOT_CONFIGURED')
        testMode = true
        code = Math.floor(100000 + Math.random() * 900000).toString()
      } else {
        const name = `LCD-${guest?.full_name ?? 'Voyageur'}-${reservation_id.slice(0, 8)}`
        const result = await nukiCreate(smartlockId, checkIn, checkOut, name)
        code = result.code
      }

      instructions = `Code d'accès Nuki valable du ${checkIn.toLocaleDateString('fr-FR')} au ${checkOut.toLocaleDateString('fr-FR')}.\nSaisissez le code sur le clavier Nuki.`

    } else {
      // key_box — code manuel / instructions
      code = Math.floor(100000 + Math.random() * 900000).toString()
      testMode = false
      instructions = property?.house_rules
        ? `Instructions d'accès :\n${property.house_rules}`
        : 'Récupérez la clé dans la boîte à clés avec le code ci-dessus.'
    }

    // ── 3. Sauvegarder dans reservations ─────────────────────────────────────
    await supabase
      .from('reservations')
      .update({
        access_code:      code,
        access_code_sent: true,
      })
      .eq('id', reservation_id)

    // ── 4. Log dans access_logs ───────────────────────────────────────────────
    await supabase.from('access_logs').insert({
      reservation_id,
      property_id:    property?.id,
      lock_type:      lockType,
      code_generated: code,
      expires_at:     checkOut.toISOString(),
    })

    console.log(`[Access] Code généré pour réservation ${reservation_id} — type: ${lockType}${testMode ? ' (TEST)' : ''}`)

    const result: AccessResponse = { code, lock_type: lockType, instructions, test_mode: testMode }
    return Response.json(result)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Access] Erreur:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
