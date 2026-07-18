import { NextResponse } from 'next/server'
import { getMainEvents } from '@/lib/leaderboards/events'

/**
 * Public Main Events API — grouped, best-of-3-rounds view of Main Events.
 *
 * A Main Event is typically 3 rounds (each its own battle_id) between the
 * same two artists. Each round's winner is decided 2-of-3 (Human Judge + X
 * Poll + SOL/Chart vote); the EVENT winner is whoever wins the majority of
 * rounds. Use /api/public/battles for individual round-level data — this
 * endpoint is for the aggregated event result.
 *
 * GET https://wavewarz.info/api/public/events
 * Query params:
 *   subtype - 'standard' | 'charity' | 'spotlight' | 'prediction' (default: all)
 *   live    - 'true' to return only events with a round currently live
 *   limit   - default 50, max 200
 *
 * No auth required — read-only, all fields are already public onchain +
 * admin-entered judging data.
 */

export const dynamic = 'force-dynamic'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const subtype = searchParams.get('subtype')
    const liveOnly = searchParams.get('live') === 'true'
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)

    const { events: allEvents } = await getMainEvents()

    let events = allEvents
    if (subtype) events = events.filter(e => e.eventSubtype === subtype)
    if (liveOnly) events = events.filter(e => e.live)
    events = events.slice(0, limit)

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      count: events.length,
      events,
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/events] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
