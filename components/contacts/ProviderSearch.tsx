'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Star } from 'lucide-react'
import type { Provider } from './types'
import { AVAILABILITY_CONFIG, SPECIALTY_LABEL, SAV_TYPE_TO_SPECIALTY } from './types'

interface Props {
  value: string
  providerId: string | null
  onChange: (name: string, id: string | null, phone: string | null) => void
  savType?: string | null
  propertyId?: string | null
  placeholder?: string
}

export function ProviderSearch({ value, providerId, onChange, savType, propertyId, placeholder }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Provider[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function search(q: string) {
    setQuery(q)
    if (q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    const supabase = createClient()
    let builder = supabase
      .from('providers')
      .select('*')
      .eq('is_active', true)
      .order('is_preferred', { ascending: false })
      .order('rating', { ascending: false })
      .limit(8)

    if (q.length >= 2) {
      builder = builder.ilike('name', `%${q}%`)
    }
    const { data } = await builder
    let list = (data ?? []) as Provider[]

    // Trier : intervenants du logement en premier, puis par spécialité SAV
    if (savType) {
      const relatedSpecialties = SAV_TYPE_TO_SPECIALTY[savType] ?? []
      list = [...list].sort((a, b) => {
        const aMatch = (a.specialties ?? []).some(s => relatedSpecialties.includes(s))
        const bMatch = (b.specialties ?? []).some(s => relatedSpecialties.includes(s))
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
        return 0
      })
    }

    setResults(list)
    setOpen(true)
    setLoading(false)
  }

  function select(p: Provider) {
    onChange(p.name, p.id, p.phone ?? p.whatsapp ?? null)
    setQuery(p.name)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => query.length >= 1 && setOpen(true)}
          placeholder={placeholder ?? 'Rechercher un intervenant…'}
          className="w-full text-sm rounded-md pl-8 pr-3 py-1.5 outline-none"
          style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
        />
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
        >
          {results.map(p => {
            const avail = AVAILABILITY_CONFIG[p.availability]
            return (
              <button
                key={p.id}
                onClick={() => select(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#F8F7F5] transition-colors flex items-center gap-3"
                style={{ borderBottom: '1px solid #F2F0EC' }}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'rgba(196,160,68,0.10)', color: '#C4A044' }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{p.name}</span>
                    {p.is_preferred && <Star className="h-3 w-3 fill-[#C4A044] text-[#C4A044] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {(p.specialties ?? []).slice(0, 2).map(s => (
                      <span key={s} className="text-[10px]" style={{ color: '#999999' }}>
                        {SPECIALTY_LABEL[s] ?? s}
                      </span>
                    ))}
                    {p.city && <span className="text-[10px]" style={{ color: '#CCCCCC' }}>· {p.city}</span>}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: avail.bg, color: avail.color }}
                  >
                    {avail.label}
                  </span>
                  {p.rating > 0 && (
                    <span className="text-[10px]" style={{ color: '#C4A044' }}>★ {p.rating.toFixed(1)}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div
          className="absolute z-50 w-full mt-1 px-3 py-3 rounded-lg text-xs"
          style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', color: '#999999' }}
        >
          Aucun intervenant trouvé pour « {query} »
        </div>
      )}
    </div>
  )
}
