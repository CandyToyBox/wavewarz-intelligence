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
  pendingJudging: { battle_id: string }[]
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

      {/* ── KPI ROW ── */}
      <section>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Platform KPIs — Live from DB</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Total SOL Volume" value={`${formatSol(revenue.totalVolume)} SOL`} sub={solToUsd(revenue.totalVolume, solPrice)} />
          <Kpi label="Real Battles" value={revenue.totalNonTest.toLocaleString()} sub="non-test battles" />
          <Kpi label="Total Trades" value={revenue.totalTrades.toLocaleString()} sub="across all battles" />
          <Kpi label="Artist Fees Paid" value="$400+" sub="team-verified" dim />
          <Kpi label="Platform Revenue" value={`${formatSol(revenue.totalRevenue)} SOL`} sub={solToUsd(revenue.totalRevenue, solPrice)} />
          <Kpi label="Artists in Pipeline" value="50+" sub="ready to battle" dim />
        </div>
      </section>

      {/* ── BATTLE BREAKDOWN + RECORDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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

        <Card title="All-Time Volume Records">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left py-2">Record</th>
                <th className="text-right py-2">Value</th>
                <th className="text-right py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5">
                <td className="py-2.5 text-white/80">All-Time Single Night</td>
                <td className="py-2.5 text-right font-rajdhani font-bold text-[#95fe7c]">12.31 SOL</td>
                <td className="py-2.5 text-right text-muted-foreground text-xs">Sep 14, 2025</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2.5 text-white/80">Second Highest Night</td>
                <td className="py-2.5 text-right font-rajdhani font-bold text-[#95fe7c]">11.44 SOL</td>
                <td className="py-2.5 text-right text-muted-foreground text-xs">Jul 27, 2025</td>
              </tr>
              <tr>
                <td className="py-2.5 text-white/80">QB Night Record</td>
                <td className="py-2.5 text-right font-rajdhani font-bold text-[#95fe7c]">9.36 SOL</td>
                <td className="py-2.5 text-right text-muted-foreground text-xs">Mar 13, 2026</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 rounded-lg bg-[#0d1321] p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">YouTube Ramp (March 2026)</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { night: 'Mar 10', sol: '0.67', battles: 10 },
                { night: 'Mar 11', sol: '1.89', battles: 9 },
                { night: 'Mar 12', sol: '5.72', battles: 12 },
                { night: 'Mar 13', sol: '9.36', battles: 14, record: true },
              ].map(n => (
                <div key={n.night} className={`rounded p-2 ${n.record ? 'bg-[#95fe7c]/10 border border-[#95fe7c]/30' : 'bg-[#111827]'}`}>
                  <p className={`font-rajdhani font-bold text-sm ${n.record ? 'text-[#95fe7c]' : 'text-white'}`}>{n.sol}</p>
                  <p className="text-[10px] text-muted-foreground">{n.night}</p>
                  <p className="text-[9px] text-muted-foreground/60">{n.battles} battles</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

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

      {/* ── OPEN WORKSTREAMS ── */}
      <section>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Open Workstreams</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <Card title="Africa Program">
            <ul className="space-y-2.5">
              {[
                'Identify first 5 African artist partners',
                'Onboarding materials (Pidgin, Swahili, Zulu)',
                'Map community hosts per market (NG, ZA, GH, KE)',
                'Schedule first Africa-featured Main Event',
                'Africa announcement — blog + social',
              ].map(item => <CheckItem key={item} label={item} />)}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-3">Target: 10 African artist battles + 5 community battles, first 6 months</p>
          </Card>

          <Card title="Merch Program">
            <ul className="space-y-2.5">
              {[
                'Finalize print-on-demand partner',
                'Design core collection (tee + hoodie + cap)',
                'Set up artist collab drop template',
                'Wire @WaveWarz_Merch_bot to fulfillment API',
                'Set up merch page on wavewarz.com',
              ].map(item => <CheckItem key={item} label={item} />)}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-3">Owner: Candytoybox (design) · BettercallZaal (launch comms)</p>
          </Card>

          <Card title="Automation (Agents)">
            <table className="w-full text-sm">
              <tbody>
                {[
                  { task: 'Post-battle social recap', state: 'Manual → lil_lob', color: 'yellow' },
                  { task: 'Merch drop announcements', state: 'Manual → Merch_bot', color: 'yellow' },
                  { task: 'Battle volume reports', state: 'Manual → LobBET', color: 'yellow' },
                  { task: 'Artist onboarding DMs', state: 'Manual → lil_lob draft', color: 'yellow' },
                  { task: 'Skip queue management', state: 'Platform → LobBET', color: 'yellow' },
                ].map(r => (
                  <tr key={r.task} className="border-b border-white/5 last:border-0">
                    <td className="py-2 text-white/80 text-xs pr-3">{r.task}</td>
                    <td className="py-2">
                      <StatusBadge status={r.state} color="yellow" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      {/* ── COLOSSEUM HACKATHON ── */}
      <Card title="Colosseum Frontier Hackathon — Application Status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0d1321] rounded-lg p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Our Angle</p>
            <p className="text-sm text-white/80 leading-relaxed">
              WaveWarz is already the live game show with ONCHAIN settlement. Option 2: extend with USDC prize mode + Privy embedded wallet for normie accessibility. No Phantom required.
            </p>
          </div>
          <div className="bg-[#0d1321] rounded-lg p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Why We Win</p>
            <p className="text-sm text-white/80 leading-relaxed">
              {revenue.totalNonTest}+ real battles. {formatSol(revenue.totalVolume)} SOL volume. Live YouTube stream M-F. HQ Trivia failed on unit economics — distributing $0.50 to 10K users cost more in PayPal fees than the prizes. We already solved this.
            </p>
          </div>
          <div className="bg-[#0d1321] rounded-lg p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Key Gaps to Close</p>
            <ul className="space-y-1.5 text-sm text-white/80">
              <CheckItem label="USDC prize mode on top of existing battle engine" />
              <CheckItem label="Privy embedded wallet — no Phantom required" />
              <CheckItem label="iOS-first game show UI shell (normie-facing)" />
            </ul>
          </div>
          <div className="bg-[#0d1321] rounded-lg p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Comparables (from Copilot)</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>HQ Trivia — defunct (2020), 8M users, $0 exit. Problem: PayPal fees.</li>
              <li>Robinhood Trivia Live — 400K players, $2M prizes. One-time promo, not a product.</li>
              <li>Trepa (C3 funded) — crowd sentiment staking. Mobile, no music.</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* ── CONTENT PILLARS ── */}
      <Card title="Content Pillars & Cadence">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="text-left py-2">Pillar</th>
              <th className="text-left py-2">What</th>
              <th className="text-left py-2 hidden md:table-cell">When</th>
              <th className="text-left py-2 hidden lg:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody>
            {[
              { pillar: 'Battle Announcements', what: 'Upcoming lineup, artists, trading open time', when: '2-4 hrs before every battle', owner: 'BettercallZaal + lil_lob' },
              { pillar: 'Live Updates', what: 'Volume milestones, chart movement, skip queue', when: 'During every stream', owner: 'BettercallZaal' },
              { pillar: 'Results + Recaps', what: 'Winner, volume, artist earnings, trader wins', when: 'Within 1 hr post-battle', owner: 'lil_lob + BettercallZaal' },
              { pillar: 'Artist Spotlights', what: 'Background, catalog, battle record, earnings', when: 'Weekly (tied to Main Event)', owner: 'Candytoybox' },
              { pillar: 'Education', what: 'Trading mechanics, fee structure, Audius sync', when: '2x per month', owner: 'Candytoybox' },
              { pillar: 'Lore + Milestones', what: 'Records, ZAO-CHELLA refs, volume milestones', when: 'Event-triggered', owner: 'Candytoybox' },
              { pillar: 'Trader Culture', what: 'Win screenshots, trader alpha, skill callouts', when: 'Ongoing', owner: 'BettercallZaal' },
            ].map(r => (
              <tr key={r.pillar} className="border-b border-white/5 last:border-0">
                <td className="py-2.5 text-white font-medium text-xs">{r.pillar}</td>
                <td className="py-2.5 text-muted-foreground text-xs pr-3">{r.what}</td>
                <td className="py-2.5 text-muted-foreground text-xs hidden md:table-cell pr-3">{r.when}</td>
                <td className="py-2.5 text-muted-foreground text-xs hidden lg:table-cell">{r.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── TEAM + AGENTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card title="Team Ownership">
          <div className="space-y-4">
            {[
              {
                handle: 'Hurric4n3IKE', role: 'Founder, Developer, MC',
                owns: ['Smart contract architecture', 'Platform development', 'Live battle hosting (MC)', 'YouTube stream hosting', 'Tech decisions'],
              },
              {
                handle: 'Candytoybox', role: 'Design, Content, Marketing, Promotion',
                owns: ['Brand and visual identity', 'Artist spotlight content', 'Education content', 'Lore and milestone posts', 'Merch design', 'Africa program comms'],
              },
              {
                handle: 'BettercallZaal', role: 'Communications, Community',
                owns: ['Battle announcements', 'Live stream updates', 'Post-battle recaps', 'Artist outreach DMs', 'Discord + community management'],
              },
            ].map(m => (
              <div key={m.handle} className="rounded-lg bg-[#0d1321] p-4">
                <p className="font-rajdhani font-bold text-[#95fe7c] tracking-wide">{m.handle}</p>
                <p className="text-[10px] text-muted-foreground mb-2">{m.role}</p>
                <div className="flex flex-wrap gap-1.5">
                  {m.owns.map(o => (
                    <span key={o} className="text-[10px] bg-white/5 text-white/60 rounded px-2 py-0.5">{o}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Agent Roster (OpenClaw)">
          <div className="space-y-2.5 mb-6">
            {[
              { handle: '@Lil_Lob_bot', role: 'Content generation, knowledge graph, research, lore documentation', status: 'Active', color: 'green' },
              { handle: '@CandyCookz_bot', role: 'Ops, approval workflows, publishing coordination', status: 'Active', color: 'green' },
              { handle: '@WaveWarz_Merch_bot', role: 'Merch shop ops, order processing, drop announcements', status: 'Pending Setup', color: 'yellow' },
              { handle: 'LobBET (lobfather)', role: 'Revenue intelligence, battle economy, skip fee + launch fee tracking', status: 'Wired', color: 'green' },
            ].map(a => (
              <div key={a.handle} className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="font-rajdhani font-bold text-[#95fe7c] text-sm tracking-wide">{a.handle}</p>
                  <p className="text-xs text-muted-foreground">{a.role}</p>
                </div>
                <StatusBadge status={a.status} color={a.color as 'green' | 'yellow'} />
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Clip Pipeline</p>
          <div className="text-xs text-muted-foreground space-y-1.5 bg-[#0d1321] rounded-lg p-3">
            {[
              'Video dropped in HQ Telegram group → bot creates voting card',
              'Net 3+ votes → Gemini captions → pushed to approval channel',
              'Team edits captions → toggles platforms → approves',
              'Postiz schedules: YouTube, X, Instagram, TikTok simultaneously',
            ].map((step, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[#95fe7c] font-bold">{i + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── MILESTONES ── */}
      <Card title="Milestones & Traction Timeline">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="text-left py-2 w-28">Date</th>
              <th className="text-left py-2">Milestone</th>
              <th className="text-left py-2 hidden md:table-cell">Significance</th>
            </tr>
          </thead>
          <tbody>
            {[
              { date: '2024', milestone: 'Art Basel Miami — ZAO-CHELLA Battle Showcase', sig: 'First major IRL event. WaveWarz established as live entertainment brand.' },
              { date: 'Jul 27, 2025', milestone: '11.44 SOL single night (3 battles)', sig: 'Second-highest volume night in platform history.' },
              { date: 'Sep 14, 2025', milestone: '12.31 SOL all-time night record (2 featured battles)', sig: 'All-time volume record. Main Event format drives highest volume.' },
              { date: 'Mar 10, 2026', milestone: 'YouTube Quick Battle stream launch (Night 1: 0.67 SOL)', sig: 'Migration to YouTube. Night 1 baseline.' },
              { date: 'Mar 13, 2026', milestone: '9.36 SOL Quick Battle night record (14 battles)', sig: '4-night ramp: 0.07 avg → 0.66 avg per battle. Platform momentum proven.' },
              { date: 'Apr 2026', milestone: `${revenue.totalNonTest}+ real battles. ${formatSol(revenue.totalVolume)} SOL volume. 50+ artist pipeline.`, sig: 'Current state. Hackathon application active. Africa + merch in development.' },
            ].map(r => (
              <tr key={r.date} className="border-b border-white/5 last:border-0">
                <td className="py-2.5 text-muted-foreground text-xs align-top">{r.date}</td>
                <td className="py-2.5 text-white/80 text-xs font-medium pr-4">{r.milestone}</td>
                <td className="py-2.5 text-muted-foreground text-xs hidden md:table-cell">{r.sig}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── MESSAGING QUICK REF ── */}
      <Card title="Messaging Quick Reference">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="text-left py-2 w-40">Channel</th>
              <th className="text-left py-2">Copy</th>
            </tr>
          </thead>
          <tbody>
            {[
              { ch: 'X (trader)', copy: 'You already know who\'s going to win. Now you can put SOL on it.' },
              { ch: 'X (artist econ)', copy: 'Spotify paid that artist $3 for 1,000 streams. Last night at WaveWarz they earned the equivalent in 6 minutes.' },
              { ch: 'LinkedIn', copy: 'The math on streaming is not fixable inside the streaming model. WaveWarz is a different model entirely.' },
              { ch: 'Instagram / Reels', copy: 'Show the battle. Show the chart moving. Show the payout landing. No narration needed.' },
              { ch: 'Discord', copy: 'The battle is live. Trading opens now. Get your SOL in before the song ends.' },
              { ch: 'Email (artist)', copy: 'Your Audius catalog can earn SOL while you sleep.' },
              { ch: 'Paid (artist)', copy: '1% of every trade on your side goes straight to your wallet. Automatically. While you perform.' },
              { ch: 'Paid (trader)', copy: 'Pick the right artist. Win SOL. 1.5% total fees. No middleman.' },
            ].map(r => (
              <tr key={r.ch} className="border-b border-white/5 last:border-0">
                <td className="py-2.5 text-muted-foreground text-xs align-top pr-4">{r.ch}</td>
                <td className="py-2.5 text-white/80 text-xs">{r.copy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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

function CheckItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-xs text-white/70">
      <span className="mt-0.5 w-3.5 h-3.5 rounded border border-amber-500/60 flex-shrink-0 flex items-center justify-center text-[8px] text-amber-400">
        ○
      </span>
      {label}
    </li>
  )
}
