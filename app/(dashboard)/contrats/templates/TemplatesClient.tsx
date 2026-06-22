'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Save } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Template {
  id: string
  name: string
  country: string
  is_active: boolean
  created_at: string
  content_fr: string
  content_en: string | null
}

const COUNTRY_LABELS: Record<string, string> = {
  MA: '🇲🇦 Maroc',
  FR: '🇫🇷 France',
  ES: '🇪🇸 Espagne',
}

export default function TemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [editing, setEditing]     = useState<string | null>(null)
  const [editFr, setEditFr]       = useState('')
  const [editEn, setEditEn]       = useState('')
  const [editName, setEditName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [editTab, setEditTab]     = useState<'fr' | 'en'>('fr')

  const startEdit = (t: Template) => {
    setEditing(t.id)
    setEditFr(t.content_fr)
    setEditEn(t.content_en ?? '')
    setEditName(t.name)
    setExpanded(t.id)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditFr('')
    setEditEn('')
    setEditName('')
  }

  const save = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/contract/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, content_fr: editFr, content_en: editEn || null }),
      })
      if (res.ok) {
        setTemplates(prev => prev.map(t =>
          t.id === id ? { ...t, name: editName, content_fr: editFr, content_en: editEn || null } : t
        ))
        cancelEdit()
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (t: Template) => {
    const res = await fetch(`/api/contract/templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.is_active }),
    })
    if (res.ok) {
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>Modèles de contrat</h1>
        <p className="text-sm mt-0.5" style={{ color: '#666666' }}>Éditez et activez vos modèles de contrat de location</p>
      </div>

      {/* Templates list */}
      <div className="space-y-3">
        {templates.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: '#999999' }}>
            Aucun modèle — exécutez la migration 017_contracts.sql
          </div>
        )}
        {templates.map(t => (
          <div key={t.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E4DC', background: '#FFFFFF' }}>
            {/* Row header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#FAFAF8]"
              onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            >
              <span className="text-sm font-medium flex-1" style={{ color: '#1A1A1A' }}>{t.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F0EDE8', color: '#666666' }}>
                {COUNTRY_LABELS[t.country] ?? t.country}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: t.is_active ? '#E8F5E9' : '#F8F7F5',
                  color: t.is_active ? '#2E7D52' : '#999999',
                }}
              >
                {t.is_active ? 'Actif' : 'Inactif'}
              </span>
              <span className="text-xs" style={{ color: '#999999' }}>
                {format(new Date(t.created_at), 'd MMM yyyy', { locale: fr })}
              </span>
              {expanded === t.id ? <ChevronUp className="h-4 w-4" style={{ color: '#999' }} /> : <ChevronDown className="h-4 w-4" style={{ color: '#999' }} />}
            </div>

            {/* Expanded content */}
            {expanded === t.id && (
              <div style={{ borderTop: '1px solid #F0EDE8' }}>
                {editing === t.id ? (
                  /* Edit mode */
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#666666' }}>Nom du modèle</label>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                        style={{ border: '1px solid #E8E4DC', color: '#1A1A1A' }}
                      />
                    </div>
                    {/* Lang tabs */}
                    <div className="flex gap-1 border-b" style={{ borderColor: '#E8E4DC' }}>
                      {(['fr', 'en'] as const).map(l => (
                        <button
                          key={l}
                          onClick={() => setEditTab(l)}
                          className="px-4 py-2 text-sm font-medium -mb-px transition-colors"
                          style={{
                            color: editTab === l ? '#C4A044' : '#666666',
                            borderBottom: editTab === l ? '2px solid #C4A044' : '2px solid transparent',
                          }}
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={editTab === 'fr' ? editFr : editEn}
                      onChange={e => editTab === 'fr' ? setEditFr(e.target.value) : setEditEn(e.target.value)}
                      rows={20}
                      className="w-full text-xs px-3 py-2 rounded-lg outline-none font-mono resize-y"
                      style={{ border: '1px solid #E8E4DC', color: '#1A1A1A', background: '#FAFAFA' }}
                      placeholder={editTab === 'fr' ? 'Contenu FR…' : 'Contenu EN (optionnel)…'}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="text-sm px-4 py-2 rounded-lg"
                        style={{ border: '1px solid #E8E4DC', color: '#666666' }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => save(t.id)}
                        disabled={saving}
                        className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium"
                        style={{ background: '#C4A044', color: '#fff' }}
                      >
                        <Save className="h-4 w-4" />
                        {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Preview mode */
                  <div className="p-5 space-y-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => toggleActive(t)}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
                        style={{ border: '1px solid #E8E4DC', color: '#666666' }}
                      >
                        {t.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {t.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => startEdit(t)}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(196,160,68,0.1)', color: '#A88830', border: '1px solid rgba(196,160,68,0.3)' }}
                      >
                        Modifier
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { label: 'Français', content: t.content_fr },
                        ...(t.content_en ? [{ label: 'English', content: t.content_en }] : []),
                      ].map(({ label, content }) => (
                        <div key={label}>
                          <p className="text-xs font-semibold mb-2" style={{ color: '#666666' }}>{label}</p>
                          <pre className="text-xs leading-relaxed whitespace-pre-wrap p-3 rounded-lg overflow-auto max-h-64"
                            style={{ background: '#F8F7F5', color: '#333333', fontFamily: 'inherit' }}>
                            {content.slice(0, 600)}{content.length > 600 ? '\n…' : ''}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
