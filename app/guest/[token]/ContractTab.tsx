'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '@/lib/guest-page/translations'

interface Article { number: number; title: string; body: string }

interface ContractData {
  content_fr: string
  content_en: string | null
  vars: Record<string, string>
  reservation: {
    id: string
    contract_signed: boolean
    contract_pdf_url: string | null
    contract_signed_at: string | null
    platform: string
  }
}

const HIGHLIGHTED = new Set([5, 7, 8, 15, 17])

function parseArticles(text: string): Article[] {
  const arts: Article[] = []
  const regex = /^(\d+)\.\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ''؀-ۿ()\s&/]+)\n([\s\S]*?)(?=\n\d+\.\s+[A-Z؀-ۿ]|$)/gm
  let m
  while ((m = regex.exec(text)) !== null) {
    arts.push({ number: parseInt(m[1]), title: m[2].trim(), body: m[3].trim() })
  }
  return arts
}

const T = {
  fr: {
    title: 'Contrat de location',
    scrollHint: 'Faites défiler pour lire le contrat complet',
    readPct: 'Vous avez lu',
    ofContract: '% du contrat',
    check1: 'J\'ai lu et j\'accepte l\'ensemble des articles du contrat de location',
    check2: 'Je reconnais que la signature électronique a la même valeur qu\'une signature manuscrite',
    check3: 'Je reconnais avoir pris connaissance des articles concernant la caution (Art. 3) et les conditions de résiliation (Art. 16)',
    signTitle: 'Votre signature',
    signHint: 'Signez dans le cadre ci-dessous avec votre doigt ou la souris',
    clear: 'Effacer',
    sign: 'Valider et signer le contrat',
    signing: 'Signature en cours…',
    signed: 'Contrat signé',
    signedAt: 'Signé le',
    download: 'Télécharger le PDF',
    alreadySigned: 'Votre contrat a été signé électroniquement.',
    noContract: 'Le contrat sera disponible avant votre arrivée.',
    fr: 'FR',
    en: 'EN',
    bothLangs: 'Afficher FR + EN',
  },
  en: {
    title: 'Rental Contract',
    scrollHint: 'Scroll to read the full contract',
    readPct: 'You have read',
    ofContract: '% of the contract',
    check1: 'I have read and agree to all articles of the rental contract',
    check2: 'I acknowledge that the electronic signature has the same legal value as a handwritten signature',
    check3: 'I acknowledge having read the articles regarding the security deposit (Art. 3) and termination conditions (Art. 16)',
    signTitle: 'Your signature',
    signHint: 'Sign in the box below with your finger or mouse',
    clear: 'Clear',
    sign: 'Validate and sign the contract',
    signing: 'Signing…',
    signed: 'Contract Signed',
    signedAt: 'Signed on',
    download: 'Download PDF',
    alreadySigned: 'Your contract has been signed electronically.',
    noContract: 'The contract will be available before your arrival.',
    fr: 'FR',
    en: 'EN',
    bothLangs: 'Show FR + EN',
  },
}

export default function ContractTab({
  token,
  lang,
  initialData,
  onSigned,
}: {
  token: string
  lang: Lang
  initialData?: ContractData | null
  onSigned?: () => void
}) {
  const t = T[lang === 'en' ? 'en' : 'fr']
  const isAirbnb = (initialData?.reservation?.platform ?? '').toLowerCase() === 'airbnb'

  const [data, setData]             = useState<ContractData | null>(initialData ?? null)
  const [loading, setLoading]       = useState(!initialData)
  const [displayLang, setDisplayLang] = useState<'fr' | 'en' | 'both'>('fr')
  const [scrollPct, setScrollPct]   = useState(0)
  const [check1, setCheck1]         = useState(false)
  const [check2, setCheck2]         = useState(false)
  const [check3, setCheck3]         = useState(false)
  const [signing, setSigning]       = useState(false)
  const [signed, setSigned]         = useState(false)
  const [pdfUrl, setPdfUrl]         = useState<string | null>(null)
  const [signedAt, setSignedAt]     = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastRef    = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (initialData) {
      if (initialData.reservation.contract_signed) {
        setSigned(true)
        setPdfUrl(initialData.reservation.contract_pdf_url)
        setSignedAt(initialData.reservation.contract_signed_at)
      }
      return
    }
    fetch(`/api/guest/${token}/contract`)
      .then(r => r.ok ? r.json() : null)
      .then((d: ContractData | null) => {
        setData(d)
        if (d?.reservation.contract_signed) {
          setSigned(true)
          setPdfUrl(d.reservation.contract_pdf_url)
          setSignedAt(d.reservation.contract_signed_at)
        }
      })
      .finally(() => setLoading(false))
  }, [token, initialData])

  // Scroll tracker
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100)
      setScrollPct(Math.min(100, pct || 0))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [data])

  // Canvas helpers
  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top }
  }

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    drawingRef.current = true
    lastRef.current = getPos(e, canvas)
  }, [])

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    if (!ctx || !lastRef.current) return
    const pos = getPos(e, canvas)
    ctx.strokeStyle = '#1A1A1A'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastRef.current = pos
    setHasSignature(true)
  }, [])

  const endDraw = useCallback(() => {
    drawingRef.current = false
    lastRef.current = null
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', endDraw)
    canvas.addEventListener('mouseleave', endDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', endDraw)
    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', endDraw)
      canvas.removeEventListener('mouseleave', endDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', endDraw)
    }
  }, [startDraw, draw, endDraw])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSign = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSigning(true)
    try {
      const signatureImage = canvas.toDataURL('image/png')
      const res = await fetch(`/api/guest/${token}/sign-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_image: signatureImage }),
      })
      if (res.ok) {
        const json = await res.json() as { signed_at?: string; pdf_url?: string }
        setSigned(true)
        setSignedAt(json.signed_at ?? null)
        setPdfUrl(json.pdf_url ?? null)
        onSigned?.()
      }
    } finally {
      setSigning(false)
    }
  }

  const allChecked = check1 && check2 && (isAirbnb || check3)
  const canSign = allChecked && hasSignature && scrollPct >= 80

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#C4A044', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!data) return (
    <div className="text-center py-12 text-sm" style={{ color: '#999999' }}>{t.noContract}</div>
  )

  const articlesFr = parseArticles(data.content_fr)
  const articlesEn = data.content_en ? parseArticles(data.content_en) : []

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>{t.title}</h2>
        {data.content_en && (
          <div className="flex gap-1">
            {(['fr', 'en', 'both'] as const).map(l => (
              <button
                key={l}
                onClick={() => setDisplayLang(l)}
                className="text-xs px-2 py-1 rounded-md font-medium transition-all"
                style={{
                  background: displayLang === l ? '#C4A044' : 'transparent',
                  color: displayLang === l ? '#fff' : '#666666',
                  border: `1px solid ${displayLang === l ? '#C4A044' : '#E8E4DC'}`,
                }}
              >
                {l === 'both' ? t.bothLangs : l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Already signed */}
      {signed ? (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#F0FAF0', border: '1px solid #B8E6B8' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#2D7D2D' }}>{t.signed}</p>
              {signedAt && (
                <p className="text-xs" style={{ color: '#4A9A4A' }}>
                  {t.signedAt} {new Date(signedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          <p className="text-sm" style={{ color: '#2D7D2D' }}>{t.alreadySigned}</p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium w-fit"
              style={{ background: '#C4A044', color: '#fff' }}
            >
              📄 {t.download}
            </a>
          )}
        </div>
      ) : null}

      {/* Contract text */}
      {!signed && (
        <>
          {/* Scroll hint */}
          <div className="text-xs text-center py-1" style={{ color: '#999999' }}>{t.scrollHint}</div>

          {/* Scroll progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full" style={{ background: '#E8E4DC' }}>
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${scrollPct}%`, background: scrollPct >= 80 ? '#22AA44' : '#C4A044' }}
              />
            </div>
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: scrollPct >= 80 ? '#22AA44' : '#C4A044' }}>
              {t.readPct} {scrollPct}{t.ofContract}
            </span>
          </div>

          {/* Articles scrollable */}
          <div
            ref={scrollRef}
            className="rounded-xl overflow-y-auto"
            style={{ maxHeight: '50vh', border: '1px solid #E8E4DC', background: '#FAFAFA' }}
          >
            {displayLang === 'both' ? (
              // Side by side (stacked on mobile, grid on md+)
              <div className="divide-y" style={{ borderColor: '#E8E4DC' }}>
                {articlesFr.map((artFr, i) => {
                  const artEn = articlesEn[i]
                  const hl = HIGHLIGHTED.has(artFr.number)
                  return (
                    <div key={artFr.number} className="grid md:grid-cols-2 divide-x" style={{ borderColor: '#E8E4DC', background: hl ? '#FFF8F0' : 'transparent' }}>
                      <div className="p-3" style={hl ? { borderLeft: '3px solid #C4A044' } : {}}>
                        <p className="text-xs font-bold mb-1" style={{ color: '#C4A044' }}>Art. {artFr.number} — {artFr.title}</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#333333' }}>{artFr.body}</p>
                      </div>
                      {artEn && (
                        <div className="p-3">
                          <p className="text-xs font-bold mb-1" style={{ color: '#A88830' }}>Art. {artEn.number} — {artEn.title}</p>
                          <p className="text-xs leading-relaxed" style={{ color: '#555555' }}>{artEn.body}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#E8E4DC' }}>
                {(displayLang === 'en' ? articlesEn : articlesFr).map(art => {
                  const hl = HIGHLIGHTED.has(art.number)
                  return (
                    <div
                      key={art.number}
                      className="p-3"
                      style={{
                        background: hl ? '#FFF8F0' : 'transparent',
                        borderLeft: hl ? '3px solid #C4A044' : undefined,
                      }}
                    >
                      <p className="text-xs font-bold mb-1" style={{ color: '#C4A044' }}>
                        Art. {art.number} — {art.title}
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: '#333333' }}>{art.body}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-3">
            {[
              { key: 'c1', checked: check1, set: setCheck1, label: t.check1 },
              { key: 'c2', checked: check2, set: setCheck2, label: t.check2 },
              ...(!isAirbnb ? [{ key: 'c3', checked: check3, set: setCheck3, label: t.check3 }] : []),
            ].map(({ key, checked, set, label }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <div
                  className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 transition-all"
                  style={{ background: checked ? '#C4A044' : '#fff', border: `2px solid ${checked ? '#C4A044' : '#C8C0B0'}` }}
                  onClick={() => set(!checked)}
                >
                  {checked && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <span className="text-xs leading-relaxed" style={{ color: '#333333' }}>{label}</span>
              </label>
            ))}
          </div>

          {/* Signature pad */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{t.signTitle}</p>
              <button
                onClick={clearCanvas}
                className="text-xs px-2 py-1 rounded-md"
                style={{ color: '#666666', border: '1px solid #E8E4DC' }}
              >
                {t.clear}
              </button>
            </div>
            <p className="text-xs mb-2" style={{ color: '#999999' }}>{t.signHint}</p>
            <canvas
              ref={canvasRef}
              width={600}
              height={160}
              className="w-full rounded-xl touch-none"
              style={{
                border: `2px solid ${hasSignature ? '#C4A044' : '#E8E4DC'}`,
                background: '#FFFFFF',
                cursor: 'crosshair',
                display: 'block',
              }}
            />
          </div>

          {/* Sign button */}
          {!canSign && (
            <p className="text-xs text-center" style={{ color: '#999999' }}>
              {scrollPct < 80
                ? `Lisez au moins 80% du contrat pour pouvoir signer (${scrollPct}% lu)`
                : !allChecked
                ? 'Cochez toutes les cases pour continuer'
                : 'Ajoutez votre signature pour continuer'
              }
            </p>
          )}

          <button
            onClick={handleSign}
            disabled={!canSign || signing}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: canSign && !signing ? '#C4A044' : '#E8E4DC',
              color: canSign && !signing ? '#fff' : '#999999',
              cursor: canSign && !signing ? 'pointer' : 'not-allowed',
            }}
          >
            {signing ? t.signing : t.sign}
          </button>
        </>
      )}
    </div>
  )
}
