import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { ArtistTable } from './artist-table'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import { BoardHead } from '@/app/leaderboards/board-head'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Artist Rankings',
  description: 'Main event artist rankings by wins, volume, and onchain earnings.',
}

export default async function ArtistLeaderboardPage() {
  const { rows: clientRows } = await getArtistLeaderboard()

  return (
    <div className="space-y-6">
      <LeaderboardNav />

      <BoardHead k="artists">
        Ranked by Main Event wins. Each event is 2-of-3 or 3-of-5 rounds; a round goes to whoever takes 2 of 3: Human Judge, X Poll, SOL Vote. Charity and spotlight events excluded.
      </BoardHead>

      <ArtistTable rows={clientRows} />
    </div>
  )
}
