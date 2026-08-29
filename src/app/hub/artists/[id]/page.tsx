export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getBookerCard } from '@/lib/booker-card'
import { ArtistBibleEditor } from './artist-bible-editor'
import { AssetManager, type Asset } from '@/app/hub/asset-manager'
import { HubAvatar } from '@/app/hub/hub-avatar'

const ARTIST_CATEGORIES = [
  'Identity Bible', 'Photos', 'Logos', 'Music', 'Video', 'Battles', 'Interviews',
  'Quotes', 'Memes', 'Community', 'Sponsors', 'Merch', 'THE WALK', 'Career Record',
]

export default async function HubArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [card, assetsRes, storylinesRes] = await Promise.all([
    getBookerCard(id),
    supabase.from('content_assets').select('id,category,franchise,title,url,asset_type,notes').eq('artist_id', id),
    supabase.from('storylines').select('*').or(`artist_a_id.eq.${id},artist_b_id.eq.${id}`),
  ])
  if (!card) notFound()

  const assets = (assetsRes.data ?? []) as Asset[]
  const storylines = storylinesRes.data ?? []
  const b = card.bible

  return (
    <div className="space-y-8">
      <Link href="/hub/artists" className="text-xs text-muted-foreground hover:text-white">← All artists</Link>

      {/* ── BOOKER CARD (Phase 36) ── */}
      <div className="rounded-2xl border border-[#95fe7c]/30 bg-gradient-to-br from-[#0d1321] via-[#111827] to-[#0d1321] overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#95fe7c] via-[#7ec1fb] to-[#95fe7c]" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <HubAvatar
                name={card.displayName}
                pfpUrl={card.profilePictureUrl ?? card.pfpUrl}
                twitterHandle={card.twitterHandle}
                size={64}
              />
              <div>
                <h1 className="text-3xl font-rajdhani font-bold text-white tracking-wide leading-none">
                  {card.displayName}{b.artist_emoji ? ` ${b.artist_emoji}` : ''}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {b.archetype_primary ? `The ${b.archetype_primary}` : 'Archetype not set'}
                  {b.archetype_secondary && ` / ${b.archetype_secondary}`}
                  {b.hero_heel && ` · ${b.hero_heel}`}
                </p>
                {b.one_line_identity && <p className="text-sm text-white/80 mt-1 italic max-w-xl">{b.one_line_identity}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <Link href={`/artist/${id}`} className="text-[10px] text-[#7ec1fb] hover:underline">Public Player Card ↗</Link>
                  {card.twitterHandle && <a href={`https://x.com/${card.twitterHandle}`} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:text-white">@{card.twitterHandle}</a>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Metric label="Rank" value={card.rank ? `#${card.rank}` : '—'} />
              <Metric label="Record" value={`${card.wins}–${card.losses}`} sub={card.winRate !== null ? `${card.winRate}%` : undefined} />
              <Metric
                label="Streak"
                value={card.streak ? `${card.streak.count}${card.streak.kind}` : '—'}
                highlight={card.streak?.kind === 'W'}
                danger={card.streak?.kind === 'L'}
              />
              <Metric label="Volume" value={`${card.volumeSol}`} sub="SOL" />
              <Metric label="Earnings" value={`${card.earningsSol}`} sub="SOL" highlight />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4 mt-6">
            <MiniField label="Identity Bible" value={`${card.completeness}% complete`} />
            <MiniField label="Signature color" value={b.colors?.signature ?? null} />
            <MiniField label="Catchphrase" value={b.catchphrase} />
            <MiniField label="Signature weapon" value={b.signature_weapon} />
            <MiniField label="Motivation" value={b.motivation} />
            <MiniField label="Greatest strength" value={b.greatest_strength} />
            <MiniField label="Vulnerability" value={b.vulnerability} />
            <MiniField
              label="Top rival"
              value={card.topRival ? `${card.topRival.name} (${card.topRival.record}, ${card.topRival.meetings}×)` : null}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <MiniField
              label="Recent form"
              value={card.recentForm.length ? card.recentForm.join(' ') : null}
            />
            <MiniField label="Main-event W/L" value={`${card.mainWins}–${card.mainLosses}`} />
            <MiniField label="Quick-battle W/L" value={`${card.quickWins}–${card.quickLosses}`} />
          </div>

          {b.needs_review && (
            <p className="mt-4 text-[11px] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded px-3 py-1.5">
              This bible is flagged for review — confirm the details before anything ships from it.
            </p>
          )}
        </div>
      </div>

      {/* ── OPEN STORYLINES ── */}
      {storylines.length > 0 && (
        <section>
          <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide mb-3">Storylines</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {storylines.map(s => (
              <Link key={s.id} href="/hub/storylines" className="rounded-lg border border-border bg-[#111827] hover:border-[#7ec1fb]/40 p-3 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{s.title}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.status === 'open' ? 'text-[#95fe7c] bg-[#95fe7c]/10' : 'text-muted-foreground bg-white/5'}`}>
                    {s.status}
                  </span>
                </div>
                {s.summary && <p className="text-xs text-muted-foreground mt-1">{s.summary}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── QUICK-BATTLE SONGS (album art from the Song Leaderboard source) ── */}
      {card.songs.length > 0 && (
        <section>
          <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide mb-1">Quick-Battle Songs</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {card.quickWins}W–{card.quickLosses}L across {card.songs.length} track{card.songs.length === 1 ? '' : 's'}. Artwork from <code className="text-[#7ec1fb]">song_registry</code> — same source as the Song Leaderboard.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {card.songs.map(s => (
              <div key={s.key} className="flex items-center gap-3 rounded-lg border border-border bg-[#111827] p-2.5">
                <div className="w-11 h-11 rounded-md overflow-hidden bg-[#1a2235] border border-border shrink-0 flex items-center justify-center">
                  {s.artUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.artUrl} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-rajdhani font-bold text-[#7ec1fb]">{s.title.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  {s.musicLink ? (
                    <a href={s.musicLink} target="_blank" rel="noreferrer" className="text-sm font-rajdhani font-bold text-white hover:text-[#7ec1fb] block truncate">{s.title} ↗</a>
                  ) : (
                    <span className="text-sm font-rajdhani font-bold text-white block truncate">{s.title}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground">{s.wins}W–{s.losses}L · {s.volumeSol} SOL</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── IDENTITY BIBLE EDITOR ── */}
      <ArtistBibleEditor artistId={id} bible={b} />

      {/* ── ASSET FOLDERS ── */}
      <AssetManager
        scope="artist"
        artistId={id}
        categories={ARTIST_CATEGORIES}
        assets={assets}
        revalidate={`/hub/artists/${id}`}
      />
    </div>
  )
}

function Metric({ label, value, sub, highlight, danger }: {
  label: string; value: string; sub?: string; highlight?: boolean; danger?: boolean
}) {
  return (
    <div className="text-center bg-[#0d1321] border border-border rounded-xl px-3 py-2 min-w-[64px]">
      <p className={`text-xl font-rajdhani font-bold ${danger ? 'text-red-400' : highlight ? 'text-[#95fe7c]' : 'text-white'}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{sub ? `${label} · ${sub}` : label}</p>
    </div>
  )
}

function MiniField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm ${value ? 'text-white' : 'text-muted-foreground/40 italic'}`}>{value || 'not set'}</p>
    </div>
  )
}
