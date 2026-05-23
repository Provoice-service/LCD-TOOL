'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Phone, Mail, Plus, ChevronRight, RefreshCw } from 'lucide-react'
import { ProprietaireDetail } from './ProprietaireDetail'

export interface Owner {
  id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  country: string | null
  city: string | null
  address: string | null
  type: string
  billing_day: number
  commission_rate: number
  contract_url: string | null
  iban: string | null
  payment_method: string
  notes: string | null
  is_active: boolean
  onboarding_date: string | null
  contract_signed_at: string | null
  preferred_language: string
  notification_email: boolean
  notification_whatsapp: boolean
  created_at: string
  updated_at: string
  properties?: { id: string; name: string; city: string | null; country: string | null; is_active: boolean }[]
}

interface Props {
  initialOwners: Owner[]
}

export function ProprietairesClient({ initialOwners }: Props) {
  const [owners, setOwners] = useState<Owner[]>(initialOwners)
  const [selected, setSelected] = useState<Owner | null>(null)

  async function refresh() {
    const supabase = createClient()
    const { data } = await supabase
      .from('owners')
      .select('*, properties:properties(id, name, city, country, is_active)')
      .order('full_name')
    if (data) setOwners(data as Owner[])
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Liste */}
      <div
        className="w-80 shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: '1px solid #E8E4DC', background: '#F8F7F5' }}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E4DC', background: '#FFFFFF' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading), serif', fontSize: 18, fontWeight: 500, color: '#1A1A1A' }}>
              Propriétaires
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#666666' }}>
              {owners.filter(o => o.is_active !== false).length} actifs
            </p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={refresh} className="p-1.5 rounded-lg" style={{ border: '1px solid #E8E4DC', color: '#999999' }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {owners.map(owner => {
            const isSelected = selected?.id === owner.id
            const activeProps = (owner.properties ?? []).filter(p => p.is_active)
            return (
              <button
                key={owner.id}
                onClick={() => setSelected(owner)}
                className="w-full text-left rounded-xl p-3 transition-all"
                style={{
                  background: isSelected ? '#FFFFFF' : 'transparent',
                  border: isSelected ? '1px solid #C4A044' : '1px solid transparent',
                  boxShadow: isSelected ? '0 2px 8px rgba(196,160,68,0.12)' : 'none',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'rgba(196,160,68,0.10)', color: '#C4A044' }}
                  >
                    {owner.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{owner.full_name}</p>
                    <p className="text-xs truncate" style={{ color: '#999999' }}>{owner.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: '#666666' }}>
                        <Building2 className="h-3 w-3" />
                        {activeProps.length} logement{activeProps.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-[11px]" style={{ color: '#C4A044' }}>
                        {owner.commission_rate}% commission
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: '#CCCCCC' }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Détail */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <ProprietaireDetail
            owner={selected}
            onUpdate={(updated) => {
              setOwners(prev => prev.map(o => o.id === updated.id ? updated : o))
              setSelected(updated)
            }}
          />
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-2" style={{ color: '#CCCCCC' }}>
            <Building2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">Sélectionnez un propriétaire</p>
          </div>
        )}
      </div>
    </div>
  )
}
