'use client'

import { useState } from 'react'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { Tip } from '@/components/tip'
import Link from 'next/link'

export type ArtistRowClient = {
  wallet: string
  name: string
  wins: number
  losses: number
  draws: number
  totalVolumeSol: string
  totalVolumeUsd: string
  totalEarningsSol: string
  totalEarningsUsd: string
  winRate: number
  battles: number
  pfpUrl: string | null
  twitterHandle: string | null
}

// Rank medal icons
function RankBadge({ position }: { position: number }) {
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
  return (
    <div className="flex items-center justify-center w-7 h-7">
      <span className="font-mono text-xs text-muted-foreground">{position + 1}</span>
    </div>
  )
}

function ArtistAvatar({ name, pfpUrl, twitterHandle }: { name: string; pfpUrl: string | null; twitterHandle: string | null }) {
  // Priority: stored pfp → Twitter pfp via unavatar → letter fallback
  const imgSrc = pfpUrl ?? (twitterHandle ? `https://unavatar.io/twitter/${twitterHandle}` : null)
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-[#1a2235] flex items-center justify-center">
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // If unavatar fails, fall back to letter
            const target = e.currentTarget
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              parent.innerHTML = `<span class="font-rajdhani font-bold text-[#95fe7c] text-lg">${initial}</span>`
            }
          }}
        />
      ) : (
        <span className="font-rajdhani font-bold text-[#95fe7c] text-lg">{initial}</span>
      )}
    </div>
  )
}

// Row accent colors for top 3
const TOP3_LEFT_BORDER = [
  'border-l-2 border-l-[#f59e0b]',
  'border-l-2 border-l-zinc-400',
  'border-l-2 border-l-orange-700',
]

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
      {/* Search + count */}
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

      <div className="rounded-xl border border-border overflow-hidden bg-[#0d1321]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-border bg-[#111827]">
                <th className="text-left px-3 py-3 text-[10px] text-muted-foreground uppercase tracking-widest w-12 pl-4">#</th>
                <th className="text-left px-3 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">Artist</th>
                <th className="text-center px-3 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                  <Tip text="Main Event wins and losses. Each event = 2-of-3 or 3-of-5 rounds.">Record</Tip>
                </th>
                <th className="text-center px-3 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                  <Tip text="Percentage of Main Events won.">Win %</Tip>
                </th>
                <th className="text-right px-3 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                  <Tip text="Total SOL traded by fans on this artist across all battles.">Volume</Tip>
                </th>
                <th className="text-right px-3 py-3 pr-4 text-[10px] text-muted-foreground uppercase tracking-widest">
                  <Tip text="Estimated SOL earned: 1% of trading volume + settlement bonuses (5% winner / 2% loser of loser's pool)." wide>Earnings</Tip>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const isTop3 = i < 3 && !search
                const leftBorderClass = isTop3 ? TOP3_LEFT_BORDER[i] : ''
                const rowBg = i % 2 === 0 ? 'bg-[#0d1321]' : 'bg-[#0a0f1c]'

                return (
                  <tr
                    key={a.wallet}
                    className={`border-b border-border/40 hover:bg-[#95fe7c]/[0.03] transition-colors ${rowBg} ${leftBorderClass}`}
                  >
                    {/* Rank */}
                    <td className="px-3 py-3 pl-4">
                      <RankBadge position={search ? i : i} />
                    </td>

                    {/* Artist */}
                    <td className="px-3 py-2.5">
                      <Link href={`/artist/${a.wallet}`} className="flex items-center gap-3 group">
                        <ArtistAvatar name={a.name} pfpUrl={a.pfpUrl} twitterHandle={a.twitterHandle} />
                        <div className="min-w-0">
                          <p className="font-rajdhani font-bold text-white group-hover:text-[#95fe7c] transition-colors text-base leading-tight truncate">
                            {a.name}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                            {a.wallet.slice(0, 6)}…{a.wallet.slice(-4)}
                            {a.twitterHandle && (
                              <span className="ml-1.5 text-[#7ec1fb]/70">@{a.twitterHandle}</span>
                            )}
                            <span className="mx-1 text-border">·</span>
                            {a.battles} {a.battles === 1 ? 'event' : 'events'}
                          </p>
                        </div>
                      </Link>
                    </td>

                    {/* Record */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 bg-[#111827] rounded-lg px-2.5 py-1 border border-border/50">
                        <span className="font-rajdhani font-bold text-[#95fe7c] text-sm">{a.wins}W</span>
                        <span className="text-muted-foreground text-xs">–</span>
                        <span className="font-rajdhani font-bold text-red-400 text-sm">{a.losses}L</span>
                        {a.draws > 0 && (
                          <>
                            <span className="text-muted-foreground text-xs">–</span>
                            <Tip text="Tied events: round wins were equal so no W or L was recorded.">
                              <span className="font-rajdhani font-bold text-[#989898] text-sm cursor-help">{a.draws}D</span>
                            </Tip>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Win % */}
                    <td className="px-3 py-2.5 text-center hidden md:table-cell">
                      <WinRateBar rate={a.winRate} color="green" />
                    </td>

                    {/* Volume */}
                    <td className="px-3 py-2.5 text-right hidden md:table-cell">
                      <p className="font-mono text-xs font-bold">
                        <span className="text-[#7ec1fb]">{a.totalVolumeSol}</span>
                        <span className="text-muted-foreground font-normal"> SOL</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">{a.totalVolumeUsd}</p>
                    </td>

                    {/* Earnings */}
                    <td className="px-3 pr-4 py-2.5 text-right">
                      <p className="font-mono text-xs font-bold">
                        <span className="text-[#95fe7c]">{a.totalEarningsSol}</span>
                        <span className="text-muted-foreground font-normal"> SOL</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">{a.totalEarningsUsd}</p>
                    </td>
                  </tr>
                )
              })}
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
    </div>
  )
}
