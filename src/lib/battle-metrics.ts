/**
 * Single source of truth for platform-wide battle metrics.
 *
 * Both the public overview and the admin Command Center call platformMetrics()
 * with the same set of non-test battles, so their numbers are guaranteed
 * identical. (They used to compute volume/counts/revenue independently, which
 * is how the two pages drifted apart.)
 */

// Launch / queue fees — 100% WaveWarZ revenue. Confirmed 2026-02-28.
export const LAUNCH_FEES = {
  community: 0.017,     // SOL per community battle launch
  quickLaunch: 0.007,   // SOL per quick battle launch
  quickQueue: 0.005,    // SOL queue fee per quick battle
}

const MAIN_EVENT_WINDOW_MS = 6 * 60 * 60 * 1000  // rounds of one event share a wallet-pair within 6h

export type ClaimTotals = {
  totalClaimed: number
  claimCount: number
}

export type MetricsBattle = {
  total_volume_a: number | null
  total_volume_b: number | null
  artist1_pool: number | null
  artist2_pool: number | null
  winner_artist_a: number | null
  winner_decided: boolean | null
  is_quick_battle: boolean | null
  is_community_battle: boolean | null
  is_main_battle: boolean | null
  event_subtype: string | null
  artist1_wallet: string | null
  artist2_wallet: string | null
  created_at: string
}

/**
 * A Main Event is multiple battles (rounds), each catalog-vs-catalog. Group
 * main battle rows that share a wallet-pair within a 6-hour window into one
 * event. Excludes prediction-market rounds.
 */
export function countMainEvents(battles: MetricsBattle[]): number {
  const rounds = battles
    .filter(b => b.is_main_battle && !b.is_quick_battle && b.event_subtype !== 'prediction')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const groups: { key: string; latestAt: number }[] = []
  for (const b of rounds) {
    const key = [b.artist1_wallet, b.artist2_wallet].sort().join('|')
    const t = new Date(b.created_at).getTime()
    let matched = false
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].key !== key) continue
      if (t - groups[i].latestAt <= MAIN_EVENT_WINDOW_MS) { groups[i].latestAt = t; matched = true; break }
    }
    if (!matched) groups.push({ key, latestAt: t })
  }
  return groups.length
}

/**
 * Total real trader withdrawals (claimShares), backfilled from chain — distinct
 * from trading volume (buys+sells). Pass rows already filtered to trade_type='claim'.
 */
export function claimTotals(claims: { amount_sol: number | null }[]): ClaimTotals {
  return {
    totalClaimed: claims.reduce((s, c) => s + (c.amount_sol ?? 0), 0),
    claimCount: claims.length,
  }
}

/** Canonical platform metrics over a set of (already non-test) battles. */
export function platformMetrics(battles: MetricsBattle[]) {
  const totalVolume = battles.reduce((s, b) => s + (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0), 0)

  // Loser pool = the losing side's pool of each decided battle (the side that
  // distributes at settlement). "Decided" = a winner is known (winner_artist_a
  // set); winner_artist_a >= 0.5 means side A won, so the loser is side B.
  const totalLoserPools = battles
    .filter(b => b.winner_artist_a != null)
    .reduce((s, b) => s + (Number(b.winner_artist_a) >= 0.5 ? (b.artist2_pool ?? 0) : (b.artist1_pool ?? 0)), 0)

  // Canonical classification: quick takes precedence; community = DIY non-quick;
  // main = official non-quick non-community. Mutually exclusive, sums to total.
  const quickCount = battles.filter(b => b.is_quick_battle).length
  const communityCount = battles.filter(b => b.is_community_battle && !b.is_quick_battle).length
  const mainBattles = battles.filter(b => b.is_main_battle && !b.is_quick_battle && !b.is_community_battle).length
  const mainEvents = countMainEvents(battles)

  // Revenue — every source, shown everywhere (transparent):
  const tradingFees = totalVolume * 0.005                                  // 0.5% per trade
  const settlement = totalLoserPools * 0.03                                // 3% of loser pool at settlement
  const quickLaunch = quickCount * (LAUNCH_FEES.quickLaunch + LAUNCH_FEES.quickQueue)
  const communityLaunch = communityCount * LAUNCH_FEES.community
  const totalRevenue = tradingFees + settlement + quickLaunch + communityLaunch

  // Artist payouts: 1% of total volume + 5%/2% of loser pools at settlement (= 7%)
  const artistPayouts = totalVolume * 0.01 + totalLoserPools * 0.07

  return {
    totalVolume, totalLoserPools,
    quickCount, communityCount, mainBattles, mainEvents,
    revenue: { tradingFees, settlement, quickLaunch, communityLaunch, total: totalRevenue },
    artistPayouts,
  }
}
