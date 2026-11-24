'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BOARDS } from './boards'

export function LeaderboardNav() {
  const pathname = usePathname() ?? ''

  // Same pill chips as the Statz rail, so the two rows read as one system; the dot is the board's colour
  return (
    <nav className="mb-6" aria-label="Leaderboards">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Link href="/leaderboards" className="ww-chip" aria-current={pathname === '/leaderboards' ? 'page' : undefined}>All boards</Link>
        {BOARDS.map(b => (
          <Link key={b.href} href={b.href} className="ww-chip" aria-current={pathname.startsWith(b.href) ? 'page' : undefined}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: b.accent }} aria-hidden="true" />
            {b.tab}
          </Link>
        ))}
      </div>
    </nav>
  )
}
