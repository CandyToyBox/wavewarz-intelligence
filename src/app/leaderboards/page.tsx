import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { RANK_ICONS } from '@/components/rank-icons'
import { BOARDS } from './boards'

export const metadata: Metadata = {
  title: 'Leaderboards',
  description: 'Artist, Song, and Community leaderboards for WaveWarZ battles on Solana.',
}

// Hub: five boards as the homepage's chrome-edged panels (.ww-hl-panel look), 3 across then 2 wide
export default function LeaderboardsHub() {
  return (
    <div className="space-y-8">
      <header className="ww-bh" style={{ '--acc': '#95fe7c' } as CSSProperties}>
        <div className="ww-bh-main">
          <p className="ww-bh-k"><i aria-hidden="true" />WaveWarZ Statz</p>
          <h1><span>Leader</span>boards</h1>
          <p className="ww-bh-d">Five ranking boards. Pick one below. All stats derived from onchain data. Test battles and charity events excluded.</p>
        </div>
      </header>

      <div className="ww-boards">
        {BOARDS.map(b => (
          <Link key={b.href} href={b.href} className="ww-board" style={{ '--acc': b.accent } as CSSProperties}>
            <span className="ww-board-top">
              <span className="ww-hl-ico" aria-hidden="true">{RANK_ICONS[b.key]}</span>
              <span className="ww-bh-k"><i aria-hidden="true" />{b.label}</span>
            </span>
            <h2>{b.title[0]} {b.title[1]}</h2>
            <p>{b.desc}</p>
            <ul>
              {b.stats.map(s => <li key={s}>{s}</li>)}
            </ul>
            <span className="ww-board-go">View rankings <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </div>
    </div>
  )
}
