'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Upload } from 'lucide-react'
import { ProviderSearch } from '@/components/contacts/ProviderSearch'
import type { Expense } from './DepensesClient'

interface Props {
  properties: { id: string; name: string; city: string | null; country: string | null }[]
  owners: { id: string; full_name: string }[]
  providers: { id: string; name: string; phone: string | null }[]
  onClose: () => void
  onCreate: (e: Partial<Expense>) => void
}

const CATEGORIES = ['plomberie', 'menage', 'consommables', 'equipement', 'reparation', 'commission', 'autre']
const CATEGORY_LABEL: Record<string, string> = {
  plomberie: 'Plomberie', menage: 'Ménage', consommables: 'Consommables',
  equipement: 'Équipement', reparation: 'Réparation', commission: 'Commission', autre: 'Autre',
}

export function NewExpenseForm({ properties, owners, providers, onClose, onCreate }: Props) {
  const [propertyId, setPropertyId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState('MAD')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState('gestionnaire')
  const [billable, setBillable] = useState(false)
  const [notes, setNotes] = useState('')
  const [providerName, setProviderName] = useState('')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [receiptUrls, setReceiptUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-remplir propriétaire selon logement
  function handlePropertyChange(id: string) {
    setPropertyId(id)
    const prop = properties.find(p => p.id === id)
    if (prop) setCurrency(prop.country === 'MA' ? 'MAD' : 'EUR')
  }

  async function uploadReceipt(file: File) {
    setUploading(true)
    const supabase = createClient()
    const path = `receipts/${Date.now()}_${file.name.replace(/\s/g, '_')}`
    const { data, error: err } = await supabase.storage.from('receipts').upload(path, file)
    if (!err && data) {
      const { data: url } = supabase.storage.from('receipts').getPublicUrl(data.path)
      setReceiptUrls(prev => [...prev, url.publicUrl])
    }
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!propertyId) { setError('Choisissez un logement'); return }
    if (!amount) { setError('Saisissez un montant'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      property_id: propertyId,
      owner_id: ownerId || null,
      title: title || null,
      category: category || null,
      amount,
      currency,
      expense_date: expenseDate,
      paid_by: paidBy,
      billable,
      notes: notes || null,
      provider_id: providerId,
      receipt_urls: receiptUrls,
      invoice_status: 'non_facture',
    }

    const { data, error: err } = await supabase
      .from('expenses')
      .insert(payload)
      .select(`
        *,
        property:properties(id, name, city, country),
        owner:owners(id, full_name),
        provider:providers(id, name, phone)
      `)
      .single()

    if (err || !data) { setError(err?.message ?? 'Erreur'); setLoading(false); return }

    // Si remboursable → créer automatiquement la ligne de facture
    if (billable && ownerId) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      let { data: inv } = await supabase
        .from('invoices').select('id, expenses_amount, net_to_owner')
        .eq('owner_id', ownerId).eq('status', 'draft').single()

      if (!inv) {
        const { data: newInv } = await supabase
          .from('invoices')
          .insert({ owner_id: ownerId, period_start: start, period_end: end, status: 'draft', gross_revenue: 0, commission_amount: 0, expenses_amount: 0, net_to_owner: 0 })
          .select().single()
        inv = newInv
      }

      if (inv) {
        const { data: line } = await supabase
          .from('invoice_lines')
          .insert({
            invoice_id: inv.id, owner_id: ownerId, property_id: propertyId,
            expense_id: data.id, label: title || 'Dépense', amount, currency, line_type: 'depense',
          }).select().single()

        if (line) {
          await supabase.from('invoices').update({
            expenses_amount: (inv.expenses_amount ?? 0) + amount,
          }).eq('id', inv.id)
          await supabase.from('expenses').update({ invoice_status: 'en_attente', invoice_line_id: line.id }).eq('id', data.id)
        }
      }
    }

    onCreate({ ...data, invoice_status: billable && ownerId ? 'en_attente' : 'non_facture' } as Partial<Expense>)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl"
        style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', boxShadow: '0 16px 64px rgba(0,0,0,0.10)' }}>

        <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E4DC' }}>
          <h2 style={{ fontFamily: 'var(--font-heading), serif', fontSize: 20, fontWeight: 500, color: '#1A1A1A' }}>
            Nouvelle dépense
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F2F0EC]">
            <X className="h-4 w-4" style={{ color: '#666666' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <F label="Logement *">
              <select value={propertyId} onChange={e => handlePropertyChange(e.target.value)} className={ic} style={is}>
                <option value="">— Choisir —</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </F>
            <F label="Propriétaire">
              <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className={ic} style={is}>
                <option value="">— Choisir —</option>
                {owners.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </select>
            </F>
          </div>

          <F label="Titre">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Réparation fuite salle de bain" className={ic} style={is} />
          </F>

          <div className="grid grid-cols-2 gap-3">
            <F label="Catégorie">
              <select value={category} onChange={e => setCategory(e.target.value)} className={ic} style={is}>
                <option value="">— Choisir —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </F>
            <F label="Date">
              <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className={ic} style={is} />
            </F>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <F label="Montant *">
              <input type="number" min={0} step={0.01} value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0" className={ic} style={is} />
            </F>
            <F label="Devise">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={ic} style={is}>
                <option value="MAD">MAD</option>
                <option value="EUR">EUR</option>
              </select>
            </F>
            <F label="Payé par">
              <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className={ic} style={is}>
                <option value="gestionnaire">Gestionnaire</option>
                <option value="proprietaire">Propriétaire</option>
                <option value="plateforme">Plateforme</option>
              </select>
            </F>
          </div>

          <F label="Intervenant">
            <ProviderSearch
              value={providerName}
              providerId={providerId}
              onChange={(name, id) => { setProviderName(name); setProviderId(id) }}
            />
          </F>

          <F label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
              style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
              placeholder="Notes sur la dépense…" />
          </F>

          {/* Upload justificatif */}
          <F label="Justificatif">
            <label className="flex items-center gap-2 cursor-pointer text-xs px-3 py-2 rounded-lg"
              style={{ border: '1px dashed #E8E4DC', color: '#999999' }}>
              <Upload className="h-4 w-4" />
              {uploading ? 'Upload en cours…' : 'Ajouter photo / PDF'}
              <input type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => e.target.files?.[0] && uploadReceipt(e.target.files[0])} />
            </label>
            {receiptUrls.length > 0 && (
              <div className="flex gap-2 mt-1 flex-wrap">
                {receiptUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="text-xs px-2 py-0.5 rounded" style={{ background: '#F8F7F5', color: '#C4A044' }}>
                    Justificatif {i + 1}
                  </a>
                ))}
              </div>
            )}
          </F>

          {/* Remboursable */}
          <div className="flex items-center gap-3">
            <input id="bill" type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)}
              className="w-4 h-4 rounded accent-[#C4A044]" />
            <label htmlFor="bill" className="text-sm" style={{ color: '#1A1A1A' }}>
              Refacturable au propriétaire
            </label>
          </div>

          {billable && ownerId && (
            <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(196,160,68,0.08)', color: '#A88830', border: '1px solid rgba(196,160,68,0.2)' }}>
              ✓ Une ligne sera automatiquement ajoutée à la facture brouillon du mois
            </div>
          )}

          {error && <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>}
        </form>

        <div className="shrink-0 px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid #E8E4DC' }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid #E8E4DC', color: '#666666' }}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: '#C4A044', color: '#FFFFFF' }}>
            {loading && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

const ic = 'w-full text-sm rounded-lg px-3 py-1.5 outline-none'
const is = { border: '1px solid #E8E4DC', color: '#1A1A1A' }

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: '#666666' }}>{label}</label>
      {children}
    </div>
  )
}
