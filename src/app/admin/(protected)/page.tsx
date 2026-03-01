import { createAdminClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { JudgingPanel } from './judging-panel'
import { ArtistPanel } from './artist-panel'
import { MediaPanel } from './media-panel'
import { CalendarPanel } from './calendar-panel'
import { StatsPanel } from './stats-panel'
import { AdminTabs } from './admin-tabs'

// ─── Launch Fee Constants (Exact — confirmed 2026-02-28) ──────────────────────
const COMMUNITY_BATTLE_FEE = 0.017
const QUICK_BATTLE_LAUNCH_FEE = 0.007
const QUICK_BATTLE_QUEUE_FEE = 0.005

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getRevenueData(supabase: Awaited<ReturnType<typeof createAdminClient>>) {
  const { data: battles } = await supabase
    .from('battles')
    .select('battle_id,created_at,artist1_name,artist2_name,artist1_pool,artist2_pool,total_volume_a,total_volume_b,is_main_battle,is_quick_battle,is_community_battle,is_test_battle,winner_decided,status')
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })

  if (!battles) return null
  const completed = battles.filter(b => b.status !== 'ACTIVE')
  const totalVolume = completed.reduce((s, b) => s + (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0), 0)
  const tradingFeeRevenue = totalVolume * 0.005
  const settlementRevenue = completed
    .filter(b => (b.artist1_pool ?? 0) + (b.artist2_pool ?? 0) > 0)
    .reduce((s, b) => s + Math.min(b.artist1_pool ?? 0, b.artist2_pool ?? 0) * 0.03, 0)
  const quickCount = completed.filter(b => b.is_quick_battle).length
  const communityCount = completed.filter(b => b.is_community_battle).length
  const quickLaunchRevenue = quickCount * (QUICK_BATTLE_LAUNCH_FEE + QUICK_BATTLE_QUEUE_FEE)
  const communityLaunchRevenue = communityCount * COMMUNITY_BATTLE_FEE
  const totalRevenue = tradingFeeRevenue + settlementRevenue + quickLaunchRevenue + communityLaunchRevenue
  const pendingJudging = battles.filter(b => b.is_main_battle && !b.winner_decided && b.status !== 'ACTIVE')

  return {
    totalVolume, tradingFeeRevenue, settlementRevenue,
    quickLaunchRevenue, communityLaunchRevenue, totalRevenue,
    totalBattles: completed.length, quickCount, communityCount,
    mainCount: completed.filter(b => b.is_main_battle).length,
    pendingJudging,
  }
}

async function getMainEventsForJudging(supabase: Awaited<ReturnType<typeof createAdminClient>>) {
  const { data } = await supabase
    .from('battles')
    .select('battle_id,created_at,artist1_name,artist2_name,artist1_pool,artist2_pool,winner_decided,status')
    .eq('is_main_battle', true)
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}

async function getArtistProfiles(supabase: Awaited<ReturnType<typeof createAdminClient>>) {
  const { data: profiles } = await supabase
    .from('artist_profiles')
    .select('artist_id,display_name,primary_wallet,audius_handle,twitter_handle,profile_picture_url,bio,social_links')
    .order('display_name')

  const { data: wallets } = await supabase
    .from('artist_wallets')
    .select('wallet_address,artist_id')

  return (profiles ?? []).map(p => ({
    ...p,
    wallets: (wallets ?? []).filter(w => w.artist_id === p.artist_id),
  }))
}

async function getBattlesForMedia(supabase: Awaited<ReturnType<typeof createAdminClient>>) {
  const { data } = await supabase
    .from('battles')
    .select('battle_id,created_at,artist1_name,artist2_name,is_main_battle,is_quick_battle,is_community_battle,youtube_replay_link,stream_link,image_url')
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })
  return data ?? []
}

async function getCalendarEvents(supabase: Awaited<ReturnType<typeof createAdminClient>>) {
  const { data } = await supabase
    .from('calendar_events')
    .select('id,title,description,event_date,event_time,event_type,location_or_link,is_featured,is_active')
    .order('event_date', { ascending: true })
  return data ?? []
}

async function getPlatformStats(supabase: Awaited<ReturnType<typeof createAdminClient>>) {
  const { data } = await supabase
    .from('platform_stats')
    .select('spotify_monthly_streams,spotify_total_streams,spotify_profile_url')
    .eq('id', 1)
    .single()
  return data ?? { spotify_monthly_streams: 0, spotify_total_streams: 0, spotify_profile_url: null }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const supabase = await createAdminClient()
  const [revenue, mainEvents, artistProfiles, mediaBattles, calendarEvents, platformStats, solPrice] = await Promise.all([
    getRevenueData(supabase),
    getMainEventsForJudging(supabase),
    getArtistProfiles(supabase),
    getBattlesForMedia(supabase),
    getCalendarEvents(supabase),
    getPlatformStats(supabase),
    getLiveSolPrice(),
  ])

  if (!revenue) return <div className="text-muted-foreground p-8">Failed to load admin data.</div>

  return (
    <div className="space-y-8">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
              Admin <span className="text-[#95fe7c]">Portal</span>
            </h1>
            <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold tracking-widest">
              INTERNAL ONLY
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Revenue · Judging · Artists · Media &nbsp;·&nbsp; 1 SOL = {solToUsd(1, solPrice)}
          </p>
        </div>
        <form action="/api/admin/logout" method="POST">
          <button className="text-xs text-muted-foreground hover:text-white transition-colors px-3 py-2 rounded border border-border">
            Sign Out
          </button>
        </form>
      </header>

      {/* ── REVENUE (always visible at top) ── */}
      <section>
        <div className="rounded-2xl border border-[#95fe7c]/30 bg-gradient-to-br from-[#0d1321] via-[#111827] to-[#0d1321] p-6 mb-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Total Platform Revenue (All Time)</p>
              <p className="text-5xl font-rajdhani font-bold text-[#95fe7c]">{formatSol(revenue.totalRevenue)} SOL</p>
              <p className="text-lg text-muted-foreground mt-1">{solToUsd(revenue.totalRevenue, solPrice)}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground space-y-1">
              <p>{revenue.totalBattles} battles counted</p>
              <p>{revenue.mainCount} main · {revenue.quickCount} quick · {revenue.communityCount} community</p>
              {revenue.pendingJudging.length > 0 && (
                <p className="text-amber-400 font-bold text-xs">{revenue.pendingJudging.length} main events pending judging</p>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <RevenueCard label="Trading Fees" value={`${formatSol(revenue.tradingFeeRevenue)} SOL`} usd={solToUsd(revenue.tradingFeeRevenue, solPrice)} detail={`0.5% × ${formatSol(revenue.totalVolume)} SOL`} color="green" />
          <RevenueCard label="Settlement Bonuses" value={`${formatSol(revenue.settlementRevenue)} SOL`} usd={solToUsd(revenue.settlementRevenue, solPrice)} detail="3% of each loser pool" color="green" />
          <RevenueCard label="Quick Battle Fees" value={`${formatSol(revenue.quickLaunchRevenue)} SOL`} usd={solToUsd(revenue.quickLaunchRevenue, solPrice)} detail={`${revenue.quickCount} × 0.012 SOL`} color="blue" />
          <RevenueCard label="Community Fees" value={`${formatSol(revenue.communityLaunchRevenue)} SOL`} usd={solToUsd(revenue.communityLaunchRevenue, solPrice)} detail={`${revenue.communityCount} × 0.017 SOL`} color="blue" />
        </div>
        <div className="rounded-xl border border-border bg-[#111827] p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Fee Rate Reference</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <FeeRef label="Trading Fee (Platform)" value="0.5% per trade" />
            <FeeRef label="Settlement Bonus" value="3% of loser pool" />
            <FeeRef label="Quick Battle Launch" value="0.007 SOL" />
            <FeeRef label="Add to Queue" value="0.005 SOL" />
            <FeeRef label="Community Launch" value="0.017 SOL" />
          </div>
        </div>
      </section>

      {/* ── TABBED SECTIONS ── */}
      <AdminTabs
        judgingPanel={<JudgingPanel battles={mainEvents} />}
        artistPanel={<ArtistPanel artists={artistProfiles} />}
        mediaPanel={<MediaPanel battles={mediaBattles} />}
        eventsPanel={<CalendarPanel events={calendarEvents} />}
        statsPanel={<StatsPanel stats={platformStats} />}
        pendingCount={revenue.pendingJudging.length}
        artistCount={artistProfiles.length}
        eventCount={calendarEvents.length}
      />

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function RevenueCard({ label, value, usd, detail, color }: {
  label: string; value: string; usd: string; detail: string; color: 'green' | 'blue'
}) {
  const val = color === 'green' ? 'text-[#95fe7c]' : 'text-[#7ec1fb]'
  const border = color === 'green' ? 'border-[#95fe7c]/20' : 'border-[#7ec1fb]/20'
  return (
    <div className={`rounded-xl border bg-[#111827] p-4 ${border}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-xl font-rajdhani font-bold ${val}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{usd}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-2 border-t border-border pt-2">{detail}</p>
    </div>
  )
}

function FeeRef({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d1321] rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="font-mono text-white font-bold text-xs">{value}</p>
    </div>
  )
}
