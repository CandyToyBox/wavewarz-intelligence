'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { Tip } from '@/components/tip'
import { Badge } from '@/components/ui/badge'

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

export type ClipperRowClient = {
  telegramId: number
  displayName: string
  pfpUrl: string | null
  points: number
  clipsSubmitted: number
  clipsApproved: number
  clipsPosted: number
  totalUpvotes: number
  approvalRate: string    // e.g. "67%"
  isArtist: boolean
  artistName: string | null
  solWallet: string | null
  totalBattles: number
  battlesWon: number
  battleWinRate: number
  mainBattles: number
  mainWins: number
}

export function ClipperTable({ rows }: { rows: ClipperRowClient[] }) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? rows.filter(r =>
        r.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (r.artistName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.solWallet ?? '').toLowerCase().includes(search.toLowerCase())
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
          className="bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50 w-full max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length}{search ? ` of ${rows.length}` : ''} contributors
        </span>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border bg-[#111827]">
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest w-10">#</th>
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">Contributor</th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Points earned: +1 submitted, +5 approved, +10 posted, +1 per upvote received.">Points</Tip>
              </th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                <Tip text="Clips submitted → approved → posted to social media.">Clips</Tip>
              </th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="For contributors who are also WaveWarz battle artists. Links to their full artist profile." wide>Battle Record</Tip>
              </th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Percentage of submitted clips that get approved by the team.">Approval %</Tip>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.telegramId} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">

                {/* Rank */}
                <td className="px-3 sm:px-4 py-3">
                  {i < 3 && !search ? <RankCell position={i} /> : <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>}
                </td>

                {/* Identity */}
                <td className="px-3 sm:px-4 py-3">
                  <Link
                    href={`/contributor/${r.telegramId}`}
                    className="flex items-center gap-2 sm:gap-3 group"
                  >
                    {/* Avatar */}
                    <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-border bg-[#1f2937] flex items-center justify-center">
                      {r.pfpUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.pfpUrl} alt={r.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-rajdhani font-bold text-orange-400 text-lg">
                          {r.displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Name + badges */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-rajdhani font-bold text-white group-hover:text-orange-400 transition-colors text-sm sm:text-base leading-tight truncate">
                          {r.displayName}
                        </p>
                        {r.isArtist && (
                          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[9px] font-bold tracking-wider leading-none px-1.5 py-0.5 shrink-0">
                            ARTIST
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {r.isArtist && r.artistName
                          ? r.artistName
                          : r.solWallet
                          ? `${r.solWallet.slice(0, 4)}…${r.solWallet.slice(-4)}`
                          : 'No wallet linked'}
                      </p>
                    </div>
                  </Link>
                </td>

                {/* Points */}
                <td className="px-3 sm:px-4 py-3 text-center">
                  <span className="font-rajdhani font-bold text-orange-400 text-lg">
                    {r.points.toLocaleString()}
                  </span>
                </td>

                {/* Clip funnel */}
                <td className="px-3 sm:px-4 py-3 text-center hidden sm:table-cell">
                  <div className="flex items-center justify-center gap-1 text-xs font-mono">
                    <Tip text="Submitted">
                      <span className="text-muted-foreground">{r.clipsSubmitted}</span>
                    </Tip>
                    <span className="text-muted-foreground/40">→</span>
                    <Tip text="Approved">
                      <span className="text-[#7ec1fb]">{r.clipsApproved}</span>
                    </Tip>
                    <span className="text-muted-foreground/40">→</span>
                    <Tip text="Posted">
                      <span className="text-[#95fe7c]">{r.clipsPosted}</span>
                    </Tip>
                  </div>
                </td>

                {/* Battle record (artists only) */}
                <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                  {r.isArtist && r.totalBattles > 0 ? (
                    <div className="space-y-1">
                      <div>
                        <span className="font-rajdhani font-bold text-[#95fe7c]">{r.battlesWon}W</span>
                        <span className="text-muted-foreground mx-1">–</span>
                        <span className="font-rajdhani font-bold text-red-400">{r.totalBattles - r.battlesWon}L</span>
                      </div>
                      <WinRateBar rate={r.battleWinRate} color="green" />
                      {r.solWallet && (
                        <Link
                          href={`/artist/${r.solWallet}`}
                          className="text-[10px] text-[#7ec1fb] hover:underline block"
                        >
                          Artist profile →
                        </Link>
                      )}
                    </div>
                  ) : r.isArtist ? (
                    <span className="text-xs text-muted-foreground">No battles yet</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>

                {/* Approval rate */}
                <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                  <span className={`text-xs font-bold font-rajdhani ${
                    parseInt(r.approvalRate) >= 60
                      ? 'text-[#95fe7c]'
                      : parseInt(r.approvalRate) >= 30
                      ? 'text-[#7ec1fb]'
                      : 'text-muted-foreground'
                  }`}>
                    {r.approvalRate}
                  </span>
                </td>

              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  {search ? `No contributors match "${search}"` : 'No clip submissions yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <p className="text-[11px] text-muted-foreground mt-3">
        Clips funnel: <span className="text-muted-foreground">submitted</span> → <span className="text-[#7ec1fb]">approved by team</span> → <span className="text-[#95fe7c]">posted to socials</span>.
        Contributors with an <span className="text-[#95fe7c] font-bold">ARTIST</span> badge also battle in WaveWarz — click their name to see clip + battle history together.
      </p>
    </div>
  )
}
