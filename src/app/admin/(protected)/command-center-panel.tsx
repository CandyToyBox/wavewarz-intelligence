import { formatSol } from '@/lib/wavewarz-math'
import { solToUsd } from '@/lib/coingecko'

type RevenueData = {
  totalVolume: number
  totalRevenue: number
  totalBattles: number
  totalNonTest: number
  totalTrades: number
  quickCount: number
  communityCount: number
  mainCount: number
  pendingJudging: { battle_id: number }[]
}

export function CommandCenterPanel({
  revenue,
  solPrice,
}: {
  revenue: RevenueData
  solPrice: number
}) {
  return (
    <div className="space-y-8">

      {/* ── KPI ROW (live from DB) ── */}
      <section>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Platform KPIs — Live from DB</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Total SOL Volume" value={`${formatSol(revenue.totalVolume)} SOL`} sub={solToUsd(revenue.totalVolume, solPrice)} />
          <Kpi label="Real Battles" value={revenue.totalNonTest.toLocaleString()} sub="non-test battles" />
          <Kpi label="Total Trades" value={revenue.totalTrades.toLocaleString()} sub="across all battles" />
          <Kpi label="Platform Revenue" value={`${formatSol(revenue.totalRevenue)} SOL`} sub={solToUsd(revenue.totalRevenue, solPrice)} />
          <Kpi label="Quick Battles" value={revenue.quickCount.toLocaleString()} sub="non-test" />
          <Kpi label="Main / Community" value={`${revenue.mainCount} / ${revenue.communityCount}`} sub="non-test" />
        </div>
      </section>

      {/* ── BATTLE BREAKDOWN (live from DB) ── */}
      <Card title="Battle Category Breakdown">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="text-left py-2">Type</th>
              <th className="text-right py-2">Count</th>
            </tr>
          </thead>
          <tbody>
            <TableRow label="Quick Battles" value={revenue.quickCount.toLocaleString()} green />
            <TableRow label="Main format (Events, Spotlights, Charity)" value={revenue.mainCount.toLocaleString()} />
            <TableRow label="Community" value={revenue.communityCount.toLocaleString()} />
            <TableRow label="Total (non-test)" value={revenue.totalNonTest.toLocaleString()} bold />
          </tbody>
        </table>
      </Card>

      {/* ── LIVE SCHEDULE ── */}
      <Card title="Live Schedule & Platform Status">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ScheduleItem day="Monday — Friday" time="8:30 PM EST" desc="Quick Battles — YouTube Livestream" badge="Active" />
          <ScheduleItem day="Sunday" time="8:00 PM EST" desc="Main Events (stream 8pm, battles 8:30pm)" badge="Active" />
          <ScheduleItem day="Any Day" time="Self-Hosted" desc="Community Battles — 0.017 SOL launch fee" badge="Active" />
          <ScheduleItem day="Go/No-Go Rule" time="≥0.5 SOL avg" desc="First 6 Quick Battles must hit threshold to continue stream" />
        </div>
      </Card>

      {/* ── PLATFORM URLS + SOCIALS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card title="Platform URLs">
          <div className="space-y-2">
            {[
              { label: 'Main Platform', url: 'https://wavewarz.com', display: 'wavewarz.com' },
              { label: 'Analytics (Statz)', url: 'https://statz.wavewarz.info', display: 'statz.wavewarz.info' },
              { label: 'Admin Portal', url: 'https://wavewarz-intelligence.vercel.app/admin', display: 'wavewarz-intelligence.vercel.app/admin' },
              { label: 'Trader Claim Recovery', url: 'https://claim.wavewarz.info', display: 'claim.wavewarz.info' },
              { label: 'Social Scheduling', url: 'https://postiz.wavewarz.info', display: 'postiz.wavewarz.info' },
              { label: 'Clip HQ', url: 'https://wavewarz-clips-hq.vercel.app', display: 'wavewarz-clips-hq.vercel.app' },
            ].map(({ label, url, display }) => (
              <div key={url} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-sm text-white/70">{label}</span>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-[#95fe7c] text-xs font-mono hover:underline">
                  {display}
                </a>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Social Accounts Status">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left py-2">Platform</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Primary Use</th>
              </tr>
            </thead>
            <tbody>
              {[
                { platform: 'YouTube', status: 'Active', color: 'green', use: 'Quick Battle livestreams, M-F 8:30pm' },
                { platform: 'X / Twitter', status: 'TBC', color: 'yellow', use: 'Battle announcements, trader alpha' },
                { platform: 'Instagram', status: 'TBC', color: 'yellow', use: 'Visual brand, battle clips' },
                { platform: 'Discord', status: 'Active', color: 'green', use: 'Community, announcements, support' },
                { platform: 'Telegram', status: 'TBC', color: 'yellow', use: 'Web3 community, trading alerts' },
                { platform: 'TikTok', status: 'Active', color: 'green', use: 'Clips via Postiz' },
              ].map(r => (
                <tr key={r.platform} className="border-b border-white/5 last:border-0">
                  <td className="py-2 text-white/80">{r.platform}</td>
                  <td className="py-2">
                    <StatusBadge status={r.status} color={r.color as 'green' | 'yellow'} />
                  </td>
                  <td className="py-2 text-muted-foreground text-xs">{r.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, dim }: { label: string; value: string; sub: string; dim?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${dim ? 'border-border bg-[#111827]' : 'border-[#95fe7c]/20 bg-gradient-to-b from-[#0d1321] to-[#111827]'}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-rajdhani font-bold text-2xl ${dim ? 'text-white' : 'text-[#95fe7c]'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-[#111827] p-5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4 pb-3 border-b border-border font-rajdhani font-bold text-[#95fe7c]">
        {title}
      </p>
      {children}
    </div>
  )
}

function TableRow({ label, value, green, bold }: { label: string; value: string; green?: boolean; bold?: boolean }) {
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className={`py-2.5 text-xs ${bold ? 'text-white font-bold' : 'text-white/70'}`}>{label}</td>
      <td className={`py-2.5 text-right font-rajdhani font-bold text-sm ${green ? 'text-[#95fe7c]' : bold ? 'text-white' : 'text-white/80'}`}>{value}</td>
    </tr>
  )
}

function ScheduleItem({ day, time, desc, badge }: { day: string; time: string; desc: string; badge?: string }) {
  return (
    <div className="rounded-lg border border-[#95fe7c]/20 bg-[#0d1321] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white mb-1">{day}</p>
      <p className="font-rajdhani font-bold text-xl text-[#95fe7c] mb-1">{time}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
      {badge && (
        <span className="mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded border text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10">
          {badge}
        </span>
      )}
    </div>
  )
}

function StatusBadge({ status, color }: { status: string; color: 'green' | 'yellow' | 'red' | 'muted' }) {
  const styles = {
    green: 'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10',
    yellow: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    red: 'text-red-400 border-red-500/40 bg-red-500/10',
    muted: 'text-muted-foreground border-border bg-white/5',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${styles[color]}`}>
      {status}
    </span>
  )
}
