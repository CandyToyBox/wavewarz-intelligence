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

// Two-colour line icons in the homepage style (green + blue strokes)
const I = ({ children }: { children: ReactNode }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
export const RANK_ICONS = {
  artists: <I><circle cx="11" cy="7" r="3.4" stroke="#95fe7c" /><path d="M4.4 20.8c.8-4.1 3.4-6.2 6.6-6.2s5.8 2.1 6.6 6.2" stroke="#95fe7c" /><path d="M18.6 10.2l.75 1.7 1.85.2-1.4 1.3.4 1.8-1.6-.9-1.6.9.4-1.8-1.4-1.3 1.85-.2z" fill="#7ec1fb" stroke="none" /></I>,
  songs: <I><circle cx="12" cy="12" r="8.8" stroke="#95fe7c" /><circle cx="12" cy="12" r="5.4" stroke="#7ec1fb" strokeWidth="1.4" /><circle cx="12" cy="12" r="1.6" fill="#daecfd" stroke="none" /><path d="M15.8 6a7 7 0 0 1 2.2 2.4" stroke="#daecfd" strokeWidth="1.3" /></I>,
  community: <I><circle cx="8" cy="8" r="3" stroke="#95fe7c" /><circle cx="16.5" cy="9" r="2.5" stroke="#7ec1fb" strokeWidth="1.6" /><path d="M2.8 20c.6-3.6 2.6-5.4 5.2-5.4s4.6 1.8 5.2 5.4" stroke="#95fe7c" /><path d="M14.4 14.6c.7-.3 1.4-.4 2.1-.4 2.2 0 3.9 1.6 4.4 4.8" stroke="#7ec1fb" strokeWidth="1.6" /></I>,
  traders: <I><path d="M3.5 19.5h17" stroke="#7ec1fb" strokeWidth="1.4" /><path d="M4.5 15.5l4.5-4.5 3.5 3 6.5-7" stroke="#95fe7c" /><path d="M15 7h4v4" stroke="#95fe7c" /></I>,
  clippers: <I><rect x="3.4" y="7.2" width="17.2" height="12.4" rx="2.2" stroke="#95fe7c" /><path d="M3.6 7.4l3-3.6M9 7.2l3-3.6M14.4 7.2l3-3.6" stroke="#7ec1fb" strokeWidth="1.5" /><path d="M10.4 11.2v5l4-2.5z" fill="#daecfd" stroke="none" /></I>,
}
