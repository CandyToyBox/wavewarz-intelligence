import { createAdminClient } from '@/lib/supabase/server'
import { getArtistStats, type Battle } from '@/lib/artist-stats'
import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { groupIntoEvents, pairKey } from '@/lib/event-grouping'
import { canonicalSongKey } from '@/lib/song-identity'
import { formatSol } from '@/lib/wavewarz-math'

// The Phase 36 "Artist One-Page Booker Card" — fast internal reference.
// Merges the editable artist_bibles row with the computed career record
// (reusing getArtistStats, the same source as the public Player Card).

export type ArtistBible = {
  artist_id: string
  nickname: string | null
  archetype_primary: string | null
  archetype_secondary: string | null
  hero_heel: string | null
  one_line_identity: string | null
  want: string | null
  motivation: string | null
  core_belief: string | null
  greatest_strength: string | null
  vulnerability: string | null
  whats_proving: string | null
  colors: Record<string, string>
  symbol: string | null
  typography: string | null
  logo_url: string | null
  visual_effect: string | null
  do_not_use: string | null
  entrance_sting_url: string | null
  walk_cue_url: string | null
  walk_script_md: string | null
  catchphrase: string | null
  victory_phrase: string | null
  challenge_phrase: string | null
  signoff: string | null
  announcer_intro: string | null
  short_bio: string | null
  long_bio: string | null
  voice_tone: string | null
  trashtalk_boundaries: string | null
  signature_weapon: string | null
  memeable_phrase: string | null
  artist_emoji: string | null
  community_name: string | null
  sponsor_fit: string[]
  canonical_clips: { title: string; url: string; note?: string }[]
  needs_review: boolean
  updated_at: string
}

// The bible fields that count toward the completeness bar (Phase 9–20, 36).
export const BIBLE_SCORED_FIELDS: (keyof ArtistBible)[] = [
  'archetype_primary', 'hero_heel', 'one_line_identity', 'want', 'motivation',
  'greatest_strength', 'vulnerability', 'whats_proving', 'symbol', 'visual_effect',
  'entrance_sting_url', 'walk_script_md', 'catchphrase', 'victory_phrase',
  'announcer_intro', 'short_bio', 'voice_tone', 'signature_weapon',
  'memeable_phrase', 'community_name',
]

export function bibleCompleteness(bible: Partial<ArtistBible> | null): number {
  if (!bible) return 0
  let filled = 0
  for (const f of BIBLE_SCORED_FIELDS) {
    const v = bible[f]
    if (typeof v === 'string' && v.trim()) filled++
  }
  // colors + sponsor_fit + canonical_clips each count as one more
  if (bible.colors && Object.keys(bible.colors).length) filled++
  if (bible.sponsor_fit && bible.sponsor_fit.length) filled++
  if (bible.canonical_clips && bible.canonical_clips.length) filled++
  return Math.round((filled / (BIBLE_SCORED_FIELDS.length + 3)) * 100)
}

const EMPTY_BIBLE = (artistId: string): ArtistBible => ({
  artist_id: artistId,
  nickname: null, archetype_primary: null, archetype_secondary: null, hero_heel: null,
  one_line_identity: null, want: null, motivation: null, core_belief: null,
  greatest_strength: null, vulnerability: null, whats_proving: null, colors: {},
  symbol: null, typography: null, logo_url: null, visual_effect: null, do_not_use: null,
  entrance_sting_url: null, walk_cue_url: null, walk_script_md: null, catchphrase: null,
  victory_phrase: null, challenge_phrase: null, signoff: null, announcer_intro: null,
  short_bio: null, long_bio: null, voice_tone: null, trashtalk_boundaries: null,
  signature_weapon: null, memeable_phrase: null, artist_emoji: null, community_name: null,
  sponsor_fit: [], canonical_clips: [], needs_review: false, updated_at: '',
})

export async function getArtistBible(artistId: string): Promise<ArtistBible> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('artist_bibles').select('*').eq('artist_id', artistId).maybeSingle()
  if (!data) return EMPTY_BIBLE(artistId)
  return {
    ...EMPTY_BIBLE(artistId),
    ...data,
    colors: (data.colors as Record<string, string>) ?? {},
    sponsor_fit: (data.sponsor_fit as string[]) ?? [],
    canonical_clips: (data.canonical_clips as ArtistBible['canonical_clips']) ?? [],
  }
}

// ─── Computed career timeline (events + quick battles, newest first) ──────────

type TimelineEntry = { date: string; type: 'main' | 'quick'; opponent: string; won: boolean }

function buildTimeline(
  mainEventBattles: Battle[], quickBattles: Battle[], allWallets: string[],
  opponentNameOverrides: Map<string, string>,
): TimelineEntry[] {
  const out: TimelineEntry[] = []

  const decided = mainEventBattles.filter(b => b.status !== 'ACTIVE' || b.winner_decided)
  const events = groupIntoEvents(
    decided,
    b => pairKey(b.artist1_wallet, b.artist1_name, b.artist2_wallet, b.artist2_name),
    b => new Date(b.created_at).getTime(),
  )
  for (const rounds of events) {
    let my = 0, opp = 0
    for (const b of rounds) {
      const isA = allWallets.includes(b.artist1_wallet)
      const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
      const aWon = (b.winner_decided && b.winner_artist_a !== null) ? Boolean(b.winner_artist_a) : p1 >= p2
      if (isA ? aWon : !aWon) my++; else opp++
    }
    if (my === opp) continue
    const first = rounds[0]
    const isA = allWallets.includes(first.artist1_wallet)
    const oppWallet = isA ? first.artist2_wallet : first.artist1_wallet
    const oppName = opponentNameOverrides.get(`${first.battle_id}|${oppWallet}`)
      ?? (isA ? first.artist2_name : first.artist1_name)
    out.push({
      date: rounds[rounds.length - 1].created_at,
      type: 'main',
      opponent: oppName,
      won: my > opp,
    })
  }

  for (const b of quickBattles) {
    if (b.status === 'ACTIVE' && !b.winner_decided) continue
    const isA = allWallets.includes(b.artist1_wallet)
    const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
    const aWon = (b.winner_decided && b.winner_artist_a !== null) ? Boolean(b.winner_artist_a) : p1 >= p2
    out.push({
      date: b.created_at,
      type: 'quick',
      opponent: isA ? b.artist2_name : b.artist1_name,
      won: isA ? aWon : !aWon,
    })
  }

  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export type BookerCard = {
  artistId: string
  displayName: string
  pfpUrl: string | null
  twitterHandle: string | null
  audiusHandle: string | null
  // Leaderboard-parity avatar source (artist_profiles only — same as the
  // Artist Leaderboard). `pfpUrl` above may additionally fall back to Audius.
  profilePictureUrl: string | null
  bible: ArtistBible
  completeness: number
  // Quick-battle songs with album art (same source as the Song Leaderboard).
  songs: BookerSong[]
  // Computed record
  rank: number | null
  wins: number
  losses: number
  mainWins: number
  mainLosses: number
  quickWins: number
  quickLosses: number
  winRate: number | null
  volumeSol: string
  earningsSol: string
  streak: { kind: 'W' | 'L'; count: number } | null
  recentForm: ('W' | 'L')[]
  topRival: { name: string; meetings: number; record: string } | null
  bestNextOpponent: string | null
  hasStats: boolean
}

export type BookerSong = {
  key: string
  title: string
  musicLink: string | null
  artUrl: string | null
  wins: number
  losses: number
  volumeSol: string
}

async function buildSongs(
  quickBattles: Battle[], allWallets: string[], supabase: ReturnType<typeof createAdminClient>,
): Promise<BookerSong[]> {
  const map = new Map<string, { title: string; musicLink: string | null; wins: number; losses: number; volume: number }>()
  for (const b of quickBattles) {
    const isA = allWallets.includes(b.artist1_wallet)
    const title = isA ? b.artist1_name : b.artist2_name
    const musicLink = isA ? (b.artist1_music_link ?? null) : (b.artist2_music_link ?? null)
    const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
    const aWon = (b.winner_decided && b.winner_artist_a !== null) ? Boolean(b.winner_artist_a) : p1 >= p2
    const won = isA ? aWon : !aWon
    const vol = isA ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)
    const key = canonicalSongKey(musicLink, title)
    const e = map.get(key) ?? { title, musicLink, wins: 0, losses: 0, volume: 0 }
    if (won) e.wins++; else e.losses++
    e.volume += vol
    map.set(key, e)
  }
  const keys = [...map.keys()]
  const artByKey = new Map<string, string | null>()
  if (keys.length) {
    const { data } = await supabase.from('song_registry').select('permalink_key,artwork_url').in('permalink_key', keys)
    for (const r of data ?? []) artByKey.set(r.permalink_key, r.artwork_url ?? null)
  }
  return [...map.entries()]
    .map(([key, s]) => ({
      key, title: s.title, musicLink: s.musicLink, artUrl: artByKey.get(key) ?? null,
      wins: s.wins, losses: s.losses, volumeSol: formatSol(s.volume),
    }))
    .sort((a, b) => b.wins - a.wins || parseFloat(b.volumeSol) - parseFloat(a.volumeSol))
}

export async function getBookerCard(artistId: string): Promise<BookerCard | null> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('artist_profiles')
    .select('artist_id,display_name,twitter_handle,audius_handle,profile_picture_url,custom_pfp_url')
    .eq('artist_id', artistId)
    .maybeSingle()
  if (!profile) return null

  const [bible, stats, leaderboard] = await Promise.all([
    getArtistBible(artistId),
    getArtistStats(artistId),
    getArtistLeaderboard(),
  ])

  const storedPfp = (profile.profile_picture_url as string | null) ?? (profile.custom_pfp_url as string | null) ?? null

  const base = {
    artistId,
    displayName: (profile.display_name as string) ?? stats?.displayName ?? 'Unknown Artist',
    pfpUrl: storedPfp ?? stats?.pfpUrl ?? null,
    profilePictureUrl: storedPfp,
    twitterHandle: (profile.twitter_handle as string | null) ?? stats?.twitterHandle ?? null,
    audiusHandle: (profile.audius_handle as string | null) ?? stats?.audiusHandle ?? null,
    bible,
    completeness: bibleCompleteness(bible),
  }

  if (!stats) {
    return {
      ...base,
      songs: [],
      rank: null, wins: 0, losses: 0, mainWins: 0, mainLosses: 0, quickWins: 0, quickLosses: 0,
      winRate: null, volumeSol: '0', earningsSol: '0', streak: null, recentForm: [],
      topRival: null, bestNextOpponent: null, hasStats: false,
    }
  }

  const songs = await buildSongs(stats.quickBattles, stats.allWallets, supabase)

  const timeline = buildTimeline(
    stats.mainEventBattles, stats.quickBattles, stats.allWallets, stats.opponentNameOverrides,
  )

  // Current streak
  let streak: BookerCard['streak'] = null
  if (timeline.length) {
    const kind: 'W' | 'L' = timeline[0].won ? 'W' : 'L'
    let count = 0
    for (const t of timeline) {
      if ((t.won ? 'W' : 'L') !== kind) break
      count++
    }
    streak = { kind, count }
  }
  const recentForm = timeline.slice(0, 5).map(t => (t.won ? 'W' : 'L') as 'W' | 'L')

  // Top rival — most-faced opponent (main events)
  const rivalMap = new Map<string, { meetings: number; wins: number; losses: number }>()
  for (const t of timeline.filter(t => t.type === 'main')) {
    const r = rivalMap.get(t.opponent) ?? { meetings: 0, wins: 0, losses: 0 }
    r.meetings++
    if (t.won) r.wins++; else r.losses++
    rivalMap.set(t.opponent, r)
  }
  const topRivalEntry = [...rivalMap.entries()].sort((a, b) => b[1].meetings - a[1].meetings)[0]
  const topRival = topRivalEntry && topRivalEntry[1].meetings > 1
    ? { name: topRivalEntry[0], meetings: topRivalEntry[1].meetings, record: `${topRivalEntry[1].wins}-${topRivalEntry[1].losses}` }
    : null

  // Rank on the artist leaderboard (match by any linked wallet or display name)
  const lbRow = leaderboard.rows.find(r =>
    stats.allWallets.includes(r.wallet) || r.name === base.displayName)
  const rank = lbRow ? leaderboard.rows.indexOf(lbRow) + 1 : null

  const completed = stats.wins + stats.losses

  return {
    ...base,
    songs,
    rank,
    wins: stats.wins,
    losses: stats.losses,
    mainWins: stats.mainWins,
    mainLosses: stats.mainLosses,
    quickWins: stats.quickWins,
    quickLosses: stats.quickLosses,
    winRate: completed > 0 ? Math.round((stats.wins / completed) * 100) : null,
    volumeSol: formatSol(stats.totalVolumeSol),
    earningsSol: formatSol(stats.totalEarningsSol),
    streak,
    recentForm,
    topRival,
    bestNextOpponent: null,
    hasStats: true,
  }
}
