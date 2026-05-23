'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Filter, RefreshCw, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { NewExpenseForm } from './NewExpenseForm'

export interface Expense {
  id: string
  title: string | null
  description: string | null
  amount: number
  currency: string
  expense_date: string | null
  category: string | null
  invoice_status: string
  billable: boolean
  paid_by: string
  owner_approved: boolean
  notes: string | null
  receipt_urls: string[]
  created_at: string
  property?: { id: string; name: string; city: string | null; country: string | null } | null
  owner?: { id: string; full_name: string } | null
  provider?: { id: string; name: string; phone: string | null } | null
}

interface Props {
  initialExpenses: Expense[]
  properties: { id: string; name: string; city: string | null; country: string | null }[]
  owners: { id: string; full_name: string }[]
  providers: { id: string; name: string; phone: string | null }[]
}

const CATEGORY_LABEL: Record<string, string> = {
  plomberie: 'Plomberie', menage: 'Ménage', consommables: 'Consommables',
  equipement: 'Équipement', reparation: 'Réparation', commission: 'Commission', autre: 'Autre',
}
const INVOICE_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  non_facture: { label: 'Non facturé', color: '#999999', bg: '#F8F7F5' },
  en_attente:  { label: 'En attente',  color: '#C17C1A', bg: 'rgba(193,124,26,0.10)' },
  facture:     { label: 'Facturé',     color: '#2E7D52', bg: 'rgba(46,125,82,0.10)' },
}

export function DepensesClient({ initialExpenses, properties, owners, providers }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showNew, setShowNew] = useState(false)
  const [filterProperty, setFilterProperty] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPaidBy, setFilterPaidBy] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'month' | 'week'>('all')

  const filtered = useMemo(() => {
    const now = new Date()
    return expenses.filter(e => {
      if (filterProperty && e.property?.id !== filterProperty) return false
      if (filterOwner && e.owner?.id !== filterOwner) return false
      if (filterStatus && e.invoice_status !== filterStatus) return false
      if (filterPaidBy && e.paid_by !== filterPaidBy) return false
      if (filterPeriod !== 'all' && e.expense_date) {
        const d = new Date(e.expense_date)
        if (filterPeriod === 'month') {
          const s = new Date(now.getFullYear(), now.getMonth(), 1)
          if (d < s) return false
        } else if (filterPeriod === 'week') {
          const s = new Date(now); s.setDate(now.getDate() - 7)
          if (d < s) return false
        }
      }
      return true
    })
  }, [expenses, filterProperty, filterOwner, filterStatus, filterPaidBy, filterPeriod])

  const totalMonth = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
    return expenses
      .filter(e => e.expense_date && new Date(e.expense_date) >= start)
      .reduce((s, e) => s + e.amount, 0)
  }, [expenses])
  const aFacturer = expenses.filter(e => e.billable && e.invoice_status === 'non_facture').reduce((s, e) => s + e.amount, 0)
  const enAttente = expenses.filter(e => e.billable && !e.owner_approved).length

  async function refresh() {
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('*, property:properties(id, name, city, country), owner:owners(id, full_name), provider:providers(id, name, phone)')
      .order('expense_date', { ascending: false })
      .limit(200)
    if (data) setExpenses(data as Expense[])
  }

  async function markRefacturable(expense: Expense) {
    const supabase = createClient()
    if (!expense.owner?.id) return
    // Trouver ou créer facture brouillon du mois
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

    let { data: invoice } = await supabase
      .from('invoices').select('id, expenses_amount').eq('owner_id', expense.owner.id).eq('status', 'draft').single()

    if (!invoice) {
      const { data: newInv } = await supabase
        .from('invoices')
        .insert({ owner_id: expense.owner.id, period_start: start, period_end: end, status: 'draft', gross_revenue: 0, commission_amount: 0, expenses_amount: 0, net_to_owner: 0 })
        .select().single()
      invoice = newInv
    }

    if (!invoice) return

    // Ajouter ligne
    const { data: line } = await supabase
      .from('invoice_lines')
      .insert({
        invoice_id: invoice.id,
        owner_id: expense.owner.id,
        property_id: expense.property?.id ?? null,
        expense_id: expense.id,
        label: expense.title ?? expense.description ?? 'Dépense',
        amount: expense.amount,
        currency: expense.currency,
        line_type: 'depense',
      })
      .select().single()

    if (line) {
      // Mise à jour facture
      await supabase.from('invoices').update({
        expenses_amount: (invoice.expenses_amount ?? 0) + expense.amount,
        net_to_owner: (invoice as any).net_to_owner - expense.amount,
      }).eq('id', invoice.id)

      // Mise à jour dépense
      await supabase.from('expenses').update({ invoice_status: 'en_attente', invoice_line_id: line.id }).eq('id', expense.id)
      setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, invoice_status: 'en_attente' } : e))
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E4DC', background: '#FFFFFF' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <h1 style={{ fontFamily: 'var(--font-heading), serif', fontSize: 22, fontWeight: 500, color: '#1A1A1A' }}>Dépenses</h1>
          <Metric label="Ce mois" value={`${totalMonth.toLocaleString('fr')} €`} />
          {aFacturer > 0 && <Metric label="À facturer" value={`${aFacturer.toLocaleString('fr')} €`} color="#C17C1A" />}
          {enAttente > 0 && <Metric label="En attente approbation" value={String(enAttente)} color="#2563A8" />}
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="p-2 rounded-lg" style={{ border: '1px solid #E8E4DC', color: '#999999' }}>
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#C4A044', color: '#FFFFFF' }}>
            <Plus className="h-4 w-4" />Nouvelle dépense
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="shrink-0 px-6 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid #E8E4DC', background: '#F8F7F5' }}>
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {[
          { value: filterProperty, onChange: setFilterProperty, options: [['', 'Tous logements'], ...properties.map(p => [p.id, p.name])] },
          { value: filterOwner, onChange: setFilterOwner, options: [['', 'Tous propriétaires'], ...owners.map(o => [o.id, o.full_name])] },
          { value: filterStatus, onChange: setFilterStatus, options: [['', 'Tous statuts'], ['non_facture', 'Non facturé'], ['en_attente', 'En attente'], ['facture', 'Facturé']] },
          { value: filterPaidBy, onChange: setFilterPaidBy, options: [['', 'Payé par tous'], ['gestionnaire', 'Gestionnaire'], ['proprietaire', 'Propriétaire'], ['plateforme', 'Plateforme']] },
          { value: filterPeriod, onChange: (v: string) => setFilterPeriod(v as typeof filterPeriod), options: [['all', 'Toute période'], ['month', 'Ce mois'], ['week', 'Cette semaine']] },
        ].map((f, i) => (
          <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
            className="text-xs rounded-md px-2.5 py-1.5 outline-none"
            style={{ border: '1px solid #E8E4DC', background: '#FFFFFF', color: '#1A1A1A' }}>
            {(f.options as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} dépense{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid #E8E4DC' }}>
              {['Date', 'Logement', 'Propriétaire', 'Catégorie', 'Titre', 'Intervenant', 'Montant', 'Payé par', 'Justificatif', 'Remboursable', 'Statut fact.', 'Approuvé', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold" style={{ color: '#666666' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={13} className="py-16 text-center text-sm" style={{ color: '#999999' }}>Aucune dépense</td></tr>
            ) : filtered.map(e => {
              const stcfg = INVOICE_STATUS_CFG[e.invoice_status] ?? INVOICE_STATUS_CFG.non_facture
              return (
                <tr key={e.id} className="hover:bg-[#F8F7F5] border-b" style={{ borderColor: '#F2F0EC' }}>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#666666' }}>
                    {e.expense_date ? format(new Date(e.expense_date), 'dd/MM/yy') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    <span style={{ color: '#1A1A1A' }}>{e.property?.name ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#666666' }}>
                    {e.owner?.full_name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#999999' }}>
                    {e.category ? (CATEGORY_LABEL[e.category] ?? e.category) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-[160px] truncate" style={{ color: '#1A1A1A' }}>
                    {e.title ?? e.description ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#666666' }}>
                    {e.provider?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: '#1A1A1A' }}>
                    {e.amount.toLocaleString('fr')} {e.currency}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#666666' }}>
                    {e.paid_by === 'gestionnaire' ? 'Gestionnaire' : e.paid_by === 'proprietaire' ? 'Propriétaire' : 'Plateforme'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {(e.receipt_urls ?? []).length > 0 ? (
                      <a href={(e.receipt_urls ?? [])[0]} target="_blank" rel="noreferrer">
                        <Receipt className="h-4 w-4 mx-auto" style={{ color: '#C4A044' }} />
                      </a>
                    ) : <span className="text-xs" style={{ color: '#CCCCCC' }}>—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input type="checkbox" checked={e.billable} readOnly className="w-4 h-4 rounded accent-[#C4A044]" />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: stcfg.bg, color: stcfg.color }}>
                      {stcfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <input type="checkbox" checked={e.owner_approved} readOnly className="w-4 h-4 rounded accent-[#2E7D52]" />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {e.billable && e.invoice_status === 'non_facture' && (
                      <button
                        onClick={() => markRefacturable(e)}
                        className="text-[10px] px-2 py-0.5 rounded font-semibold transition-colors"
                        style={{ background: 'rgba(193,124,26,0.10)', color: '#C17C1A', border: '1px solid rgba(193,124,26,0.3)' }}
                      >
                        Facturer
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewExpenseForm
          properties={properties}
          owners={owners}
          providers={providers}
          onClose={() => setShowNew(false)}
          onCreate={(exp) => {
            setExpenses(prev => [exp as Expense, ...prev])
            setShowNew(false)
          }}
        />
      )}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
      style={{ background: `${color ?? '#1A1A1A'}12`, color: color ?? '#1A1A1A', border: `1px solid ${color ?? '#1A1A1A'}30` }}>
      <span className="font-semibold">{value}</span>
      <span style={{ color: '#999999' }}>{label}</span>
    </div>
  )
}
