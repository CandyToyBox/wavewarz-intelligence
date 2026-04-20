import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol, calculateArtistEarnings, getWinnerLoserPools } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/tip'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import TraderHoldings from './trader-holdings'

type Props = { params: Promise<{ wallet: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { wallet } = await params
  return {
    title: `Trader ${wallet.slice(0, 8)}… — WaveWarZ Intelligence`,
  }
}

export default async function TraderPage({ params }: Props) {
  const { wallet } = await params
  if (!wallet || wallet.length < 32) notFound()

  const supabase = await createClient()
  const [tradesRes, solPrice] = await Promise.all([
    supabase
      .from('trades')
      .select('id, battle_id, trade_type, amount_sol, timestamp')
      .eq('trader_wallet', wallet)
      .order('timestamp', { ascending: false }),
    getLiveSolPrice(),
  ])

  const trades = tradesRes.data ?? []

  // Get all referenced battles
  const battleIds = [...new Set(trades.map(t => t.battle_id).filter(Boolean))]
  const battlesRes = battleIds.length > 0
    ? await supabase
        .from('battles')
        .select('battle_id, artist1_name, artist2_name, artist1_wallet, artist2_wallet, artist1_pool, artist2_pool, total_volume_a, total_volume_b, winner_artist_a, winner_decided, status, created_at, is_quick_battle, is_community_battle, image_url')
        .in('battle_id', battleIds)
    : { data: [] }

  const battleMap = new Map((battlesRes.data ?? []).map(b => [b.battle_id, b]))

  // Aggregate stats
  let totalVolume = 0
  let totalInvested = 0
  let totalPayout = 0
  // Per-battle: battle_id → true (won on winning side) | false (lost)
  // If trader held both sides, a win on either side counts as a win.
  const settledBattles = new Map<number, boolean>()

  for (const t of trades) {
    totalVolume += t.amount_sol ?? 0
    const isBuy = t.trade_type?.toLowerCase().includes('buy')
    const isSell = t.trade_type?.toLowerCase().includes('sell')
    if (isBuy) totalInvested += t.amount_sol ?? 0
    if (isSell) totalPayout += t.amount_sol ?? 0

    const battle = t.battle_id ? battleMap.get(t.battle_id) : null
    if (battle && t.battle_id && t.trade_type) {
      const isOver = battle.winner_decided || ['ended','completed','settled'].includes((battle.status ?? '').toLowerCase())
      if (isOver) {
        const a1Won = battle.winner_artist_a >= 0.5
        const sideA = t.trade_type.toLowerCase().includes('_a') || t.trade_type.toLowerCase() === 'buy'
        const won = sideA ? a1Won : !a1Won
        const existing = settledBattles.get(t.battle_id)
        // Once marked as a win, don't downgrade back to loss
        if (existing === undefined || (!existing && won)) {
          settledBattles.set(t.battle_id, won)
        }
      }
    }
  }

  let wins = 0, losses = 0
  for (const [, won] of settledBattles) {
    if (won) wins++
    else losses++
  }

  const netPnl = totalPayout - totalInvested
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null
  const sp = solPrice ?? 0

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Link href="/leaderboards/traders" className="text-xs text-muted-foreground hover:text-white transition-colors inline-block">
        ← Trader Rankings
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ec1fb] mb-1">Trader Profile</p>
          <h1 className="text-2xl sm:text-3xl font-rajdhani font-bold text-white tracking-tight font-mono break-all">
            {wallet}
          </h1>
          <div className="flex gap-2 mt-2">
            <a
              href={`https://solscan.io/account/${wallet}`}
              target="_blank" rel="noreferrer"
              className="text-[10px] text-[#7ec1fb] border border-[#7ec1fb]/20 px-2 py-0.5 rounded hover:bg-[#7ec1fb]/10 transition-colors"
            >
              Solscan ↗
            </a>
            <a
              href={`https://claim.wavewarz.info`}
              target="_blank" rel="noreferrer"
              className="text-[10px] text-muted-foreground border border-border px-2 py-0.5 rounded hover:text-white transition-colors"
            >
              Claim Funds ↗
            </a>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Volume" value={`${formatSol(totalVolume)} SOL`} sub={solToUsd(totalVolume, sp)} accent="#7ec1fb" />
        <StatCard label="Battles" value={String(battleIds.length)} sub={`${trades.length} trades`} />
        <StatCard
          label={<Tip text="Win rate across settled battles where side (A/B) is recorded">Win Rate</Tip>}
          value={winRate !== null ? `${winRate.toFixed(0)}%` : '—'}
          sub={wins + losses > 0 ? `${wins}W · ${losses}L` : 'no side data'}
        />
        <StatCard
          label={<Tip text="Total SOL received from sells minus SOL spent on buys">Net P&L</Tip>}
          value={netPnl !== 0 ? `${netPnl >= 0 ? '+' : ''}${formatSol(netPnl)} SOL` : '—'}
          sub={netPnl !== 0 ? solToUsd(Math.abs(netPnl), sp) : 'no buy/sell data'}
          accent={netPnl > 0 ? '#95fe7c' : netPnl < 0 ? '#ef4444' : undefined}
        />
      </div>

      {/* Live Holdings — client-side on-chain scan */}
      <TraderHoldings wallet={wallet} />

      {/* Battle History */}
      {battleIds.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-rajdhani font-bold text-white text-lg tracking-wide">Battle History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{battleIds.length} battles participated</p>
          </div>
          <div className="divide-y divide-border/50">
            {battleIds.map(bid => {
              const b = battleMap.get(bid)
              if (!b) return null
              const battleTrades = trades.filter(t => t.battle_id === bid)
              const totalForBattle = battleTrades.reduce((s, t) => s + (t.amount_sol ?? 0), 0)
              const isOver = b.winner_decided || ['ended','completed','settled'].includes((b.status ?? '').toLowerCase())
              const a1Won = b.winner_artist_a >= 0.5
              const firstTrade = battleTrades[battleTrades.length - 1]
              const sideA = firstTrade?.trade_type?.toLowerCase().includes('_a') || firstTrade?.trade_type?.toLowerCase() === 'buy'
              const won = isOver && firstTrade?.trade_type ? (sideA ? a1Won : !a1Won) : null
              const typeLabel = b.is_quick_battle ? 'Quick' : b.is_community_battle ? 'Community' : 'Main'
              const typeColor = b.is_quick_battle ? '#7ec1fb' : b.is_community_battle ? '#f59e0b' : '#95fe7c'

              return (
                <div key={bid} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {won === true && <span className="text-[9px] font-bold uppercase tracking-widest text-[#95fe7c] bg-[#95fe7c]/10 border border-[#95fe7c]/30 px-1.5 py-0.5 rounded">W</span>}
                      {won === false && <span className="text-[9px] font-bold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">L</span>}
                      {won === null && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-white/5 border border-border px-1.5 py-0.5 rounded">—</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/battles/${bid}`} className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm">
                          Battle #{bid}
                        </Link>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
                          style={{ color: typeColor, borderColor: `${typeColor}30`, backgroundColor: `${typeColor}10` }}>
                          {typeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.artist1_name} vs {b.artist2_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-white">{formatSol(totalForBattle)} SOL</p>
                    <p className="text-[10px] text-muted-foreground">{battleTrades.length} trade{battleTrades.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trade Log */}
      {trades.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-rajdhani font-bold text-white text-lg tracking-wide">Trade Log</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{trades.length} transactions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-[#0d1321]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Battle</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 50).map(t => {
                  const isBuy = t.trade_type?.toLowerCase().includes('buy')
                  return (
                    <tr key={t.id} className="border-b border-border/30 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        {t.battle_id ? (
                          <Link href={`/battles/${t.battle_id}`} className="font-mono text-[#7ec1fb] hover:text-white transition-colors">
                            #{t.battle_id}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                          isBuy
                            ? 'text-[#95fe7c] border-[#95fe7c]/30 bg-[#95fe7c]/10'
                            : 'text-[#7ec1fb] border-[#7ec1fb]/30 bg-[#7ec1fb]/10'
                        }`}>
                          {t.trade_type ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-white">
                        {formatSol(t.amount_sol ?? 0)} SOL
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                        {t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {trades.length > 50 && (
            <p className="px-5 py-3 text-[10px] text-muted-foreground border-t border-border">
              Showing 50 of {trades.length} trades
            </p>
          )}
        </div>
      )}

      {trades.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="font-bold text-white mb-1">No trade history found</p>
          <p className="text-sm text-muted-foreground">This wallet has no recorded trades in the WaveWarZ database yet.</p>
          <p className="text-xs text-muted-foreground mt-2">Use the <Link href="/claim" className="text-[#7ec1fb] hover:underline">Claim tool</Link> to check for on-chain holdings.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, accent }: {
  label: React.ReactNode; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className="font-mono text-sm font-bold" style={{ color: accent ?? '#ffffff' }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

import type React from 'react'
