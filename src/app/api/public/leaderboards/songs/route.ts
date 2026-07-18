import { NextResponse } from 'next/server'
import { getSongLeaderboard } from '@/lib/leaderboards/songs'

/**
 * Public song leaderboard API — same source of truth as
 * wavewarz.info/leaderboards/songs (src/lib/leaderboards/songs.ts).
 *
 * GET https://wavewarz.info/api/public/leaderboards/songs
 * Query params: limit (default 100, max 500), sort ('volume' | 'battles' | 'winRate', default 'volume')
 *
 * No auth required — read-only, aggregate data only. Returns one row per
 * unique track (keyed by Audius permalink), aggregated across every Quick
 * Battle it has appeared in — not the raw per-battle history.
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
    const sort = searchParams.get('sort') === 'battles' || searchParams.get('sort') === 'winRate'
      ? searchParams.get('sort')!
      : 'volume'

    const { songs } = await getSongLeaderboard()

    const aggregated = songs.map(s => {
      const wins = s.battles.filter(b => b.won).length
      const losses = s.battles.length - wins
      const totalVolume = s.battles.reduce((sum, b) => sum + b.volume1, 0)
      const totalUniqueTraders = s.battles.reduce((sum, b) => sum + b.uniqueTraders, 0)
      const lastPlayed = s.battles.reduce<string | null>(
        (latest, b) => (!latest || b.createdAt > latest ? b.createdAt : latest), null
      )
      return {
        songTitle: s.songTitle,
        artistName: s.artistName,
        musicLink: s.musicLink,
        genre: s.genre,
        artUrl: s.artUrl,
        battles: s.battles.length,
        wins,
        losses,
        winRate: s.battles.length > 0 ? Math.round(wins / s.battles.length * 100) : 0,
        totalVolumeSol: Math.round(totalVolume * 10000) / 10000,
        totalUniqueTraders,
        lastPlayed,
      }
    })

    aggregated.sort((a, b) => {
      if (sort === 'battles') return b.battles - a.battles
      if (sort === 'winRate') return b.winRate - a.winRate
      return b.totalVolumeSol - a.totalVolumeSol
    })

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      count: aggregated.length,
      songs: aggregated.slice(0, limit),
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/leaderboards/songs] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
