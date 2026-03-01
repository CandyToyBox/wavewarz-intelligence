import type React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { calculatePlatformRevenue } from '@/lib/wavewarz-math'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/tip'

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
  // Artist payouts: 1% trading fee + 5% winner bonus + 2% loser bonus
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
  const supabase = await createClient()
  const { data } = await supabase
    .from('platform_events')
    .select('*')
    .eq('is_active', true)
    .order('id')
  return data ?? []
}

export default async function HomePage() {
  const [stats, schedule, solPrice] = await Promise.all([
    getGlobalStats(),
    getSchedule(),
    getLiveSolPrice(),
  ])

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
            label={<Tip text="Sum of all SOL traded by fans across every battle. Does not include fees deducted by the protocol.">Total Volume</Tip>}
            primary={`${parseFloat(stats.totalVolume.toFixed(2))} SOL`}
            secondary={solToUsd(stats.totalVolume, solPrice)}
            sub={`${stats.totalBattles} battles`}
          />
          <StatCard
            label={<Tip text="Artists earn 1% of all trading volume on their side, plus a settlement bonus (5% of loser pool for winners, 2% for losers). Paid instantly onchain — no withdrawal needed." wide>Artist Payouts</Tip>}
            primary={`${parseFloat(stats.totalArtistPayouts.toFixed(2))} SOL`}
            secondary={solToUsd(stats.totalArtistPayouts, solPrice)}
            sub="Instant · automatic"
            highlight
          />
          <StatCard
            label={<Tip text="Platform earns 0.5% of all trading volume per trade, plus 3% of the losing pool at settlement." wide>Platform Revenue</Tip>}
            primary={`${parseFloat(stats.platformRevenue.toFixed(2))} SOL`}
            secondary={solToUsd(stats.platformRevenue, solPrice)}
            sub="0.5% fees + 3% settlement"
          />
          <StatCard
            label={<Tip text="Main Events are artist vs artist battles with judges. Quick Battles are song vs song — winner decided by trading charts only.">Battles</Tip>}
            primary={`${stats.mainEvents} Main`}
            secondary={`${stats.quickBattles} Quick`}
            sub="Test battles excluded"
          />
        </section>
      )}

      {/* Schedule */}
      <section>
        <h2 className="text-2xl font-rajdhani font-bold text-white mb-4 tracking-wide">
          Live Broadcast Schedule
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedule.length > 0 ? schedule.map((evt: {
            id: number; title: string; description: string;
            day_of_week: string; time_est: string; event_type: string; platform_link: string
          }) => (
            <a
              key={evt.id}
              href={evt.platform_link}
              target="_blank"
              rel="noreferrer"
              className="block p-6 border border-border bg-card rounded-xl hover:border-[#7ec1fb] transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className={`text-lg font-bold font-rajdhani ${evt.event_type === 'LIVE_TRADING' ? 'text-[#95fe7c]' : 'text-[#7ec1fb]'}`}>
                  {evt.title}
                </h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                  {evt.day_of_week} · {evt.time_est} EST
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{evt.description}</p>
              <span className="text-sm font-bold text-[#7ec1fb] group-hover:underline">
                Join X Space →
              </span>
            </a>
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
        <a
          href="https://claim.wavewarz.info"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
        >
          Claim Winnings ↗
        </a>
      </section>

    </div>
  )
}

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
