'use client'

import type { AnchorHTMLAttributes } from 'react'

/** Which X conversion event a click maps to — see /api/track/outbound-click for the env var lookup. */
export type ConversionEventType = 'trade_platform' | 'live_show'

/**
 * Fires an X Ads Conversion API event (server-side, via /api/track/outbound-click)
 * for outbound clicks from the Intelligence dashboard. Best-effort — never blocks
 * or breaks navigation if it fails.
 */
export function trackOutboundClick(destination: string, eventType: ConversionEventType = 'trade_platform') {
  if (typeof window === 'undefined') return
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
