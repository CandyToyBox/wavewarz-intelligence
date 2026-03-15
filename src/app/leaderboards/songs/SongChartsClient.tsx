'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { Tip } from '@/components/tip'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

export type SongBattle = {
  battleId: number
  pool1: number      // this song's pool (SOL)
  pool2: number      // opponent's pool (SOL)
  volume1: number    // this song's trading volume (SOL)
  durationSeconds: number
  createdAt: string
  uniqueTraders: number
  won: boolean
}

export type SongData = {
  key: string
  songTitle: string
  musicLink: string | null
  handle: string | null
  artUrl: string | null
  genre: string | null
  artistName: string | null
  battles: SongBattle[]
}

type Period   = 'today' | 'week' | 'month' | 'all'
type Category = 'trending' | 'played' | 'volume' | 'traders' | 'genre'

type RankedSong = SongData & {
  wins: number
  losses: number
  totalBattles: number
  winRate: number
  totalVolume: number
  totalUniqueTraders: number
  trendingScore: number
  lastPlayed: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string>   = { today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' }
const CATEGORY_LABELS: Record<Category, string> = { trending: 'Trending', played: 'Most Played', volume: 'Most Volume', traders: 'Most Traders', genre: 'By Genre' }

const PALETTE = ['#95fe7c', '#7ec1fb', '#f59e0b', '#f472b6', '#a78bfa', '#34d399']
function colorForLetter(letter: string) {
  return PALETTE[letter.toUpperCase().charCodeAt(0) % PALETTE.length]
}

// ── Trending score formula ───────────────────────────────────────────────────
// score = velocity × competitiveness × recency_decay × engagement_boost
// Higher = hotter. Sums across all of a song's battles in the period.

function battleTrendingScore(b: SongBattle): number {
  const totalSol    = b.pool1 + b.pool2
  const durationMin = Math.max(b.durationSeconds / 60, 1)
  const velocity    = totalSol / durationMin

  const totalPool        = b.pool1 + b.pool2
  const competitiveness  = totalPool > 0
    ? 1 + (1 - Math.abs(b.pool1 - b.pool2) / totalPool) * 0.5
    : 1

  const hoursOld = (Date.now() - new Date(b.createdAt).getTime()) / 3_600_000
  const recency  = 1 / Math.pow(1 + hoursOld / 24, 1.5)

  const engagement = 1 + Math.min(b.uniqueTraders / 100, 0.3)

  return velocity * competitiveness * recency * engagement
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cutoffMs(period: Period): number {
  const DAY = 86_400_000
  return period === 'today' ? Date.now() - DAY
    : period === 'week'  ? Date.now() - 7  * DAY
    : period === 'month' ? Date.now() - 30 * DAY
    : 0
}

function filterBattles(battles: SongBattle[], period: Period): SongBattle[] {
  const cutoff = cutoffMs(period)
  return cutoff === 0 ? battles : battles.filter(b => new Date(b.createdAt).getTime() >= cutoff)
}

function aggregateSong(song: SongData, period: Period): RankedSong | null {
  const fb = filterBattles(song.battles, period)
  if (fb.length === 0) return null
  const wins    = fb.filter(b => b.won).length
  const losses  = fb.length - wins
  const volume  = fb.reduce((s, b) => s + b.volume1, 0)
  const traders = fb.reduce((s, b) => s + b.uniqueTraders, 0)
  const score   = fb.reduce((s, b) => s + battleTrendingScore(b), 0)
  // battles already sorted newest-first from server
  const lastPlayed = fb[0]?.createdAt ?? null
  return {
    ...song,
    wins, losses,
    totalBattles: fb.length,
    winRate: Math.round(wins / fb.length * 100),
    totalVolume: volume,
    totalUniqueTraders: traders,
    trendingScore: score,
    lastPlayed,
  }
}

function relativeHeat(score: number, max: number): number {
  return max > 0 ? Math.round((score / max) * 100) : 0
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

function formatSolShort(sol: number): string {
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}K`
  if (sol >= 1)    return sol.toFixed(2)
  return sol.toFixed(4)
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SongAvatar({ song, size = 10 }: { song: RankedSong | SongData; size?: number }) {
  const initial = song.songTitle.charAt(0).toUpperCase()
  const color   = colorForLetter(initial)
  const cls     = `shrink-0 w-${size} h-${size} rounded-lg`
  return song.artUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={song.artUrl} alt={song.songTitle} className={`${cls} object-cover border border-border`} />
  ) : (
    <div
      className={`${cls} border flex items-center justify-center font-rajdhani font-bold text-lg`}
      style={{ backgroundColor: `${color}18`, borderColor: `${color}40`, color }}
    >
      {initial}
    </div>
  )
}

function SongName({ song }: { song: RankedSong }) {
  return (
    <div className="min-w-0">
      {song.musicLink ? (
        <a
          href={song.musicLink}
          target="_blank"
          rel="noreferrer"
          className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm sm:text-base leading-tight flex items-center gap-1"
        >
          <span className="truncate">{song.songTitle}</span>
          <span className="text-[10px] text-[#7ec1fb] shrink-0">↗</span>
        </a>
      ) : (
        <p className="font-rajdhani font-bold text-white text-sm sm:text-base leading-tight truncate">{song.songTitle}</p>
      )}
      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
        {song.handle && <p className="text-[10px] text-muted-foreground">@{song.handle}</p>}
        {song.genre && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#7ec1fb]/10 text-[#7ec1fb] border border-[#7ec1fb]/20">
            {song.genre}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main chart table ─────────────────────────────────────────────────────────

function ChartTable({
  songs,
  category,
  maxScore,
}: {
  songs: RankedSong[]
  category: Exclude<Category, 'genre'>
  maxScore: number
}) {
  const RANK_LABEL = ['🥇', '🥈', '🥉']

  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[540px]">
        <thead>
          <tr className="border-b border-border bg-[#111827]">
            <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest w-10">#</th>
            <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">Song</th>
            {category === 'trending' && (
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                <Tip text="Composite score: volume velocity × competitiveness × recency × trader engagement. Decays over time.">Heat</Tip>
              </th>
            )}
            <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
              <Tip text="Wins and losses in quick battles. Winner decided by 3-factor system: Poll + Charts (SOL) + DJ Wavy AI Judge — 2 out of 3 wins.">Record</Tip>
            </th>
            <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
              <Tip text="Percentage of quick battles this song has won.">Win %</Tip>
            </th>
            {category === 'volume' && (
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Total SOL traded by fans backing this song.">Volume</Tip>
              </th>
            )}
            {category === 'traders' && (
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Sum of unique traders across all battles in this period.">Traders</Tip>
              </th>
            )}
            {category === 'played' && (
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Number of quick battles this song has competed in.">Battles</Tip>
              </th>
            )}
            {category === 'trending' && (
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Total SOL traded by fans backing this song.">Volume</Tip>
              </th>
            )}
            <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Last</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song, i) => {
            const heat = relativeHeat(song.trendingScore, maxScore)
            return (
              <tr key={song.key} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-3 sm:px-4 py-3 text-muted-foreground font-mono text-xs">
                  {i < 3 ? RANK_LABEL[i] : `${i + 1}`}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <SongAvatar song={song} />
                    <SongName song={song} />
                  </div>
                </td>

                {/* Heat bar — trending only */}
                {category === 'trending' && (
                  <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${heat}%`,
                            background: heat > 66
                              ? '#95fe7c'
                              : heat > 33
                              ? '#7ec1fb'
                              : '#4a4a4a',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-8">{heat}</span>
                    </div>
                  </td>
                )}

                <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                  <span className="font-rajdhani font-bold text-[#7ec1fb]">{song.wins}W</span>
                  <span className="text-muted-foreground mx-1">–</span>
                  <span className="font-rajdhani font-bold text-red-400">{song.losses}L</span>
                </td>
                <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                  <WinRateBar rate={song.winRate} color="blue" />
                </td>

                {category === 'volume' && (
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <p className="font-mono text-xs">
                      <span className="text-[#7ec1fb]">{formatSolShort(song.totalVolume)}</span>{' '}
                      <span className="text-muted-foreground">SOL</span>
                    </p>
                  </td>
                )}
                {category === 'traders' && (
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <span className="font-mono text-xs text-[#95fe7c]">{song.totalUniqueTraders.toLocaleString()}</span>
                  </td>
                )}
                {category === 'played' && (
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <span className="font-mono text-xs text-white">{song.totalBattles}</span>
                  </td>
                )}
                {category === 'trending' && (
                  <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
                    <p className="font-mono text-xs">
                      <span className="text-[#7ec1fb]">{formatSolShort(song.totalVolume)}</span>{' '}
                      <span className="text-muted-foreground">SOL</span>
                    </p>
                  </td>
                )}

                <td className="px-3 sm:px-4 py-3 text-right text-[10px] text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                  {timeAgo(song.lastPlayed)}
                </td>
              </tr>
            )
          })}
          {songs.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                No quick battles in this time period yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Genre view ───────────────────────────────────────────────────────────────

function GenreView({ songs }: { songs: RankedSong[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, RankedSong[]>()
    for (const s of songs) {
      const g = s.genre ?? 'Other'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(s)
    }
    // Sort each genre group by wins then volume
    for (const [, arr] of map) {
      arr.sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume)
    }
    // Sort genres by total volume
    return [...map.entries()].sort((a, b) => {
      const volA = a[1].reduce((s, x) => s + x.totalVolume, 0)
      const volB = b[1].reduce((s, x) => s + x.totalVolume, 0)
      return volB - volA
    })
  }, [songs])

  if (grouped.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No genre data available for this period. Genre is resolved from Audius metadata.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.map(([genre, genreSongs]) => {
        const totalVol = genreSongs.reduce((s, x) => s + x.totalVolume, 0)
        return (
          <div key={genre} className="rounded-xl border border-border overflow-hidden">
            <div className="bg-[#111827] px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <span className="font-rajdhani font-bold text-white text-lg tracking-wide">{genre}</span>
                <Badge className="bg-[#7ec1fb]/10 text-[#7ec1fb] border border-[#7ec1fb]/20 text-[9px] tracking-widest">
                  {genreSongs.length} song{genreSongs.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{formatSolShort(totalVol)} SOL</span>
            </div>
            <div className="divide-y divide-border/50">
              {genreSongs.slice(0, 5).map((song, i) => (
                <div key={song.key} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{i + 1}</span>
                  <SongAvatar song={song} size={8} />
                  <div className="flex-1 min-w-0">
                    {song.musicLink ? (
                      <a
                        href={song.musicLink}
                        target="_blank"
                        rel="noreferrer"
                        className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm flex items-center gap-1"
                      >
                        <span className="truncate">{song.songTitle}</span>
                        <span className="text-[10px] text-[#7ec1fb] shrink-0">↗</span>
                      </a>
                    ) : (
                      <p className="font-rajdhani font-bold text-sm text-white truncate">{song.songTitle}</p>
                    )}
                    {song.handle && <p className="text-[10px] text-muted-foreground">@{song.handle}</p>}
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="font-mono text-xs">
                      <span className="text-[#7ec1fb]">{song.wins}W</span>
                      <span className="text-muted-foreground">–</span>
                      <span className="text-red-400">{song.losses}L</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatSolShort(song.totalVolume)} SOL</p>
                  </div>
                </div>
              ))}
              {genreSongs.length > 5 && (
                <div className="px-4 py-2 text-[10px] text-muted-foreground text-center">
                  +{genreSongs.length - 5} more songs in this genre
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-mono uppercase tracking-widest rounded transition-all whitespace-nowrap ${
        active
          ? 'bg-[#7ec1fb]/15 text-[#7ec1fb] border border-[#7ec1fb]/40'
          : 'text-muted-foreground hover:text-white border border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

// ── Root client component ─────────────────────────────────────────────────────

export default function SongChartsClient({ songs }: { songs: SongData[] }) {
  const [period,   setPeriod]   = useState<Period>('week')
  const [category, setCategory] = useState<Category>('trending')

  const { rankedSongs, maxScore, totalSongs } = useMemo(() => {
    // Aggregate each song for the selected period
    const aggregated = songs
      .map(s => aggregateSong(s, period))
      .filter((s): s is RankedSong => s !== null)

    // Sort by selected category
    let sorted: RankedSong[]
    switch (category) {
      case 'played':  sorted = [...aggregated].sort((a, b) => b.totalBattles   - a.totalBattles); break
      case 'volume':  sorted = [...aggregated].sort((a, b) => b.totalVolume    - a.totalVolume);  break
      case 'traders': sorted = [...aggregated].sort((a, b) => b.totalUniqueTraders - a.totalUniqueTraders); break
      case 'genre':   sorted = [...aggregated].sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume); break
      default:        sorted = [...aggregated].sort((a, b) => b.trendingScore  - a.trendingScore)
    }

    const maxScore = sorted[0]?.trendingScore ?? 0
    return { rankedSongs: sorted, maxScore, totalSongs: sorted.length }
  }, [songs, period, category])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Link href="/leaderboards" className="text-xs text-muted-foreground hover:text-white transition-colors mb-4 inline-block">
          ← All Leaderboards
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
            Song <span className="text-[#7ec1fb]">Charts</span>
          </h1>
          <Badge className="bg-[#7ec1fb]/20 text-[#7ec1fb] border border-[#7ec1fb]/40 text-[10px] font-bold tracking-widest">
            QUICK BATTLES
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">{totalSongs} songs · {PERIOD_LABELS[period]}</span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Trending scores factor volume velocity, battle closeness, recency, and trader engagement.
        </p>
      </div>

      {/* Period tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0 mr-1">Period:</span>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <TabBtn key={p} active={period === p} onClick={() => setPeriod(p)}>
            {PERIOD_LABELS[p]}
          </TabBtn>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0 mr-1">View:</span>
        {(Object.keys(CATEGORY_LABELS) as Category[]).map(c => (
          <TabBtn key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c]}
          </TabBtn>
        ))}
      </div>

      {/* Trending score legend (trending view only) */}
      {category === 'trending' && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-[#95fe7c]" />
            <span>Hot (66–100)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-[#7ec1fb]" />
            <span>Warm (33–65)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-[#4a4a4a]" />
            <span>Cool (0–32)</span>
          </div>
          <Tip text="Heat score is relative to the top song in this time period. A song at 100 is the hottest right now.">
            <span className="underline underline-offset-2 cursor-help">How is this calculated?</span>
          </Tip>
        </div>
      )}

      {/* Content */}
      {category === 'genre' ? (
        <GenreView songs={rankedSongs} />
      ) : (
        <ChartTable songs={rankedSongs} category={category} maxScore={maxScore} />
      )}
    </div>
  )
}
