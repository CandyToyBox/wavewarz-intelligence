import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol, calculateArtistEarnings, calculatePlatformRevenue } from '@/lib/wavewarz-math'
import { resolveAudiusTrack } from '@/lib/audius'
import { Badge } from '@/components/ui/badge'
import { EventGroupCard, type EventGroupCardData, type RoundData } from './event-group-card'
import { QuickBattleCard, type QuickBattleCardData, V2_QB_LAUNCH } from './quick-battle-card'
import { BattlesControls } from './battles-controls'
import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Battles Feed — WaveWarZ Intelligence',
  description: 'Live chronological feed of every WaveWarZ battle. Main events grouped by round.',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPOTIFY_RATE = 0.003
const GROUP_WINDOW_MS = 6 * 60 * 60 * 1000  // 6 hours
const PAGE_SIZE = 20

type SortKey   = 'newest' | 'oldest' | 'volume'
type FilterKey = 'all' | 'main' | 'quick' | 'community'

const PALETTE = ['#95fe7c', '#7ec1fb', '#f59e0b', '#f472b6', '#a78bfa', '#34d399']
function colorFor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
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

function pairKey(b: RawBattle): string {
  return [b.artist1_wallet || b.artist1_name, b.artist2_wallet || b.artist2_name]
    .sort().join('|')
}

function marginPct(a: number, b: number): string {
  const total = a + b
  if (total <= 0) return '0'
  return Math.round((Math.abs(a - b) / total) * 100).toString()
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getBattles(): Promise<RawBattle[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('battles')
    .select([
      'battle_id','created_at',
      'artist1_name','artist2_name','artist1_wallet','artist2_wallet','wavewarz_wallet',
      'artist1_pool','artist2_pool','total_volume_a','total_volume_b',
      'artist1_music_link','artist2_music_link',
      'image_url','stream_link','youtube_replay_link',
      'is_quick_battle','is_community_battle','is_main_battle',
      'event_subtype','status',
    ].join(','))
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })

  return (data ?? []) as unknown as RawBattle[]
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
  const sorted = [...nonQuick].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const groups: Group[] = []

  for (const b of sorted) {
    const key = pairKey(b)
    const bTime = new Date(b.created_at).getTime()

    let matched: Group | null = null
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i]
      if (g.key !== key) continue
      const lastTime = new Date(g.battles[g.battles.length - 1].created_at).getTime()
      if (bTime - lastTime <= GROUP_WINDOW_MS) { matched = g; break }
    }

    if (matched) {
      matched.battles.push(b)
      matched.latestAt = Math.max(matched.latestAt, bTime)
    } else {
      groups.push({ key, battles: [b], latestAt: bTime })
    }
  }

  return groups
}

// ─── Feed construction ────────────────────────────────────────────────────────

function buildGroupItem(group: Group, solPrice: number, pfpMap: Map<string, string | null>): FeedItem {
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

  let a1Wins = 0, a2Wins = 0
  for (const b of battles) {
    const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
    if (p1 >= p2) a1Wins++; else a2Wins++
  }
  const overallWinner =
    a1Wins > a2Wins ? first.artist1_name :
    a2Wins > a1Wins ? first.artist2_name :
    null

  const rounds: RoundData[] = battles.map((b, i) => {
    const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
    const v1 = b.total_volume_a ?? 0, v2 = b.total_volume_b ?? 0
    const totalVol = v1 + v2
    const winnerIsA = p1 >= p2
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
      totalVolSol: formatSol(totalVol),
      totalVolUsd: solToUsd(totalVol, solPrice),
      // Winner
      winner: winnerIsA ? b.artist1_name : b.artist2_name,
      loser:  winnerIsA ? b.artist2_name : b.artist1_name,
      winnerIsA,
      marginSol: formatSol(Math.abs(p1 - p2)),
      marginPct: marginPct(p1, p2),
      pct1: totalVol > 0 ? Math.round((v1 / totalVol) * 100) : 50,
      pct2: totalVol > 0 ? Math.round((v2 / totalVol) * 100) : 50,
      // Earnings
      a1EarnSol: formatSol(a1Earn.totalSol),
      a1EarnUsd: solToUsd(a1Earn.totalSol, solPrice),
      a1TradeFeesSol: formatSol(a1Earn.tradingFees),
      a1TradeFeesUsd: solToUsd(a1Earn.tradingFees, solPrice),
      a1SettleSol: formatSol(a1Earn.settlementBonus),
      a1SettleUsd: solToUsd(a1Earn.settlementBonus, solPrice),
      a1SettleLabel: winnerIsA ? 'Winner bonus (5% of loser pool)' : 'Consolation (2% of loser pool)',
      a2EarnSol: formatSol(a2Earn.totalSol),
      a2EarnUsd: solToUsd(a2Earn.totalSol, solPrice),
      a2TradeFeesSol: formatSol(a2Earn.tradingFees),
      a2TradeFeesUsd: solToUsd(a2Earn.tradingFees, solPrice),
      a2SettleSol: formatSol(a2Earn.settlementBonus),
      a2SettleUsd: solToUsd(a2Earn.settlementBonus, solPrice),
      a2SettleLabel: !winnerIsA ? 'Winner bonus (5% of loser pool)' : 'Consolation (2% of loser pool)',
      platformEarnSol: formatSol(platEarn.totalSol),
      platformEarnUsd: solToUsd(platEarn.totalSol, solPrice),
      // Links
      youtubeLink: b.youtube_replay_link,
      streamLink: b.stream_link,
      // Wallets
      a1Wallet: b.artist1_wallet || null,
      a2Wallet: b.artist2_wallet || null,
      wavewarzWallet: b.wavewarz_wallet,
    }
  })

  const data: EventGroupCardData = {
    groupKey: String(first.battle_id),
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

function buildQuickItem(b: RawBattle, solPrice: number, song1ArtUrl: string | null, song2ArtUrl: string | null): FeedItem {
  const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
  const v1 = b.total_volume_a ?? 0, v2 = b.total_volume_b ?? 0
  const totalVol = v1 + v2
  const winnerIsA = p1 >= p2
  const loserPool = winnerIsA ? p2 : p1
  const totalUsd = totalVol * solPrice
  const streams = totalUsd / SPOTIFY_RATE

  const s1Earn = calculateArtistEarnings(v1, loserPool, winnerIsA)
  const s2Earn = calculateArtistEarnings(v2, loserPool, !winnerIsA)
  const platEarn = calculatePlatformRevenue(totalVol, loserPool)

  const data: QuickBattleCardData = {
    battle_id: b.battle_id,
    dateFormatted: fmtDate(b.created_at, true),
    // Songs
    song1Title: b.artist1_name,
    song2Title: b.artist2_name,
    song1Link: b.artist1_music_link,
    song2Link: b.artist2_music_link,
    song1Handle: parseAudiusHandle(b.artist1_music_link),
    song2Handle: parseAudiusHandle(b.artist2_music_link),
    song1ArtUrl,
    song2ArtUrl,
    song1Color: colorFor(b.artist1_name),
    song2Color: colorFor(b.artist2_name),
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
    song1TradeFeesSol: formatSol(s1Earn.tradingFees),
    song1TradeFeesUsd: solToUsd(s1Earn.tradingFees, solPrice),
    song1SettleSol: formatSol(s1Earn.settlementBonus),
    song1SettleUsd: solToUsd(s1Earn.settlementBonus, solPrice),
    song1SettleLabel: winnerIsA ? 'Winner bonus (5% of loser pool)' : 'Consolation (2% of loser pool)',
    // Song 2 earnings
    song2EarnSol: formatSol(s2Earn.totalSol),
    song2EarnUsd: solToUsd(s2Earn.totalSol, solPrice),
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

  const [battles, solPrice, pfpMap] = await Promise.all([getBattles(), getLiveSolPrice(), getArtistPfpMap()])

  const quickBattles = battles.filter(b => b.is_quick_battle)
  const nonQuick    = battles.filter(b => !b.is_quick_battle)

  const groups = buildGroups(nonQuick)

  // Build full item list (no Audius art yet)
  const allGroupItems = groups.map(g => buildGroupItem(g, solPrice, pfpMap))
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

  // Only resolve Audius art for quick battles on this page
  const pageQuickStubs = pageStubs.filter(s => s.kind === 'quick') as Array<{ kind: 'quick'; battle: RawBattle; latestAt: number }>
  const artworkMap = new Map<number, { song1ArtUrl: string | null; song2ArtUrl: string | null }>()
  await Promise.all(
    pageQuickStubs.map(async s => {
      const [t1, t2] = await Promise.all([
        resolveAudiusTrack(s.battle.artist1_music_link ?? ''),
        resolveAudiusTrack(s.battle.artist2_music_link ?? ''),
      ])
      artworkMap.set(s.battle.battle_id, {
        song1ArtUrl: t1?.artwork?.['480x480'] ?? null,
        song2ArtUrl: t2?.artwork?.['480x480'] ?? null,
      })
    })
  )

  const pageFeed: FeedItem[] = pageStubs.map(s => {
    if (s.kind === 'group') return s.item
    const art = artworkMap.get(s.battle.battle_id) ?? { song1ArtUrl: null, song2ArtUrl: null }
    return buildQuickItem(s.battle, solPrice, art.song1ArtUrl, art.song2ArtUrl)
  })

  const quickCount  = quickBattles.length
  const eventCount  = groups.length
  const multiRound  = groups.filter(g => g.battles.length > 1).length

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <header>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl sm:text-4xl font-rajdhani font-bold text-white tracking-tight">
            Battles <span className="text-[#95fe7c]">Feed</span>
          </h1>
          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest animate-pulse">
            LIVE
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Every battle, all time. Main events grouped by round automatically.
        </p>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/20">
            {eventCount} events
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#7ec1fb]/10 text-[#7ec1fb] border border-[#7ec1fb]/20">
            {quickCount} quick battles
          </span>
          {multiRound > 0 && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {multiRound} multi-round events
            </span>
          )}
          <span className="text-[10px] text-muted-foreground px-2.5 py-1 hidden sm:inline">
            {totalItems} shown · test battles excluded
          </span>
        </div>

        {/* Sort / Filter controls */}
        <div className="mt-4">
          <Suspense>
            <BattlesControls sort={sort} filter={filter} />
          </Suspense>
        </div>
      </header>

      {/* ── FEED ── */}
      <div className="space-y-3">
        {pageFeed.length === 0 && (
          <div className="rounded-xl border border-border bg-[#111827] p-12 text-center">
            <p className="text-xl font-rajdhani font-bold text-white mb-2">No battles yet</p>
            <p className="text-muted-foreground text-sm">Battles will appear here as soon as webhooks are received from WaveWarZ.</p>
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
                ? 'border-border text-muted-foreground/40 pointer-events-none'
                : 'border-border text-muted-foreground hover:text-white hover:border-white/20'
            }`}
          >
            ← Prev
          </a>

          <div className="flex items-center gap-1 flex-wrap justify-center">
            <span className="text-[10px] text-muted-foreground mr-1">
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
                  <span key={`gap-${i}`} className="text-muted-foreground/40 px-1">…</span>
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
                ? 'border-border text-muted-foreground/40 pointer-events-none'
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
