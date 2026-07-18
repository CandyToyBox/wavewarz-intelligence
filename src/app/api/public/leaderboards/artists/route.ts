import { NextResponse } from 'next/server'
import { getArtistLeaderboard } from '@/lib/leaderboards/artists'

/**
 * Public artist leaderboard API — same source of truth as
 * wavewarz.info/leaderboards/artists (src/lib/leaderboards/artists.ts).
 *
 * GET https://wavewarz.info/api/public/leaderboards/artists
 * Query params: limit (default 100, max 500)
 *
 * No auth required — read-only, aggregate data only.
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
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500)

    const { rows } = await getArtistLeaderboard()

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      count: rows.length,
      artists: rows.slice(0, limit),
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/leaderboards/artists] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
