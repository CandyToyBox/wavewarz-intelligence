import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { ClipperTable, type ClipperRowClient } from './clipper-table'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clipper Rankings — WaveWarZ Intelligence',
  description: 'Community clip contributors ranked by submissions, approvals, and points. Many are also WaveWarz battle artists.',
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

      {/* Back + header */}
      <div>
        <Link href="/leaderboards" className="text-xs text-muted-foreground hover:text-white transition-colors mb-4 inline-block">
          ← All Leaderboards
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
            Clipper <span className="text-orange-400">Rankings</span>
          </h1>
          <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-bold tracking-widest">
            COMMUNITY CLIPS
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Ranked by points. Contributors earn points for every clip submitted, approved, and posted.
          {artistCount > 0 && ` ${artistCount} contributors are also active WaveWarz battle artists.`}
        </p>
      </div>

      {/* Quick stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-[#111827] p-4 text-center">
            <p className="text-2xl font-rajdhani font-bold text-orange-400">{rows.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Contributors</p>
          </div>
          <div className="rounded-xl border border-border bg-[#111827] p-4 text-center">
            <p className="text-2xl font-rajdhani font-bold text-[#7ec1fb]">{totalSubmitted}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Clips Submitted</p>
          </div>
          <div className="rounded-xl border border-border bg-[#111827] p-4 text-center">
            <p className="text-2xl font-rajdhani font-bold text-[#95fe7c]">{totalPosted}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Posted to Socials</p>
          </div>
        </div>
      )}

      <ClipperTable rows={rows} />
    </div>
  )
}
