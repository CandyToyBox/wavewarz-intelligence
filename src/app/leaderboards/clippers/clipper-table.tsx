'use client'

import { useState } from 'react'
import { RankPanel, RankRow, RankEmpty, RankSearch, RANK_ICONS } from '@/components/rank-list'

export type ClipperRowClient = {
  telegramId: number
  displayName: string
  pfpUrl: string | null
  points: number
  clipsSubmitted: number
  clipsApproved: number
  clipsPosted: number
  totalUpvotes: number
  approvalRate: string    // e.g. "67%"
  isArtist: boolean
  artistName: string | null
  solWallet: string | null
  totalBattles: number
  battlesWon: number
  battleWinRate: number
  mainBattles: number
  mainWins: number
}

export function ClipperTable({ rows }: { rows: ClipperRowClient[] }) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r => r.displayName.toLowerCase().includes(q) || (r.artistName ?? '').toLowerCase().includes(q) || (r.solWallet ?? '').toLowerCase().includes(q))
    : rows

  return (
    <div>
      <RankSearch value={search} onChange={setSearch} placeholder="Search by name or wallet" count={`${filtered.length}${q ? ` of ${rows.length}` : ''} contributors`} />
      <RankPanel icon={RANK_ICONS.clippers} title="Top clippers" sub="Community clips · most points">
        {filtered.map((r, i) => {
          const who = r.isArtist && r.artistName ? `Artist · ${r.artistName}` : r.solWallet ? `${r.solWallet.slice(0, 4)}…${r.solWallet.slice(-4)}` : 'No wallet linked'
          const record = r.isArtist && r.totalBattles > 0 ? ` · ${r.battlesWon}W ${r.totalBattles - r.battlesWon}L` : ''
          return (
            <RankRow
              key={r.telegramId}
              rank={i + 1}
              art={r.pfpUrl}
              href={`/contributor/${r.telegramId}`}
              title={r.displayName}
              sub={`${who}${record}`}
              extras={[
                { k: 'Sent · OK · Posted', v: `${r.clipsSubmitted} · ${r.clipsApproved} · ${r.clipsPosted}` },
                { k: 'Approved', v: r.approvalRate },
              ]}
              stat={r.points.toLocaleString('en-US')}
              small="Points"
            />
          )
        })}
        {filtered.length === 0 && <RankEmpty>{q ? `No contributors match "${search}"` : 'No clip submissions yet.'}</RankEmpty>}
      </RankPanel>
      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
        Points: +1 per clip sent, +5 approved, +10 posted, +1 per upvote. Clips go from sent to approved by the team to posted on socials.
        Contributors marked Artist also battle on WaveWarZ.
      </p>
    </div>
  )
}
