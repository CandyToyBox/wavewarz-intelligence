import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { Tip } from '@/components/tip'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Community Rankings — WaveWarZ Intelligence',
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
    supabase
      .from('battles')
      .select('battle_id,artist1_name,artist1_wallet,artist2_name,artist2_wallet,artist1_pool,artist2_pool,total_volume_a,total_volume_b,image_url,status')
      .eq('is_community_battle', true)
      .eq('is_test_battle', false)
      .neq('status', 'ACTIVE'),
    supabase
      .from('artist_profiles')
      .select('primary_wallet,profile_picture_url'),
    getLiveSolPrice(),
  ])

  const battles = (res.data ?? []) as RawBattle[]
  const pfpByWallet = new Map<string, string | null>(
    (profilesRes.data ?? []).map(p => [p.primary_wallet, p.profile_picture_url])
  )

  const map = new Map<string, CommunityRow>()

  for (const b of battles) {
    const aWon = (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0)
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

function RankCell({ position }: { position: number }) {
  if (position === 0) return (
    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/30">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 18h20l-2-10-4 5-4-9-4 9-4-5-2 10z" fill="#f59e0b" strokeLinejoin="round"/>
        <circle cx="2" cy="8" r="1.5" fill="#fbbf24"/>
        <circle cx="12" cy="4" r="1.5" fill="#fbbf24"/>
        <circle cx="22" cy="8" r="1.5" fill="#fbbf24"/>
      </svg>
    </div>
  )
  if (position === 1) return (
    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-400/10 border border-zinc-400/25">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2L4.5 13.5H11L11 22L19.5 10.5H13L13 2Z" fill="#a1a1aa"/>
      </svg>
    </div>
  )
  if (position === 2) return (
    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-700/10 border border-orange-700/25">
      <svg width="13" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2C12 2 7 8 7 13C7 15.8 8.7 18.2 11 19.3C10.4 18.3 10 17.2 10 16C10 13.5 12 11.5 12 11.5C12 11.5 14 13.5 14 16C14 17.2 13.6 18.3 13 19.3C15.3 18.2 17 15.8 17 13C17 8 12 2 12 2Z" fill="#c2410c"/>
      </svg>
    </div>
  )
  return <span className="font-mono text-xs text-muted-foreground">{position + 1}</span>
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

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-border bg-[#111827]">
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest w-10">#</th>
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">Competitor</th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Wins and losses across all community battles.">Record</Tip>
              </th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Percentage of community battles won.">Win %</Tip>
              </th>
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Total SOL traded on this competitor across all community battles.">Volume</Tip>
              </th>
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Total community battles competed in.">Battles</Tip>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.wallet} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-3 sm:px-4 py-3">
                  <RankCell position={i} />
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-border bg-[#1f2937] flex items-center justify-center">
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-rajdhani font-bold text-amber-400 text-lg">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-rajdhani font-bold text-white text-sm sm:text-base leading-tight truncate">{c.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                        {c.wallet.slice(0, 6)}…{c.wallet.slice(-4)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                  <span className="font-rajdhani font-bold text-amber-400">{c.wins}W</span>
                  <span className="text-muted-foreground mx-1">–</span>
                  <span className="font-rajdhani font-bold text-red-400">{c.losses}L</span>
                </td>
                <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                  <WinRateBar rate={c.winRate} color="amber" />
                </td>
                <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
                  <p className="font-mono text-xs"><span className="text-amber-400">{formatSol(c.totalVolume)}</span> <span className="text-muted-foreground">SOL</span></p>
                  <p className="text-[10px] text-muted-foreground">{solToUsd(c.totalVolume, solPrice)}</p>
                </td>
                <td className="px-3 sm:px-4 py-3 text-right text-muted-foreground text-xs">{c.battles}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No community battle data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
