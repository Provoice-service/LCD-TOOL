'use client'

import { SOURCE_CONFIG } from '@/components/crm/types'
import type { LeadSource } from '@/components/crm/types'

interface SourceBadgeProps {
  source: LeadSource
  detail?: string | null
  referralName?: string | null
  size?: 'sm' | 'xs'
}

export function SourceBadge({ source, detail, referralName, size = 'sm' }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.other
  const tooltip = referralName
    ? `Référent : ${referralName}`
    : detail
      ? detail
      : undefined

  const px = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${px} ${cfg.bg} ${cfg.color} whitespace-nowrap`}
      title={tooltip}
    >
      {cfg.label}
      {referralName && <span className="ml-1 opacity-60 text-xs">· {referralName}</span>}
    </span>
  )
}
