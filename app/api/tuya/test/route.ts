import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BASE_URL      = process.env.TUYA_BASE_URL      ?? 'https://openapi.tuyaeu.com'
const CLIENT_ID     = process.env.TUYA_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET ?? ''

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function getTuyaToken(): Promise<string> {
  const t    = Date.now().toString()
  const sign = await hmacSha256(CLIENT_SECRET, `${CLIENT_ID}${t}`)
  const res  = await fetch(`${BASE_URL}/v1.0/token?grant_type=1`, {
    headers: { client_id: CLIENT_ID, sign, t, sign_method: 'HMAC-SHA256' },
  })
  const data = await res.json()
  if (!data.success) throw new Error(`Tuya auth: ${data.msg}`)
  return data.result.access_token
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get('device_id')

  if (!deviceId) {
    return Response.json({ error: 'device_id requis' }, { status: 400 })
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return Response.json({ test_mode: true, message: 'Tuya non configuré (TUYA_CLIENT_ID/TUYA_CLIENT_SECRET manquants)' })
  }

  try {
    const token = await getTuyaToken()
    const t     = Date.now().toString()
    const strToSign = `${CLIENT_ID}${token}${t}GET\n\n\n/v1.0/devices/${deviceId}`
    const sign  = await hmacSha256(CLIENT_SECRET, strToSign)

    const res = await fetch(`${BASE_URL}/v1.0/devices/${deviceId}`, {
      headers: {
        client_id:    CLIENT_ID,
        access_token: token,
        sign,
        t,
        sign_method: 'HMAC-SHA256',
      },
    })

    const data = await res.json()
    if (!data.success) {
      return Response.json({ online: false, device_name: deviceId, error: data.msg })
    }

    return Response.json({
      online:      data.result.online as boolean,
      device_name: data.result.name   as string,
      battery:     data.result.status?.find((s: { code: string; value: unknown }) => s.code === 'battery_percentage')?.value as number | undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
