import type React from 'react'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { platformMetrics, claimTotals, isBattleLive, type MetricsBattle } from '@/lib/battle-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/tip'
import Link from 'next/link'
import { resolveAudiusTrack } from '@/lib/audius'
import QBChartsPreview from '@/app/qb-charts-preview'
import type { SongData, SongBattle } from '@/app/leaderboards/songs/SongChartsClient'
import { pinnedEvent } from '@/config/pinned-event'
import { LiveArena, type LiveArenaData } from '@/components/live-arena'

async function getGlobalStats() {
  const supabase = await createClient()

  // fetchAll paginates past PostgREST's 1000-row cap so totals count every battle.
  const battles = await fetchAll<MetricsBattle & { unique_traders: number | null }>((from, to) => supabase
    .from('battles')
    .select('total_volume_a, total_volume_b, artist1_pool, artist2_pool, artist1_wallet, artist2_wallet, winner_artist_a, winner_decided, is_quick_battle, is_community_battle, is_main_battle, is_test_battle, event_subtype, created_at, unique_traders')
    .eq('is_test_battle', false)
    .range(from, to))

  if (!battles.length) return null

  // Single source of truth — identical to the admin Command Center.
  const m = platformMetrics(battles)

  // Real trader withdrawals (claimShares), backfilled from chain — separate metric
  // from trading volume. See scripts/backfill-claims-from-chain.ts.
  const claims = await fetchAll<{ amount_sol: number | null }>((from, to) => supabase
    .from('trades')
    .select('amount_sol')
    .eq('trade_type', 'claim')
    .range(from, to))
  const c = claimTotals(claims)

  return {
    totalVolume: m.totalVolume,
    totalBattles: battles.length,
    mainEvents: m.mainEvents,
    mainBattles: m.mainBattles,
    quickBattles: m.quickCount,
    totalArtistPayouts: m.artistPayouts,
    totalClaimed: c.totalClaimed,
    claimCount: c.claimCount,
  }
}

async function getSchedule() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('platform_events')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    return data ?? []
  } catch { return [] }
}

async function getCalendarEvents() {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('is_active', true)
      .gte('event_date', today)
      .order('event_date')
      .limit(6)
    return data ?? []
  } catch { return [] }
}

async function getSpotifyStats() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('platform_stats')
      .select('spotify_monthly_streams, spotify_total_streams, spotify_profile_url')
      .eq('id', 1)
      .single()
    return data ?? null
  } catch { return null }
}

function parseAudiusHandle(url: string | null): string | null {
  if (!url) return null
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[0] ?? null
  } catch { return null }
}

async function getQuickBattleData(): Promise<SongData[]> {
  try {
    const supabase = await createClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data } = await supabase
      .from('battles')
      .select('battle_id,artist1_name,artist2_name,artist1_pool,artist2_pool,total_volume_a,total_volume_b,artist1_music_link,artist2_music_link,battle_duration,created_at,unique_traders,winner_decided,winner_artist_a')
      .eq('is_quick_battle', true)
      .eq('is_test_battle', false)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })

    // Liveness filtered in JS via isBattleLive() (timer math), not a SQL status
    // filter -- status text is inconsistently cased across historical rows,
    // which silently dropped genuinely-ended battles from this preview.
    const battles = (data ?? []).filter(b => !isBattleLive(b))
    const map = new Map<string, SongData>()

    for (const b of battles) {
      const aWon = (b.winner_decided && b.winner_artist_a != null)
        ? Number(b.winner_artist_a) === 1
        : (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0)
      const durationSeconds = b.battle_duration ?? 0
      const uniqueTraders   = b.unique_traders ?? 0

      const sides = [
        { title: b.artist1_name, musicLink: b.artist1_music_link, pool1: b.artist1_pool ?? 0, pool2: b.artist2_pool ?? 0, volume1: b.total_volume_a ?? 0, won: aWon },
        { title: b.artist2_name, musicLink: b.artist2_music_link, pool1: b.artist2_pool ?? 0, pool2: b.artist1_pool ?? 0, volume1: b.total_volume_b ?? 0, won: !aWon },
      ]

      for (const s of sides) {
        if (!s.title) continue
        const key = s.title.toLowerCase().trim()
        const handle = parseAudiusHandle(s.musicLink)
        if (!map.has(key)) {
          map.set(key, { key, songTitle: s.title, musicLink: s.musicLink, handle, artUrl: null, genre: null, artistName: null, battles: [] })
        }
        const entry = map.get(key)!
        if (!entry.musicLink && s.musicLink) { entry.musicLink = s.musicLink; entry.handle = handle }
        const battle: SongBattle = { battleId: b.battle_id, pool1: s.pool1, pool2: s.pool2, volume1: s.volume1, durationSeconds, createdAt: b.created_at, uniqueTraders, won: s.won }
        entry.battles.push(battle)
      }
    }

    const songs = Array.from(map.values())
    const uniqueLinks = [...new Set(songs.map(s => s.musicLink).filter(Boolean) as string[])]
    const trackMap = new Map<string, { artUrl: string | null; genre: string | null; artistName: string | null }>()
    await Promise.all(uniqueLinks.map(async (link) => {
      const track = await resolveAudiusTrack(link)
      trackMap.set(link, { artUrl: track?.artwork?.['480x480'] ?? null, genre: track?.genre ?? null, artistName: track?.user?.name ?? null })
    }))
    for (const song of songs) {
      if (song.musicLink) {
        const info = trackMap.get(song.musicLink)
        if (info) { song.artUrl = info.artUrl; song.genre = info.genre; song.artistName = info.artistName }
      }
    }
    return songs
  } catch { return [] }
}

// "The Arena" — Design System v1 signature component, wired to the real live battle.
// https://claude.ai/code/artifact/e9ef036f-61d2-4785-be94-1e1bd421af26
// WaveWarZ runs one battle at a time, so the single most recent battle is the only
// live candidate (same rule as the public stats API's liveBattle field).
async function getLiveArena(totalBattles: number): Promise<LiveArenaData | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('battles')
      .select('battle_id, artist1_name, artist2_name, artist1_pool, artist2_pool, artist1_music_link, artist2_music_link, battle_duration, created_at, is_quick_battle, is_main_battle, is_community_battle')
      .eq('is_test_battle', false)
      .order('created_at', { ascending: false })
      .limit(1)

    const candidate = data?.[0]
    if (!candidate || !isBattleLive(candidate)) return null

    const [track1, track2] = await Promise.all([
      candidate.artist1_music_link ? resolveAudiusTrack(candidate.artist1_music_link) : null,
      candidate.artist2_music_link ? resolveAudiusTrack(candidate.artist2_music_link) : null,
    ])

    return {
      battleId: candidate.battle_id,
      type: candidate.is_quick_battle ? 'quick' : candidate.is_community_battle ? 'community' : 'main',
      side1: {
        name: candidate.artist1_name ?? 'Side A',
        handle: parseAudiusHandle(candidate.artist1_music_link),
        artUrl: track1?.artwork?.['480x480'] ?? null,
        poolSol: candidate.artist1_pool ?? 0,
        // Only Quick Battles play song1 then song2 sequentially -- Main/Community
        // events don't, so leave duration undefined and the arena falls back to
        // its old static "side1 is playing" display for those.
        durationSec: candidate.is_quick_battle ? (track1?.duration ?? null) : null,
      },
      side2: {
        name: candidate.artist2_name ?? 'Side B',
        handle: parseAudiusHandle(candidate.artist2_music_link),
        artUrl: track2?.artwork?.['480x480'] ?? null,
        poolSol: candidate.artist2_pool ?? 0,
        durationSec: candidate.is_quick_battle ? (track2?.duration ?? null) : null,
      },
      startedAt: candidate.created_at,
      endsAt: new Date(new Date(candidate.created_at).getTime() + (candidate.battle_duration ?? 0) * 1000).toISOString(),
      settledCount: totalBattles,
    }
  } catch {
    return null
  }
}

export default async function HomePage() {
  const [stats, schedule, calendarEvents, spotify, solPrice, qbSongs] = await Promise.all([
    getGlobalStats(),
    getSchedule(),
    getCalendarEvents(),
    getSpotifyStats(),
    getLiveSolPrice(),
    getQuickBattleData(),
  ])
  const liveArena = stats ? await getLiveArena(stats.totalBattles) : null

  const hasSpotify = spotify && (spotify.spotify_monthly_streams > 0 || spotify.spotify_total_streams > 0)

  return (
    <div className="space-y-10">

      {liveArena && <LiveArena data={liveArena} />}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-5xl font-rajdhani font-bold tracking-tight text-white">
            WaveWarZ <span className="text-[#7ec1fb]">Intelligence</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-lg tracking-wide">
            Every battle. Every number. <span className="text-white font-bold">ONCHAIN</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-mono">
            1 SOL = {solToUsd(1, solPrice)}
          </span>
          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 px-4 py-1 text-[10px] font-bold tracking-widest animate-pulse">
            LIVE
          </Badge>
        </div>
      </header>

      {/* What Is WaveWarZ */}
      <section className="rounded-2xl border border-[#7ec1fb]/20 bg-[#7ec1fb]/5 p-6 md:p-8 space-y-4">
        <h2 className="text-3xl font-rajdhani font-bold text-white">What Is WaveWarZ?</h2>
        <p className="text-gray-300 leading-relaxed max-w-3xl">
          WaveWarZ is a decentralized music battle platform built on Solana. Artists go head-to-head in timed battles while fans trade ephemeral tokens on who they think will win. Every trade is denominated in SOL — no platform token, no middleman. Artists earn automatically from trading volume the moment a battle settles. It&apos;s part trading arena, part concert, part community — and it&apos;s all onchain.
        </p>
        <p className="text-gray-400 leading-relaxed max-w-3xl text-sm">
          We built WaveWarZ because music deserves a real economy. Streams pay fractions of a cent. WaveWarZ lets fans put real money behind the artists they believe in — and lets artists earn directly from that conviction, instantly, every time.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <a href="https://wavewarz.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-[#95fe7c] hover:bg-[#7de86a] text-black text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">
            Enter the Arena ↗
          </a>
          <a href="https://www.youtube.com/@wavewarz" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">
            Watch on YouTube ↗
          </a>
          <a href="https://solscan.io/account/9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 border border-[#7ec1fb]/30 hover:border-[#7ec1fb] text-[#7ec1fb] text-sm font-bold px-5 py-2.5 rounded-lg transition-colors font-mono">
            View Program on Solscan ↗
          </a>
        </div>
      </section>

      {/* What You'll Find Here */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">What&apos;s On This Site</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon="🏆"
            title="Leaderboards"
            desc="Artist and song rankings by volume, wins, and battle count. See who&apos;s dominating the arena."
            href="/leaderboards"
          />
          <FeatureCard
            icon="🎬"
            title="WaveWarZ Clippers"
            desc="Community members submit battle highlights. Approved clips go out on YouTube, X, and TikTok. Submit your clip and earn points."
            href="https://t.me/wavewarzclipshq"
            external
          />
          <FeatureCard
            icon="🎙"
            title="X Spaces — Daily"
            desc="Join us live Mon–Fri at 8:30 PM EST for the Quick Battle Livestream. Trade the charts in real-time while the music plays."
            href="https://x.com/wavewarz"
            external
          />
          <FeatureCard
            icon="📺"
            title="YouTube Livestream"
            desc="Quick Battles stream live on YouTube every weeknight at 8:30 PM EST. Two songs battle it out — fans vote and trade in real-time."
            href="https://www.youtube.com/@wavewarz"
            external
          />
          <FeatureCard
            icon="📅"
            title="Events Calendar"
            desc="Upcoming battles, X Spaces, community events, and tournaments — all in one place."
            href="/events"
          />
          <FeatureCard
            icon="📊"
            title="Battle Analytics"
            desc="Verified onchain stats for every battle. Volume, pools, trader counts, and payout breakdowns — all sourced directly from Solana."
            href="/battles"
          />
        </div>
      </section>

      {/* Pinned event — mirrors the pinned post on @wavewarz (see src/config/pinned-event.ts) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live Tournament</h2>
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#95fe7c] border border-[#95fe7c]/30 px-2 py-0.5 rounded">
            {pinnedEvent.badge}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Bracket animation / pinned flyer */}
          <a href={pinnedEvent.href} target="_blank" rel="noreferrer"
            className="rounded-2xl border border-[#7ec1fb]/30 overflow-hidden block bg-black">
            {pinnedEvent.mediaType === 'video' ? (
              <video
                src={pinnedEvent.src}
                poster={pinnedEvent.poster}
                autoPlay muted loop playsInline
                className="w-full h-full object-cover"
                aria-label={`${pinnedEvent.title} bracket animation`}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={pinnedEvent.src} alt={`${pinnedEvent.title} flyer`} className="w-full h-full object-cover" />
            )}
          </a>

          {/* AI Artist Tournament */}
          <div className="rounded-2xl border border-[#7ec1fb]/30 bg-[#7ec1fb]/5 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ec1fb] mb-1">Single-Elimination Bracket</p>
                <h3 className="text-2xl font-rajdhani font-bold text-white">{pinnedEvent.title}</h3>
              </div>
              <span className="text-3xl">🤖</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {pinnedEvent.subtitle}
            </p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Semifinal result: GEEK MYTH def. LUI 2–1 — 342 SOL, biggest event ever</li>
              <li>• Round 3 alone traded 159 SOL — 4x any full event before it</li>
              <li>• Grand Final: GEEK MYTH vs Stormbourne, then the Stella Estrella gauntlet</li>
              <li>• Every round is a real onchain battle — trade it live</li>
            </ul>
            <a href={pinnedEvent.href} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#7ec1fb] hover:bg-[#5aaae8] text-black text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">
              {pinnedEvent.cta} ↗
            </a>
          </div>

        </div>
      </section>

      {/* Stat Cards */}
      {stats && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Platform Stats</h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground font-mono">All time · test battles excluded</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={<Tip text="Total SOL from all buys and sells across every battle, all time. Test battles excluded.">Total Volume</Tip>}
              primary={`${parseFloat(stats.totalVolume.toFixed(2))} SOL`}
              secondary={solToUsd(stats.totalVolume, solPrice)}
              sub={`${stats.totalBattles} battles`}
            />
            <StatCard
              label={<Tip text="Real SOL withdrawn by traders via claimShares — the actual settlement payout, parsed from onchain vault transactions. Distinct from trading volume." wide>Total Claimed</Tip>}
              primary={`${parseFloat(stats.totalClaimed.toFixed(2))} SOL`}
              secondary={solToUsd(stats.totalClaimed, solPrice)}
              sub={`${stats.claimCount} withdrawals`}
            />
            <StatCard
              label={<Tip text="1% of trading volume per side, paid per trade. At settlement: winning artist gets 5% of loser pool, losing artist gets 2%. All automatic, instant, onchain." wide>Artist Payouts</Tip>}
              primary={`${parseFloat(stats.totalArtistPayouts.toFixed(2))} SOL`}
              secondary={solToUsd(stats.totalArtistPayouts, solPrice)}
              sub="Instant · automatic"
              highlight
            />
            <StatCard
              label={<Tip text="A Main Event is multiple battles (catalog vs catalog, ~2 songs per artist per round). Quick Battles are individual song vs song." wide>Battle Types</Tip>}
              primary={`${stats.mainEvents} events · ${stats.mainBattles} battles`}
              secondary={`${stats.quickBattles} Quick`}
              sub="main events · battles · quick songs"
            />
          </div>
        </section>
      )}

      {/* Spotify Streams */}
      {hasSpotify && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide">Spotify Streams</h2>
            <a
              href={spotify.spotify_profile_url ?? 'https://open.spotify.com'}
              target="_blank" rel="noreferrer"
              className="text-[10px] text-[#1DB954] border border-[#1DB954]/30 px-2 py-0.5 rounded hover:bg-[#1DB954]/10 transition-colors"
            >
              Open Spotify ↗
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {spotify.spotify_monthly_streams > 0 && (
              <div className="rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <SpotifyIcon />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1DB954]">Monthly Listeners</p>
                </div>
                <p className="font-rajdhani font-bold text-3xl text-white">
                  {spotify.spotify_monthly_streams.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Across all WaveWarZ artists</p>
              </div>
            )}
            {spotify.spotify_total_streams > 0 && (
              <div className="rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <SpotifyIcon />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1DB954]">Total Streams</p>
                </div>
                <p className="font-rajdhani font-bold text-3xl text-white">
                  {spotify.spotify_total_streams.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">All-time platform total</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* X Spaces Schedule */}
      <section>
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide flex items-center gap-3">
              Live Schedule
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-muted-foreground border border-border">𝕏</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Join us live — trade the charts in real-time or drop in for community AMA</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedule.length > 0 ? schedule.map((evt: {
            id: number; title: string; description: string
            day_of_week: string; time_est: string; event_type: string; platform_link: string
          }) => (
            <ScheduleCard
              key={evt.id}
              title={evt.title}
              time={`${evt.day_of_week} · ${evt.time_est} EST`}
              desc={evt.description}
              href={evt.platform_link}
              titleColor={evt.event_type === 'X_SPACE' && evt.id % 2 === 1 ? 'text-[#95fe7c]' : 'text-[#7ec1fb]'}
            />
          )) : (
            <>
              <ScheduleCard
                title="Live Quick Battle Trading"
                time="Mon–Fri · 8:30 PM EST"
                desc="Join us on X Spaces to trade the charts live. Watch the 30-second final windows play out in real-time."
                href="https://x.com/wavewarz"
                titleColor="text-[#95fe7c]"
              />
              <ScheduleCard
                title="Community AMA & Feedback"
                time="Mon–Fri · 11:00 AM EST"
                desc="Talk directly with the founders, give feedback, and help shape the platform's future."
                href="https://x.com/wavewarz"
                titleColor="text-[#7ec1fb]"
              />
            </>
          )}
        </div>
      </section>

      {/* Trader Claim Disclaimer */}
      <section className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-yellow-300 mb-1">Traders: Your winnings are NOT automatic</p>
          <p className="text-xs text-yellow-300/80">
            Artist payouts are instant and onchain. Trader winnings must be manually claimed after each battle.
          </p>
        </div>
        <Link
          href="/claim"
          className="shrink-0 inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
        >
          Claim Winnings ↗
        </Link>
      </section>

      {/* Quick Battle Charts Preview */}
      {qbSongs.length > 0 && (
        <section>
          <QBChartsPreview songs={qbSongs} />
        </section>
      )}

      {/* Events Calendar */}
      {calendarEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide">Upcoming Events</h2>
            <Link href="/events" className="text-xs text-[#7ec1fb] hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {calendarEvents.map((evt: {
              id: string; title: string; description: string | null
              event_date: string; event_time: string | null; event_type: string
              location_or_link: string | null; is_featured: boolean; flyer_url: string | null
            }) => {
              const typeConfig: Record<string, { color: string; label: string }> = {
                BATTLE:    { color: '#95fe7c', label: 'Battle' },
                SPACES:    { color: '#7ec1fb', label: 'X Spaces' },
                COMMUNITY: { color: '#f59e0b', label: 'Community' },
                OTHER:     { color: '#989898', label: 'Event' },
              }
              const cfg = typeConfig[evt.event_type] ?? typeConfig.OTHER
              const dateObj = new Date(evt.event_date + 'T12:00:00')
              const dateFmt = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <div
                  key={evt.id}
                  className={`rounded-xl border overflow-hidden ${evt.is_featured ? 'border-[#95fe7c]/30 bg-[#95fe7c]/5' : 'border-border bg-card'}`}
                >
                  {/* Battle flyer — shown when uploaded */}
                  {evt.flyer_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={evt.flyer_url}
                      alt={`${evt.title} flyer`}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
                        style={{ color: cfg.color, borderColor: `${cfg.color}30`, backgroundColor: `${cfg.color}10` }}>
                        {cfg.label}
                      </span>
                      {evt.is_featured && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#95fe7c]">Featured</span>
                      )}
                    </div>
                    <p className="font-rajdhani font-bold text-white text-base leading-tight mb-1">{evt.title}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mb-2">
                      {dateFmt}{evt.event_time ? ` · ${evt.event_time}` : ''}
                    </p>
                    {evt.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{evt.description}</p>
                    )}
                    {evt.location_or_link && (
                      evt.location_or_link.startsWith('http') ? (
                        <a href={evt.location_or_link} target="_blank" rel="noreferrer"
                          className="text-[10px] text-[#7ec1fb] hover:underline">
                          Join / Details ↗
                        </a>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">{evt.location_or_link}</p>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, primary, secondary, sub, highlight = false,
}: {
  label: React.ReactNode; primary: string; secondary?: string; sub?: string; highlight?: boolean
}) {
  return (
    <Card className={`bg-card border-border anim-fade-up ${highlight ? 'glow-pulse-green' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Primary value — SOL amount */}
        <p className={`text-2xl font-rajdhani font-bold leading-tight ${highlight ? 'text-[#95fe7c]' : 'text-white'}`}>
          {primary}
        </p>
        {/* Secondary — USD equivalent or sub-label */}
        {secondary && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground">{secondary}</span>
          </div>
        )}
        {/* Sub-label */}
        {sub && (
          <p className="text-[10px] text-muted-foreground/70 mt-2 pt-2 border-t border-border font-mono">
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ScheduleCard({
  title, time, desc, href, titleColor,
}: {
  title: string; time: string; desc: string; href: string; titleColor: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block p-6 border border-border bg-card rounded-xl hover:border-[#7ec1fb] transition-colors group"
    >
      <h3 className={`text-lg font-bold font-rajdhani mb-1 ${titleColor}`}>{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{time}</p>
      <p className="text-sm text-gray-300 mb-4">{desc}</p>
      <span className="text-sm font-bold text-[#7ec1fb] group-hover:underline">
        Join X Space →
      </span>
    </a>
  )
}

function FeatureCard({
  icon, title, desc, href, external = false,
}: {
  icon: string; title: string; desc: string; href: string; external?: boolean
}) {
  const inner = (
    <div className="h-full p-5 rounded-xl border border-border bg-card hover:border-[#7ec1fb]/40 transition-colors group space-y-2">
      <div className="text-2xl">{icon}</div>
      <h3 className="font-rajdhani font-bold text-white text-base group-hover:text-[#7ec1fb] transition-colors">{title}</h3>
      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
    </div>
  )
  if (external) {
    return <a href={href} target="_blank" rel="noreferrer" className="block h-full">{inner}</a>
  }
  return <Link href={href} className="block h-full">{inner}</Link>
}

function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.519-.973c3.632-1.102 8.147-.568 11.234 1.329a.78.78 0 01.257 1.072zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.935.935 0 01-.954 1.608z"/>
    </svg>
  )
}
