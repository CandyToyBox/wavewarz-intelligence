export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ADMIN_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

// Same signed-session gate as /admin (and src/proxy.ts runs before render) — the Hub is an internal tool. Server Actions in
// ./actions.ts re-check the cookie themselves (the layout gate alone doesn't
// protect them once an action ID is known).
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (!(await verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE)?.value))) redirect('/admin/login')

  const links = [
    { href: '/hub', label: 'Library' },
    { href: '/hub/league', label: 'WaveWarZ Archives' },
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
          Identity · History · Story · Content · Sponsorship, with the whole family: WavID, Wave Station, The ZAO and ZAO Festivals.
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
