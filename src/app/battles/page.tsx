import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol, calculateArtistEarnings, calculatePlatformRevenue } from '@/lib/wavewarz-math'
import { resolveAudiusTrack } from '@/lib/audius'
import { canonicalSongKey } from '@/lib/song-identity'
import { getBattleAddress, getBattleVaultAddress } from '@/lib/solana/pda'
import { groupIntoEvents, pairKey as sharedPairKey } from '@/lib/event-grouping'
import { getWavIdRoster, findWavIdArtist, type WavIdRoster } from '@/lib/wavid/roster'
import { EventGroupCard, type EventGroupCardData, type RoundData } from './event-group-card'
import { QuickBattleCard, type QuickBattleCardData } from './quick-battle-card'
import { BattlesControls } from './battles-controls'
import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Battles Feed',
  description: 'Live chronological feed of every WaveWarZ battle. Main events grouped by round.',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPOTIFY_RATE = 0.003
const PAGE_SIZE = 20

// V2 winner system launched March 10, 2026 (Poll + Charts + DJ Wavy). V1 was
// charts-only (larger pool wins). Declared here (a Server Component module),
// NOT imported from quick-battle-card.tsx: that file is 'use client', and
// Next.js replaces every export of a client module -- including plain
// constants, not just components -- with an unusable client-reference stub
// when accessed from server code. Comparing against that stub silently
// evaluates to `false` (no exception), which was making every quick battle
// show "V1 - Charts Only" regardless of its real date.
const V2_QB_LAUNCH = new Date('2026-03-10T00:00:00')

type SortKey   = 'newest' | 'oldest' | 'volume'
type FilterKey = 'all' | 'main' | 'quick' | 'community'

// Each side's Wave ID as a small raster (the artist's own colour identity). Quick Battles look up by the
// song's Audius handle then wallet (artist1_name is a song title there, so never by name); events also by name.
function wavidArt(roster: WavIdRoster | null, who: { audiusHandle?: string | null; wallet?: string | null; name?: string | null }): string | null {
  const handle = findWavIdArtist(roster, who)?.identity?.audiusHandle as string | undefined
  return handle ? `/api/wavid-art/${encodeURIComponent(handle)}?format=png&size=128` : null
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RawBattle = {
  battle_id: number
  created_at: string
  artist1_name: string
  artist2_name: string
  artist1_wallet: string
  artist2_wallet: string
  wavewarz_wallet: string | null
  artist1_pool: number
  artist2_pool: number
  total_volume_a: number
  total_volume_b: number
  artist1_music_link: string | null
  artist2_music_link: string | null
  image_url: string | null
  stream_link: string | null
  youtube_replay_link: string | null
  is_quick_battle: boolean
  is_community_battle: boolean
  is_main_battle: boolean
  event_subtype: string | null
  status: string
  poll_winner: string | null
  poll_votes_a: number | null
  poll_votes_b: number | null
  dj_wavy_winner: string | null
  winner_artist_a: number | null
  winner_decided: boolean
}

type FeedItem =
  | { kind: 'group';  data: EventGroupCardData; latestAt: number; totalVol: number }
  | { kind: 'quick';  data: QuickBattleCardData; latestAt: number; totalVol: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAudiusHandle(url: string | null): string | null {
  if (!url) return null
  try { return new URL(url).pathname.split('/').filter(Boolean)[0] ?? null }
  catch { return null }
}

function formatStreams(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M streams`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K streams`
  return `${Math.round(n)} streams`
}

function fmtDate(iso: string, includeYear = false): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}),
  })
}

function marginPct(a: number, b: number): string {
  const total = a + b
  if (total <= 0) return '0'
  return Math.round((Math.abs(a - b) / total) * 100).toString()
}

// Parses a poll/DJ Wavy winner field into true (artist1/song1), false
// (artist2/song2), or null (no data / explicit tie) -- handles both the
// 'A'/'B' and 'artist_a'/'artist_b' formats the webhook has sent over time.
function parseQuickFactor(raw: string | null, artist1Name: string): boolean | null {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  if (upper === 'TIE') return null
  if (upper === 'A' || upper === 'ARTIST_A') return true
  if (upper === 'B' || upper === 'ARTIST_B') return false
  if (raw.trim().toLowerCase() === artist1Name.trim().toLowerCase()) return true
  return null
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getBattles(): Promise<RawBattle[]> {
  const supabase = await createClient()
  // fetchAll paginates past the 1000-row cap so the full battle history shows.
  const data = await fetchAll((from, to) => supabase
    .from('battles')
    .select([
      'battle_id','created_at',
      'artist1_name','artist2_name','artist1_wallet','artist2_wallet','wavewarz_wallet',
      'artist1_pool','artist2_pool','total_volume_a','total_volume_b',
      'artist1_music_link','artist2_music_link',
      'image_url','stream_link','youtube_replay_link',
      'is_quick_battle','is_community_battle','is_main_battle',
      'event_subtype','status',
      'poll_winner','poll_votes_a','poll_votes_b','dj_wavy_winner',
      'winner_artist_a','winner_decided',
    ].join(','))
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })
    .range(from, to))

  // Names are trimmed here: a leading space made first-word labels come out blank ("R2" with no winner).
  return (data as unknown as RawBattle[]).map(b => ({ ...b, artist1_name: (b.artist1_name ?? '').trim(), artist2_name: (b.artist2_name ?? '').trim() }))
}

async function getArtistPfpMap(): Promise<Map<string, string | null>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('artist_profiles')
    .select('primary_wallet,profile_picture_url')
  const map = new Map<string, string | null>()
  for (const p of data ?? []) {
    if (p.primary_wallet) map.set(p.primary_wallet, p.profile_picture_url ?? null)
  }
  return map
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

type Group = {
  key: string
  battles: RawBattle[]
  latestAt: number
}

function buildGroups(nonQuick: RawBattle[]): Group[] {
  const eventBattles = groupIntoEvents(
    nonQuick,
    b => sharedPairKey(b.artist1_wallet, b.artist1_name, b.artist2_wallet, b.artist2_name),
    b => new Date(b.created_at).getTime(),
  )
  return eventBattles.map(battles => ({
    key: sharedPairKey(battles[0].artist1_wallet, battles[0].artist1_name, battles[0].artist2_wallet, battles[0].artist2_name),
    battles,
    latestAt: Math.max(...battles.map(b => new Date(b.created_at).getTime())),
  }))
}

// ─── Feed construction ────────────────────────────────────────────────────────

function buildGroupItem(group: Group, solPrice: number, pfpMap: Map<string, string | null>, roster: WavIdRoster | null): FeedItem {
  const battles = group.battles // sorted oldest→newest
  const first = battles[0]

  let eventType: EventGroupCardData['eventType'] = 'main'
  if (first.event_subtype === 'charity')        eventType = 'charity'
  else if (first.event_subtype === 'spotlight') eventType = 'spotlight'
  else if (first.is_community_battle)           eventType = 'community'

  const imageUrl = battles.find(b => b.image_url)?.image_url ?? null

  const totalVolRaw = battles.reduce(
    (s, b) => s + (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0), 0
  )
  const totalUsd = totalVolRaw * solPrice
  const streams = totalUsd / SPOTIFY_RATE

  // Main/Community/Charity rounds are decided by the admin judging panel
  // (Human Judge + X Poll + SOL Vote, 2-of-3 -> winner_artist_a), not by
  // which side's trading pool is bigger. Only fall back to pool size for a
  // round that hasn't been judged yet (e.g. still live).
  function roundWinnerIsA(b: RawBattle): boolean {
    if (b.winner_decided && b.winner_artist_a !== null) return Number(b.winner_artist_a) >= 1
    const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
    return p1 >= p2
  }

  let a1Wins = 0, a2Wins = 0
  for (const b of battles) {
    if (roundWinnerIsA(b)) a1Wins++; else a2Wins++
  }
  const overallWinner =
    a1Wins > a2Wins ? first.artist1_name :
    a2Wins > a1Wins ? first.artist2_name :
    null

  const rounds: RoundData[] = battles.map((b, i) => {
    const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
    const v1 = b.total_volume_a ?? 0, v2 = b.total_volume_b ?? 0
    const totalVol = v1 + v2
    const winnerIsA = roundWinnerIsA(b)
    const loserPool = winnerIsA ? p2 : p1

    const a1Earn = calculateArtistEarnings(v1, loserPool, winnerIsA)
    const a2Earn = calculateArtistEarnings(v2, loserPool, !winnerIsA)
    const platEarn = calculatePlatformRevenue(totalVol, loserPool)

    return {
      battle_id: b.battle_id,
      roundNumber: i + 1,
      dateFormatted: fmtDate(b.created_at),
      artist1Name: b.artist1_name,
      artist2Name: b.artist2_name,
      // Pool values
      a1PoolSol: formatSol(p1),
      a2PoolSol: formatSol(p2),
      a1PoolUsd: solToUsd(p1, solPrice),
      a2PoolUsd: solToUsd(p2, solPrice),
      // Volumes
      a1VolSol: formatSol(v1),
      a2VolSol: formatSol(v2),
      a1VolUsd: solToUsd(v1, solPrice),
      a2VolUsd: solToUsd(v2, solPrice),
      totalVolSol: formatSol(totalVol),
      totalVolUsd: solToUsd(totalVol, solPrice),
      streamEquivalent: formatStreams((totalVol * solPrice) / SPOTIFY_RATE),
      // Winner
      winner: winnerIsA ? b.artist1_name : b.artist2_name,
      loser:  winnerIsA ? b.artist2_name : b.artist1_name,
      winnerIsA,
      marginSol: formatSol(Math.abs(p1 - p2)),
      marginPct: marginPct(p1, p2),
      // Bar widths are each side's share of the final pools, matching the pool numbers printed beside them
      pct1: p1 + p2 > 0 ? Math.round((p1 / (p1 + p2)) * 100) : 50,
      pct2: p1 + p2 > 0 ? Math.round((p2 / (p1 + p2)) * 100) : 50,
      rawA1Earn: a1Earn.totalSol, rawA2Earn: a2Earn.totalSol, rawPlatEarn: platEarn.totalSol,
      // Earnings
      a1EarnSol: formatSol(a1Earn.totalSol),
      a1EarnUsd: solToUsd(a1Earn.totalSol, solPrice),
      a1EarnStreams: formatStreams((a1Earn.totalSol * solPrice) / SPOTIFY_RATE),
      a1TradeFeesSol: formatSol(a1Earn.tradingFees),
      a1TradeFeesUsd: solToUsd(a1Earn.tradingFees, solPrice),
      a1SettleSol: formatSol(a1Earn.settlementBonus),
      a1SettleUsd: solToUsd(a1Earn.settlementBonus, solPrice),
      a1SettleLabel: winnerIsA ? 'Winner bonus (5% of loser pool)' : 'Consolation (2% of loser pool)',
      a2EarnSol: formatSol(a2Earn.totalSol),
      a2EarnUsd: solToUsd(a2Earn.totalSol, solPrice),
      a2EarnStreams: formatStreams((a2Earn.totalSol * solPrice) / SPOTIFY_RATE),
      a2TradeFeesSol: formatSol(a2Earn.tradingFees),
      a2TradeFeesUsd: solToUsd(a2Earn.tradingFees, solPrice),
      a2SettleSol: formatSol(a2Earn.settlementBonus),
      a2SettleUsd: solToUsd(a2Earn.settlementBonus, solPrice),
      a2SettleLabel: !winnerIsA ? 'Winner bonus (5% of loser pool)' : 'Consolation (2% of loser pool)',
      platformEarnSol: formatSol(platEarn.totalSol),
      platformEarnUsd: solToUsd(platEarn.totalSol, solPrice),
      platformTradeFeesSol: formatSol(platEarn.tradingFees),
      platformTradeFeesUsd: solToUsd(platEarn.tradingFees, solPrice),
      platformSettleSol: formatSol(platEarn.settlementBonus),
      platformSettleUsd: solToUsd(platEarn.settlementBonus, solPrice),
      // Links
      youtubeLink: b.youtube_replay_link,
      streamLink: b.stream_link,
      // Wallets
      a1Wallet: b.artist1_wallet || null,
      a2Wallet: b.artist2_wallet || null,
      wavewarzWallet: b.wavewarz_wallet,
      // Onchain verification — the vault PDA holding this round's real SOL.
      // Its Solscan history shows buys, sells, AND claim withdrawals -- the
      // full picture, not just trading volume.
      vaultAddress: getBattleVaultAddress(b.battle_id).toBase58(),
      // Battle account PDA -- the game-state account (pools, supply, winner,
      // settlement flag), distinct from the vault which holds the money.
      battleAddress: getBattleAddress(b.battle_id).toBase58(),
    }
  })

  // Event totals: each artist's and the platform's earnings summed across every round
  const sum = (k: 'rawA1Earn' | 'rawA2Earn' | 'rawPlatEarn') => rounds.reduce((s, r) => s + r[k], 0)
  const a1Total = sum('rawA1Earn'), a2Total = sum('rawA2Earn'), platTotal = sum('rawPlatEarn')

  const data: EventGroupCardData = {
    groupKey: String(first.battle_id),
    artist1Wavid: wavidArt(roster, { wallet: first.artist1_wallet, name: first.artist1_name }),
    artist2Wavid: wavidArt(roster, { wallet: first.artist2_wallet, name: first.artist2_name }),
    a1Wins, a2Wins,
    overallWinnerIsA: a1Wins === a2Wins ? null : a1Wins > a2Wins,
    a1EarnSol: formatSol(a1Total), a1EarnUsd: solToUsd(a1Total, solPrice),
    a2EarnSol: formatSol(a2Total), a2EarnUsd: solToUsd(a2Total, solPrice),
    platformEarnSol: formatSol(platTotal), platformEarnUsd: solToUsd(platTotal, solPrice),
    eventType,
    artist1Name: first.artist1_name,
    artist2Name: first.artist2_name,
    artist1PfpUrl: pfpMap.get(first.artist1_wallet ?? '') ?? null,
    artist2PfpUrl: pfpMap.get(first.artist2_wallet ?? '') ?? null,
    imageUrl,
    latestDateFormatted: fmtDate(battles[battles.length - 1].created_at, true),
    totalRounds: battles.length,
    totalVolSol: formatSol(totalVolRaw),
    totalVolUsd: solToUsd(totalVolRaw, solPrice),
    streamEquivalent: formatStreams(streams),
    overallWinner,
    rounds,
  }

  return { kind: 'group', data, latestAt: group.latestAt, totalVol: totalVolRaw }
}

function buildQuickItem(b: RawBattle, solPrice: number, song1ArtUrl: string | null, song2ArtUrl: string | null, pfpMap: Map<string, string | null>, roster: WavIdRoster | null): FeedItem {
  const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
  const v1 = b.total_volume_a ?? 0, v2 = b.total_volume_b ?? 0
  const totalVol = v1 + v2
  // "Charts" is legitimately pool-based (one of the 3 judging factors below).
  // The overall winner is the decided 2-of-3 result (Poll + Charts + DJ Wavy
  // -> winner_artist_a), which can differ from Charts alone -- same
  // winner_decided/winner_artist_a fields Main Events use, synced from the
  // quick_battles_* factor columns by the webhook. Pool comparison is only a
  // fallback for battles that haven't been judged yet.
  const chartsWinnerIsA = p1 >= p2
  const winnerIsA = b.winner_decided && b.winner_artist_a !== null
    ? Number(b.winner_artist_a) >= 1
    : chartsWinnerIsA
  const loserPool = winnerIsA ? p2 : p1
  const totalUsd = totalVol * solPrice
  const streams = totalUsd / SPOTIFY_RATE

  const s1Earn = calculateArtistEarnings(v1, loserPool, winnerIsA)
  const s2Earn = calculateArtistEarnings(v2, loserPool, !winnerIsA)
  const platEarn = calculatePlatformRevenue(totalVol, loserPool)

  const pollWinnerIsA = parseQuickFactor(b.poll_winner, b.artist1_name)
  const djWavyWinnerIsA = parseQuickFactor(b.dj_wavy_winner, b.artist1_name)

  // Score of the decided result: how many of the three factors went each way (V2). Missing factors don't count.
  const factors = [chartsWinnerIsA, pollWinnerIsA, djWavyWinnerIsA].filter((x): x is boolean => x !== null)
  const handle1 = parseAudiusHandle(b.artist1_music_link), handle2 = parseAudiusHandle(b.artist2_music_link)

  const data: QuickBattleCardData = {
    battle_id: b.battle_id,
    chartsA: chartsWinnerIsA,
    pollA: pollWinnerIsA,
    djA: djWavyWinnerIsA,
    scoreFor: factors.filter(x => x === winnerIsA).length,
    scoreAgainst: factors.filter(x => x !== winnerIsA).length,
    song1PfpUrl: pfpMap.get(b.artist1_wallet ?? '') ?? null,
    song2PfpUrl: pfpMap.get(b.artist2_wallet ?? '') ?? null,
    song1Wavid: wavidArt(roster, { audiusHandle: handle1, wallet: b.artist1_wallet }),
    song2Wavid: wavidArt(roster, { audiusHandle: handle2, wallet: b.artist2_wallet }),
    dateFormatted: fmtDate(b.created_at, true),
    // Factor breakdown (V2 only -- null when the data doesn't exist)
    pollWinnerTitle: pollWinnerIsA === null ? null : pollWinnerIsA ? b.artist1_name : b.artist2_name,
    pollIsTie: b.poll_winner !== null && pollWinnerIsA === null,
    pollVotesA: b.poll_votes_a,
    pollVotesB: b.poll_votes_b,
    chartsWinnerTitle: chartsWinnerIsA ? b.artist1_name : b.artist2_name,
    djWavyWinnerTitle: djWavyWinnerIsA === null ? null : djWavyWinnerIsA ? b.artist1_name : b.artist2_name,
    // Songs
    song1Title: b.artist1_name,
    song2Title: b.artist2_name,
    song1Link: b.artist1_music_link,
    song2Link: b.artist2_music_link,
    song1Handle: handle1,
    song2Handle: handle2,
    song1ArtUrl,
    song2ArtUrl,
    // Pools
    song1PoolSol: formatSol(p1),
    song1PoolUsd: solToUsd(p1, solPrice),
    song2PoolSol: formatSol(p2),
    song2PoolUsd: solToUsd(p2, solPrice),
    // Volumes
    song1VolSol: formatSol(v1),
    song1VolUsd: solToUsd(v1, solPrice),
    song2VolSol: formatSol(v2),
    song2VolUsd: solToUsd(v2, solPrice),
    // Totals
    totalVolSol: formatSol(totalVol),
    totalVolUsd: solToUsd(totalVol, solPrice),
    streamEquivalent: formatStreams(streams),
    // Winner
    winnerTitle: winnerIsA ? b.artist1_name : b.artist2_name,
    loserTitle:  winnerIsA ? b.artist2_name : b.artist1_name,
    winnerIsA,
    isV2: new Date(b.created_at) >= V2_QB_LAUNCH,
    marginSol: formatSol(Math.abs(p1 - p2)),
    marginPct: marginPct(p1, p2),
    // Song 1 earnings
    song1EarnSol: formatSol(s1Earn.totalSol),
    song1EarnUsd: solToUsd(s1Earn.totalSol, solPrice),
    song1EarnStreams: formatStreams((s1Earn.totalSol * solPrice) / SPOTIFY_RATE),
    song1TradeFeesSol: formatSol(s1Earn.tradingFees),
    song1TradeFeesUsd: solToUsd(s1Earn.tradingFees, solPrice),
    song1SettleSol: formatSol(s1Earn.settlementBonus),
    song1SettleUsd: solToUsd(s1Earn.settlementBonus, solPrice),
    song1SettleLabel: winnerIsA ? 'Winner bonus (5% of loser pool)' : 'Consolation (2% of loser pool)',
    // Song 2 earnings
    song2EarnSol: formatSol(s2Earn.totalSol),
    song2EarnUsd: solToUsd(s2Earn.totalSol, solPrice),
    song2EarnStreams: formatStreams((s2Earn.totalSol * solPrice) / SPOTIFY_RATE),
    song2TradeFeesSol: formatSol(s2Earn.tradingFees),
    song2TradeFeesUsd: solToUsd(s2Earn.tradingFees, solPrice),
    song2SettleSol: formatSol(s2Earn.settlementBonus),
    song2SettleUsd: solToUsd(s2Earn.settlementBonus, solPrice),
    song2SettleLabel: !winnerIsA ? 'Winner bonus (5% of loser pool)' : 'Consolation (2% of loser pool)',
    // Platform
    platformEarnSol: formatSol(platEarn.totalSol),
    platformEarnUsd: solToUsd(platEarn.totalSol, solPrice),
    platformTradeFeesSol: formatSol(platEarn.tradingFees),
    platformTradeFeesUsd: solToUsd(platEarn.tradingFees, solPrice),
    platformSettleSol: formatSol(platEarn.settlementBonus),
    platformSettleUsd: solToUsd(platEarn.settlementBonus, solPrice),
    // Wallets
    song1Wallet: b.artist1_wallet || null,
    song2Wallet: b.artist2_wallet || null,
    wavewarzWallet: b.wavewarz_wallet,
    // Onchain verification -- see note on RoundData.vaultAddress above.
    vaultAddress: getBattleVaultAddress(b.battle_id).toBase58(),
    battleAddress: getBattleAddress(b.battle_id).toBase58(),
  }

  return { kind: 'quick', data, latestAt: new Date(b.created_at).getTime(), totalVol }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BattlesFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; filter?: string }>
}) {
  const sp = await searchParams
  const page   = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const sort   = (['newest','oldest','volume'].includes(sp.sort ?? '') ? sp.sort : 'newest') as SortKey
  const filter = (['all','main','quick','community'].includes(sp.filter ?? '') ? sp.filter : 'all') as FilterKey

  const [battles, solPrice, pfpMap, roster] = await Promise.all([getBattles(), getLiveSolPrice(), getArtistPfpMap(), getWavIdRoster().catch(() => null)])

  const quickBattles = battles.filter(b => b.is_quick_battle)
  const nonQuick    = battles.filter(b => !b.is_quick_battle)

  const groups = buildGroups(nonQuick)

  // Build full item list (no Audius art yet)
  const allGroupItems = groups.map(g => buildGroupItem(g, solPrice, pfpMap, roster))
  const allQuickItems: Array<{ battle: RawBattle; latestAt: number; totalVol: number }> = quickBattles.map(b => ({
    battle: b,
    latestAt: new Date(b.created_at).getTime(),
    totalVol: (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0),
  }))

  // Merge all items
  type Stub = { kind: 'group'; item: FeedItem } | { kind: 'quick'; battle: RawBattle; latestAt: number; totalVol: number }
  let stubs: Stub[] = [
    ...allGroupItems.map(item => ({ kind: 'group' as const, item })),
    ...allQuickItems.map(s => ({ kind: 'quick' as const, battle: s.battle, latestAt: s.latestAt, totalVol: s.totalVol })),
  ]

  // Apply filter
  if (filter === 'main') {
    stubs = stubs.filter(s => {
      if (s.kind !== 'group') return false
      const t = (s.item.data as EventGroupCardData).eventType
      return t === 'main' || t === 'charity' || t === 'spotlight'
    })
  } else if (filter === 'quick') {
    stubs = stubs.filter(s => s.kind === 'quick')
  } else if (filter === 'community') {
    stubs = stubs.filter(s => {
      if (s.kind !== 'group') return false
      return (s.item.data as EventGroupCardData).eventType === 'community'
    })
  }

  // Apply sort
  stubs.sort((a, b) => {
    const aT = a.kind === 'group' ? a.item.latestAt : a.latestAt
    const bT = b.kind === 'group' ? b.item.latestAt : b.latestAt
    const aV = a.kind === 'group' ? a.item.totalVol : a.totalVol
    const bV = b.kind === 'group' ? b.item.totalVol : b.totalVol
    if (sort === 'oldest')  return aT - bT
    if (sort === 'volume')  return bV - aV
    return bT - aT  // newest (default)
  })

  const totalItems = stubs.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStubs = stubs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Only resolve art for quick battles on this page. Prefer the cached
  // song_registry table (same source the Song Charts leaderboard uses) over
  // live Audius API calls -- Audius discovery nodes are flaky/rate-limited,
  // so a live resolveAudiusTrack() per card was the reason album art was
  // "not loading much" on this page. Only fall back to a live lookup for
  // songs that haven't been backfilled into the registry yet.
  const pageQuickStubs = pageStubs.filter(s => s.kind === 'quick') as Array<{ kind: 'quick'; battle: RawBattle; latestAt: number }>
  const artworkMap = new Map<number, { song1ArtUrl: string | null; song2ArtUrl: string | null }>()

  const registryKeys = Array.from(new Set(pageQuickStubs.flatMap(s => [
    s.battle.artist1_music_link ? canonicalSongKey(s.battle.artist1_music_link, s.battle.artist1_name) : null,
    s.battle.artist2_music_link ? canonicalSongKey(s.battle.artist2_music_link, s.battle.artist2_name) : null,
  ]).filter((k): k is string => !!k)))

  const registryArtByKey = new Map<string, string | null>()
  if (registryKeys.length) {
    const supabase = await createClient()
    const { data: registry } = await supabase
      .from('song_registry')
      .select('permalink_key, artwork_url')
      .in('permalink_key', registryKeys)
    for (const r of registry ?? []) registryArtByKey.set(r.permalink_key, r.artwork_url ?? null)
  }

  await Promise.all(
    pageQuickStubs.map(async s => {
      const key1 = s.battle.artist1_music_link ? canonicalSongKey(s.battle.artist1_music_link, s.battle.artist1_name) : null
      const key2 = s.battle.artist2_music_link ? canonicalSongKey(s.battle.artist2_music_link, s.battle.artist2_name) : null

      let art1 = key1 ? registryArtByKey.get(key1) ?? null : null
      let art2 = key2 ? registryArtByKey.get(key2) ?? null : null

      // Fall back to a live lookup only when the registry has no entry at all
      // (key1/key2 not found as a key in the map -- distinct from a known
      // registry row whose artwork_url is legitimately null).
      const needsLive1 = key1 !== null && !registryArtByKey.has(key1)
      const needsLive2 = key2 !== null && !registryArtByKey.has(key2)
      if (needsLive1 || needsLive2) {
        const [t1, t2] = await Promise.all([
          needsLive1 ? resolveAudiusTrack(s.battle.artist1_music_link ?? '') : Promise.resolve(null),
          needsLive2 ? resolveAudiusTrack(s.battle.artist2_music_link ?? '') : Promise.resolve(null),
        ])
        if (needsLive1) art1 = t1?.artwork?.['480x480'] ?? null
        if (needsLive2) art2 = t2?.artwork?.['480x480'] ?? null
      }

      artworkMap.set(s.battle.battle_id, { song1ArtUrl: art1, song2ArtUrl: art2 })
    })
  )

  const pageFeed: FeedItem[] = pageStubs.map(s => {
    if (s.kind === 'group') return s.item
    const art = artworkMap.get(s.battle.battle_id) ?? { song1ArtUrl: null, song2ArtUrl: null }
    return buildQuickItem(s.battle, solPrice, art.song1ArtUrl, art.song2ArtUrl, pfpMap, roster)
  })

  const quickCount  = quickBattles.length
  const eventCount  = groups.length
  const multiRound  = groups.filter(g => g.battles.length > 1).length

  return (
    <div className="space-y-5">

      {/* ── HEADER: same board header as the leaderboards (.ww-bh in site-shell.css) ── */}
      <header className="ww-bh">
        <div className="ww-bh-main">
          <p className="ww-bh-k"><i aria-hidden="true" />WaveWarZ Statz</p>
          <h1>Battles <span>Feed</span></h1>
          <p className="ww-bh-d">Every battle, all time, with each result, the earnings and the onchain receipts. Main events are grouped by round.</p>
        </div>
        <dl className="bt-counts">
          <div><dt>Events</dt><dd>{eventCount}</dd></div>
          <div><dt>Quick Battles</dt><dd>{quickCount}</dd></div>
          {multiRound > 0 && <div><dt>Multi-round</dt><dd>{multiRound}</dd></div>}
        </dl>
      </header>

      <div className="bt-toolbar">
        <Suspense>
          <BattlesControls sort={sort} filter={filter} />
        </Suspense>
        <p className="bt-shown">{totalItems} shown · test battles excluded</p>
      </div>

      <p className="bt-howto">
        How earnings work: artists earn 1% of every trade on their side, plus 5% of the losing pool for the winner or a 2%
        consolation for the other side. The platform takes 0.5% of trades and 3% of the losing pool. Spotify equivalent is
        what the same dollars would earn at $0.003 per stream. <a href="/benefits">More on artist earnings</a>
      </p>

      {/* ── FEED ── */}
      <div className="space-y-4">
        {pageFeed.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-xl font-display font-bold text-white mb-2">No battles here yet</p>
            <p className="text-muted-foreground text-sm">Nothing matches this filter. Pick All Battles to see the full record.</p>
          </div>
        )}

        {pageFeed.map(item =>
          item.kind === 'group' ? (
            <EventGroupCard key={item.data.groupKey} data={item.data} />
          ) : (
            <QuickBattleCard key={item.data.battle_id} data={item.data} />
          )
        )}
      </div>

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <a
            href={safePage > 1 ? `/battles?page=${safePage - 1}&sort=${sort}&filter=${filter}` : undefined}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              safePage <= 1
                ? 'border-border text-muted-foreground opacity-50 pointer-events-none'
                : 'border-border text-muted-foreground hover:text-white hover:border-white/20'
            }`}
          >
            ← Prev
          </a>

          <div className="flex items-center gap-1 flex-wrap justify-center">
            <span className="text-xs text-muted-foreground mr-1">
              Page {safePage} of {totalPages}
            </span>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .reduce<(number | 'gap')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('gap')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === 'gap' ? (
                  <span key={`gap-${i}`} className="text-muted-foreground px-1">…</span>
                ) : (
                  <a
                    key={p}
                    href={`/battles?page=${p}&sort=${sort}&filter=${filter}`}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-mono border transition-colors ${
                      p === safePage
                        ? 'bg-[#95fe7c]/10 text-[#95fe7c] border-[#95fe7c]/30'
                        : 'border-border text-muted-foreground hover:text-white hover:border-white/20'
                    }`}
                  >
                    {p}
                  </a>
                )
              )}
          </div>

          <a
            href={safePage < totalPages ? `/battles?page=${safePage + 1}&sort=${sort}&filter=${filter}` : undefined}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              safePage >= totalPages
                ? 'border-border text-muted-foreground opacity-50 pointer-events-none'
                : 'border-border text-muted-foreground hover:text-white hover:border-white/20'
            }`}
          >
            Next →
          </a>
        </div>
      )}

    </div>
  )
}
