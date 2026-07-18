import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'

/** Shared trader-leaderboard computation — used by both the leaderboard page and the public API. */

export type TraderLeaderboardRow = {
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

export async function getTraderLeaderboard(): Promise<{ rows: TraderLeaderboardRow[]; solPrice: number }> {
  const supabase = await createClient()

  // fetchAll paginates past the 1000-row cap — the trades table alone has
  // ~8k rows, so without this the whole leaderboard was built from a fraction.
  const [trades, battles, solPrice] = await Promise.all([
    fetchAll<{ battle_id: number | null; trader_wallet: string | null; trade_type: string | null; amount_sol: number | null }>(
      (from, to) => supabase
        .from('trades')
        .select('battle_id, trader_wallet, trade_type, amount_sol')
        .range(from, to)),
    fetchAll<{ battle_id: number; artist1_wallet: string | null; artist2_wallet: string | null; winner_artist_a: number | null; winner_decided: boolean | null; status: string | null; artist1_pool: number | null; artist2_pool: number | null }>(
      (from, to) => supabase
        .from('battles')
        .select('battle_id, artist1_wallet, artist2_wallet, winner_artist_a, winner_decided, status, artist1_pool, artist2_pool')
        .eq('is_test_battle', false)
        .range(from, to)),
    getLiveSolPrice(),
  ])

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
    const isClaim = t.trade_type === 'claim'
    const a = agg.get(t.trader_wallet)!
    // Claims are settlement withdrawals, not trading activity — exclude from volume/trade count.
    if (!isClaim) {
      a.totalVolume += t.amount_sol ?? 0
      a.tradeCount++
    }
    if (t.battle_id) a.battleIds.add(t.battle_id)

    // Determine win/loss per BATTLE (not per trade).
    // If a trader held tokens on both sides, a win on either side counts as a win.
    // Claim rows don't carry a/b side info (unlike buy_a/buy_b/sell_a/sell_b) — skip
    // them here, win/loss is already established from that trader's buy/sell rows.
    const battle = t.battle_id ? battleMap.get(t.battle_id) : null
    if (battle && t.trade_type && t.battle_id && !isClaim) {
      const isOver = battle.winner_decided || ['ended','completed','settled'].includes((battle.status ?? '').toLowerCase())
      if (isOver) {
        const a1Won = (battle.winner_artist_a ?? 0) >= 0.5
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
    } else if (t.trade_type?.toLowerCase().includes('sell') || t.trade_type === 'claim') {
      // 'claim' = real settlement withdrawal (claimShares), backfilled from chain.
      // Previously only mid-battle sells counted as payout, so any trader who
      // held to settlement and claimed showed as a near-total loss even when
      // they won. See scripts/backfill-claims-from-chain.ts.
      a.payout += t.amount_sol ?? 0
    }
  }

  const sp = solPrice ?? 0

  const rows: TraderLeaderboardRow[] = Array.from(agg.values())
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
