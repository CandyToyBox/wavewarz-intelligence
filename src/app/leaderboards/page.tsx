import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboards — WaveWarZ Intelligence',
  description: 'Artist, Song, and Community leaderboards for WaveWarZ battles on Solana.',
}

const BOARDS = [
  {
    href: '/leaderboards/artists',
    badge: 'MAIN EVENTS',
    badgeColor: 'bg-[#95fe7c]/20 text-[#95fe7c] border-[#95fe7c]/40',
    borderColor: 'border-[#95fe7c]/20 hover:border-[#95fe7c]/50',
    accentColor: 'text-[#95fe7c]',
    number: '01',
    title: 'Artist Rankings',
    desc: 'Main event competitors ranked by wins, volume, and onchain earnings.',
    stats: ['Win / Loss record by Main Event', 'Total SOL traded by fans', 'Artist earnings: 1% fees + settlement bonus', 'Win rate %'],
  },
  {
    href: '/leaderboards/songs',
    badge: 'QUICK BATTLES',
    badgeColor: 'bg-[#7ec1fb]/20 text-[#7ec1fb] border-[#7ec1fb]/40',
    borderColor: 'border-[#7ec1fb]/20 hover:border-[#7ec1fb]/50',
    accentColor: 'text-[#7ec1fb]',
    number: '02',
    title: 'Song Charts',
    desc: 'Tracks ranked by quick battle performance. Album art from Audius. Winner: 2-of-3 (Poll + Charts + DJ Wavy AI Judge).',
    stats: ['Trending score: velocity × recency × engagement', 'Win / Loss record', 'Total SOL volume', 'Battle count & unique traders'],
  },
  {
    href: '/leaderboards/community',
    badge: 'COMMUNITY',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    borderColor: 'border-amber-500/20 hover:border-amber-500/50',
    accentColor: 'text-amber-400',
    number: '03',
    title: 'Community Rankings',
    desc: 'Community battle competitors ranked by wins and trading volume. Battle artwork shown per entry.',
    stats: ['Win / Loss record', 'Total SOL traded', 'Win rate %', 'Battle count'],
  },
  {
    href: '/leaderboards/traders',
    badge: 'TRADERS',
    badgeColor: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40',
    borderColor: 'border-[#f59e0b]/20 hover:border-[#f59e0b]/50',
    accentColor: 'text-[#f59e0b]',
    number: '04',
    title: 'Trader Rankings',
    desc: 'Fans and speculators ranked by trading volume, win rate, and net P&L. Click any wallet to scan onchain.',
    stats: ['Total SOL traded across all battles', 'Battle win rate', 'Net P&L (payout − invested)', 'Live onchain scan per wallet'],
  },
  {
    href: '/leaderboards/clippers',
    badge: 'COMMUNITY CLIPS',
    badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    borderColor: 'border-orange-500/20 hover:border-orange-500/50',
    accentColor: 'text-orange-400',
    number: '05',
    title: 'Clipper Rankings',
    desc: 'Community contributors ranked by clip submissions, approvals, and points. Many are also active battle artists.',
    stats: ['Clips submitted → approved → posted', 'Points earned', 'Battle record (if they compete)', 'SOL wallet for future rewards'],
  },
]

export default function LeaderboardsHub() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">WaveWarZ Intelligence</p>
        <h1 className="text-5xl font-rajdhani font-bold tracking-tight text-white">
          <span className="text-[#95fe7c]">Leader</span>boards
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg">
          Five ranking boards — choose one below. All stats derived from onchain data. Test battles and charity events excluded.
        </p>
      </header>

      {/* Quick nav strip */}
      <div className="flex flex-wrap gap-2">
        {BOARDS.map(b => (
          <Link
            key={b.href}
            href={b.href}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${b.borderColor} text-xs font-mono uppercase tracking-widest transition-all hover:scale-[1.02]`}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${b.accentColor} shrink-0`} />
            <span className={b.accentColor}>{b.number}</span>
            <span className="text-white">{b.title}</span>
            <Badge className={`${b.badgeColor} border text-[9px] font-bold tracking-widest ml-1 hidden sm:inline-flex`}>{b.badge}</Badge>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {BOARDS.map(b => (
          <Link
            key={b.href}
            href={b.href}
            className={`group rounded-xl border ${b.borderColor} bg-card p-5 flex flex-col transition-all hover:scale-[1.01]`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`text-4xl font-rajdhani font-bold opacity-25 ${b.accentColor} leading-none`}>{b.number}</span>
              <Badge className={`${b.badgeColor} border text-[9px] font-bold tracking-widest`}>{b.badge}</Badge>
            </div>
            <h2 className={`text-xl font-rajdhani font-bold text-white mb-1.5 tracking-wide group-hover:${b.accentColor} transition-colors`}>
              {b.title}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{b.desc}</p>
            <ul className="space-y-1 mb-4">
              {b.stats.map(s => (
                <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className={`w-1 h-1 rounded-full mt-1.5 ${b.accentColor} bg-current shrink-0`} />
                  {s}
                </li>
              ))}
            </ul>
            <span className={`text-xs font-rajdhani font-bold ${b.accentColor} group-hover:underline`}>
              View Rankings →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
