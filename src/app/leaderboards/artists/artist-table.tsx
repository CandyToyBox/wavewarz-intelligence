'use client'

import { useState } from 'react'
import { RankPanel, RankRow, RankEmpty, RankSearch, RANK_ICONS } from '@/components/rank-list'

export type ArtistRowClient = {
  wallet: string
  name: string
  wins: number
  losses: number
  draws: number
  totalVolumeSol: string
  totalVolumeUsd: string
  totalEarningsSol: string
  totalEarningsUsd: string
  winRate: number
  battles: number
  pfpUrl: string | null
  twitterHandle: string | null
}

export function ArtistTable({ rows }: { rows: ArtistRowClient[] }) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q ? rows.filter(r => r.name.toLowerCase().includes(q) || r.wallet.toLowerCase().includes(q)) : rows

  return (
    <div>
      <RankSearch value={search} onChange={setSearch} placeholder="Search by name or wallet" count={`${filtered.length}${q ? ` of ${rows.length}` : ''} artists`} />
      <RankPanel icon={RANK_ICONS.artists} title="Top artists" sub="Main Events · most wins">
        {filtered.map((a, i) => {
          const pic = a.pfpUrl ?? (a.twitterHandle ? `https://unavatar.io/twitter/${a.twitterHandle}` : null)
          const record = `${a.wins}W ${a.losses}L${a.draws > 0 ? ` ${a.draws}D` : ''}`
          return (
            <RankRow
              key={a.wallet}
              rank={i + 1}
              art={pic}
              href={`/artist/${a.wallet}`}
              title={a.name}
              sub={`${record} · ${a.winRate}% win rate · ${a.battles} ${a.battles === 1 ? 'event' : 'events'}`}
              extras={[{ k: 'Traded', v: `${a.totalVolumeSol} SOL` }]}
              stat={`${a.totalEarningsSol} SOL`}
              small="Earned"
            />
          )
        })}
        {filtered.length === 0 && <RankEmpty>{q ? `No artists match "${search}"` : 'No Main Event data yet.'}</RankEmpty>}
      </RankPanel>
      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
        Earned = 1% of trading on the artist plus the settlement share (5% of the losing pool if they won, 2% if they lost), paid onchain.
        Record counts each Main Event once, not each round.
      </p>
    </div>
  )
}
