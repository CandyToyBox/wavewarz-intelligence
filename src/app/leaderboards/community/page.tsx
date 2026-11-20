import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { isBattleLive } from '@/lib/battle-metrics'
import { Badge } from '@/components/ui/badge'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import { RankPanel, RankRow, RankEmpty, RANK_ICONS } from '@/components/rank-list'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Community Rankings',
  description: 'Community battle competitors ranked by wins, volume, and win rate.',
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
  image_url: string | null
  status: string
  winner_decided: boolean | null
  winner_artist_a: number | null
  created_at: string
  battle_duration: number | null
  event_subtype: string | null
}

type CommunityRow = {
  name: string
  wallet: string
  wins: number
  losses: number
  totalVolume: number
  battles: number
  winRate: number
  // Best image to show: battle image_url or profile picture from artist_profiles
  imageUrl: string | null
}

async function getData() {
  const supabase = await createClient()
  const [res, profilesRes, solPrice] = await Promise.all([
    // fetchAll paginates past the 1000-row cap; .then keeps the {data} shape.
    fetchAll((from, to) => supabase
      .from('battles')
      .select('battle_id,artist1_name,artist1_wallet,artist2_name,artist2_wallet,artist1_pool,artist2_pool,total_volume_a,total_volume_b,image_url,status,winner_decided,winner_artist_a,created_at,battle_duration,event_subtype')
      .eq('is_community_battle', true)
      // Community = DIY artist/name/brand vs same. A song-vs-song (Audius)
      // battle is a Quick Battle even if it carries the community flag, so
      // exclude is_quick_battle here — community leaderboard is never song vs song.
      .eq('is_quick_battle', false)
      .eq('is_test_battle', false)
      .range(from, to)).then(data => ({ data })),
    // NOTE: benefit battles (event_subtype 'charity') are filtered out below in
    // JS — SQL neq() would also drop the NULL-subtype rows that make up most of
    // the leaderboard. A Benefit Battle (IndieZ vs ClassicZ, PolyRaiders wallet
    // on both sides) is a fundraiser, not a competitor rivalry, so it does not
    // belong in a ranked competitor list.
    supabase
      .from('artist_profiles')
      .select('primary_wallet,profile_picture_url'),
    getLiveSolPrice(),
  ])

  const allBattles = (res.data ?? []) as RawBattle[]
  const now = Date.now()
  const battles = allBattles
    .filter(b => !isBattleLive(b, now))
    // Benefit Battles are fundraisers, not rivalries — excluded from the ranked list.
    .filter(b => b.event_subtype !== 'charity')
  const pfpByWallet = new Map<string, string | null>(
    (profilesRes.data ?? []).map(p => [p.primary_wallet, p.profile_picture_url])
  )

  const map = new Map<string, CommunityRow>()

  for (const b of battles) {
    // Use admin-decided winner when available; fall back to pool comparison for undecided battles
    const aWon = (b.winner_decided && b.winner_artist_a !== null)
      ? Number(b.winner_artist_a) >= 0.5
      : (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0)
    const sides = [
      { wallet: b.artist1_wallet, name: b.artist1_name, won: aWon, volume: b.total_volume_a ?? 0, imageUrl: b.image_url },
      { wallet: b.artist2_wallet, name: b.artist2_name, won: !aWon, volume: b.total_volume_b ?? 0, imageUrl: b.image_url },
    ]
    for (const s of sides) {
      if (!s.wallet) continue
      const existing = map.get(s.wallet) ?? {
        name: s.name,
        wallet: s.wallet,
        wins: 0, losses: 0, totalVolume: 0, battles: 0, winRate: 0,
        // Prefer profile picture, fall back to battle image_url
        imageUrl: pfpByWallet.get(s.wallet) ?? s.imageUrl ?? null,
      }
      existing.battles++
      existing.totalVolume += s.volume
      if (s.won) existing.wins++; else existing.losses++
      map.set(s.wallet, existing)
    }
  }

  const rows = Array.from(map.values())
    .map(r => ({ ...r, winRate: r.battles > 0 ? Math.round(r.wins / r.battles * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume)

  return { rows, solPrice }
}

export default async function CommunityLeaderboardPage() {
  const { rows, solPrice } = await getData()

  return (
    <div className="space-y-6">
      <LeaderboardNav />

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
            Community <span className="text-amber-400">Rankings</span>
          </h1>
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold tracking-widest">
            COMMUNITY
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">{rows.length} competitors</span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Ranked by wins, then total SOL volume. Battle artwork shown per entry.
        </p>
      </div>

      <RankPanel icon={RANK_ICONS.community} title="Top community competitors" sub="Community battles · most wins">
        {rows.map((c, i) => (
          <RankRow
            key={c.wallet}
            rank={i + 1}
            art={c.imageUrl}
            href={`/artist/${c.wallet}`}
            title={c.name}
            sub={`${c.wins}W ${c.losses}L · ${c.winRate}% win rate · ${c.wallet.slice(0, 4)}…${c.wallet.slice(-4)}`}
            extras={[{ k: 'Traded', v: `${formatSol(c.totalVolume)} SOL` }, { k: 'USD', v: solToUsd(c.totalVolume, solPrice) }]}
            stat={`${c.battles} ${c.battles === 1 ? 'battle' : 'battles'}`}
            small="Played"
          />
        ))}
        {rows.length === 0 && <RankEmpty>No community battle data yet.</RankEmpty>}
      </RankPanel>
    </div>
  )
}
