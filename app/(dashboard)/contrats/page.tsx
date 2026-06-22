import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { FileText, CheckCircle2, Clock, Download } from 'lucide-react'

interface ContractRow {
  id: string
  check_in: string | null
  check_out: string | null
  contract_signed: boolean
  contract_signed_at: string | null
  contract_pdf_url: string | null
  contract_generated_at: string | null
  guest: { full_name: string } | null
  property: { name: string } | null
}

export default async function ContratsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase
    .from('reservations')
    .select(`
      id, check_in, check_out,
      contract_signed, contract_signed_at, contract_pdf_url, contract_generated_at,
      guest:guests(full_name),
      property:properties(name)
    `)
    .not('contract_generated_at', 'is', null)
    .order('contract_signed_at', { ascending: false, nullsFirst: false })
    .limit(100)

  const contracts = (rows ?? []) as unknown as ContractRow[]
  const signed   = contracts.filter(c => c.contract_signed).length
  const pending  = contracts.filter(c => !c.contract_signed).length

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), 'd MMM yyyy', { locale: fr }) : '—'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>Contrats</h1>
          <p className="text-sm mt-0.5" style={{ color: '#666666' }}>Gestion des contrats de location signés et en attente</p>
        </div>
        <Link
          href="/contrats/templates"
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: 'rgba(196,160,68,0.1)', color: '#A88830', border: '1px solid rgba(196,160,68,0.3)' }}
        >
          <FileText className="h-4 w-4" />
          Modèles de contrat
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total générés', value: contracts.length, color: '#1A1A1A' },
          { label: 'Signés', value: signed, color: '#2E7D52' },
          { label: 'En attente', value: pending, color: '#C4A044' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: '#FFFFFF', border: '1px solid #E8E4DC' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: '#999999' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E4DC' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid #E8E4DC' }}>
              {['Voyageur', 'Logement', 'Séjour', 'Statut', 'Signé le', 'PDF'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#999999' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#F0EDE8' }}>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#999999' }}>
                  Aucun contrat généré pour l'instant
                </td>
              </tr>
            ) : contracts.map(c => (
              <tr key={c.id} style={{ background: '#FFFFFF' }} className="hover:bg-[#FAFAF8] transition-colors">
                <td className="px-4 py-3 font-medium" style={{ color: '#1A1A1A' }}>
                  {c.guest?.full_name ?? '—'}
                </td>
                <td className="px-4 py-3" style={{ color: '#333333' }}>
                  {c.property?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666666' }}>
                  {fmtDate(c.check_in)} → {fmtDate(c.check_out)}
                </td>
                <td className="px-4 py-3">
                  {c.contract_signed ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: '#E8F5E9', color: '#2E7D52' }}>
                      <CheckCircle2 className="h-3 w-3" /> Signé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: '#FFF8E7', color: '#C4A044' }}>
                      <Clock className="h-3 w-3" /> En attente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#666666' }}>
                  {c.contract_signed_at ? fmtDate(c.contract_signed_at) : '—'}
                </td>
                <td className="px-4 py-3">
                  {c.contract_pdf_url ? (
                    <a href={c.contract_pdf_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: '#F0EDE8', color: '#666666' }}>
                      <Download className="h-3 w-3" /> PDF
                    </a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
