import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getLiveSolPrice } from '@/lib/coingecko'
import { platformMetrics, claimTotals, isBattleLive, type MetricsBattle } from '@/lib/battle-metrics'

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

type LiveBattleRow = {
  battle_id: number
  artist1_name: string | null
  artist2_name: string | null
  artist1_wallet: string | null
  artist2_wallet: string | null
  artist1_pool: number | null
  artist2_pool: number | null
  total_volume_a: number | null
  total_volume_b: number | null
  is_quick_battle: boolean | null
  is_main_battle: boolean | null
  is_community_battle: boolean | null
  battle_duration: number | null
  created_at: string
}

// Live-vs-completed logic now lives in isBattleLive() in battle-metrics.ts, shared
// across every page/API that needs to know if a battle is still running. WaveWarz
// currently runs one battle at a time, so the single most recent battle is always
// the only live candidate.

export async function GET() {
  try {
    const supabase = await createClient()

    const [battles, claims, solPrice, liveCandidateRes] = await Promise.all([
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
      supabase
        .from('battles')
        .select('battle_id, artist1_name, artist2_name, artist1_wallet, artist2_wallet, artist1_pool, artist2_pool, total_volume_a, total_volume_b, is_quick_battle, is_main_battle, is_community_battle, battle_duration, created_at')
        .eq('is_test_battle', false)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    if (!battles.length) {
      return NextResponse.json({ error: 'No data available' }, { status: 503, headers: corsHeaders() })
    }

    const m = platformMetrics(battles)
    const c = claimTotals(claims)
    const round = (n: number) => Math.round(n * 10000) / 10000

    const now = Date.now()
    const windowVolume = (ms: number) => battles
      .filter(b => now - new Date(b.created_at).getTime() <= ms)
      .reduce((s, b) => s + (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0), 0)

    const candidate = (liveCandidateRes.data?.[0] ?? null) as LiveBattleRow | null
    const liveBattle = (candidate && isBattleLive(candidate, now)) ? {
      battleId: candidate.battle_id,
      type: candidate.is_quick_battle ? 'quick' : candidate.is_community_battle ? 'community' : 'main',
      artist1: { name: candidate.artist1_name, wallet: candidate.artist1_wallet, poolSol: round(candidate.artist1_pool ?? 0), volumeSol: round(candidate.total_volume_a ?? 0) },
      artist2: { name: candidate.artist2_name, wallet: candidate.artist2_wallet, poolSol: round(candidate.artist2_pool ?? 0), volumeSol: round(candidate.total_volume_b ?? 0) },
      startedAt: candidate.created_at,
      endsAt: new Date(new Date(candidate.created_at).getTime() + (candidate.battle_duration ?? 0) * 1000).toISOString(),
      url: `https://wavewarz.info/battles/${candidate.battle_id}`,
    } : null

    const body = {
      updatedAt: new Date().toISOString(),
      solPriceUsd: solPrice,

      volume: {
        totalSol: round(m.totalVolume),
        totalUsd: round(m.totalVolume * solPrice),
        last24hSol: round(windowVolume(24 * 60 * 60 * 1000)),
        last7dSol: round(windowVolume(7 * 24 * 60 * 60 * 1000)),
      },
      liveBattle,
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
