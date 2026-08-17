import { NextResponse } from 'next/server'

/**
 * Server-side leg of X Ads' Conversion API — fired when a visitor clicks through
 * from the Intelligence dashboard to a tracked destination. Runs alongside the
 * client-side pixel (see root layout) for ad-blocker/ITP resilience.
 *
 * Two conversion events share this one route, distinguished by `eventType` in
 * the request body:
 *   'trade_platform' — clicks to the trading site (wavewarz.com)
 *   'live_show'       — clicks to join an X Space or watch the livestream
 *
 * Requires env vars (Vercel, server-only — never NEXT_PUBLIC_):
 *   X_PIXEL_ACCESS_TOKEN     — from X Ads Conversion API setup, Step 2
 *   X_CONVERSION_EVENT_ID       — tw-reaex-xxxxx id for the 'trade_platform' event
 *   X_CONVERSION_EVENT_ID_LIVE  — tw-reaex-xxxxx id for the 'live_show' event
 * Each event created in X's Events Manager (Ads > Events > Web Conversions).
 * Until both the token and the relevant event id are set, this route is a
 * no-op that doesn't block navigation.
 */

export const dynamic = 'force-dynamic'

const PIXEL_ID = 'reaex'

function eventIdFor(eventType: string | undefined): string | undefined {
  if (eventType === 'live_show') return process.env.X_CONVERSION_EVENT_ID_LIVE
  return process.env.X_CONVERSION_EVENT_ID
}

export async function POST(request: Request) {
  try {
    const token = process.env.X_PIXEL_ACCESS_TOKEN

    const { eventType, eventSourceUrl, twclid } = (await request.json().catch(() => ({}))) as {
      eventType?: string
      eventSourceUrl?: string
      twclid?: string | null
    }

    const eventId = eventIdFor(eventType)
    if (!token || !eventId) {
      return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 202 })
    }

    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0]?.trim()
    const userAgent = request.headers.get('user-agent') ?? undefined

    const identifiers: Record<string, string> = {}
    if (twclid) identifiers.twclid = twclid
    if (ipAddress) identifiers.ip_address = ipAddress
    if (userAgent) identifiers.user_agent = userAgent

    // X requires at least one of: twclid, hashed_email, hashed_phone, or the ip+user_agent pair.
    const hasIdentifier = Boolean(identifiers.twclid || (identifiers.ip_address && identifiers.user_agent))
    if (!hasIdentifier) {
      return NextResponse.json({ ok: false, reason: 'no_identifiers' }, { status: 202 })
    }

    const res = await fetch(`https://ads-api.x.com/12/measurement/conversions/${PIXEL_ID}`, {
      method: 'POST',
      headers: {
        'X-Pixel-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversions: [
          {
            conversion_time: new Date().toISOString(),
            event_id: eventId,
            event_source_url: eventSourceUrl,
            conversion_id: `owc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            identifiers: [identifiers],
          },
        ],
      }),
    })

    if (!res.ok) {
      console.error('[api/track/outbound-click] X Conversion API error:', res.status, await res.text().catch(() => ''))
      return NextResponse.json({ ok: false }, { status: 202 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/track/outbound-click] error:', err)
    return NextResponse.json({ ok: false }, { status: 202 })
  }
}
