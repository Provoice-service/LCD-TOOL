'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CrmMarket } from '@/components/crm/types'
import { Badge } from '@/components/ui/badge'
import { MapPin, Building2, Users, Calendar, TrendingUp } from 'lucide-react'

const STATUS_CONFIG: Record<CrmMarket['status'], { label: string; variant: 'default'|'secondary'|'outline'|'destructive'; color: string }> = {
  active:      { label: 'Actif',       variant: 'default',    color: 'text-green-700'  },
  prospecting: { label: 'Prospection', variant: 'secondary',  color: 'text-blue-700'   },
  identified:  { label: 'Identifié',   variant: 'outline',    color: 'text-gray-600'   },
  paused:      { label: 'En pause',    variant: 'destructive', color: 'text-orange-700' },
}

interface ExpansionMarketsProps {
  initialMarkets: CrmMarket[]
}

export function ExpansionMarkets({ initialMarkets }: ExpansionMarketsProps) {
  const [markets, setMarkets] = useState<CrmMarket[]>(initialMarkets)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<CrmMarket>>({})

  async function saveMarket(market: CrmMarket) {
    const supabase = createClient()
    await supabase.from('crm_markets').update(editForm).eq('id', market.id)
    setMarkets(m => m.map(x => x.id === market.id ? { ...x, ...editForm } : x))
    setEditing(null)
  }

  const activeCount      = markets.filter(m=>m.status==='active').length
  const totalProperties  = markets.reduce((s,m)=>s+m.current_properties,0)
  const targetProperties = markets.reduce((s,m)=>s+(m.target_properties??0),0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Marchés actifs',    value: activeCount,      icon: TrendingUp },
          { label: 'Logements gérés',   value: totalProperties,  icon: Building2  },
          { label: 'Objectif total',    value: targetProperties, icon: MapPin     },
        ].map(({label,value,icon:Icon})=>(
          <div key={label} className="p-4 rounded-xl border bg-card flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
          </div>
        ))}
      </div>

      {/* Grille marchés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {markets.map(market => {
          const scfg = STATUS_CONFIG[market.status]
          const progress = market.target_properties
            ? Math.round((market.current_properties / market.target_properties) * 100)
            : 0
          const isEditing = editing === market.id

          return (
            <div key={market.id} className="rounded-xl border bg-card p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">{market.city}</h3>
                    <p className="text-xs text-muted-foreground">{market.country}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={scfg.variant}>{scfg.label}</Badge>
                  <button
                    onClick={() => { setEditing(isEditing ? null : market.id); setEditForm(market) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isEditing ? 'Annuler' : 'Éditer'}
                  </button>
                </div>
              </div>

              {/* Progression */}
              {market.target_properties && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-medium">{market.current_properties} / {market.target_properties} logements</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${market.status==='active' ? 'bg-green-500' : 'bg-blue-400'}`}
                      style={{ width: `${Math.min(progress,100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{progress}% de l&apos;objectif</p>
                </div>
              )}

              {/* Infos */}
              {!isEditing && (
                <div className="space-y-1.5 text-sm">
                  {market.local_partners && (
                    <div className="flex items-start gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">{market.local_partners}</p>
                    </div>
                  )}
                  {market.target_launch_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Lancement : {new Date(market.target_launch_date).toLocaleDateString('fr')}
                      </p>
                    </div>
                  )}
                  {market.notes && <p className="text-xs text-muted-foreground italic">{market.notes}</p>}
                  {market.regulatory_notes && (
                    <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">⚖ {market.regulatory_notes}</p>
                  )}
                </div>
              )}

              {/* Formulaire édition inline */}
              {isEditing && (
                <div className="space-y-2.5 pt-2 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Statut</label>
                      <select className="input-base w-full text-xs"
                        value={editForm.status} onChange={e=>setEditForm(f=>({...f,status:e.target.value as any}))}>
                        <option value="identified">Identifié</option>
                        <option value="prospecting">Prospection</option>
                        <option value="active">Actif</option>
                        <option value="paused">En pause</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Objectif logements</label>
                      <input type="number" className="input-base w-full text-xs"
                        value={editForm.target_properties??''}
                        onChange={e=>setEditForm(f=>({...f,target_properties:e.target.value?parseInt(e.target.value):undefined}))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Logements actuels</label>
                      <input type="number" className="input-base w-full text-xs"
                        value={editForm.current_properties??0}
                        onChange={e=>setEditForm(f=>({...f,current_properties:parseInt(e.target.value)||0}))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Date lancement</label>
                      <input type="date" className="input-base w-full text-xs"
                        value={editForm.target_launch_date??''}
                        onChange={e=>setEditForm(f=>({...f,target_launch_date:e.target.value||null}))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Partenaires locaux</label>
                    <input className="input-base w-full text-xs"
                      value={editForm.local_partners??''}
                      onChange={e=>setEditForm(f=>({...f,local_partners:e.target.value||null}))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Notes</label>
                    <textarea className="input-base w-full text-xs resize-none" rows={2}
                      value={editForm.notes??''}
                      onChange={e=>setEditForm(f=>({...f,notes:e.target.value||null}))} />
                  </div>
                  <button onClick={()=>saveMarket(market)}
                    className="w-full py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
