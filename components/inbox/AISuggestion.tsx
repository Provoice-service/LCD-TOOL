'use client'

import { useRef, useReducer, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sparkles, Send, Pencil, RefreshCw } from 'lucide-react'

interface AISuggestionProps {
  messageId: string
  onSent?: () => void
}

export function AISuggestion({ messageId, onSent }: AISuggestionProps) {
  const suggestionRef = useRef('')
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState('')

  const suggestion = suggestionRef.current

  async function generate() {
    setLoading(true)
    suggestionRef.current = ''
    forceUpdate()
    setEditing(false)

    try {
      const response = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId }),
      })

      const data = await response.json()
      console.log('[AISuggestion] Réponse reçue:', data)

      if (!response.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      suggestionRef.current = data.text ?? ''
      forceUpdate()
    } catch (err) {
      console.error('[AISuggestion] Erreur:', err)
      suggestionRef.current = `Erreur : ${err instanceof Error ? err.message : String(err)}`
      forceUpdate()
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    const supabase = createClient()
    await supabase
      .from('messages')
      .update({ ai_used: true, ai_suggestion: suggestion, status: 'replied' })
      .eq('id', messageId)
    onSent?.()
  }

  async function handleConfirmEdit() {
    const supabase = createClient()
    await supabase
      .from('messages')
      .update({ ai_modified: true, ai_suggestion: editedText, status: 'replied' })
      .eq('id', messageId)
    suggestionRef.current = editedText
    forceUpdate()
    setEditing(false)
    onSent?.()
  }

  return (
    <div className="border-t bg-muted/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Suggestion IA
        </div>
        {!suggestion && (
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                Génération…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Générer
              </>
            )}
          </Button>
        )}
      </div>

      {/* Suggestion text / edit zone */}
      {(suggestion || loading) && (
        <>
          {editing ? (
            <textarea
              className="w-full text-sm rounded-md border bg-background px-3 py-2 min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              autoFocus
            />
          ) : (
            <p className="text-sm text-foreground bg-background border rounded-md px-3 py-2 whitespace-pre-wrap min-h-[80px]">
              {suggestion}
              {loading && (
                <span className="inline-block w-1 h-4 bg-foreground ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={handleConfirmEdit}>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Envoyer modifié
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Annuler
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleSend} disabled={loading}>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Envoyer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditedText(suggestion)
                    setEditing(true)
                  }}
                  disabled={loading}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Modifier
                </Button>
                <Button size="sm" variant="ghost" onClick={generate} disabled={loading}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Regénérer
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
