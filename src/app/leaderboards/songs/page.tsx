import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { resolveAudiusTrack } from '@/lib/audius'
import { Badge } from '@/components/ui/badge'
import { WinRateBar } from '@/app/leaderboards/win-rate-bar'
import { Tip } from '@/components/tip'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Song Rankings — WaveWarZ Intelligence',
  description: 'Quick battle song rankings by wins, volume, and win rate.',
}

type RawBattle = {
  artist1_name: string
  artist2_name: string
  artist1_wallet: string
  artist2_wallet: string
  artist1_pool: number
  artist2_pool: number
  total_volume_a: number
  total_volume_b: number
  artist1_music_link: string | null
  artist2_music_link: string | null
  status: string
}

type SongRow = {
  songTitle: string
  artistHandle: string | null
  musicLink: string | null
  wins: number
  losses: number
  totalVolume: number
  battles: number
  winRate: number
  artUrl: string | null
  genre: string | null
}

// Parse artist handle from https://audius.co/{handle}/{slug}
function parseAudiusHandle(url: string | null): string | null {
  if (!url) return null
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[0] ?? null
  } catch {
    return null
  }
}

async function getData() {
  const supabase = await createClient()
  const [res, solPrice] = await Promise.all([
    supabase
      .from('battles')
      .select('artist1_name,artist2_name,artist1_wallet,artist2_wallet,artist1_pool,artist2_pool,total_volume_a,total_volume_b,artist1_music_link,artist2_music_link,status')
      .eq('is_quick_battle', true)
      .eq('is_test_battle', false)
      .neq('status', 'ACTIVE'),
    getLiveSolPrice(),
  ])

  const battles = (res.data ?? []) as RawBattle[]
  const map = new Map<string, SongRow>()

  for (const b of battles) {
    const aWon = (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0)
    const sides = [
      { title: b.artist1_name, musicLink: b.artist1_music_link, won: aWon, volume: b.total_volume_a ?? 0 },
      { title: b.artist2_name, musicLink: b.artist2_music_link, won: !aWon, volume: b.total_volume_b ?? 0 },
    ]
    for (const s of sides) {
      if (!s.title) continue
      const key = s.title.toLowerCase().trim()
      const handle = parseAudiusHandle(s.musicLink)
      const existing = map.get(key) ?? {
        songTitle: s.title,
        artistHandle: handle,
        musicLink: s.musicLink,
        wins: 0, losses: 0,
        totalVolume: 0, battles: 0, winRate: 0,
        artUrl: null,
        genre: null,
      }
      existing.battles++
      existing.totalVolume += s.volume
      if (s.won) existing.wins++; else existing.losses++
      // Keep the first non-null music link we see
      if (!existing.musicLink && s.musicLink) {
        existing.musicLink = s.musicLink
        existing.artistHandle = handle
      }
      map.set(key, existing)
    }
  }

  const rows = Array.from(map.values())
    .map(r => ({ ...r, winRate: r.battles > 0 ? Math.round(r.wins / r.battles * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins || b.totalVolume - a.totalVolume)

  // Resolve Audius artwork + genre for unique music links (parallel, server-side)
  const uniqueLinks = [...new Set(rows.map(r => r.musicLink).filter(Boolean) as string[])]
  const trackMap = new Map<string, { artUrl: string | null; genre: string | null }>()

  await Promise.all(
    uniqueLinks.map(async (link) => {
      const track = await resolveAudiusTrack(link)
      trackMap.set(link, {
        artUrl: track?.artwork?.['480x480'] ?? null,
        genre: track?.genre ?? null,
      })
    })
  )

  for (const row of rows) {
    if (row.musicLink) {
      const info = trackMap.get(row.musicLink)
      if (info) {
        row.artUrl = info.artUrl
        row.genre = info.genre
      }
    }
  }

  return { rows, solPrice }
}

// Deterministic color from song title initial
const PALETTE = ['#95fe7c', '#7ec1fb', '#f59e0b', '#f472b6', '#a78bfa', '#34d399']
function colorForLetter(letter: string) {
  const idx = letter.toUpperCase().charCodeAt(0) % PALETTE.length
  return PALETTE[idx]
}

const RANK_LABEL = ['🥇', '🥈', '🥉']

export default async function SongLeaderboardPage() {
  const { rows, solPrice } = await getData()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leaderboards" className="text-xs text-muted-foreground hover:text-white transition-colors mb-4 inline-block">
          ← All Leaderboards
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
            Song <span className="text-[#7ec1fb]">Rankings</span>
          </h1>
          <Badge className="bg-[#7ec1fb]/20 text-[#7ec1fb] border border-[#7ec1fb]/40 text-[10px] font-bold tracking-widest">
            QUICK BATTLES
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">{rows.length} songs</span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Ranked by wins, then volume. Winner determined by chart dominance — no judges.
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="border-b border-border bg-[#111827]">
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest w-10">#</th>
              <th className="text-left px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">Song</th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Wins and losses in quick battles. Winner is decided by chart dominance — no judges.">Record</Tip>
              </th>
              <th className="text-center px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Percentage of quick battles this song has won.">Win %</Tip>
              </th>
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                <Tip text="Total SOL traded by fans backing this song across all quick battles.">Volume</Tip>
              </th>
              <th className="text-right px-3 sm:px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                <Tip text="Number of quick battles this song has competed in.">Battles</Tip>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const initial = s.songTitle.charAt(0).toUpperCase()
              const color = colorForLetter(initial)
              return (
                <tr key={`${s.songTitle}-${i}`} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 sm:px-4 py-3 text-muted-foreground font-mono text-xs">
                    {i < 3 ? RANK_LABEL[i] : `${i + 1}`}
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Album art or letter avatar */}
                      {s.artUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.artUrl}
                          alt={s.songTitle}
                          className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div
                          className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center text-lg font-rajdhani font-bold"
                          style={{ backgroundColor: `${color}18`, borderColor: `${color}40`, color }}
                        >
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        {s.musicLink ? (
                          <a
                            href={s.musicLink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm sm:text-base leading-tight flex items-center gap-1"
                          >
                            <span className="truncate">{s.songTitle}</span>
                            <span className="text-[10px] text-[#7ec1fb] shrink-0">↗</span>
                          </a>
                        ) : (
                          <p className="font-rajdhani font-bold text-white text-sm sm:text-base leading-tight truncate">{s.songTitle}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {s.artistHandle && (
                            <p className="text-[10px] text-muted-foreground">@{s.artistHandle}</p>
                          )}
                          {s.genre && (
                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#7ec1fb]/10 text-[#7ec1fb] border border-[#7ec1fb]/20">
                              {s.genre}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                    <span className="font-rajdhani font-bold text-[#7ec1fb]">{s.wins}W</span>
                    <span className="text-muted-foreground mx-1">–</span>
                    <span className="font-rajdhani font-bold text-red-400">{s.losses}L</span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                    <WinRateBar rate={s.winRate} color="blue" />
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
                    <p className="font-mono text-xs"><span className="text-[#7ec1fb]">{formatSol(s.totalVolume)}</span> <span className="text-muted-foreground">SOL</span></p>
                    <p className="text-[10px] text-muted-foreground">{solToUsd(s.totalVolume, solPrice)}</p>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right text-muted-foreground text-xs">{s.battles}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No quick battle data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
