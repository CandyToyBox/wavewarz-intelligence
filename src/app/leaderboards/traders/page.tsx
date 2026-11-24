import { getTraderLeaderboard } from '@/lib/leaderboards/traders'
import { solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import { TraderLookup } from './trader-lookup'
import { BoardHead, BoardFigure } from '@/app/leaderboards/board-head'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { RankPanel, RankRow } from '@/components/rank-list'
import { RANK_ICONS } from '@/components/rank-icons'
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

      <BoardHead
        k="traders"
        aside={<BoardFigure label={anyIncomplete ? 'Ranked trader volume · partial' : 'Ranked trader volume'} value={formatSol(totalVolume)} unit="SOL" sub={solToUsd(totalVolume, solPrice)} />}
      >
        Fans and traders ranked by total SOL traded across all battles.
      </BoardHead>

      {/* Wallet lookup */}
      <TraderLookup />

      {anyIncomplete && (
        <div className="ww-note" style={{ '--acc': '#f2a74b' } as CSSProperties}>
          <p className="ww-bh-k"><i aria-hidden="true" />Rebuilding from chain</p>
          <p>
            Per-trade records for the largest battles are being re-fetched from Solana
            {completeShare > 0 && <> ({(completeShare * 100).toFixed(0)}% verified so far)</>}.
            Net SOL is hidden for wallets whose trade history is not yet fully verified,
            and volume for those wallets is a lower bound. Platform volume, artist payouts and
            settlement figures on the other pages are unaffected: those come from settled
            battle state, not per-trade data.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <p className="font-display font-bold text-white text-xl mb-2">No Trade Data Yet</p>
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
