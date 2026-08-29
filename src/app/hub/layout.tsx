export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

// Same cookie gate as /admin — the Hub is an internal tool. Server Actions in
// ./actions.ts re-check the cookie themselves (the layout gate alone doesn't
// protect them once an action ID is known).
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const cookie = hdrs.get('cookie') ?? ''
  if (!cookie.includes('admin_authed=1')) redirect('/admin/login')

  const links = [
    { href: '/hub', label: 'Library' },
    { href: '/hub/league', label: 'League Bible' },
    { href: '/hub/artists', label: 'Artists' },
    { href: '/hub/events', label: 'Events' },
    { href: '/hub/storylines', label: 'Storylines' },
    { href: '/hub/sponsors', label: 'Sponsor Inventory' },
  ]

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-4">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-rajdhani font-bold text-white tracking-tight">
            League <span className="text-[#95fe7c]">Hub</span>
          </h1>
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold tracking-widest">
            INTERNAL ONLY
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Identity · History · Story · Content · Sponsorship — the WaveWarZ entertainment operating system.
        </p>
        <nav className="flex flex-wrap gap-1 mt-3">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  )
}
