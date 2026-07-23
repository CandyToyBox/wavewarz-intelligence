import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isBattleLive } from '@/lib/battle-metrics'
import { canonicalSongKey } from '@/lib/song-identity'

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

const SELECT = 'battle_id,artist1_name,artist2_name,artist1_wallet,artist2_wallet,artist1_twitter,artist2_twitter,artist1_music_link,artist2_music_link,artist1_pool,artist2_pool,total_volume_a,total_volume_b,winner_decided,winner_artist_a,is_quick_battle,is_main_battle,is_community_battle,battle_duration,created_at,image_url,poll_winner,poll_votes_a,poll_votes_b,dj_wavy_winner,dj_wavy_reasoning,main_event_human_judge,main_event_x_poll_winner,main_event_sol_vote_winner,main_event_judged_at'

type Row = {
  battle_id: number
  artist1_name: string | null
  artist2_name: string | null
  artist1_wallet: string | null
  artist2_wallet: string | null
  artist1_twitter: string | null
  artist2_twitter: string | null
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
  poll_winner: string | null
  poll_votes_a: number | null
  poll_votes_b: number | null
  dj_wavy_winner: string | null
  dj_wavy_reasoning: string | null
  main_event_human_judge: string | null
  main_event_x_poll_winner: string | null
  main_event_sol_vote_winner: string | null
  main_event_judged_at: string | null
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

type ProfileInfo = { profilePictureUrl: string | null; twitterHandle: string | null }
type ArtUrlByKey = Map<string, string | null>

function resolveArtist(
  wallet: string | null, name: string | null, twitter: string | null, musicLink: string | null,
  profileByWallet: Map<string, ProfileInfo>, artByKey: ArtUrlByKey,
) {
  const profile = wallet ? profileByWallet.get(wallet) : undefined
  const songKey = musicLink ? canonicalSongKey(musicLink, name) : null
  return {
    name,
    wallet,
    musicLink,
    profilePictureUrl: profile?.profilePictureUrl ?? null,
    twitterHandle: (profile?.twitterHandle ?? twitter)?.replace(/^@/, '') || null,
    albumArtUrl: songKey ? (artByKey.get(songKey) ?? null) : null,
  }
}

function toPublicBattle(
  b: Row, now: number, profileByWallet: Map<string, ProfileInfo>, artByKey: ArtUrlByKey,
) {
  const round = (n: number) => Math.round(n * 10000) / 10000
  const type = b.is_quick_battle ? 'quick' : b.is_community_battle ? 'community' : 'main'
  const live = isBattleLive(b, now)
  const winnerSide = b.winner_decided && b.winner_artist_a !== null
    ? (Number(b.winner_artist_a) >= 0.5 ? 'artist1' : 'artist2')
    : null

  const a1 = resolveArtist(b.artist1_wallet, b.artist1_name, b.artist1_twitter, b.artist1_music_link, profileByWallet, artByKey)
  const a2 = resolveArtist(b.artist2_wallet, b.artist2_name, b.artist2_twitter, b.artist2_music_link, profileByWallet, artByKey)

  const factors = type === 'quick'
    ? {
        pollWinner: normalizeFactorSide(b.poll_winner, b.artist1_name),
        pollVotesArtist1: b.poll_votes_a,
        pollVotesArtist2: b.poll_votes_b,
        djWavyWinner: normalizeFactorSide(b.dj_wavy_winner, b.artist1_name),
        djWavyReasoning: b.dj_wavy_reasoning,
      }
    : {
        humanJudgeWinner: normalizeFactorSide(b.main_event_human_judge, b.artist1_name),
        xPollWinner: normalizeFactorSide(b.main_event_x_poll_winner, b.artist1_name),
        solVoteWinner: normalizeFactorSide(b.main_event_sol_vote_winner, b.artist1_name),
        judgedAt: b.main_event_judged_at,
      }

  return {
    battleId: b.battle_id,
    type,
    live,
    winnerDecided: !!b.winner_decided,
    winnerSide,
    artist1: { ...a1, poolSol: round(b.artist1_pool ?? 0), volumeSol: round(b.total_volume_a ?? 0) },
    artist2: { ...a2, poolSol: round(b.artist2_pool ?? 0), volumeSol: round(b.total_volume_b ?? 0) },
    factors,
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

    const rows = (data ?? []) as Row[]

    // Batch-resolve artist profile pictures/Twitter and Quick Battle album art
    // in two extra queries rather than N+1 per battle.
    const wallets = Array.from(new Set(rows.flatMap(b => [b.artist1_wallet, b.artist2_wallet]).filter((w): w is string => !!w)))
    const songKeys = Array.from(new Set(
      rows.flatMap(b => [
        b.artist1_music_link ? canonicalSongKey(b.artist1_music_link, b.artist1_name) : null,
        b.artist2_music_link ? canonicalSongKey(b.artist2_music_link, b.artist2_name) : null,
      ]).filter((k): k is string => !!k)
    ))

    const [profilesRes, registryRes] = await Promise.all([
      wallets.length
        ? supabase.from('artist_profiles').select('primary_wallet,profile_picture_url,twitter_handle').in('primary_wallet', wallets)
        : Promise.resolve({ data: [] }),
      songKeys.length
        ? supabase.from('song_registry').select('permalink_key,artwork_url').in('permalink_key', songKeys)
        : Promise.resolve({ data: [] }),
    ])

    const profileByWallet = new Map<string, ProfileInfo>(
      (profilesRes.data ?? []).map((p: { primary_wallet: string; profile_picture_url: string | null; twitter_handle: string | null }) =>
        [p.primary_wallet, { profilePictureUrl: p.profile_picture_url, twitterHandle: p.twitter_handle }])
    )
    const artByKey: ArtUrlByKey = new Map(
      (registryRes.data ?? []).map((r: { permalink_key: string; artwork_url: string | null }) => [r.permalink_key, r.artwork_url])
    )

    const now = Date.now()
    let battles = rows.map(b => toPublicBattle(b, now, profileByWallet, artByKey))
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
