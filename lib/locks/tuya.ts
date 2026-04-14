// =============================================================================
// Tuya / SmartLife Cloud API — wrapper LCD Tool
// Docs : https://developer.tuya.com/en/docs/cloud/temporary-password
// =============================================================================

const BASE_URL    = process.env.TUYA_BASE_URL    ?? 'https://openapi.tuyaeu.com'
const CLIENT_ID   = process.env.TUYA_CLIENT_ID   ?? ''
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET ?? ''

// ── Helpers crypto ────────────────────────────────────────────────────────────

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

// ── Auth token ────────────────────────────────────────────────────────────────

interface TuyaTokenResponse {
  result: { access_token: string; expire_time: number }
  success: boolean
  msg?: string
}

async function getAccessToken(): Promise<string> {
  const t = Date.now().toString()
  const str = `${CLIENT_ID}${t}`
  const sign = await hmacSha256(CLIENT_SECRET, str)

  const res = await fetch(`${BASE_URL}/v1.0/token?grant_type=1`, {
    headers: {
      client_id: CLIENT_ID,
      sign,
      t,
      sign_method: 'HMAC-SHA256',
    },
  })

  const data: TuyaTokenResponse = await res.json()
  if (!data.success) throw new Error(`Tuya auth failed: ${data.msg}`)
  return data.result.access_token
}

function signedHeaders(token: string, t: string, sign: string) {
  return {
    'Content-Type': 'application/json',
    client_id: CLIENT_ID,
    access_token: token,
    sign,
    t,
    sign_method: 'HMAC-SHA256',
  }
}

// ── Générer un code temporaire ────────────────────────────────────────────────

export interface TuyaCodeResult {
  codeId: string
  code: string
}

export async function generateTempCode(
  deviceId: string,
  checkIn: Date,
  checkOut: Date
): Promise<TuyaCodeResult> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('TUYA_NOT_CONFIGURED — returning test code')
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    return { codeId: `test-${Date.now()}`, code }
  }

  const token = await getAccessToken()
  const t = Date.now().toString()
  const body = JSON.stringify({
    name: `LCD-${deviceId}-${Date.now()}`,
    password: Math.floor(100000 + Math.random() * 900000).toString(),
    effective_time: Math.floor(checkIn.getTime() / 1000),
    invalid_time: Math.floor(checkOut.getTime() / 1000),
    type: 0, // code temporaire
  })

  const strToSign = `${CLIENT_ID}${token}${t}POST\n${await sha256(body)}\n\n/v1.0/devices/${deviceId}/door-lock/temp-passwords`
  const sign = await hmacSha256(CLIENT_SECRET, strToSign)

  const res = await fetch(
    `${BASE_URL}/v1.0/devices/${deviceId}/door-lock/temp-passwords`,
    { method: 'POST', headers: signedHeaders(token, t, sign), body }
  )

  const data = await res.json()
  if (!data.success) throw new Error(`Tuya createCode failed: ${data.msg}`)
  return { codeId: String(data.result.id), code: data.result.password }
}

// ── Révoquer un code ──────────────────────────────────────────────────────────

export async function revokeTempCode(deviceId: string, codeId: string): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('TUYA_NOT_CONFIGURED — skipping revoke')
    return
  }

  const token = await getAccessToken()
  const t = Date.now().toString()
  const strToSign = `${CLIENT_ID}${token}${t}DELETE\n\n\n/v1.0/devices/${deviceId}/door-lock/temp-passwords/${codeId}`
  const sign = await hmacSha256(CLIENT_SECRET, strToSign)

  await fetch(
    `${BASE_URL}/v1.0/devices/${deviceId}/door-lock/temp-passwords/${codeId}`,
    { method: 'DELETE', headers: signedHeaders(token, t, sign) }
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256(message: string): Promise<string> {
  const enc = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(message))
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
