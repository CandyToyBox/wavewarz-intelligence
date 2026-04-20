'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/leaderboards/artists',   label: 'Artists',   sub: 'Main Events',   color: '#95fe7c' },
  { href: '/leaderboards/songs',     label: 'Songs',     sub: 'Quick Battles', color: '#7ec1fb' },
  { href: '/leaderboards/community', label: 'Community', sub: 'Community',     color: '#f59e0b' },
  { href: '/leaderboards/traders',   label: 'Traders',   sub: 'All Battles',   color: '#fbbf24' },
  { href: '/leaderboards/clippers',  label: 'Clippers',  sub: 'Clips',         color: '#f97316' },
]

export function LeaderboardNav() {
  const pathname = usePathname()

  return (
    <nav className="mb-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Link
          href="/leaderboards"
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors shrink-0"
        >
          ← All
        </Link>
        <div className="w-px h-4 bg-border shrink-0" />
        <div className="flex items-center gap-1 bg-[#080d18] border border-border/60 rounded-xl p-1 overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'text-[#0d1321]'
                    : 'text-muted-foreground hover:bg-white/[0.06] hover:text-white'
                }`}
                style={isActive ? { backgroundColor: tab.color } : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
