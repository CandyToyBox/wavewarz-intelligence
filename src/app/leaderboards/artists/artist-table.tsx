'use client'

import { useState } from 'react'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { Tip } from '@/components/tip'
import Link from 'next/link'

const RANK_LABEL = ['🥇', '🥈', '🥉']

export type ArtistRowClient = {
  wallet: string
  name: string
  wins: number
  losses: number
  totalVolumeSol: string
  totalVolumeUsd: string
  totalEarningsSol: string
  totalEarningsUsd: string
  winRate: number
  battles: number
  pfpUrl: string | null
}

export function ArtistTable({ rows }: { rows: ArtistRowClient[] }) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? rows.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.wallet.toLowerCase().includes(search.toLowerCase())
      )
    : rows

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or wallet…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#95fe7c]/50 w-full max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length}{search ? ` of ${rows.length}` : ''} artists
        </span>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-border bg-[#111827]">
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest w-10">#</th>
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">Artist</th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Wins and losses across all main event battles.">Record</Tip>
              </th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Percentage of battles won. Higher is better.">Win %</Tip>
              </th>
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Total SOL traded by fans on this artist across all battles.">Volume</Tip>
              </th>
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Estimated SOL earned: 1% of trading volume + settlement bonuses (5% winner / 2% loser of the losing pool)." wide>Earnings</Tip>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr key={a.wallet} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-3 sm:px-4 py-3 text-muted-foreground font-mono text-xs">
                  {i < 3 && !search ? RANK_LABEL[i] : `${i + 1}`}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <Link href={`/artist/${a.wallet}`} className="flex items-center gap-2 sm:gap-3 group">
                    <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-border bg-[#1f2937] flex items-center justify-center">
                      {a.pfpUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.pfpUrl} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-rajdhani font-bold text-[#95fe7c] text-lg">
                          {a.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-rajdhani font-bold text-white group-hover:text-[#95fe7c] transition-colors text-sm sm:text-base leading-tight truncate">
                        {a.name}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {a.wallet.slice(0, 6)}…{a.wallet.slice(-4)} · {a.battles}b
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                  <span className="font-rajdhani font-bold text-[#95fe7c]">{a.wins}W</span>
                  <span className="text-muted-foreground mx-1">–</span>
                  <span className="font-rajdhani font-bold text-red-400">{a.losses}L</span>
                </td>
                <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                  <WinRateBar rate={a.winRate} color="green" />
                </td>
                <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
                  <p className="font-mono text-xs"><span className="text-[#7ec1fb]">{a.totalVolumeSol}</span> <span className="text-muted-foreground">SOL</span></p>
                  <p className="text-[10px] text-muted-foreground">{a.totalVolumeUsd}</p>
                </td>
                <td className="px-3 sm:px-4 py-3 text-right">
                  <p className="font-mono text-xs"><span className="text-[#95fe7c]">{a.totalEarningsSol}</span> <span className="text-muted-foreground">SOL</span></p>
                  <p className="text-[10px] text-muted-foreground">{a.totalEarningsUsd}</p>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  {search ? `No artists match "${search}"` : 'No main event data yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
