'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'

const NAV_LINKS = [
  { href: '/',             label: 'Overview' },
  { href: '/battles',      label: 'Battles' },
  { href: '/leaderboards', label: 'Leaderboards' },
  { href: '/events',       label: 'Events' },
  { href: '/claim',        label: 'Claim' },
]

export function NavBar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    return href === '/' ? pathname === href : pathname.startsWith(href)
  }

  return (
    <nav className="border-b border-border bg-[#04080f]/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0" onClick={() => setOpen(false)}>
            {/* Wave icon */}
            <svg width="32" height="22" viewBox="0 0 64 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <linearGradient id="navWaveGrad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7ec1fb"/>
                  <stop offset="100%" stopColor="#95fe7c"/>
                </linearGradient>
              </defs>
              <path d="M4 30 C9 18 14 8 19 18 C24 28 29 38 34 28 C39 18 44 8 49 18 C54 28 59 38 60 32"
                stroke="url(#navWaveGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M4 16 C9 6 14 0 19 8 C24 16 29 24 34 14 C39 4 44 0 49 8 C54 16 59 24 60 18"
                stroke="url(#navWaveGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.45"/>
            </svg>
            <div className="flex items-center gap-2">
              <span className="font-rajdhani font-bold text-2xl text-white tracking-wider leading-none">
                WAVE<span className="text-actiongreen">WARZ</span>
              </span>
              <Badge className="bg-actiongreen/20 text-actiongreen border-actiongreen/40 text-[10px] font-bold tracking-widest hidden sm:flex">
                INTELLIGENCE
              </Badge>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-actiongreen/10 text-actiongreen'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {open && (
        <div className="md:hidden border-t border-border bg-[#04080f] px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-actiongreen/10 text-actiongreen'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
