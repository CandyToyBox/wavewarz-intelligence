import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isBattleLive } from '@/lib/battle-metrics'

/**
 * Public battles list API — flat, paginated feed of every battle.
 *
 * GET https://wavewarz.info/api/public/battles
 * Query params:
 *   type   - 'main' | 'quick' | 'community' (default: all types)
 *   live   - 'true' to return only the currently live battle
 *   limit  - default 50, max 200
 *   offset - default 0
 *
 * No auth required — read-only, all fields are already public onchain data.
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

const SELECT = 'battle_id,artist1_name,artist2_name,artist1_wallet,artist2_wallet,artist1_music_link,artist2_music_link,artist1_pool,artist2_pool,total_volume_a,total_volume_b,winner_decided,winner_artist_a,is_quick_battle,is_main_battle,is_community_battle,battle_duration,created_at,image_url'

type Row = {
  battle_id: number
  artist1_name: string | null
  artist2_name: string | null
  artist1_wallet: string | null
  artist2_wallet: string | null
  artist1_music_link: string | null
  artist2_music_link: string | null
  artist1_pool: number | null
  artist2_pool: number | null
  total_volume_a: number | null
  total_volume_b: number | null
  winner_decided: boolean | null
  winner_artist_a: number | null
  is_quick_battle: boolean | null
  is_main_battle: boolean | null
  is_community_battle: boolean | null
  battle_duration: number | null
  created_at: string
  image_url: string | null
}

function toPublicBattle(b: Row, now: number) {
  const round = (n: number) => Math.round(n * 10000) / 10000
  const type = b.is_quick_battle ? 'quick' : b.is_community_battle ? 'community' : 'main'
  const live = isBattleLive(b, now)
  const winnerSide = b.winner_decided && b.winner_artist_a !== null
    ? (Number(b.winner_artist_a) >= 0.5 ? 'artist1' : 'artist2')
    : null

  return {
    battleId: b.battle_id,
    type,
    live,
    winnerDecided: !!b.winner_decided,
    winnerSide,
    artist1: {
      name: b.artist1_name,
      wallet: b.artist1_wallet,
      musicLink: b.artist1_music_link,
      poolSol: round(b.artist1_pool ?? 0),
      volumeSol: round(b.total_volume_a ?? 0),
    },
    artist2: {
      name: b.artist2_name,
      wallet: b.artist2_wallet,
      musicLink: b.artist2_music_link,
      poolSol: round(b.artist2_pool ?? 0),
      volumeSol: round(b.total_volume_b ?? 0),
    },
    imageUrl: b.image_url,
    createdAt: b.created_at,
    endsAt: new Date(new Date(b.created_at).getTime() + (b.battle_duration ?? 0) * 1000).toISOString(),
    url: `https://wavewarz.info/battles/${b.battle_id}`,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const liveOnly = searchParams.get('live') === 'true'
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    const supabase = await createClient()
    let query = supabase
      .from('battles')
      .select(SELECT)
      .eq('is_test_battle', false)
      .order('created_at', { ascending: false })

    if (type === 'main') query = query.eq('is_main_battle', true)
    else if (type === 'quick') query = query.eq('is_quick_battle', true)
    else if (type === 'community') query = query.eq('is_community_battle', true)

    // Live battles are rare (WaveWarz runs one at a time) and recent, so pull
    // a bounded recent window rather than paginating past the 1000-row cap.
    if (liveOnly) query = query.limit(50)
    else query = query.range(offset, offset + limit - 1)

    const { data, error } = await query
    if (error) throw error

    const now = Date.now()
    let battles = ((data ?? []) as Row[]).map(b => toPublicBattle(b, now))
    if (liveOnly) battles = battles.filter(b => b.live).slice(0, 1)

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      count: battles.length,
      battles,
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/battles] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
