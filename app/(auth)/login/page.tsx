'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#F8F7F5' }}
    >
      {/* Card */}
      <div
        className="w-full mx-4"
        style={{
          maxWidth: 400,
          background: '#FFFFFF',
          border: '1px solid #E8E4DC',
          borderRadius: 12,
          padding: '48px 40px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-alma-keys.png"
            alt="Alma Keys"
            width={160}
            height={64}
            className="h-16 w-auto object-contain"
            priority
          />
        </div>

        {/* Titre */}
        <h1
          className="text-center mb-1"
          style={{
            fontFamily: 'var(--font-heading), Georgia, serif',
            fontSize: 28,
            fontWeight: 500,
            color: '#C4A044',
            letterSpacing: '0.02em',
          }}
        >
          Bienvenue
        </h1>
        <p
          className="text-center mb-8 text-sm"
          style={{ color: '#666666' }}
        >
          Connectez-vous à votre espace de gestion
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#666666' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E4DC',
                color: '#1A1A1A',
                borderRadius: 8,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#666666' }}
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E4DC',
                color: '#1A1A1A',
                borderRadius: 8,
              }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all disabled:opacity-60"
            style={{
              background: loading ? '#A88830' : '#C4A044',
              color: '#FFFFFF',
              borderRadius: 8,
              letterSpacing: '0.02em',
            }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {/* Footer brand */}
        <p
          className="text-center text-xs mt-8"
          style={{ color: '#999999' }}
        >
          Alma Keys · Gestion Immobilière
        </p>
      </div>
    </div>
  )
}
