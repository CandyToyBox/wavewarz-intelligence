import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isBattleLive } from '@/lib/battle-metrics'
import { calculateArtistEarnings, getWinnerLoserPools } from '@/lib/wavewarz-math'

/**
 * Public single-battle detail API.
 *
 * GET https://wavewarz.info/api/public/battles/:id
 *
 * No auth required — all fields are already public onchain data.
 */

export const dynamic = 'force-dynamic'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const battleId = Number(id)
    if (!Number.isInteger(battleId)) {
      return NextResponse.json({ error: 'Invalid battle id' }, { status: 400, headers: corsHeaders() })
    }

    const supabase = await createClient()
    const { data: b, error } = await supabase
      .from('battles')
      .select('*')
      .eq('battle_id', battleId)
      .maybeSingle()

    if (error) throw error
    if (!b) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404, headers: corsHeaders() })
    }

    const round = (n: number) => Math.round(n * 10000) / 10000
    const type = b.is_quick_battle ? 'quick' : b.is_community_battle ? 'community' : 'main'
    const now = Date.now()
    const live = isBattleLive({ created_at: b.created_at, battle_duration: b.battle_duration }, now)

    const aWon = b.winner_decided && b.winner_artist_a !== null ? Number(b.winner_artist_a) >= 0.5 : null
    const p1 = b.artist1_pool ?? 0
    const p2 = b.artist2_pool ?? 0
    const v1 = b.total_volume_a ?? 0
    const v2 = b.total_volume_b ?? 0

    let earnings: { artist1: { tradingFeesSol: number; settlementBonusSol: number; totalSol: number }; artist2: { tradingFeesSol: number; settlementBonusSol: number; totalSol: number } } | null = null
    if (aWon !== null) {
      const { loserPool } = getWinnerLoserPools(p1, p2, aWon)
      const e1 = calculateArtistEarnings(v1, loserPool, aWon)
      const e2 = calculateArtistEarnings(v2, loserPool, !aWon)
      earnings = {
        artist1: { tradingFeesSol: round(e1.tradingFees), settlementBonusSol: round(e1.settlementBonus), totalSol: round(e1.tradingFees + e1.settlementBonus) },
        artist2: { tradingFeesSol: round(e2.tradingFees), settlementBonusSol: round(e2.settlementBonus), totalSol: round(e2.tradingFees + e2.settlementBonus) },
      }
    }

    const body = {
      battleId: b.battle_id,
      type,
      live,
      winnerDecided: !!b.winner_decided,
      winnerSide: aWon === null ? null : (aWon ? 'artist1' : 'artist2'),
      artist1: {
        name: b.artist1_name,
        wallet: b.artist1_wallet,
        musicLink: b.artist1_music_link,
        twitter: b.artist1_twitter,
        poolSol: round(p1),
        volumeSol: round(v1),
      },
      artist2: {
        name: b.artist2_name,
        wallet: b.artist2_wallet,
        musicLink: b.artist2_music_link,
        twitter: b.artist2_twitter,
        poolSol: round(p2),
        volumeSol: round(v2),
      },
      artistEarnings: earnings,
      imageUrl: b.image_url,
      createdAt: b.created_at,
      endsAt: new Date(new Date(b.created_at).getTime() + (b.battle_duration ?? 0) * 1000).toISOString(),
      battleDurationSeconds: b.battle_duration,
      streamLink: b.stream_link,
      url: `https://wavewarz.info/battles/${b.battle_id}`,
    }

    return NextResponse.json(body, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/battles/[id]] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
