import { createClient } from '@/lib/supabase/server'
import { ClipperTable, type ClipperRowClient } from './clipper-table'
import { LeaderboardNav } from '@/app/leaderboards/leaderboard-nav'
import { BoardHead } from '@/app/leaderboards/board-head'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clipper Rankings',
  description: 'Community clip contributors ranked by submissions, approvals, and points. Many are also WaveWarZ battle artists.',
}

async function getData() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clipper_profiles')
    .select('*')
    .order('points', { ascending: false })

  if (error || !data) return { rows: [] }

  const rows: ClipperRowClient[] = data.map(r => {
    const submitted  = (r.clips_submitted as number) ?? 0
    const approved   = (r.clips_approved as number) ?? 0
    const posted     = (r.clips_posted as number) ?? 0
    const battles    = (r.total_battles as number) ?? 0
    const won        = (r.battles_won as number) ?? 0
    const battleWinRate = battles > 0 ? Math.round(won / battles * 100) : 0
    const approvalRate  = submitted > 0 ? `${Math.round(approved / submitted * 100)}%` : '—'

    // Display name: prefer artist_name (if they battle) → telegram_name
    const displayName =
      (r.is_artist && r.artist_name ? r.artist_name as string : null) ??
      (r.telegram_name as string) ??
      `User ${r.telegram_id}`

    return {
      telegramId:     r.telegram_id as number,
      displayName,
      pfpUrl:         (r.profile_picture_url as string | null) ?? null,
      points:         (r.points as number) ?? 0,
      clipsSubmitted: submitted,
      clipsApproved:  approved,
      clipsPosted:    posted,
      totalUpvotes:   (r.total_upvotes as number) ?? 0,
      approvalRate,
      isArtist:       Boolean(r.is_artist),
      artistName:     (r.artist_name as string | null) ?? null,
      solWallet:      (r.sol_wallet as string | null) ?? null,
      totalBattles:   battles,
      battlesWon:     won,
      battleWinRate,
      mainBattles:    (r.main_battles as number) ?? 0,
      mainWins:       (r.main_wins as number) ?? 0,
    }
  })

  return { rows }
}

export default async function ClipperLeaderboardPage() {
  const { rows } = await getData()

  const artistCount   = rows.filter(r => r.isArtist).length
  const totalPosted   = rows.reduce((s, r) => s + r.clipsPosted, 0)
  const totalSubmitted = rows.reduce((s, r) => s + r.clipsSubmitted, 0)

  return (
    <div className="space-y-6">

      <LeaderboardNav />

      <BoardHead k="clippers">
        Ranked by points. Contributors earn points for every clip submitted, approved, and posted.
        {artistCount > 0 && (artistCount === 1 ? ` 1 contributor is also an active WaveWarZ battle artist.` : ` ${artistCount} contributors are also active WaveWarZ battle artists.`)}
      </BoardHead>

      {/* Quick stats */}
      {rows.length > 0 && (
        <div className="ww-tiles">
          <div><b style={{ color: '#e5c25a' }}>{rows.length}</b><small>Contributors</small></div>
          <div><b style={{ color: '#7ec1fb' }}>{totalSubmitted}</b><small>Clips submitted</small></div>
          <div><b style={{ color: '#95fe7c' }}>{totalPosted}</b><small>Posted to socials</small></div>
        </div>
      )}

      <ClipperTable rows={rows} />
    </div>
  )
}
