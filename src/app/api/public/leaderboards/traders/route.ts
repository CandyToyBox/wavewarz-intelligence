import { NextResponse } from 'next/server'
import { getTraderLeaderboard } from '@/lib/leaderboards/traders'

/**
 * Public trader leaderboard API — same source of truth as
 * wavewarz.info/leaderboards/traders (src/lib/leaderboards/traders.ts).
 *
 * GET https://wavewarz.info/api/public/leaderboards/traders
 * Query params: limit (default 100, max 500)
 *
 * No auth required — read-only, aggregate data only. Wallet addresses are
 * public onchain data; no PII is exposed.
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

    const { rows, solPrice } = await getTraderLeaderboard()

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      solPriceUsd: solPrice,
      count: rows.length,
      traders: rows.slice(0, limit),
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/leaderboards/traders] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
