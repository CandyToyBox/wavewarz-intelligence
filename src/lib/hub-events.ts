import { createAdminClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getWinnerLoserPools, calculateArtistEarnings, formatSol } from '@/lib/wavewarz-math'
import { isMainEventRound, groupMainEventRounds } from '@/lib/battle-metrics'

// Derives Main Events from grouped battle rounds — the main_events table is
// empty, so events don't exist as rows. Grouping is the SAME canonical helper
// the homepage "Main Events" stat uses (isMainEventRound + groupMainEventRounds
// in battle-metrics.ts), so listHubEvents().length === the wavewarz.info count.
// Narrative rows (battle_theses) attach by a stable slug, not a hard FK.

type RawBattle = {
  battle_id: number
  created_at: string
  artist1_name: string
  artist1_wallet: string
  artist2_name: string
  artist2_wallet: string
  artist1_pool: number
  artist2_pool: number
  total_volume_a: number
  total_volume_b: number
  winner_artist_a: number | null
  winner_decided: boolean | null
  event_subtype: string | null
  is_main_battle: boolean | null
  is_quick_battle: boolean | null
  status: string
  youtube_replay_link: string | null
  image_url: string | null
}

export type HubEventSide = {
  artistId: string | null
  name: string
  wallet: string
  pfpUrl: string | null
  twitterHandle: string | null
  roundWins: number
  volumeSol: number
  earningsSol: number
}

export type HubEvent = {
  slug: string
  label: string
  date: string
  eventSubtype: string
  rounds: number
  decidedRounds: number
  battleIds: number[]
  a: HubEventSide
  b: HubEventSide
  winner: 'a' | 'b' | 'draw' | 'pending'
  totalVolumeSol: string
  youtubeReplayLink: string | null
  imageUrl: string | null
  hasThesis: boolean
  thesisNeedsReview: boolean
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'artist'
}

function eventSlug(nameA: string, nameB: string, dateISO: string): string {
  const [x, y] = [slugify(nameA), slugify(nameB)].sort()
  return `${x}-vs-${y}-${dateISO.slice(0, 10).replace(/-/g, '')}`
}

type ResolvedSide = {
  key: string; artistId: string | null; wallet: string; name: string
  pfpUrl: string | null; twitterHandle: string | null
}
type Resolver = (battleId: number, wallet: string, fallbackName: string, fallbackTwitter: string | null) => ResolvedSide

async function loadResolvers(supabase: ReturnType<typeof createAdminClient>): Promise<{ resolve: Resolver }> {
  const [profilesRes, walletsRes, overridesRes] = await Promise.all([
    supabase.from('artist_profiles').select('artist_id,primary_wallet,display_name,profile_picture_url,twitter_handle'),
    supabase.from('artist_wallets').select('artist_id,wallet_address'),
    supabase.from('battle_artist_overrides').select('battle_id,wallet,artist_id'),
  ])

  const profileById = new Map<string, { primaryWallet: string | null; displayName: string | null; pfpUrl: string | null; twitter: string | null }>(
    (profilesRes.data ?? []).map(p => [p.artist_id, {
      primaryWallet: p.primary_wallet, displayName: p.display_name,
      pfpUrl: p.profile_picture_url as string | null, twitter: p.twitter_handle as string | null,
    }]),
  )
  const walletToProfileId = new Map<string, string>()
  for (const p of profilesRes.data ?? []) if (p.primary_wallet) walletToProfileId.set(p.primary_wallet, p.artist_id)
  for (const w of walletsRes.data ?? []) walletToProfileId.set(w.wallet_address, w.artist_id)
  const overrideMap = new Map<string, string>()
  for (const o of overridesRes.data ?? []) overrideMap.set(`${o.battle_id}|${o.wallet}`, o.artist_id)

  function resolve(battleId: number, wallet: string, fallbackName: string, fallbackTwitter: string | null): ResolvedSide {
    const profileId = overrideMap.get(`${battleId}|${wallet}`) ?? walletToProfileId.get(wallet)
    if (profileId) {
      const p = profileById.get(profileId)
      if (p) return {
        key: profileId, artistId: profileId, wallet: p.primaryWallet ?? wallet,
        name: p.displayName ?? fallbackName, pfpUrl: p.pfpUrl,
        twitterHandle: (p.twitter ?? fallbackTwitter)?.replace(/^@/, '') || null,
      }
    }
    return { key: wallet, artistId: null, wallet, name: fallbackName, pfpUrl: null, twitterHandle: fallbackTwitter?.replace(/^@/, '') || null }
  }
  return { resolve }
}

function summarizeGroup(rounds: RawBattle[], resolve: Resolver): Omit<HubEvent, 'hasThesis' | 'thesisNeedsReview'> {
  // Group order is chronological (groupMainEventRounds sorts ascending); the
  // first round anchors which side is "artist A" for the whole event, and its
  // date anchors the slug (same as getMainEvents' startedAt).
  const first = rounds[0]
  const rA = resolve(first.battle_id, first.artist1_wallet, first.artist1_name, null)
  const rB = resolve(first.battle_id, first.artist2_wallet, first.artist2_name, null)

  const a: HubEventSide = { artistId: rA.artistId, name: rA.name, wallet: rA.wallet, pfpUrl: rA.pfpUrl, twitterHandle: rA.twitterHandle, roundWins: 0, volumeSol: 0, earningsSol: 0 }
  const b: HubEventSide = { artistId: rB.artistId, name: rB.name, wallet: rB.wallet, pfpUrl: rB.pfpUrl, twitterHandle: rB.twitterHandle, roundWins: 0, volumeSol: 0, earningsSol: 0 }

  let decidedRounds = 0
  for (const round of rounds) {
    const rr1 = resolve(round.battle_id, round.artist1_wallet, round.artist1_name, null)
    const aIsArtist1 = rr1.key === rA.key
    const p1 = round.artist1_pool ?? 0, p2 = round.artist2_pool ?? 0

    const volA = aIsArtist1 ? (round.total_volume_a ?? 0) : (round.total_volume_b ?? 0)
    const volB = aIsArtist1 ? (round.total_volume_b ?? 0) : (round.total_volume_a ?? 0)
    a.volumeSol += volA
    b.volumeSol += volB

    const decided = round.winner_decided && round.winner_artist_a !== null
    if (!decided) continue
    decidedRounds++
    const aWon = Number(round.winner_artist_a) >= 1
    const { loserPool } = getWinnerLoserPools(p1, p2, aWon)
    const aRoundWon = aIsArtist1 ? aWon : !aWon
    if (aRoundWon) a.roundWins++; else b.roundWins++
    const eA = calculateArtistEarnings(volA, loserPool, aRoundWon)
    const eB = calculateArtistEarnings(volB, loserPool, !aRoundWon)
    a.earningsSol += eA.tradingFees + eA.settlementBonus
    b.earningsSol += eB.tradingFees + eB.settlementBonus
  }

  const date = first.created_at
  const winner: HubEvent['winner'] =
    decidedRounds === 0 ? 'pending'
    : a.roundWins > b.roundWins ? 'a'
    : b.roundWins > a.roundWins ? 'b'
    : 'draw'

  return {
    slug: eventSlug(rA.name, rB.name, date),
    label: `${rA.name} vs ${rB.name}`,
    date,
    eventSubtype: first.event_subtype ?? 'standard',
    rounds: rounds.length,
    decidedRounds,
    battleIds: rounds.map(r => r.battle_id),
    a, b,
    winner,
    totalVolumeSol: formatSol(a.volumeSol + b.volumeSol),
    youtubeReplayLink: rounds.map(r => r.youtube_replay_link).find(Boolean) ?? null,
    imageUrl: rounds.map(r => r.image_url).find(Boolean) ?? null,
  }
}

const MAIN_SELECT =
  'battle_id,created_at,artist1_name,artist1_wallet,artist2_name,artist2_wallet,artist1_pool,artist2_pool,total_volume_a,total_volume_b,winner_artist_a,winner_decided,event_subtype,is_main_battle,is_quick_battle,status,youtube_replay_link,image_url'

async function loadMainRounds(supabase: ReturnType<typeof createAdminClient>): Promise<RawBattle[]> {
  const rows = await fetchAll<RawBattle>((from, to) => supabase
    .from('battles')
    .select(MAIN_SELECT)
    .eq('is_main_battle', true)
    .eq('is_test_battle', false)
    .range(from, to))
  // Same filter the homepage stat uses — charity/spotlight kept, prediction dropped.
  return rows.filter(isMainEventRound)
}

export async function listHubEvents(): Promise<HubEvent[]> {
  const supabase = createAdminClient()
  const [rounds, { resolve }, thesesRes] = await Promise.all([
    loadMainRounds(supabase),
    loadResolvers(supabase),
    supabase.from('battle_theses').select('event_slug,needs_review'),
  ])
  const thesisBySlug = new Map<string, boolean>((thesesRes.data ?? []).map(t => [t.event_slug, t.needs_review]))

  const events = groupMainEventRounds(rounds)
    .map(g => summarizeGroup(g, resolve))
    .map(e => ({
      ...e,
      hasThesis: thesisBySlug.has(e.slug),
      thesisNeedsReview: thesisBySlug.get(e.slug) ?? false,
    }))
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getHubEvent(slug: string): Promise<HubEvent | null> {
  const events = await listHubEvents()
  return events.find(e => e.slug === slug) ?? null
}
