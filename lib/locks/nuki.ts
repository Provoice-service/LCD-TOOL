// =============================================================================
// Nuki Web API — wrapper LCD Tool
// Docs : https://developer.nuki.io/page/nuki-web-api-111
// =============================================================================

const NUKI_BASE   = 'https://api.nuki.io'
const NUKI_TOKEN  = process.env.NUKI_API_TOKEN ?? ''

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${NUKI_TOKEN}`,
  }
}

// ── Créer un code d'accès temporaire ─────────────────────────────────────────

export interface NukiCodeResult {
  codeId: number
  code: string // code numérique 6 chiffres
}

export async function createAccessCode(
  smartlockId: string,
  checkIn: Date,
  checkOut: Date,
  name: string
): Promise<NukiCodeResult> {
  if (!NUKI_TOKEN) {
    console.warn('NUKI_NOT_CONFIGURED — returning test code')
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    return { codeId: Date.now(), code }
  }

  // Générer un code 6 chiffres aléatoire (Nuki le stocke, pas de génération auto)
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  const body = JSON.stringify({
    smartlockId: parseInt(smartlockId, 10),
    name,
    code: parseInt(code, 10),
    allowedFromDate: checkIn.toISOString(),
    allowedUntilDate: checkOut.toISOString(),
    type: 3, // type = temporary access code
    enabled: true,
  })

  const res = await fetch(`${NUKI_BASE}/smartlock/auth`, {
    method: 'PUT',
    headers: authHeaders(),
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Nuki createAccessCode failed (${res.status}): ${text}`)
  }

  // Nuki renvoie l'id dans le header Location ou dans le body selon version
  const data = await res.json().catch(() => ({}))
  const codeId: number = data?.smartlockAuthId ?? Date.now()

  return { codeId, code }
}

// ── Supprimer un code d'accès ─────────────────────────────────────────────────

export async function deleteAccessCode(
  smartlockId: string,
  codeId: number
): Promise<void> {
  if (!NUKI_TOKEN) {
    console.warn('NUKI_NOT_CONFIGURED — skipping delete')
    return
  }

  const res = await fetch(
    `${NUKI_BASE}/smartlock/${smartlockId}/auth/${codeId}`,
    { method: 'DELETE', headers: authHeaders() }
  )

  if (!res.ok) {
    const text = await res.text()
    console.error(`Nuki deleteAccessCode failed (${res.status}): ${text}`)
  }
}
