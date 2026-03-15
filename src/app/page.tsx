import type React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { calculatePlatformRevenue } from '@/lib/wavewarz-math'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/tip'
import Link from 'next/link'

async function getGlobalStats() {
  const supabase = await createClient()

  const { data: battles } = await supabase
    .from('battles')
    .select('total_volume_a, total_volume_b, artist1_pool, artist2_pool, winner_artist_a, is_quick_battle, is_main_battle, is_test_battle, unique_traders')
    .eq('is_test_battle', false)

  if (!battles) return null

  const totalVolume = battles.reduce(
    (sum, b) => sum + (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0),
    0
  )
  const totalLoserPools = battles
    .filter(b => b.winner_artist_a !== null)
    .reduce((sum, b) => {
      const loser = b.winner_artist_a ? (b.artist2_pool ?? 0) : (b.artist1_pool ?? 0)
      return sum + loser
    }, 0)

  const platform = calculatePlatformRevenue(totalVolume, totalLoserPools)
  const totalArtistPayouts = totalVolume * 0.01 + totalLoserPools * 0.07

  return {
    totalVolume,
    totalBattles: battles.length,
    mainEvents: battles.filter(b => b.is_main_battle).length,
    quickBattles: battles.filter(b => b.is_quick_battle).length,
    totalArtistPayouts,
    platformRevenue: platform.totalSol,
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

export default async function HomePage() {
  const [stats, schedule, calendarEvents, spotify, solPrice] = await Promise.all([
    getGlobalStats(),
    getSchedule(),
    getCalendarEvents(),
    getSpotifyStats(),
    getLiveSolPrice(),
  ])

  const hasSpotify = spotify && (spotify.spotify_monthly_streams > 0 || spotify.spotify_total_streams > 0)

  return (
    <div className="space-y-10">

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-5xl font-rajdhani font-bold tracking-tight text-white">
            WaveWarZ <span className="text-[#7ec1fb]">Intelligence</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Back Music, Not Memes. The decentralized arena on Solana.
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

      {/* Stat Cards */}
      {stats && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={<Tip text="Sum of all SOL traded by fans across every battle.">Total Volume</Tip>}
            primary={`${parseFloat(stats.totalVolume.toFixed(2))} SOL`}
            secondary={solToUsd(stats.totalVolume, solPrice)}
            sub={`${stats.totalBattles} battles`}
          />
          <StatCard
            label={<Tip text="Artists earn 1% of all trading volume + settlement bonus. Paid instantly onchain." wide>Artist Payouts</Tip>}
            primary={`${parseFloat(stats.totalArtistPayouts.toFixed(2))} SOL`}
            secondary={solToUsd(stats.totalArtistPayouts, solPrice)}
            sub="Instant · automatic"
            highlight
          />
          <StatCard
            label={<Tip text="Platform earns 0.5% per trade + 3% of losing pool at settlement." wide>Platform Revenue</Tip>}
            primary={`${parseFloat(stats.platformRevenue.toFixed(2))} SOL`}
            secondary={solToUsd(stats.platformRevenue, solPrice)}
            sub="0.5% fees + 3% settlement"
          />
          <StatCard
            label={<Tip text="Main Events are artist vs artist with judges. Quick Battles are song vs song — winner by chart.">Battles</Tip>}
            primary={`${stats.mainEvents} Main`}
            secondary={`${stats.quickBattles} Quick`}
            sub="Test battles excluded"
          />
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
        <h2 className="text-2xl font-rajdhani font-bold text-white mb-4 tracking-wide flex items-center gap-3">
          X Spaces Schedule
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-muted-foreground border border-border">
            𝕏
          </span>
        </h2>
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
    <Card className="bg-card border-border">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-rajdhani font-bold ${highlight ? 'text-[#95fe7c]' : 'text-white'}`}>
          {primary}
        </p>
        {secondary && <p className="text-xs text-muted-foreground mt-0.5">{secondary}</p>}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
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

function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.519-.973c3.632-1.102 8.147-.568 11.234 1.329a.78.78 0 01.257 1.072zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.935.935 0 01-.954 1.608z"/>
    </svg>
  )
}
