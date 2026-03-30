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

type RawBattle = {
  battle_id: number
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
      .select('battle_id,artist1_name,artist1_wallet,artist2_name,artist2_wallet,artist1_pool,artist2_pool,total_volume_a,total_volume_b,winner_artist_a,event_subtype,status')
      .eq('is_main_battle', true)
      .eq('is_community_battle', false)
      .eq('is_quick_battle', false)
      .eq('is_test_battle', false)
      .eq('winner_decided', true)
      .neq('event_subtype', 'charity')
      .neq('event_subtype', 'spotlight'),
    supabase
      .from('artist_profiles')
      .select('id,primary_wallet,display_name,profile_picture_url'),
    supabase
      .from('artist_wallets')
      .select('artist_id,wallet_address'),
    getLiveSolPrice(),
  ])

  const battles = (battlesRes.data ?? []) as RawBattle[]

  // Build wallet → canonical key map (profile id when linked, else wallet itself)
  // This merges multi-wallet artists (e.g. STILO + STILOWORLD) into one row.
  const profileById = new Map<string, { primaryWallet: string; displayName: string | null; pfpUrl: string | null }>(
    (profilesRes.data ?? []).map(p => [p.id, { primaryWallet: p.primary_wallet, displayName: p.display_name, pfpUrl: p.profile_picture_url }])
  )
  const walletToProfileId = new Map<string, string>()
  for (const p of profilesRes.data ?? []) walletToProfileId.set(p.primary_wallet, p.id)
  for (const w of walletsRes.data ?? []) walletToProfileId.set(w.wallet_address, w.artist_id)

  // Resolve a wallet to its canonical group key and display info
  function resolveWallet(wallet: string, fallbackName: string) {
    const profileId = walletToProfileId.get(wallet)
    if (profileId) {
      const p = profileById.get(profileId)!
      return { key: profileId, wallet: p.primaryWallet, name: p.displayName ?? fallbackName, pfpUrl: p.pfpUrl }
    }
    return { key: wallet, wallet, name: fallbackName, pfpUrl: null }
  }

  const map = new Map<string, {
    wallet: string; name: string; wins: number; losses: number
    totalVolume: number; totalEarnings: number; winRate: number; battles: number
    pfpUrl: string | null
  }>()

  for (const b of battles) {
    // Use the recorded 2-of-3 judging result (Human Judge + X Poll + SOL Vote).
    // winner_artist_a = 1 means artist A won, 0 means artist B won.
    const aWon = (b.winner_artist_a ?? 0) >= 1
    const p1 = b.artist1_pool ?? 0
    const p2 = b.artist2_pool ?? 0
    const { loserPool } = getWinnerLoserPools(p1, p2, aWon)

    const sides = [
      { wallet: b.artist1_wallet, name: b.artist1_name, won: aWon, volume: b.total_volume_a ?? 0 },
      { wallet: b.artist2_wallet, name: b.artist2_name, won: !aWon, volume: b.total_volume_b ?? 0 },
    ]

    for (const s of sides) {
      if (!s.wallet) continue
      const resolved = resolveWallet(s.wallet, s.name)
      const existing = map.get(resolved.key) ?? {
        wallet: resolved.wallet, name: resolved.name,
        wins: 0, losses: 0, totalVolume: 0, totalEarnings: 0,
        winRate: 0, battles: 0,
        pfpUrl: resolved.pfpUrl,
      }
      existing.battles++
      existing.totalVolume += s.volume
      if (s.won) existing.wins++; else existing.losses++
      const e = calculateArtistEarnings(s.volume, loserPool, s.won)
      existing.totalEarnings += e.tradingFees + e.settlementBonus
      map.set(resolved.key, existing)
    }
  }

  const rows = Array.from(map.values())
    .map(r => ({ ...r, winRate: r.battles > 0 ? Math.round(r.wins / r.battles * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume)

  // Pre-format all display strings server-side (client component cannot call server utils)
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
    battles: r.battles,
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
          Ranked by wins, then volume. Charity & spotlight battles excluded. Winner = 2-of-3 (Human Judge · X Poll · SOL Vote).
        </p>
      </div>

      <ArtistTable rows={clientRows} />
    </div>
  )
}
