import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { calculateArtistEarnings, getWinnerLoserPools, formatSol } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { ArtistTable, type ArtistRowClient } from './artist-table'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Artist Rankings — WaveWarZ Intelligence',
  description: 'Main event artist rankings by wins, volume, and onchain earnings.',
}

const GROUP_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours — same as battles feed

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
  event_subtype: string
  status: string
}

async function getData() {
  const supabase = await createClient()
  const [battlesRes, profilesRes, walletsRes, solPrice] = await Promise.all([
    supabase
      .from('battles')
      .select('battle_id,created_at,artist1_name,artist1_wallet,artist2_name,artist2_wallet,artist1_pool,artist2_pool,total_volume_a,total_volume_b,winner_artist_a,event_subtype,status')
      .eq('is_main_battle', true)
      .eq('is_community_battle', false)
      .eq('is_quick_battle', false)
      .eq('is_test_battle', false)
      .eq('winner_decided', true),
    // Note: event_subtype charity/spotlight filtered below (neq excludes NULLs in SQL)
    supabase
      .from('artist_profiles')
      .select('artist_id,primary_wallet,display_name,profile_picture_url'),
    supabase
      .from('artist_wallets')
      .select('artist_id,wallet_address'),
    getLiveSolPrice(),
  ])

  // Filter out charity/spotlight — done in JS because SQL neq() excludes NULL rows
  const battles = ((battlesRes.data ?? []) as RawBattle[]).filter(
    b => b.event_subtype !== 'charity' && b.event_subtype !== 'spotlight'
  )

  // Build wallet → canonical profile map (merges multi-wallet artists)
  const profileById = new Map<string, { primaryWallet: string; displayName: string | null; pfpUrl: string | null }>(
    (profilesRes.data ?? []).map(p => [p.artist_id, { primaryWallet: p.primary_wallet, displayName: p.display_name, pfpUrl: p.profile_picture_url }])
  )
  const walletToProfileId = new Map<string, string>()
  for (const p of profilesRes.data ?? []) walletToProfileId.set(p.primary_wallet, p.artist_id)
  for (const w of walletsRes.data ?? []) walletToProfileId.set(w.wallet_address, w.artist_id)

  function resolveWallet(wallet: string, fallbackName: string) {
    const profileId = walletToProfileId.get(wallet)
    if (profileId) {
      const p = profileById.get(profileId)
      if (p) return { key: profileId, wallet: p.primaryWallet, name: p.displayName ?? fallbackName, pfpUrl: p.pfpUrl }
    }
    return { key: wallet, wallet, name: fallbackName, pfpUrl: null }
  }

  // Build pair key using resolved keys so multi-wallet artists group correctly
  function resolvedPairKey(b: RawBattle): string {
    const r1 = resolveWallet(b.artist1_wallet, b.artist1_name)
    const r2 = resolveWallet(b.artist2_wallet, b.artist2_name)
    return [r1.key, r2.key].sort().join('|')
  }

  // ── Group individual rounds into Main Events ──────────────────────────────────
  // Same wallet-pair + 6-hour time window logic as the battles feed page.
  // Rounds sorted oldest → newest so group window checks work correctly.
  const sorted = [...battles].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const eventGroups: { key: string; battles: RawBattle[]; latestAt: number }[] = []

  for (const b of sorted) {
    const key = resolvedPairKey(b)
    const bTime = new Date(b.created_at).getTime()

    let matched: (typeof eventGroups)[0] | null = null
    for (let i = eventGroups.length - 1; i >= 0; i--) {
      const g = eventGroups[i]
      if (g.key !== key) continue
      const lastTime = new Date(g.battles[g.battles.length - 1].created_at).getTime()
      if (bTime - lastTime <= GROUP_WINDOW_MS) { matched = g; break }
    }

    if (matched) {
      matched.battles.push(b)
      matched.latestAt = Math.max(matched.latestAt, bTime)
    } else {
      eventGroups.push({ key, battles: [b], latestAt: bTime })
    }
  }

  // ── Determine event winner and accumulate per-artist stats ────────────────────
  // For each event: count rounds won by each artist, majority wins the event.
  // Volume + earnings are accumulated from every round regardless of tie.
  const map = new Map<string, {
    wallet: string; name: string; events: number; wins: number; losses: number
    totalVolume: number; totalEarnings: number; winRate: number
    pfpUrl: string | null
  }>()

  for (const group of eventGroups) {
    const firstBattle = group.battles[0]
    const r1 = resolveWallet(firstBattle.artist1_wallet, firstBattle.artist1_name)
    const r2 = resolveWallet(firstBattle.artist2_wallet, firstBattle.artist2_name)

    let r1RoundWins = 0, r2RoundWins = 0
    let r1Volume = 0, r2Volume = 0
    let r1Earnings = 0, r2Earnings = 0

    for (const b of group.battles) {
      // Determine which canonical artist maps to artist1 in this specific round
      const bR1 = resolveWallet(b.artist1_wallet, b.artist1_name)
      const r1IsArtist1 = bR1.key === r1.key

      const aWon = (b.winner_artist_a ?? 0) >= 1
      const r1Won = r1IsArtist1 ? aWon : !aWon

      const p1 = b.artist1_pool ?? 0
      const p2 = b.artist2_pool ?? 0
      const { loserPool } = getWinnerLoserPools(p1, p2, aWon)

      const vol_r1 = r1IsArtist1 ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)
      const vol_r2 = r1IsArtist1 ? (b.total_volume_b ?? 0) : (b.total_volume_a ?? 0)

      r1Volume += vol_r1
      r2Volume += vol_r2

      const e1 = calculateArtistEarnings(vol_r1, loserPool, r1Won)
      const e2 = calculateArtistEarnings(vol_r2, loserPool, !r1Won)
      r1Earnings += e1.tradingFees + e1.settlementBonus
      r2Earnings += e2.tradingFees + e2.settlementBonus

      if (r1Won) r1RoundWins++; else r2RoundWins++
    }

    const r1WonEvent = r1RoundWins > r2RoundWins
    const r2WonEvent = r2RoundWins > r1RoundWins
    // If r1RoundWins === r2RoundWins the event is a draw — events++ but no W/L

    const ex1 = map.get(r1.key) ?? {
      wallet: r1.wallet, name: r1.name, events: 0, wins: 0, losses: 0,
      totalVolume: 0, totalEarnings: 0, winRate: 0, pfpUrl: r1.pfpUrl,
    }
    ex1.events++
    ex1.totalVolume += r1Volume
    ex1.totalEarnings += r1Earnings
    if (r1WonEvent) ex1.wins++
    else if (r2WonEvent) ex1.losses++
    map.set(r1.key, ex1)

    const ex2 = map.get(r2.key) ?? {
      wallet: r2.wallet, name: r2.name, events: 0, wins: 0, losses: 0,
      totalVolume: 0, totalEarnings: 0, winRate: 0, pfpUrl: r2.pfpUrl,
    }
    ex2.events++
    ex2.totalVolume += r2Volume
    ex2.totalEarnings += r2Earnings
    if (r2WonEvent) ex2.wins++
    else if (r1WonEvent) ex2.losses++
    map.set(r2.key, ex2)
  }

  const rows = Array.from(map.values())
    .map(r => ({ ...r, winRate: r.events > 0 ? Math.round(r.wins / r.events * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume)

  const clientRows: ArtistRowClient[] = rows.map(r => ({
    wallet: r.wallet,
    name: r.name,
    wins: r.wins,
    losses: r.losses,
    totalVolumeSol: formatSol(r.totalVolume),
    totalVolumeUsd: solToUsd(r.totalVolume, solPrice),
    totalEarningsSol: formatSol(r.totalEarnings),
    totalEarningsUsd: solToUsd(r.totalEarnings, solPrice),
    winRate: r.winRate,
    battles: r.events,
    pfpUrl: r.pfpUrl,
  }))

  return { clientRows }
}

export default async function ArtistLeaderboardPage() {
  const { clientRows } = await getData()

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/leaderboards" className="text-xs text-muted-foreground hover:text-white transition-colors mb-4 inline-block">
          ← All Leaderboards
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
            Artist <span className="text-[#95fe7c]">Rankings</span>
          </h1>
          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest">
            MAIN EVENTS
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Ranked by Main Event wins. Each event = 2-of-3 or 3-of-5 rounds. Charity & spotlight excluded. Round winner = 2-of-3 (Human Judge · X Poll · SOL Vote).
        </p>
      </div>

      <ArtistTable rows={clientRows} />
    </div>
  )
}
