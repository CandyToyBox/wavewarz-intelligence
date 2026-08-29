export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { bibleCompleteness, type ArtistBible } from '@/lib/booker-card'
import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { HubAvatar } from '@/app/hub/hub-avatar'
import { SyncAvatarsButton } from './sync-avatars-button'

export default async function HubArtists() {
  const supabase = createAdminClient()
  const [profilesRes, biblesRes, leaderboard] = await Promise.all([
    supabase.from('artist_profiles').select('artist_id,display_name,twitter_handle,audius_handle,profile_picture_url,custom_pfp_url,primary_wallet'),
    supabase.from('artist_bibles').select('*'),
    getArtistLeaderboard(),
  ])
  const bibleById = new Map<string, ArtistBible>((biblesRes.data ?? []).map(b => [b.artist_id, b as ArtistBible]))

  // Rank by Artist Leaderboard position (wallet or name match); unranked last.
  const rankByWallet = new Map<string, number>()
  const rankByName = new Map<string, number>()
  leaderboard.rows.forEach((r, i) => {
    if (r.wallet) rankByWallet.set(r.wallet, i + 1)
    rankByName.set(r.name, i + 1)
  })

  const artists = (profilesRes.data ?? []).map(p => {
    const bible = bibleById.get(p.artist_id) ?? null
    const rank = rankByWallet.get(p.primary_wallet as string) ?? rankByName.get(p.display_name as string) ?? null
    return {
      id: p.artist_id,
      name: p.display_name as string,
      twitter: (p.twitter_handle as string | null)?.replace(/^@/, '') ?? null,
      pfpUrl: (p.profile_picture_url as string | null) ?? (p.custom_pfp_url as string | null) ?? null,
      rank,
      completeness: bibleCompleteness(bible),
      archetype: bible?.archetype_primary ?? null,
      needsReview: bible?.needs_review ?? false,
    }
  }).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          {artists.length} artists — the full Artist Leaderboard, in rank order. One Identity Bible + Booker Card
          each (Phases 9–20, 36); graphics, announcer copy and sponsor matching all pull from these. Records,
          rankings and avatars stay live-synced with wavewarz.info; <em>Sync from leaderboard</em> adds any new
          artists to the roster.
        </p>
        <SyncAvatarsButton />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map(a => (
          <Link
            key={a.id}
            href={`/hub/artists/${a.id}`}
            className="rounded-xl border border-border bg-[#111827] hover:border-[#7ec1fb]/40 p-4 transition-colors"
          >
            <div className="flex items-start gap-3 mb-2">
              <HubAvatar name={a.name} pfpUrl={a.pfpUrl} twitterHandle={a.twitter} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-rajdhani font-bold text-white text-lg leading-tight">
                    {a.rank && <span className="text-muted-foreground font-mono text-sm mr-1.5">#{a.rank}</span>}
                    {a.name}
                  </span>
                  {a.needsReview && (
                    <span className="text-[9px] font-bold text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded px-1.5 py-0.5 shrink-0">
                      REVIEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.archetype ? `The ${a.archetype}` : 'Archetype not set'}
                  {a.twitter && ` · @${a.twitter}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-[#0d1321] overflow-hidden">
                <div className="h-full rounded-full bg-[#95fe7c]" style={{ width: `${a.completeness}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-9 text-right">{a.completeness}%</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
