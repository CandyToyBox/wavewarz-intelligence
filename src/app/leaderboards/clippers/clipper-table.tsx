'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { Tip } from '@/components/tip'
import { Badge } from '@/components/ui/badge'

const RANK_LABEL = ['🥇', '🥈', '🥉']

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
                <td className="px-3 sm:px-4 py-3 text-muted-foreground font-mono text-xs">
                  {i < 3 && !search ? RANK_LABEL[i] : `${i + 1}`}
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
