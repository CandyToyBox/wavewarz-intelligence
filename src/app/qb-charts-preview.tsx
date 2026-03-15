'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Tip } from '@/components/tip'
import type { SongData, SongBattle } from '@/app/leaderboards/songs/SongChartsClient'

// ─── Types & constants ────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month'

const PERIOD_META: Record<Period, { label: string; desc: string }> = {
  today: { label: 'Today',      desc: 'Last 24 hours' },
  week:  { label: 'This Week',  desc: 'Last 7 days'   },
  month: { label: 'This Month', desc: 'Last 30 days'  },
}

// ─── Trending score (matches SongChartsClient algorithm) ─────────────────────

function trendingScore(battles: SongBattle[]): number {
  return battles.reduce((sum, b) => {
    const totalSol    = b.pool1 + b.pool2
    const durationMin = Math.max(b.durationSeconds / 60, 1)
    const velocity    = totalSol / durationMin
    const competitive = totalSol > 0
      ? 1 + (1 - Math.abs(b.pool1 - b.pool2) / totalSol) * 0.5
      : 1
    const hoursOld  = (Date.now() - new Date(b.createdAt).getTime()) / 3_600_000
    const recency   = 1 / Math.pow(1 + hoursOld / 24, 1.5)
    const engagement = 1 + Math.min(b.uniqueTraders / 100, 0.3)
    return sum + velocity * competitive * recency * engagement
  }, 0)
}

function cutoffMs(period: Period): number {
  const DAY = 86_400_000
  if (period === 'today') return Date.now() - DAY
  if (period === 'week')  return Date.now() - 7 * DAY
  return                         Date.now() - 30 * DAY
}

function formatVol(sol: number): string {
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}K`
  if (sol >= 1)    return sol.toFixed(2)
  return sol.toFixed(3)
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const PALETTE = ['#95fe7c', '#7ec1fb', '#f59e0b', '#f472b6', '#34d399', '#60a5fa']
function letterColor(s: string) {
  return PALETTE[s.toUpperCase().charCodeAt(0) % PALETTE.length]
}

// ─── Rank icons — on-brand SVGs for music battle leaderboard ─────────────────
// #1 Crown   — chart king                (gold)
// #2 Zap     — high energy momentum      (wave blue)
// #3 Flame   — heating up               (amber)
// #4 TrendUp — rising through the ranks  (action green)
// #5 Star    — charting                  (muted)

function RankIcon({ position }: { position: number }) {
  const tips = [
    'Chart King — #1 trending song this period',
    '#2 — High energy momentum',
    '#3 — Heating up fast',
    '#4 — Rising through the ranks',
    '#5 — Charting',
  ]

  const icons = [
    // Crown — position 1
    <svg key="crown" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 18h20l-2-10-4 5-4-9-4 9-4-5-2 10z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5" strokeLinejoin="round"/>
      <path d="M4 18h16" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="2" cy="8" r="1.5" fill="#fbbf24"/>
      <circle cx="12" cy="4" r="1.5" fill="#fbbf24"/>
      <circle cx="22" cy="8" r="1.5" fill="#fbbf24"/>
    </svg>,

    // Lightning bolt — position 2
    <svg key="zap" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L4.5 13.5H11L11 22L19.5 10.5H13L13 2Z" fill="#7ec1fb" stroke="#7ec1fb" strokeWidth="0.5" strokeLinejoin="round"/>
    </svg>,

    // Flame — position 3
    <svg key="flame" width="15" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C12 2 7 8 7 13C7 15.8 8.7 18.2 11 19.3C10.4 18.3 10 17.2 10 16C10 13.5 12 11.5 12 11.5C12 11.5 14 13.5 14 16C14 17.2 13.6 18.3 13 19.3C15.3 18.2 17 15.8 17 13C17 8 12 2 12 2Z" fill="#f97316" stroke="#f97316" strokeWidth="0.5"/>
      <path d="M12 13C12 13 10 14.5 10 16.5C10 18 11 19.5 12 20C13 19.5 14 18 14 16.5C14 14.5 12 13 12 13Z" fill="#fbbf24" stroke="none"/>
    </svg>,

    // Trending up — position 4
    <svg key="trend" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="#95fe7c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="17 6 23 6 23 12" stroke="#95fe7c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>,

    // Star — position 5
    <svg key="star" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#52525b" stroke="#71717a" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>,
  ]

  const bgColors = ['#f59e0b', '#7ec1fb', '#f97316', '#95fe7c', '#52525b']
  const glowColors = ['#f59e0b50', '#7ec1fb40', '#f9731640', '#95fe7c40', 'transparent']

  if (position >= 5) {
    return (
      <span className="flex items-center justify-center w-7 h-7 text-[11px] font-mono text-muted-foreground shrink-0">
        {position + 1}
      </span>
    )
  }

  return (
    <Tip text={tips[position]}>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform hover:scale-110"
        style={{
          background: `${bgColors[position]}15`,
          border: `1px solid ${bgColors[position]}35`,
          boxShadow: `0 0 8px ${glowColors[position]}`,
        }}
      >
        {icons[position]}
      </div>
    </Tip>
  )
}

// ─── W-L Record badge ─────────────────────────────────────────────────────────

function RecordBadge({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0
  return (
    <div className="text-right shrink-0">
      <p className="text-xs font-mono whitespace-nowrap leading-tight">
        <span className="text-[#7ec1fb] font-bold">{wins}W</span>
        <span className="text-muted-foreground mx-0.5">–</span>
        <span className="text-red-400 font-bold">{losses}L</span>
      </p>
      <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{winPct}% win rate</p>
    </div>
  )
}

// ─── SOL volume display ───────────────────────────────────────────────────────

function VolDisplay({ sol }: { sol: number }) {
  return (
    <div className="text-right shrink-0 min-w-[52px]">
      <p className="text-xs font-mono text-[#7ec1fb] font-bold leading-tight">{formatVol(sol)}</p>
      <p className="text-[9px] font-mono text-muted-foreground mt-0.5">SOL</p>
    </div>
  )
}

// ─── Heat bar ─────────────────────────────────────────────────────────────────

function HeatBar({ heat }: { heat: number }) {
  const color = heat > 66 ? '#95fe7c' : heat > 33 ? '#7ec1fb' : '#374151'
  const label = heat > 66 ? 'HOT' : heat > 33 ? 'WARM' : 'COOL'
  const labelColor = heat > 66 ? '#95fe7c' : heat > 33 ? '#7ec1fb' : '#4b5563'
  return (
    <Tip text={`Heat score: ${heat}/100 — measures velocity, battle closeness, recency & trader engagement`}>
      <div className="hidden sm:flex flex-col items-end gap-1 w-20 shrink-0">
        <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${heat}%`, background: color, boxShadow: heat > 50 ? `0 0 6px ${color}80` : 'none' }}
          />
        </div>
        <span className="text-[8px] font-bold tracking-widest" style={{ color: labelColor }}>{label}</span>
      </div>
    </Tip>
  )
}

// ─── Song row ─────────────────────────────────────────────────────────────────

type RankedSong = SongData & {
  wins: number; losses: number
  totalBattles: number; totalVolume: number; score: number
}

function SongRow({
  song, index, maxScore, view,
}: {
  song: RankedSong; index: number; maxScore: number; view: 'trending' | 'genre'
}) {
  const color   = letterColor(song.songTitle.charAt(0))
  const initial = song.songTitle.charAt(0).toUpperCase()
  const heat    = maxScore > 0 ? Math.round((song.score / maxScore) * 100) : 0

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors anim-fade-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Rank icon */}
      <RankIcon position={index} />

      {/* Album art */}
      {song.artUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={song.artUrl}
          alt={song.songTitle}
          className="w-10 h-10 rounded-lg object-cover border border-border/60 shrink-0"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 font-rajdhani font-bold text-base"
          style={{ backgroundColor: `${color}18`, borderColor: `${color}40`, color }}
        >
          {initial}
        </div>
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        {song.musicLink ? (
          <a
            href={song.musicLink}
            target="_blank"
            rel="noreferrer"
            className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm leading-tight flex items-center gap-1 group"
          >
            <span className="truncate">{song.songTitle}</span>
            <span className="text-[10px] text-[#7ec1fb] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
          </a>
        ) : (
          <p className="font-rajdhani font-bold text-white text-sm truncate leading-tight">{song.songTitle}</p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {song.handle && (
            <span className="text-[10px] text-muted-foreground">@{song.handle}</span>
          )}
          {song.genre && (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}25` }}
            >
              {song.genre}
            </span>
          )}
        </div>
      </div>

      {/* Heat bar — trending only, hidden on mobile */}
      {view === 'trending' && <HeatBar heat={heat} />}

      {/* W-L record */}
      <RecordBadge wins={song.wins} losses={song.losses} />

      {/* Volume */}
      <VolDisplay sol={song.totalVolume} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QBChartsPreview({ songs }: { songs: SongData[] }) {
  const [period, setPeriod]       = useState<Period>('week')
  const [showGenre, setShowGenre] = useState(false)

  const { top, genreGroups, maxScore } = useMemo(() => {
    const cutoff = cutoffMs(period)

    const ranked = songs
      .map(s => {
        const fb = s.battles.filter(b => new Date(b.createdAt).getTime() >= cutoff)
        if (!fb.length) return null
        const wins   = fb.filter(b => b.won).length
        const losses = fb.length - wins
        const vol    = fb.reduce((a, b) => a + b.volume1, 0)
        const score  = trendingScore(fb)
        return { ...s, wins, losses, totalBattles: fb.length, totalVolume: vol, score }
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score) as RankedSong[]

    const maxScore = ranked[0]?.score ?? 0

    const genreMap = new Map<string, RankedSong>()
    for (const s of ranked) {
      const g = s.genre ?? 'Other'
      if (!genreMap.has(g)) genreMap.set(g, s)
    }
    const genreGroups = [...genreMap.entries()]
      .sort((a, b) => b[1].totalVolume - a[1].totalVolume)
      .slice(0, 8)

    return { top: ranked.slice(0, 5), genreGroups, maxScore }
  }, [songs, period])

  const activeView = showGenre ? 'genre' : 'trending'

  return (
    <section>

      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide">
              Quick Battle <span className="text-[#7ec1fb]">Charts</span>
            </h2>
            <Tip text="Song vs Song — winner decided by Poll + Charts (SOL) + DJ Wavy AI Judge, 2 out of 3">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-[#7ec1fb]/40 bg-[#7ec1fb]/10 text-[#7ec1fb] cursor-help">
                QUICK BATTLES
              </span>
            </Tip>
          </div>
          <p className="text-xs text-muted-foreground">
            Live every weeknight 8:30 PM EST · Trending = volume velocity × recency × engagement
          </p>
        </div>
        <Link
          href="/leaderboards/songs"
          className="text-xs text-[#7ec1fb] hover:text-white transition-colors font-mono shrink-0 flex items-center gap-1 group"
        >
          Full Charts
          <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
        </Link>
      </div>

      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-[#0d1321] border border-border rounded-lg p-1">
          {(Object.keys(PERIOD_META) as Period[]).map(p => (
            <Tip key={p} text={PERIOD_META[p].desc}>
              <button
                onClick={() => { setPeriod(p); setShowGenre(false) }}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-all whitespace-nowrap ${
                  period === p && !showGenre
                    ? 'bg-[#7ec1fb]/20 text-[#7ec1fb] border border-[#7ec1fb]/40'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                {PERIOD_META[p].label}
              </button>
            </Tip>
          ))}
        </div>

        {/* Genre toggle */}
        <Tip text="Top charting song per genre — ranked by total SOL volume">
          <button
            onClick={() => setShowGenre(v => !v)}
            className={`px-3 py-1 text-xs font-mono rounded-lg border transition-all whitespace-nowrap ${
              showGenre
                ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40 glow-pulse-blue'
                : 'text-muted-foreground border-border hover:text-white hover:border-[#7ec1fb]/30'
            }`}
          >
            By Genre
          </button>
        </Tip>

        {/* Live context pill */}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono hidden sm:block">
          {showGenre
            ? `${genreGroups.length} genres charting`
            : `Top ${top.length} of ${songs.filter(s => s.battles.some(b => new Date(b.createdAt).getTime() >= cutoffMs(period))).length} songs`
          }
        </span>
      </div>

      {/* ── Legend bar — trending view only ─────────────────────────────────── */}
      {!showGenre && (
        <div className="flex items-center gap-4 mb-3 px-1">
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest shrink-0">Heat:</span>
          {[
            { color: '#95fe7c', label: 'Hot  66+' },
            { color: '#7ec1fb', label: 'Warm 33+' },
            { color: '#374151', label: 'Cool  0+' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">

        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#0d1321]/80 border-b border-border">
          <span className="w-7 shrink-0" />
          <span className="w-10 shrink-0" />
          <span className="flex-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Song</span>
          {!showGenre && <span className="hidden sm:block w-20 text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right shrink-0">Heat</span>}
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right shrink-0 w-16">Record</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right shrink-0 w-14">
            <Tip text="Total SOL traded by fans backing this song in the selected period">Volume</Tip>
          </span>
        </div>

        {/* Rows */}
        {activeView === 'genre' ? (
          genreGroups.length === 0 ? (
            <EmptyState period={period} />
          ) : (
            <div className="divide-y divide-border/40">
              {genreGroups.map(([genre, song], i) => (
                <div key={genre} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors anim-fade-up"
                  style={{ animationDelay: `${i * 0.05}s` }}>
                  <RankIcon position={i} />
                  {song.artUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={song.artUrl} alt={song.songTitle}
                      className="w-10 h-10 rounded-lg object-cover border border-border/60 shrink-0" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 font-rajdhani font-bold text-base"
                      style={{ backgroundColor: `${letterColor(genre.charAt(0))}18`, borderColor: `${letterColor(genre.charAt(0))}40`, color: letterColor(genre.charAt(0)) }}
                    >
                      {song.songTitle.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {song.musicLink ? (
                      <a href={song.musicLink} target="_blank" rel="noreferrer"
                        className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm truncate flex items-center gap-1 group">
                        <span className="truncate">{song.songTitle}</span>
                        <span className="text-[10px] text-[#7ec1fb] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                      </a>
                    ) : (
                      <p className="font-rajdhani font-bold text-white text-sm truncate">{song.songTitle}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${letterColor(genre.charAt(0))}18`, color: letterColor(genre.charAt(0)), border: `1px solid ${letterColor(genre.charAt(0))}25` }}
                      >
                        {genre}
                      </span>
                      {song.handle && <span className="text-[10px] text-muted-foreground">@{song.handle}</span>}
                    </div>
                  </div>
                  <RecordBadge wins={song.wins} losses={song.losses} />
                  <VolDisplay sol={song.totalVolume} />
                </div>
              ))}
            </div>
          )
        ) : (
          top.length === 0 ? (
            <EmptyState period={period} />
          ) : (
            <div className="divide-y divide-border/40">
              {top.map((song, i) => (
                <SongRow
                  key={song.key}
                  song={song}
                  index={i}
                  maxScore={maxScore}
                  view="trending"
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
        <p className="text-[10px] text-muted-foreground">
          Rankings update as battles settle · Winner = Poll + Charts + DJ Wavy, 2/3 wins
        </p>
        <Link
          href="/leaderboards/songs"
          className="text-xs font-mono text-[#7ec1fb] hover:text-white transition-colors flex items-center gap-1 group"
        >
          Most Played · Most Volume · Most Traders · All Genres
          <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
        </Link>
      </div>

    </section>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ period }: { period: Period }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#7ec1fb]/10 border border-[#7ec1fb]/20 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18V5l12-2v13" stroke="#7ec1fb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="6" cy="18" r="3" stroke="#7ec1fb" strokeWidth="1.5"/>
          <circle cx="18" cy="16" r="3" stroke="#7ec1fb" strokeWidth="1.5"/>
        </svg>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        No quick battles in {PERIOD_META[period].desc.toLowerCase()} yet.
      </p>
      <p className="text-[11px] text-muted-foreground/60 text-center">
        Battles go live every weeknight at 8:30 PM EST
      </p>
    </div>
  )
}
