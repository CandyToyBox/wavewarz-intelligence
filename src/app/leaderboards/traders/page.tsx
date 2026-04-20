import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/tip'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import { TraderLookup } from './trader-lookup'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Trader Rankings — WaveWarZ Intelligence',
  description: 'Top traders ranked by volume, win rate, and net P&L across all WaveWarZ battles.',
}

type TraderRow = {
  wallet: string
  totalVolumeSol: number
  totalVolumeSolFmt: string
  totalVolumeUsd: string
  tradeCount: number
  battleCount: number
  wins: number
  losses: number
  winRate: number
  netPnlSol: number
  netPnlFmt: string
  netPnlUsd: string
  netPnlPositive: boolean
}

async function getData() {
  const supabase = await createClient()

  const [tradesRes, battlesRes, solPrice] = await Promise.all([
    supabase
      .from('trades')
      .select('battle_id, trader_wallet, trade_type, amount_sol'),
    supabase
      .from('battles')
      .select('battle_id, artist1_wallet, artist2_wallet, winner_artist_a, winner_decided, status, artist1_pool, artist2_pool')
      .eq('is_test_battle', false),
    getLiveSolPrice(),
  ])

  const trades = tradesRes.data ?? []
  const battles = battlesRes.data ?? []

  if (trades.length === 0) return { rows: [], solPrice }

  // Build a quick lookup: battle_id → battle
  const battleMap = new Map(battles.map(b => [b.battle_id, b]))

  // Aggregate per wallet
  type Agg = {
    wallet: string
    totalVolume: number
    tradeCount: number
    battleIds: Set<number>
    // Per-battle win tracking: battle_id → true (won on winning side) | false (lost)
    // If trader held both sides, winning side takes precedence (true overrides false)
    settledBattles: Map<number, boolean>
    invested: number
    payout: number
  }
  const agg = new Map<string, Agg>()

  for (const t of trades) {
    if (!t.trader_wallet) continue
    if (!agg.has(t.trader_wallet)) {
      agg.set(t.trader_wallet, {
        wallet: t.trader_wallet,
        totalVolume: 0,
        tradeCount: 0,
        battleIds: new Set(),
        settledBattles: new Map(),
        invested: 0,
        payout: 0,
      })
    }
    const a = agg.get(t.trader_wallet)!
    a.totalVolume += t.amount_sol ?? 0
    a.tradeCount++
    if (t.battle_id) a.battleIds.add(t.battle_id)

    // Determine win/loss per BATTLE (not per trade).
    // If a trader held tokens on both sides, a win on either side counts as a win.
    const battle = t.battle_id ? battleMap.get(t.battle_id) : null
    if (battle && t.trade_type && t.battle_id) {
      const isOver = battle.winner_decided || ['ended','completed','settled'].includes((battle.status ?? '').toLowerCase())
      if (isOver) {
        const a1Won = battle.winner_artist_a >= 0.5
        const sideA = t.trade_type.toLowerCase().includes('_a') || t.trade_type.toLowerCase() === 'buy'
        const won = sideA ? a1Won : !a1Won
        const existing = a.settledBattles.get(t.battle_id)
        // Once marked as a win, don't downgrade back to loss
        if (existing === undefined || (!existing && won)) {
          a.settledBattles.set(t.battle_id, won)
        }
      }
    }

    if (t.trade_type?.toLowerCase().includes('buy')) {
      a.invested += t.amount_sol ?? 0
    } else if (t.trade_type?.toLowerCase().includes('sell')) {
      a.payout += t.amount_sol ?? 0
    }
  }

  const sp = solPrice ?? 0

  const rows: TraderRow[] = Array.from(agg.values())
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .map(a => {
      const battles = a.battleIds.size
      let wins = 0, losses = 0
      for (const [, won] of a.settledBattles) {
        if (won) wins++
        else losses++
      }
      const settled = wins + losses
      const winRate = settled > 0 ? (wins / settled) * 100 : 0
      const netPnl = a.payout - a.invested
      return {
        wallet: a.wallet,
        totalVolumeSol: a.totalVolume,
        totalVolumeSolFmt: formatSol(a.totalVolume),
        totalVolumeUsd: solToUsd(a.totalVolume, sp),
        tradeCount: a.tradeCount,
        battleCount: battles,
        wins,
        losses,
        winRate,
        netPnlSol: netPnl,
        netPnlFmt: formatSol(Math.abs(netPnl)),
        netPnlUsd: solToUsd(Math.abs(netPnl), sp),
        netPnlPositive: netPnl >= 0,
      }
    })

  return { rows, solPrice }
}

export default async function TradersLeaderboardPage() {
  const { rows, solPrice } = await getData()

  const totalVolume = rows.reduce((s, r) => s + r.totalVolumeSol, 0)

  return (
    <div className="space-y-6">
      <LeaderboardNav />

      {/* Wallet lookup */}
      <TraderLookup />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
              Trader <span className="text-[#f59e0b]">Rankings</span>
            </h1>
            <Badge className="bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40 text-[10px] font-bold tracking-widest">
              TRADERS
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Fans and speculators ranked by total SOL traded across all battles.</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Trader Volume</p>
          <p className="font-rajdhani font-bold text-2xl text-white">{formatSol(totalVolume)} <span className="text-muted-foreground text-lg font-normal">SOL</span></p>
          <p className="text-xs text-muted-foreground">{solToUsd(totalVolume, solPrice)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <p className="font-rajdhani font-bold text-white text-xl mb-2">No Trade Data Yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Individual trade records haven&apos;t been connected yet — the trades table needs to be populated from WaveWarz on-chain data. Use the wallet lookup above to scan a specific wallet&apos;s history directly.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[#0d1321]">
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-10">#</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wallet</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <Tip text="Total SOL traded across all buy/sell transactions">Volume</Tip>
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Trades</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Battles</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                  <Tip text="Win rate across settled battles">Win Rate</Tip>
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  <Tip text="Payout received minus SOL invested">Net P&L</Tip>
                </th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.wallet} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#7ec1fb]/10 border border-[#7ec1fb]/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#7ec1fb]">{r.wallet.slice(0, 2)}</span>
                      </div>
                      <div>
                        <Link href={`/trader/${r.wallet}`} className="font-mono text-xs text-white hover:text-[#7ec1fb] transition-colors">
                          {r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">{r.wins}W · {r.losses}L</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-mono text-xs text-white">{r.totalVolumeSolFmt} SOL</p>
                    <p className="text-[10px] text-muted-foreground">{r.totalVolumeUsd}</p>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <p className="font-mono text-xs text-white">{r.tradeCount}</p>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <p className="font-mono text-xs text-white">{r.battleCount}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {r.wins + r.losses > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <WinRateBar rate={r.winRate} />
                        <span className="text-[10px] text-muted-foreground">{r.winRate.toFixed(0)}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground text-center block">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {r.netPnlSol !== 0 ? (
                      <>
                        <p className={`font-mono text-xs font-bold ${r.netPnlPositive ? 'text-[#95fe7c]' : 'text-red-400'}`}>
                          {r.netPnlPositive ? '+' : '-'}{r.netPnlFmt} SOL
                        </p>
                        <p className="text-[10px] text-muted-foreground">{r.netPnlUsd}</p>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/trader/${r.wallet}`}
                      className="text-[10px] text-[#7ec1fb] hover:text-white transition-colors">
                      ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Trade data sourced from WaveWarZ on-chain records. Net P&L requires buy/sell side data in trade records.
      </p>
    </div>
  )
}
