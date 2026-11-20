import { getTraderLeaderboard } from '@/lib/leaderboards/traders'
import { solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import { TraderLookup } from './trader-lookup'
import type { Metadata } from 'next'
import { RankPanel, RankRow, RANK_ICONS } from '@/components/rank-list'
import { TraderNote } from '@/components/trader-note'

export const metadata: Metadata = {
  title: 'Trader Rankings',
  description: 'WaveWarZ traders ranked by total SOL traded across all battles, from public onchain records.',
}

export default async function TradersLeaderboardPage() {
  const { rows, solPrice, completeShare } = await getTraderLeaderboard()

  const totalVolume = rows.reduce((s, r) => s + r.totalVolumeSol, 0)
  const anyIncomplete = rows.some(r => !r.dataComplete)

  return (
    <div className="space-y-6">
      <LeaderboardNav />

      {/* Wallet lookup */}
      <TraderLookup />

      {anyIncomplete && (
        <div className="rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-4 py-3">
          <p className="text-xs text-[#f59e0b] font-bold uppercase tracking-widest mb-1">Rebuilding from chain</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Per-trade records for the largest battles are being re-fetched from Solana
            {completeShare > 0 && <> ({(completeShare * 100).toFixed(0)}% verified so far)</>}.
            Net SOL is hidden for wallets whose trade history is not yet fully verified,
            and volume for those wallets is a lower bound. Platform volume, artist payouts and
            settlement figures on the other pages are unaffected — those come from settled
            battle state, not per-trade data.
          </p>
        </div>
      )}

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
          <p className="text-sm text-muted-foreground mt-1">Fans and traders ranked by total SOL traded across all battles.</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Ranked Trader Volume{anyIncomplete && <span className="text-[#f59e0b]"> ·&nbsp;partial</span>}</p>
          <p className="font-rajdhani font-bold text-2xl text-white">{formatSol(totalVolume)} <span className="text-muted-foreground text-lg font-normal">SOL</span></p>
          <p className="text-xs text-muted-foreground">{solToUsd(totalVolume, solPrice)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <p className="font-rajdhani font-bold text-white text-xl mb-2">No Trade Data Yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No trades recorded yet. Trade history is sourced from WaveWarZ onchain data and updates as battles settle. Use the wallet lookup above to scan a specific wallet&apos;s history directly.
          </p>
        </div>
      ) : (
        <RankPanel icon={RANK_ICONS.traders} title="Top traders" sub="All battles · most SOL traded">
          {rows.map((r, i) => (
            <RankRow
              key={r.wallet}
              rank={i + 1}
              art={null}
              href={`/trader/${r.wallet}`}
              title={<span className="font-mono">{r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}</span>}
              sub={`${r.tradeCount} trades · ${r.battleCount} battles · ${r.wins + r.losses > 0 ? `backed the winner ${r.wins} of ${r.wins + r.losses}` : 'no settled battles'}`}
              extras={[{ k: 'Net SOL', v: !r.dataComplete ? 'unverified' : r.netPnlSol !== 0 ? `${r.netPnlPositive ? '+' : '-'}${r.netPnlFmt}` : '—' }]}
              stat={`${r.totalVolumeSolFmt} SOL`}
              small="Traded"
            />
          ))}
        </RankPanel>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Trade data sourced from WaveWarZ onchain records. Net SOL needs the buy and sell side of each trade.
      </p>
      <TraderNote />
    </div>
  )
}
