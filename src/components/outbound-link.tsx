'use client'

import type { AnchorHTMLAttributes } from 'react'

declare global {
  interface Window {
    twq?: (command: string, eventId: string, params?: Record<string, unknown>) => void
  }
}

/** Which X conversion event a click maps to — see /api/track/outbound-click for the env var lookup. */
export type ConversionEventType = 'trade_platform' | 'live_show'

// Client-side X pixel event ids (public — X has you paste these directly into page HTML).
// The matching server-only X_CONVERSION_EVENT_ID(_LIVE) env vars are the source of truth
// for the Conversion API call; keep both in sync when an id changes in X's Events Manager.
const CLIENT_EVENT_IDS: Partial<Record<ConversionEventType, string>> = {
  live_show: 'tw-reaex-reh9v',
  trade_platform: 'tw-reaex-reha6',
}

function newConversionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `owc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Fires an X Ads conversion for outbound clicks from the Intelligence dashboard —
 * both the client-side pixel event (ad-blocker-visible, fast) and the server-side
 * Conversion API call (via /api/track/outbound-click, ad-blocker-resilient), tied
 * together with a shared conversion_id so X can dedupe the two. Best-effort —
 * never blocks or breaks navigation if either leg fails.
 */
export function trackOutboundClick(destination: string, eventType: ConversionEventType = 'trade_platform') {
  if (typeof window === 'undefined') return
  const conversionId = newConversionId()

  const clientEventId = CLIENT_EVENT_IDS[eventType]
  if (clientEventId) {
    window.twq?.('event', clientEventId, { conversion_id: conversionId })
  }

  let twclid: string | null = null
  try {
    twclid = sessionStorage.getItem('twclid')
  } catch {
    // sessionStorage unavailable (privacy mode, etc.) — skip identifier
  }
  fetch('/api/track/outbound-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination,
      eventType,
      eventSourceUrl: window.location.href,
      twclid,
      conversionId,
    }),
    keepalive: true,
  }).catch(() => {})
}

/** Drop-in <a> replacement that tracks outbound conversion clicks on top of normal link behavior. */
export function OutboundLink({
  onClick,
  href,
  eventType = 'trade_platform',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { eventType?: ConversionEventType }) {
  return (
    <a
      href={href}
      onClick={e => {
        if (href) trackOutboundClick(href, eventType)
        onClick?.(e)
      }}
      {...props}
    />
  )
}
