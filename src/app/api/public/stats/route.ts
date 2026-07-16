import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getLiveSolPrice } from '@/lib/coingecko'
import { platformMetrics, claimTotals, type MetricsBattle } from '@/lib/battle-metrics'

/**
 * Public platform stats API — for wavewarz.com (or anywhere else) to embed
 * live numbers on the front page. Same source of truth as the wavewarz.info
 * homepage and admin Command Center (src/lib/battle-metrics.ts), so these
 * numbers can never drift from what's shown there.
 *
 * GET https://wavewarz.info/api/public/stats
 *
 * No auth required — read-only, aggregate data only (no wallet-level detail).
 * Revalidates every 60s; safe to poll every 30-60s from a live front page.
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

export async function GET() {
  try {
    const supabase = await createClient()

    const [battles, claims, solPrice] = await Promise.all([
      fetchAll<MetricsBattle>((from, to) => supabase
        .from('battles')
        .select('total_volume_a, total_volume_b, artist1_pool, artist2_pool, artist1_wallet, artist2_wallet, winner_artist_a, winner_decided, is_quick_battle, is_community_battle, is_main_battle, event_subtype, created_at')
        .eq('is_test_battle', false)
        .range(from, to)),
      fetchAll<{ amount_sol: number | null }>((from, to) => supabase
        .from('trades')
        .select('amount_sol')
        .eq('trade_type', 'claim')
        .range(from, to)),
      getLiveSolPrice(),
    ])

    if (!battles.length) {
      return NextResponse.json({ error: 'No data available' }, { status: 503, headers: corsHeaders() })
    }

    const m = platformMetrics(battles)
    const c = claimTotals(claims)
    const round = (n: number) => Math.round(n * 10000) / 10000

    const body = {
      updatedAt: new Date().toISOString(),
      solPriceUsd: solPrice,

      volume: {
        totalSol: round(m.totalVolume),
        totalUsd: round(m.totalVolume * solPrice),
      },
      artistPayouts: {
        totalSol: round(m.artistPayouts),
        totalUsd: round(m.artistPayouts * solPrice),
        note: 'Instant, automatic onchain payouts to artists — 1% of trading volume + settlement bonus',
      },
      traderClaims: {
        totalSol: round(c.totalClaimed),
        totalUsd: round(c.totalClaimed * solPrice),
        withdrawalCount: c.claimCount,
        note: 'Real trader withdrawals (claimShares), parsed from onchain vault transactions',
      },
      platformRevenue: {
        totalSol: round(m.revenue.total),
        totalUsd: round(m.revenue.total * solPrice),
      },
      battles: {
        total: battles.length,
        mainEvents: m.mainEvents,
        mainBattles: m.mainBattles,
        quickBattles: m.quickCount,
        communityBattles: m.communityCount,
      },
    }

    return NextResponse.json(body, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/stats] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
