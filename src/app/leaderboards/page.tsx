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
    desc: 'Main event competitors ranked by wins, volume, and onchain earnings. Profile pictures included.',
    stats: ['Win / Loss record', 'Total SOL volume', 'Artist earnings (fees + settlement)', 'Win rate %'],
  },
  {
    href: '/leaderboards/songs',
    badge: 'QUICK BATTLES',
    badgeColor: 'bg-[#7ec1fb]/20 text-[#7ec1fb] border-[#7ec1fb]/40',
    borderColor: 'border-[#7ec1fb]/20 hover:border-[#7ec1fb]/50',
    accentColor: 'text-[#7ec1fb]',
    number: '02',
    title: 'Song Rankings',
    desc: 'Tracks ranked by quick battle performance. Album art pulled from Audius. Winner determined by chart dominance.',
    stats: ['Win / Loss record', 'Total SOL volume', 'Win rate %', 'Audius link'],
  },
  {
    href: '/leaderboards/community',
    badge: 'COMMUNITY',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    borderColor: 'border-amber-500/20 hover:border-amber-500/50',
    accentColor: 'text-amber-400',
    number: '03',
    title: 'Community Rankings',
    desc: 'Community battle competitors and sides ranked by outcomes. Battle artwork displayed per entry.',
    stats: ['Win / Loss record', 'Total SOL volume', 'Win rate %', 'Battle count'],
  },
]

export default function LeaderboardsHub() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-5xl font-rajdhani font-bold tracking-tight text-white">
          WaveWarZ <span className="text-[#95fe7c]">Leaderboards</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Rankings derived from onchain pool values. Test battles and charity events excluded.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {BOARDS.map(b => (
          <Link
            key={b.href}
            href={b.href}
            className={`group rounded-xl border ${b.borderColor} bg-[#111827] p-6 flex flex-col transition-colors`}
          >
            <div className="flex items-start justify-between mb-4">
              <span className={`text-4xl font-rajdhani font-bold opacity-20 ${b.accentColor}`}>{b.number}</span>
              <Badge className={`${b.badgeColor} border text-[10px] font-bold tracking-widest`}>{b.badge}</Badge>
            </div>
            <h2 className={`text-2xl font-rajdhani font-bold text-white group-hover:${b.accentColor} transition-colors mb-2 tracking-wide`}>
              {b.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{b.desc}</p>
            <ul className="space-y-1 mb-5">
              {b.stats.map(s => (
                <li key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`w-1 h-1 rounded-full ${b.accentColor} bg-current shrink-0`} />
                  {s}
                </li>
              ))}
            </ul>
            <span className={`text-sm font-rajdhani font-bold ${b.accentColor} group-hover:underline`}>
              View Rankings →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
