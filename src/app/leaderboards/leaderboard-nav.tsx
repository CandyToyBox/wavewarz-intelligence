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
  const pathname = usePathname() ?? ''

  // Same pill chips as the Statz rail, so the two rows read as one system
  return (
    <nav className="mb-6" aria-label="Leaderboards">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Link href="/leaderboards" className="ww-chip" aria-current={pathname === '/leaderboards' ? 'page' : undefined}>All boards</Link>
        {TABS.map(tab => (
          <Link key={tab.href} href={tab.href} className="ww-chip" aria-current={pathname.startsWith(tab.href) ? 'page' : undefined}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tab.color }} aria-hidden="true" />
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
