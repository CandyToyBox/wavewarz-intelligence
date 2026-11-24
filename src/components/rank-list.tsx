'use client'

// Leaderboard panels and rows, ported from the redesigned wavewarz.com homepage ("Top artists" / "Top songs":
// .hl-panel, .hl-row, .hl-art in wavewarz-homepage-candy-work/index.html). CSS lives in site-shell.css (.ww-hl-*).
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { CdCase } from '@/components/cd-case'

export function RankPanel({ icon, title, sub, aside, tools, children }: { icon: ReactNode; title: string; sub?: string; aside?: ReactNode; tools?: ReactNode; children?: ReactNode }) {
  return (
    <section className="ww-hl-panel">
      <header className="ww-hl-ph">
        <span className="ww-hl-ico" aria-hidden="true">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {aside}
      </header>
      {tools}
      {children && <ol className="ww-hl-list">{children}</ol>}
    </section>
  )
}

function Pic({ src }: { src: string | null | undefined }) {
  const [bad, setBad] = useState(false)
  // empty <b> shows the music-note placeholder (same as the homepage)
  return src && !bad
    // eslint-disable-next-line @next/next/no-img-element
    ? <b><img src={src} alt="" loading="lazy" onError={() => setBad(true)} /></b>
    : <b />
}

export type RankExtra = { k: string; v: ReactNode }

export function RankRow({ rank, art, cover, pair, title, sub, extras, stat, small, href, external }: {
  rank: number
  art?: string | null
  /** draw the art as a CD jewel case (songs) instead of the round chrome avatar (people) */
  cover?: boolean
  pair?: [string | null, string | null]
  title: ReactNode
  sub?: ReactNode
  extras?: RankExtra[]
  stat: ReactNode
  small: string
  href?: string
  external?: boolean
}) {
  const body = (
    <>
      <span className="ww-hl-rk">{rank}</span>
      {cover
        ? <span className="ww-hl-art cd"><CdCase src={art} /></span>
        : pair
        ? <span className="ww-hl-art pair" aria-hidden="true"><i><Pic src={pair[0]} /></i><i><Pic src={pair[1]} /></i></span>
        : <span className="ww-hl-art" aria-hidden="true"><Pic src={art} /></span>}
      <span className="ww-hl-tx">
        <span className="ww-hl-t">{title}</span>
        {sub && <span className="ww-hl-s">{sub}</span>}
      </span>
      <span className="ww-hl-x">
        {extras?.map(e => <span key={e.k}><b>{e.v}</b><small>{e.k}</small></span>)}
      </span>
      <span className="ww-hl-st">{stat}<small>{small}</small></span>
    </>
  )
  return (
    <li>
      {href
        ? external
          ? <a className="ww-hl-row" href={href} target="_blank" rel="noopener noreferrer">{body}</a>
          : <Link className="ww-hl-row" href={href}>{body}</Link>
        : <div className="ww-hl-row">{body}</div>}
    </li>
  )
}

export function RankEmpty({ children }: { children: ReactNode }) {
  return <li className="ww-hl-empty">{children}</li>
}

export function RankSearch({ value, onChange, placeholder, count }: { value: string; onChange: (v: string) => void; placeholder: string; count: string }) {
  return (
    <div className="ww-hl-search">
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off" spellCheck={false} />
      <span>{count}</span>
    </div>
  )
}

// Icons live in rank-icons.tsx (no 'use client') so server pages can render them too.
export { RANK_ICONS } from './rank-icons'
