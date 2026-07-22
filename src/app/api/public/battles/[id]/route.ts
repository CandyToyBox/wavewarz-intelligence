import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isBattleLive } from '@/lib/battle-metrics'
import { calculateArtistEarnings, getWinnerLoserPools } from '@/lib/wavewarz-math'
import { canonicalSongKey } from '@/lib/song-identity'

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

// Normalizes a stored factor value ("A"/"B", "artist_a"/"artist_b", "TIE", or
// an artist name) to the public API's existing artist1/artist2 convention.
function normalizeFactorSide(raw: string | null, artist1Name: string | null): 'artist1' | 'artist2' | null {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  if (upper === 'TIE') return null
  if (upper === 'A' || upper === 'ARTIST_A') return 'artist1'
  if (upper === 'B' || upper === 'ARTIST_B') return 'artist2'
  if (artist1Name && raw.trim().toLowerCase() === artist1Name.trim().toLowerCase()) return 'artist1'
  return null
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
      .select('battle_id,is_quick_battle,is_community_battle,created_at,battle_duration,winner_decided,winner_artist_a,artist1_pool,artist2_pool,total_volume_a,total_volume_b,artist1_name,artist2_name,artist1_wallet,artist2_wallet,artist1_music_link,artist2_music_link,artist1_twitter,artist2_twitter,image_url,stream_link,poll_winner,dj_wavy_winner,dj_wavy_reasoning,main_event_human_judge,main_event_x_poll_winner,main_event_sol_vote_winner,main_event_judged_at')
      .eq('battle_id', battleId)
      .maybeSingle()

    if (error) throw error
    if (!b) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404, headers: corsHeaders() })
    }

    const round = (n: number) => Math.round(n * 10000) / 10000
    const type = b.is_quick_battle ? 'quick' : b.is_community_battle ? 'community' : 'main'
    const factors = type === 'quick'
      ? {
          pollWinner: normalizeFactorSide(b.poll_winner, b.artist1_name),
          djWavyWinner: normalizeFactorSide(b.dj_wavy_winner, b.artist1_name),
          djWavyReasoning: b.dj_wavy_reasoning,
        }
      : {
          humanJudgeWinner: normalizeFactorSide(b.main_event_human_judge, b.artist1_name),
          xPollWinner: normalizeFactorSide(b.main_event_x_poll_winner, b.artist1_name),
          solVoteWinner: normalizeFactorSide(b.main_event_sol_vote_winner, b.artist1_name),
          judgedAt: b.main_event_judged_at,
        }
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

    // Resolve artist profile pictures/Twitter + Quick Battle album art
    const wallets = [b.artist1_wallet, b.artist2_wallet].filter((w): w is string => !!w)
    const songKeys = [
      b.artist1_music_link ? canonicalSongKey(b.artist1_music_link, b.artist1_name) : null,
      b.artist2_music_link ? canonicalSongKey(b.artist2_music_link, b.artist2_name) : null,
    ].filter((k): k is string => !!k)

    const [profilesRes, registryRes] = await Promise.all([
      wallets.length
        ? supabase.from('artist_profiles').select('primary_wallet,profile_picture_url,twitter_handle').in('primary_wallet', wallets)
        : Promise.resolve({ data: [] }),
      songKeys.length
        ? supabase.from('song_registry').select('permalink_key,artwork_url').in('permalink_key', songKeys)
        : Promise.resolve({ data: [] }),
    ])

    const profileByWallet = new Map(
      (profilesRes.data ?? []).map((p: { primary_wallet: string; profile_picture_url: string | null; twitter_handle: string | null }) =>
        [p.primary_wallet, { profilePictureUrl: p.profile_picture_url, twitterHandle: p.twitter_handle }])
    )
    const artByKey = new Map(
      (registryRes.data ?? []).map((r: { permalink_key: string; artwork_url: string | null }) => [r.permalink_key, r.artwork_url])
    )

    function resolveArtist(wallet: string | null, name: string | null, twitter: string | null, musicLink: string | null) {
      const profile = wallet ? profileByWallet.get(wallet) : undefined
      const songKey = musicLink ? canonicalSongKey(musicLink, name) : null
      return {
        profilePictureUrl: profile?.profilePictureUrl ?? null,
        twitterHandle: (profile?.twitterHandle ?? twitter)?.replace(/^@/, '') || null,
        albumArtUrl: songKey ? (artByKey.get(songKey) ?? null) : null,
      }
    }

    const body = {
      battleId: b.battle_id,
      type,
      live,
      winnerDecided: !!b.winner_decided,
      winnerSide: aWon === null ? null : (aWon ? 'artist1' : 'artist2'),
      factors,
      artist1: {
        name: b.artist1_name,
        wallet: b.artist1_wallet,
        musicLink: b.artist1_music_link,
        poolSol: round(p1),
        volumeSol: round(v1),
        ...resolveArtist(b.artist1_wallet, b.artist1_name, b.artist1_twitter, b.artist1_music_link),
      },
      artist2: {
        name: b.artist2_name,
        wallet: b.artist2_wallet,
        musicLink: b.artist2_music_link,
        poolSol: round(p2),
        volumeSol: round(v2),
        ...resolveArtist(b.artist2_wallet, b.artist2_name, b.artist2_twitter, b.artist2_music_link),
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
