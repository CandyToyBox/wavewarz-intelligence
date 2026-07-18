import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { Badge } from '@/components/ui/badge'
import { ArtistTable } from './artist-table'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Artist Rankings — WaveWarZ Intelligence',
  description: 'Main event artist rankings by wins, volume, and onchain earnings.',
}

export default async function ArtistLeaderboardPage() {
  const { rows: clientRows } = await getArtistLeaderboard()

  return (
    <div className="space-y-6">
      <LeaderboardNav />

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
            Artist <span className="text-[#95fe7c]">Rankings</span>
          </h1>
          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest">
            MAIN EVENTS
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">{clientRows.length} artists</span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Ranked by Main Event wins. Each event = 2-of-3 or 3-of-5 rounds — round winner = Human Judge + X Poll + SOL Vote (2-of-3). Charity & spotlight events excluded.
        </p>
      </div>

      <ArtistTable rows={clientRows} />
    </div>
  )
}
