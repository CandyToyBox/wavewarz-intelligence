export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { bibleCompleteness, type ArtistBible } from '@/lib/booker-card'
import { listHubEvents } from '@/lib/hub-events'
import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { HubAvatar } from '@/app/hub/hub-avatar'

// The Phase 37 Content Library Structure, made browsable.
const LIBRARY = {
  '/WAVEWARZ LEAGUE': ['History', 'Records', 'Rules', 'Logos', 'Brand', 'Sponsors', 'Press', 'Charity', 'Templates'],
  '/ARTISTS/{artist}': ['Identity Bible', 'Photos', 'Logos', 'Music', 'Video', 'Battles', 'Interviews', 'Quotes', 'Memes', 'Community', 'Sponsors', 'Merch', 'THE WALK', 'Career Record'],
  '/EVENTS/{event}': ['Raw', 'Promo', 'Livestream', 'Results', 'Clips', 'Screenshots', 'Stats', 'Sponsors', 'Reactions', 'Press'],
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[#0d1321] overflow-hidden">
      <div
        className="h-full rounded-full bg-[#95fe7c] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default async function HubHome() {
  const supabase = createAdminClient()
  const [profilesRes, biblesRes, storylinesRes, sponsorsRes, events, leaderboard] = await Promise.all([
    supabase.from('artist_profiles').select('artist_id,display_name,twitter_handle,profile_picture_url,custom_pfp_url,primary_wallet'),
    supabase.from('artist_bibles').select('*'),
    supabase.from('storylines').select('status'),
    supabase.from('sponsor_inventory').select('status'),
    listHubEvents(),
    getArtistLeaderboard(),
  ])

  const bibleById = new Map<string, ArtistBible>((biblesRes.data ?? []).map(b => [b.artist_id, b as ArtistBible]))
  const rankByWallet = new Map<string, number>()
  const rankByName = new Map<string, number>()
  leaderboard.rows.forEach((r, i) => { if (r.wallet) rankByWallet.set(r.wallet, i + 1); rankByName.set(r.name, i + 1) })

  const artists = (profilesRes.data ?? []).map(p => ({
    id: p.artist_id,
    name: p.display_name as string,
    twitter: (p.twitter_handle as string | null)?.replace(/^@/, '') ?? null,
    pfpUrl: (p.profile_picture_url as string | null) ?? (p.custom_pfp_url as string | null) ?? null,
    rank: rankByWallet.get(p.primary_wallet as string) ?? rankByName.get(p.display_name as string) ?? null,
    completeness: bibleCompleteness(bibleById.get(p.artist_id) ?? null),
  })).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name))

  const openStorylines = (storylinesRes.data ?? []).filter(s => s.status === 'open').length
  const totalStorylines = (storylinesRes.data ?? []).length
  const sponsorsSold = (sponsorsRes.data ?? []).filter(s => s.status === 'sold').length
  const sponsorsPitched = (sponsorsRes.data ?? []).filter(s => s.status === 'pitched').length
  const totalSponsors = (sponsorsRes.data ?? []).length
  const eventsWithThesis = events.filter(e => e.hasThesis).length

  return (
    <div className="space-y-8">

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Roster" value={`${artists.length}`} sub="recurring artists" href="/hub/artists" />
        <Kpi
          label="Identity Bibles"
          value={`${artists.filter(a => a.completeness > 0).length}/${artists.length}`}
          sub={`${Math.round(artists.reduce((s, a) => s + a.completeness, 0) / Math.max(artists.length, 1))}% avg complete`}
          href="/hub/artists"
        />
        <Kpi label="Main Events" value={`${events.length}`} sub={`${eventsWithThesis} with a thesis`} href="/hub/events" />
        <Kpi label="Storylines" value={`${openStorylines}`} sub={`${totalStorylines} total · open`} href="/hub/storylines" />
      </div>

      {/* Library structure */}
      <section>
        <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide mb-3">Content Library</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(LIBRARY).map(([folder, subs]) => (
            <div key={folder} className="rounded-xl border border-border bg-[#111827] p-4">
              <p className="font-mono text-xs text-[#7ec1fb] mb-3">{folder}</p>
              <ul className="space-y-1">
                {subs.map(s => (
                  <li key={s} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-muted-foreground/40">└</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Artists */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide">Artist Files</h2>
          <Link href="/hub/artists" className="text-xs text-[#7ec1fb] hover:underline">All artists →</Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {artists.slice(0, 12).map(a => (
            <Link
              key={a.id}
              href={`/hub/artists/${a.id}`}
              className="rounded-lg border border-border bg-[#111827] hover:border-[#7ec1fb]/40 p-3 transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-2">
                {a.rank && <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">#{a.rank}</span>}
                <HubAvatar name={a.name} pfpUrl={a.pfpUrl} twitterHandle={a.twitter} size={32} />
                <span className="font-rajdhani font-bold text-white flex-1 truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.completeness}%</span>
              </div>
              <Bar pct={a.completeness} />
            </Link>
          ))}
        </div>
      </section>

      {/* Events */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide">Event Files</h2>
          <Link href="/hub/events" className="text-xs text-[#7ec1fb] hover:underline">All events →</Link>
        </div>
        <div className="rounded-xl border border-border bg-[#111827] overflow-hidden">
          {events.slice(0, 8).map(e => (
            <Link
              key={e.slug}
              href={`/hub/events/${e.slug}`}
              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-2 shrink-0">
                  <HubAvatar name={e.a.name} pfpUrl={e.a.pfpUrl} twitterHandle={e.a.twitterHandle} size={28} />
                  <HubAvatar name={e.b.name} pfpUrl={e.b.pfpUrl} twitterHandle={e.b.twitterHandle} size={28} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{e.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(e.date).toLocaleDateString()} · {e.rounds} round{e.rounds > 1 ? 's' : ''} · {e.totalVolumeSol} SOL
                    {e.eventSubtype !== 'standard' && ` · ${e.eventSubtype}`}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                e.hasThesis
                  ? 'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10'
                  : 'text-amber-400 border-amber-500/40 bg-amber-500/10'
              }`}>
                {e.hasThesis ? (e.thesisNeedsReview ? 'THESIS · REVIEW' : 'THESIS ✓') : 'THESIS NEEDED'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Sponsor snapshot */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide">Sponsor Inventory</h2>
          <Link href="/hub/sponsors" className="text-xs text-[#7ec1fb] hover:underline">Manage →</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Available" value={`${totalSponsors - sponsorsSold - sponsorsPitched}`} sub="ownable properties" />
          <Kpi label="Pitched" value={`${sponsorsPitched}`} sub="in conversation" />
          <Kpi label="Sold" value={`${sponsorsSold}`} sub="closed" />
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const inner = (
    <div className="rounded-xl border border-border bg-[#111827] p-4 h-full">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-rajdhani font-bold text-[#95fe7c]">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
  return href ? <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link> : inner
}
