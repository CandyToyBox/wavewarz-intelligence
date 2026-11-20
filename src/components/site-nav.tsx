'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { MAIN_NAV, STATS_NAV, WATCH, main } from '@/lib/site'

// Same floating pill nav as the redesigned wavewarz.com, plus the Stats section rail underneath.
export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const rail = useRef<HTMLDivElement>(null)

  // keep the current Stats page in view on narrow screens
  useEffect(() => {
    const cur = rail.current?.querySelector('[aria-current="page"]') as HTMLElement | null
    if (cur && rail.current) rail.current.scrollLeft = cur.offsetLeft - 16
  }, [pathname])

  // The artist Playbook is a focused private form with its own header.
  if (pathname.startsWith('/playbook')) return null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <>
      <div className="ww-nav-wrap">
        <nav className="ww-navbar" aria-label="Main">
          <a href={main('/')} aria-label="WaveWarZ home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wavewarz-logo.svg" alt="WaveWarZ" className="ww-logo" width={114} height={50} />
          </a>
          <ul className="ww-links">
            <li>
              <details className="ww-watch">
                <summary>Watch live<span className="ww-chev" aria-hidden="true" /></summary>
                <div className="ww-watch-menu">
                  {WATCH.map(w => <a key={w.href} href={w.href} target="_blank" rel="noopener">{w.label}</a>)}
                  <p>No wallet needed to watch. YouTube is replays only; current livestreams are on X, Kick, and Twitch.</p>
                </div>
              </details>
            </li>
            {MAIN_NAV.map(l => (
              <li key={l.label}>
                {l.stats
                  ? <Link href="/" aria-current={pathname === '/' ? 'page' : 'true'} className="is-section">{l.label}</Link>
                  : <a href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener' } : {})}>{l.label}</a>}
              </li>
            ))}
          </ul>
          <div className="ww-actions">
            <a href={main('/')} className="ww-btn solid" title="Opens wavewarz.com to connect a wallet">Connect wallet</a>
            <button type="button" className="ww-btn ghost ww-menu-btn" aria-expanded={open} aria-controls="ww-menu" onClick={() => setOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
              <span className="sr-only">Menu</span>
            </button>
          </div>
        </nav>
        {open && (
          <div className="ww-menu" id="ww-menu" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false) }}>
            {WATCH.slice(0, 1).map(w => <a key={w.href} href={w.href} target="_blank" rel="noopener">Watch live</a>)}
            {MAIN_NAV.filter(l => !l.stats).map(l => <a key={l.label} href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener' } : {})}>{l.label}</a>)}
          </div>
        )}
      </div>

      <div className="ww-rail-wrap">
        <div className="ww-rail" ref={rail} role="navigation" aria-label="Stats">
          {STATS_NAV.map(l => l.external
            ? <a key={l.href} href={l.href} target="_blank" rel="noopener" className="ww-chip">{l.label}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg></a>
            : <Link key={l.href} href={l.href} className="ww-chip" aria-current={isActive(l.href) ? 'page' : undefined}>{l.label}</Link>)}
        </div>
      </div>
    </>
  )
}
