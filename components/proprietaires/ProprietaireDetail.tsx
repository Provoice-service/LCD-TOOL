'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Building2, ExternalLink, Mail, Phone, Save } from 'lucide-react'
import type { Owner } from './ProprietairesClient'

interface Expense {
  id: string; title: string | null; description: string | null
  amount: number; currency: string; expense_date: string | null
  invoice_status: string; billable: boolean
  property?: { name: string } | null
}

interface Invoice {
  id: string; period_start: string | null; period_end: string | null
  status: string; net_to_owner: number; expenses_amount: number
  commission_amount: number; gross_revenue: number
}

interface Props {
  owner: Owner
  onUpdate: (o: Owner) => void
}

const TABS = ['Infos', 'Logements', 'Dépenses', 'Factures'] as const
type Tab = typeof TABS[number]

export function ProprietaireDetail({ owner, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('Infos')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [saving, setSaving] = useState(false)

  // Champs éditables
  const [fullName, setFullName] = useState(owner.full_name)
  const [email, setEmail] = useState(owner.email)
  const [phone, setPhone] = useState(owner.phone ?? '')
  const [city, setCity] = useState(owner.city ?? '')
  const [iban, setIban] = useState(owner.iban ?? '')
  const [commissionRate, setCommissionRate] = useState(owner.commission_rate)
  const [billingDay, setBillingDay] = useState(owner.billing_day)
  const [paymentMethod, setPaymentMethod] = useState(owner.payment_method ?? 'virement')
  const [notes, setNotes] = useState(owner.notes ?? '')
  const [notifEmail, setNotifEmail] = useState(owner.notification_email ?? true)
  const [notifWA, setNotifWA] = useState(owner.notification_whatsapp ?? true)

  useEffect(() => {
    if (tab === 'Dépenses') loadExpenses()
    if (tab === 'Factures') loadInvoices()
  }, [tab, owner.id])

  async function loadExpenses() {
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('id, title, description, amount, currency, expense_date, invoice_status, billable, property:properties(name)')
      .eq('owner_id', owner.id)
      .order('expense_date', { ascending: false })
      .limit(50)
    setExpenses((data ?? []) as unknown as Expense[])
  }

  async function loadInvoices() {
    const supabase = createClient()
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('owner_id', owner.id)
      .order('period_start', { ascending: false })
      .limit(20)
    setInvoices((data ?? []) as Invoice[])
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('owners')
      .update({
        full_name: fullName, email, phone: phone || null,
        city: city || null, iban: iban || null,
        commission_rate: commissionRate, billing_day: billingDay,
        payment_method: paymentMethod, notes: notes || null,
        notification_email: notifEmail, notification_whatsapp: notifWA,
      })
      .eq('id', owner.id)
      .select('*, properties:properties(id, name, city, country, is_active)')
      .single()
    if (data) onUpdate(data as Owner)
    setSaving(false)
  }

  async function generateDraftInvoice() {
    const supabase = createClient()
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    // Vérifier si brouillon existe déjà
    const { data: existing } = await supabase
      .from('invoices').select('id').eq('owner_id', owner.id).eq('status', 'draft').single()
    if (!existing) {
      await supabase.from('invoices').insert({
        owner_id: owner.id, period_start: start, period_end: end,
        status: 'draft', gross_revenue: 0, commission_amount: 0, expenses_amount: 0, net_to_owner: 0,
      })
    }
    await loadInvoices()
  }

  const activeProps = (owner.properties ?? []).filter(p => p.is_active)
  const totalDepenses = expenses.reduce((s, e) => s + e.amount, 0)
  const aFacturer = expenses.filter(e => e.billable && e.invoice_status === 'non_facture').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E4DC', background: '#FFFFFF' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold"
            style={{ background: 'rgba(196,160,68,0.10)', color: '#C4A044' }}>
            {owner.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>{owner.full_name}</h2>
            <div className="flex items-center gap-3 text-xs" style={{ color: '#999999' }}>
              {owner.email && <a href={`mailto:${owner.email}`} className="flex items-center gap-1 hover:text-[#C4A044]"><Mail className="h-3 w-3" />{owner.email}</a>}
              {owner.phone && <a href={`tel:${owner.phone}`} className="flex items-center gap-1 hover:text-[#C4A044]"><Phone className="h-3 w-3" />{owner.phone}</a>}
            </div>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded font-semibold"
          style={{ background: 'rgba(196,160,68,0.10)', color: '#A88830' }}>
          {activeProps.length} logement{activeProps.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex" style={{ borderBottom: '1px solid #E8E4DC', background: '#F8F7F5' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === t ? '#C4A044' : '#666666',
              borderBottom: tab === t ? '2px solid #C4A044' : '2px solid transparent',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-6">

        {tab === 'Infos' && (
          <div className="max-w-lg space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="Nom complet"><input value={fullName} onChange={e => setFullName(e.target.value)} className={ic} style={is} /></F>
              <F label="Email"><input value={email} onChange={e => setEmail(e.target.value)} type="email" className={ic} style={is} /></F>
              <F label="Téléphone"><input value={phone} onChange={e => setPhone(e.target.value)} className={ic} style={is} /></F>
              <F label="Ville"><input value={city} onChange={e => setCity(e.target.value)} className={ic} style={is} /></F>
              <F label="IBAN"><input value={iban} onChange={e => setIban(e.target.value)} className={ic} style={is} /></F>
              <F label="Mode de paiement">
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={ic} style={is}>
                  <option value="virement">Virement</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Chèque</option>
                  <option value="autre">Autre</option>
                </select>
              </F>
              <F label="Commission (%)"><input type="number" value={commissionRate} onChange={e => setCommissionRate(parseFloat(e.target.value))} className={ic} style={is} /></F>
              <F label="Jour de facturation"><input type="number" min={1} max={28} value={billingDay} onChange={e => setBillingDay(parseInt(e.target.value))} className={ic} style={is} /></F>
            </div>

            <F label="Notes internes">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                placeholder="Notes confidentielles sur le propriétaire…" />
            </F>

            <div className="flex gap-4">
              <Toggle label="Notif. email" value={notifEmail} onChange={setNotifEmail} />
              <Toggle label="Notif. WhatsApp" value={notifWA} onChange={setNotifWA} />
            </div>

            {owner.onboarding_date && (
              <p className="text-xs" style={{ color: '#999999' }}>
                Onboarding : {format(new Date(owner.onboarding_date), 'dd MMMM yyyy', { locale: fr })}
              </p>
            )}

            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
              style={{ background: '#C4A044', color: '#FFFFFF' }}>
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}

        {tab === 'Logements' && (
          <div className="space-y-2 max-w-xl">
            {activeProps.length === 0 && <p className="text-sm" style={{ color: '#999999' }}>Aucun logement actif</p>}
            {activeProps.map(p => (
              <a key={p.id} href={`/properties/${p.id}`}
                className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[#F2F0EC]"
                style={{ border: '1px solid #E8E4DC', background: '#FFFFFF' }}>
                <Building2 className="h-4 w-4 shrink-0" style={{ color: '#C4A044' }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{p.name}</p>
                  {p.city && <p className="text-xs" style={{ color: '#999999' }}>{p.city}</p>}
                </div>
                <ExternalLink className="h-3.5 w-3.5" style={{ color: '#CCCCCC' }} />
              </a>
            ))}
          </div>
        )}

        {tab === 'Dépenses' && (
          <div className="space-y-4">
            {/* Résumé */}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total dépenses" value={`${totalDepenses.toLocaleString('fr')} €`} />
              <Stat label="À facturer" value={`${aFacturer.toLocaleString('fr')} €`} color="#C17C1A" />
              <Stat label="Dépenses" value={`${expenses.length}`} />
            </div>
            {/* Tableau */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E4DC' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F8F7F5', borderBottom: '1px solid #E8E4DC' }}>
                    {['Date', 'Logement', 'Titre', 'Montant', 'Statut'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: '#666666' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-xs" style={{ color: '#999999' }}>Aucune dépense</td></tr>
                  )}
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-[#F8F7F5]" style={{ borderBottom: '1px solid #F2F0EC' }}>
                      <td className="px-3 py-2 text-xs" style={{ color: '#666666' }}>
                        {e.expense_date ? format(new Date(e.expense_date), 'dd/MM/yy') : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#1A1A1A' }}>{e.property?.name ?? '—'}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#1A1A1A' }}>{e.title ?? e.description ?? '—'}</td>
                      <td className="px-3 py-2 text-xs font-medium" style={{ color: '#1A1A1A' }}>
                        {e.amount.toLocaleString('fr')} {e.currency}
                      </td>
                      <td className="px-3 py-2">
                        <InvoiceStatusBadge status={e.invoice_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Factures' && (
          <div className="space-y-4 max-w-2xl">
            <button onClick={generateDraftInvoice}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(196,160,68,0.10)', color: '#A88830', border: '1px solid rgba(196,160,68,0.3)' }}>
              + Générer la facture du mois
            </button>
            {invoices.length === 0 && <p className="text-sm" style={{ color: '#999999' }}>Aucune facture</p>}
            {invoices.map(inv => (
              <div key={inv.id} className="rounded-xl p-4" style={{ border: '1px solid #E8E4DC', background: '#FFFFFF' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                      {inv.period_start ? format(new Date(inv.period_start), 'MMMM yyyy', { locale: fr }) : '—'}
                    </p>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading), serif', color: '#C4A044' }}>
                      {inv.net_to_owner.toLocaleString('fr')} €
                    </p>
                    <p className="text-xs" style={{ color: '#999999' }}>net propriétaire</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: '#666666' }}>
                  <span>Revenus bruts : {inv.gross_revenue.toLocaleString('fr')} €</span>
                  <span>Commission : {inv.commission_amount.toLocaleString('fr')} €</span>
                  <span>Dépenses : {inv.expenses_amount.toLocaleString('fr')} €</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ic = 'w-full text-sm rounded-lg px-3 py-1.5 outline-none'
const is = { border: '1px solid #E8E4DC', color: '#1A1A1A' }

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: '#666666' }}>{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ border: '1px solid #E8E4DC', background: '#FFFFFF' }}>
      <p className="text-xs" style={{ color: '#999999' }}>{label}</p>
      <p className="text-lg font-semibold mt-0.5" style={{ fontFamily: 'var(--font-heading), serif', color: color ?? '#1A1A1A' }}>{value}</p>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center gap-2 text-xs" style={{ color: value ? '#2E7D52' : '#999999' }}>
      <span className="w-8 h-4 rounded-full relative transition-colors" style={{ background: value ? '#2E7D52' : '#E8E4DC' }}>
        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }} />
      </span>
      {label}
    </button>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    non_facture: { label: 'Non facturé', color: '#999999', bg: '#F8F7F5' },
    en_attente:  { label: 'En attente',  color: '#C17C1A', bg: 'rgba(193,124,26,0.10)' },
    facture:     { label: 'Facturé',     color: '#2E7D52', bg: 'rgba(46,125,82,0.10)' },
    draft:       { label: 'Brouillon',   color: '#666666', bg: '#F8F7F5' },
    sent:        { label: 'Envoyée',     color: '#2563A8', bg: 'rgba(37,99,168,0.10)' },
    paid:        { label: 'Payée',       color: '#2E7D52', bg: 'rgba(46,125,82,0.10)' },
  }
  const c = cfg[status] ?? { label: status, color: '#999999', bg: '#F8F7F5' }
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}
