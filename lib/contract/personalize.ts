import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface ContractVars {
  guest_name: string
  property_name: string
  property_address: string
  check_in_date: string
  check_out_date: string
  check_in_time: string
  check_out_time: string
  nb_guests: string
  deposit_amount: string
  total_amount: string
  platform: string
  today_date: string
}

export function buildVars(data: {
  guestName: string
  propertyName: string
  propertyAddress: string | null
  checkIn: string | null
  checkOut: string | null
  checkInTime: string | null
  checkOutTime: string | null
  numGuests: number | null
  depositAmount: number | null
  totalAmount: number
  platform: string
}): ContractVars {
  const fmtDate = (d: string | null, locale = fr) =>
    d ? format(new Date(d), 'd MMMM yyyy', { locale }) : '—'

  return {
    guest_name:       data.guestName,
    property_name:    data.propertyName,
    property_address: data.propertyAddress ?? '—',
    check_in_date:    fmtDate(data.checkIn),
    check_out_date:   fmtDate(data.checkOut),
    check_in_time:    data.checkInTime ?? '—',
    check_out_time:   data.checkOutTime ?? '—',
    nb_guests:        String(data.numGuests ?? '—'),
    deposit_amount:   data.depositAmount ? `${data.depositAmount.toLocaleString('fr')} MAD` : '—',
    total_amount:     `${data.totalAmount.toLocaleString('fr')}`,
    platform:         data.platform,
    today_date:       format(new Date(), 'd MMMM yyyy', { locale: fr }),
  }
}

export function personalize(text: string, vars: ContractVars): string {
  let result = text
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

export function parseArticles(text: string): Array<{ number: number; title: string; body: string }> {
  const articles: Array<{ number: number; title: string; body: string }> = []
  // Match "N. TITLE\ntext..." blocks
  const regex = /^(\d+)\.\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ''()\s&/]+)\n([\s\S]*?)(?=\n\d+\.\s+[A-Z]|$)/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    articles.push({
      number: parseInt(match[1]),
      title:  match[2].trim(),
      body:   match[3].trim(),
    })
  }
  return articles
}
