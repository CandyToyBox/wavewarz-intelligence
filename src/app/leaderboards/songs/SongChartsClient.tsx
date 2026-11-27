'use client'

import { useState, useMemo } from 'react'
import { RankPanel, RankRow, RankEmpty, RANK_ICONS } from '@/components/rank-list'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import { OutboundLink } from '@/components/outbound-link'

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
  v1Wins: number   // charts-only era wins
  v2Wins: number   // Poll + Charts + DJ Wavy era wins
  totalBattles: number
  winRate: number
  totalVolume: number
  totalUniqueTraders: number
  trendingScore: number
  lastPlayed: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = { today: 'Today', week: 'This week', month: 'This month', all: 'All time' }
// Plain names that say what the list is sorted by; the hint is the button's tooltip and screen-reader description.
const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'trending', label: 'Trending', hint: 'Songs with the most action lately: trading, close battles and traders' },
  { key: 'played', label: 'Most battles', hint: 'Songs that played the most Quick Battles' },
  { key: 'volume', label: 'Most SOL traded', hint: 'Songs with the most SOL traded on them' },
  { key: 'traders', label: 'Most traders', hint: 'Songs the most different people traded on' },
  { key: 'genre', label: 'By genre', hint: 'Top songs in each genre' },
]
const PAGE_SIZE = 25

// V2 winner system: Poll + Charts (SOL) + DJ Wavy AI Judge (2/3 wins)
// V1 was charts-only. Cutoff: March 10, 2026 YouTube livestream launch.
const V2_QB_LAUNCH = new Date('2026-03-10T00:00:00')
const isV2Battle = (b: SongBattle) => new Date(b.createdAt) >= V2_QB_LAUNCH

// ── Trending score formula ───────────────────────────────────────────────────
// score = velocity × competitiveness × recency_decay × engagement_boost
// Higher = hotter. Sums across all of a song's battles in the period.
//
// Recency decay is skipped for the "all" period: with a ~24h half-life,
// battles older than a few days round to ~0 contribution, so applying it
// across a song's entire history just reduces "All Time" to "last couple
// days" and buries songs with real all-time volume/records behind whatever
// battled most recently.

function battleTrendingScore(b: SongBattle, period: Period): number {
  const totalSol    = b.pool1 + b.pool2
  const durationMin = Math.max(b.durationSeconds / 60, 1)
  const velocity    = totalSol / durationMin

  const totalPool        = b.pool1 + b.pool2
  const competitiveness  = totalPool > 0
    ? 1 + (1 - Math.abs(b.pool1 - b.pool2) / totalPool) * 0.5
    : 1

  let recency = 1
  if (period !== 'all') {
    const hoursOld = (Date.now() - new Date(b.createdAt).getTime()) / 3_600_000
    recency = 1 / Math.pow(1 + hoursOld / 24, 1.5)
  }

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
  const v1Wins  = fb.filter(b => b.won && !isV2Battle(b)).length
  const v2Wins  = fb.filter(b => b.won && isV2Battle(b)).length
  const volume  = fb.reduce((s, b) => s + b.volume1, 0)
  const traders = fb.reduce((s, b) => s + b.uniqueTraders, 0)
  const score   = fb.reduce((s, b) => s + battleTrendingScore(b, period), 0)
  // battles already sorted newest-first from server
  const lastPlayed = fb[0]?.createdAt ?? null
  return {
    ...song,
    wins, losses, v1Wins, v2Wins,
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

const SUBTITLE: Record<Exclude<Category, 'genre'>, string> = {
  trending: 'trending',
  volume: 'most SOL traded',
  traders: 'most traders',
  played: 'most battles',
}

// ── Main chart table ─────────────────────────────────────────────────────────

function songRow(song: RankedSong, rank: number, category: Category, maxScore: number) {
  const heat = relativeHeat(song.trendingScore, maxScore)
  const sub = [song.handle ? `@${song.handle}` : null, song.genre, `last played ${timeAgo(song.lastPlayed)}`].filter(Boolean).join(' · ')
  const record = { k: 'Record', v: `${song.wins}W ${song.losses}L` }
  const traded = { k: 'Traded', v: `${formatSolShort(song.totalVolume)} SOL` }
  const [stat, small, extras] =
    category === 'volume' ? [`${formatSolShort(song.totalVolume)} SOL`, 'Traded', [record]]
    : category === 'traders' ? [song.totalUniqueTraders.toLocaleString('en-US'), 'Traders', [record, traded]]
    : category === 'played' ? [`${song.totalBattles}`, song.totalBattles === 1 ? 'Battle' : 'Battles', [record, traded]]
    : category === 'genre' ? [`${song.wins}W ${song.losses}L`, 'Record', [traded]]
    : [`${song.wins} ${song.wins === 1 ? 'win' : 'wins'}`, `${Math.round(song.winRate)}% win rate`, [{ k: 'Heat', v: String(heat) }, traded]]
  return (
    <RankRow key={song.key} rank={rank} art={song.artUrl} cover href={song.musicLink ?? undefined} external
      title={song.songTitle} sub={sub} extras={extras} stat={stat} small={small} />
  )
}

function ChartTable({ songs, category, period, maxScore, page, onPageChange, controls }: {
  songs: RankedSong[]
  category: Exclude<Category, 'genre'>
  period: Period
  maxScore: number
  page: number
  onPageChange: (p: number) => void
  controls: React.ReactNode
}) {
  const totalPages = Math.max(1, Math.ceil(songs.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const pageSongs = songs.slice(start, start + PAGE_SIZE)
  const count = `${songs.length.toLocaleString('en-US')} ${songs.length === 1 ? 'song' : 'songs'} · ${PERIOD_LABELS[period].toLowerCase()} · ${SUBTITLE[category]}`

  return (
    <div className="space-y-3">
      <RankPanel icon={RANK_ICONS.songs} title="Top songs" sub={count} tools={controls}>
        {pageSongs.map((song, i) => songRow(song, start + i + 1, category, maxScore))}
        {pageSongs.length === 0 && <RankEmpty>No Quick Battles {period === 'today' ? 'today' : `in ${PERIOD_LABELS[period].toLowerCase()}`} yet. Try a longer time.</RankEmpty>}
      </RankPanel>

      {totalPages > 1 && (
        <nav className="ww-pager" aria-label="Pages">
          <button type="button" className="ww-chip" onClick={() => onPageChange(page - 1)} disabled={page === 1}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" className="ww-chip" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>Next</button>
        </nav>
      )}
    </div>
  )
}

// ── Genre view: one panel per genre, top five songs each ────────────────────

function GenreView({ songs, controls }: { songs: RankedSong[]; controls: React.ReactNode }) {
  const grouped = useMemo(() => {
    const map = new Map<string, RankedSong[]>()
    for (const s of songs) {
      const g = s.genre ?? 'Other'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(s)
    }
    for (const [, arr] of map) arr.sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume)
    return [...map.entries()].sort((a, b) => b[1].reduce((s, x) => s + x.totalVolume, 0) - a[1].reduce((s, x) => s + x.totalVolume, 0))
  }, [songs])

  return (
    <div className="space-y-5">
      <RankPanel icon={RANK_ICONS.songs} title="Top songs by genre" sub={`${grouped.length} ${grouped.length === 1 ? 'genre' : 'genres'} · genre comes from Audius`} tools={controls}>
        {grouped.length === 0 && <RankEmpty>No songs with a genre in this time yet. Try a longer time.</RankEmpty>}
      </RankPanel>
      {grouped.map(([genre, list]) => (
        <RankPanel key={genre} icon={RANK_ICONS.songs} title={genre}
          sub={`${list.length} ${list.length === 1 ? 'song' : 'songs'} · ${formatSolShort(list.reduce((s, x) => s + x.totalVolume, 0))} SOL traded`}>
          {list.slice(0, 5).map((song, i) => songRow(song, i + 1, 'genre', 0))}
        </RankPanel>
      ))}
    </div>
  )
}

// ── How songs win (closed by default) ───────────────────────────────────────

function HowItWorks() {
  return (
    <details className="ww-explain">
      <summary>How songs win, and what the numbers mean</summary>
      <div>
        <p><b>Who wins a Quick Battle.</b> Since March 10, 2026 a song needs 2 of 3: the live listener poll, the charts (the bigger SOL pool) and DJ Wavy&apos;s verdict. Before that date the bigger pool alone decided it. Older records count the same way they were called at the time.</p>
        <p><b>Trending and Heat.</b> Trending ranks songs by recent action: SOL traded per minute, how close the battle was, how many people traded, and how recent it was. Heat is that score next to the top song in the list, which is 100.</p>
        <p><b>Traded.</b> SOL traded on the song across its battles. Every trade pays the artist 1%.</p>
        <p className="ww-explain-cta">
          Want DJ Wavy&apos;s take on your own track?{' '}
          <OutboundLink href="https://www.wavewarz.com/audius/search" target="_blank" rel="noreferrer">Get a DJ Wavy Breakdown</OutboundLink>
        </p>
      </div>
    </details>
  )
}

// ── Root client component ─────────────────────────────────────────────────────

export default function SongChartsClient({ songs }: { songs: SongData[] }) {
  const [period,   setPeriod]   = useState<Period>('week')
  const [category, setCategory] = useState<Category>('trending')
  const [page,     setPage]     = useState(1)


  const { rankedSongs, maxScore } = useMemo(() => {
    const aggregated = songs
      .map(s => aggregateSong(s, period))
      .filter((s): s is RankedSong => s !== null)
    let sorted: RankedSong[]
    switch (category) {
      case 'played':  sorted = [...aggregated].sort((a, b) => b.totalBattles   - a.totalBattles); break
      case 'volume':  sorted = [...aggregated].sort((a, b) => b.totalVolume    - a.totalVolume);  break
      case 'traders': sorted = [...aggregated].sort((a, b) => b.totalUniqueTraders - a.totalUniqueTraders); break
      case 'genre':   sorted = [...aggregated].sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume); break
      default:        sorted = [...aggregated].sort((a, b) => b.trendingScore  - a.trendingScore)
    }
    return { rankedSongs: sorted, maxScore: sorted[0]?.trendingScore ?? 0 }
  }, [songs, period, category])

  // One row of controls, inside the panel it changes: what to rank by, and over what time.
  const controls = (
    <div className="ww-sortbar">
      <div className="ww-seg" role="group" aria-label="Rank songs by">
        {CATEGORIES.map(c => (
          <button key={c.key} type="button" aria-pressed={category === c.key} title={c.hint} onClick={() => { setCategory(c.key); setPage(1) }}>{c.label}</button>
        ))}
      </div>
      <label className="ww-when">
        <span className="sr-only">Time</span>
        <select value={period} onChange={e => { setPeriod(e.target.value as Period); setPage(1) }}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
        </select>
      </label>
    </div>
  )

  return (
    <div className="space-y-6">
      <LeaderboardNav />

      <header>
        <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">Song <span className="text-[#7ec1fb]">Charts</span></h1>
        <p className="text-muted-foreground text-sm mt-1">Every song that has played a Quick Battle. Tap a song to listen on Audius.</p>
      </header>

      {category === 'genre'
        ? <GenreView songs={rankedSongs} controls={controls} />
        : <ChartTable songs={rankedSongs} category={category} period={period} maxScore={maxScore} page={page} onPageChange={setPage} controls={controls} />}

      <HowItWorks />
    </div>
  )
}
