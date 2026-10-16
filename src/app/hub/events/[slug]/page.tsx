export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getHubEvent } from '@/lib/hub-events'
import { getBookerCard, type BookerCard } from '@/lib/booker-card'
import { ThesisEditor, type Thesis } from './thesis-editor'
import { RunwayChecklist } from './runway-checklist'
import { AssetManager, type Asset } from '@/app/hub/asset-manager'
import { ModuleGroup } from '@/app/hub/module-group'
import { HubAvatar } from '@/app/hub/hub-avatar'
import { ASSET_COLUMNS, EVENT_MODULES, subjectKey, toStateMap } from '@/lib/hub-modules'

export default async function HubEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()

  const event = await getHubEvent(slug)
  if (!event) notFound()

  const subject = subjectKey('event', slug)
  const [thesisRes, assetsRes, cardA, cardB, modulesRes] = await Promise.all([
    supabase.from('battle_theses').select('*').eq('event_slug', slug).maybeSingle(),
    supabase.from('content_assets').select(ASSET_COLUMNS).eq('event_slug', slug),
    event.a.artistId ? getBookerCard(event.a.artistId) : Promise.resolve(null),
    event.b.artistId ? getBookerCard(event.b.artistId) : Promise.resolve(null),
    supabase.from('hub_modules').select('module_key,status,checklist').eq('subject', subject),
  ])

  const thesis = (thesisRes.data ?? null) as Thesis | null
  const assets = (assetsRes.data ?? []) as Asset[]
  const runway = (thesisRes.data?.runway as Record<string, boolean>) ?? {}
  const states = toStateMap(modulesRes.data)

  // Promo runway items grouped by flywheel stage; progress comes from them.
  const autoProgress = Object.fromEntries(EVENT_MODULES.map(m => {
    const keys = m.runway ?? []
    return [m.key, { done: keys.filter(k => runway[k]).length, total: keys.length }]
  }))
  const nodes = Object.fromEntries(EVENT_MODULES.map(m => [
    m.key,
    <div key={m.key} className="space-y-4">
      {m.key === 'announce' && (
        <ThesisEditor
          slug={slug}
          thesis={thesis}
          eventMeta={{ artistAId: event.a.artistId, artistBId: event.b.artistId, label: event.label, date: event.date }}
        />
      )}
      {m.key === 'faceoff' && (
        <div>
          <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide mb-1">Tale of the Track</h3>
          <p className="text-xs text-muted-foreground mb-3">Auto-generated matchup comparison from both Booker Cards. Use it for the Fight Card.</p>
          <TaleOfTheTrack event={event} a={cardA} b={cardB} />
        </div>
      )}
      {m.runway && (
        <RunwayChecklist slug={slug} runway={runway} keys={m.runway} title="Promo steps for this stage" />
      )}
      <AssetManager
        scope="event"
        eventSlug={slug}
        categories={m.categories}
        assets={assets.filter(a => m.categories.includes(a.category))}
        revalidate={`/hub/events/${slug}`}
        moduleKey={m.key}
        heading="Files and links"
      />
    </div>,
  ]))

  return (
    <div className="space-y-8">
      <Link href="/hub/events" className="text-xs text-muted-foreground hover:text-white">← All events</Link>

      {/* Header */}
      <div className="rounded-2xl border border-[#95fe7c]/30 bg-gradient-to-br from-[#0d1321] via-[#111827] to-[#0d1321] overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#95fe7c] via-[#7ec1fb] to-[#95fe7c]" />
        <div className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            {event.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.imageUrl} alt={event.label} className="w-20 h-20 rounded-lg object-cover border border-border shrink-0" />
            )}
            <div className="flex items-center gap-3">
              <HubAvatar name={event.a.name} pfpUrl={event.a.pfpUrl} twitterHandle={event.a.twitterHandle} size={48} />
              <span className="text-xs text-muted-foreground font-bold">VS</span>
              <HubAvatar name={event.b.name} pfpUrl={event.b.pfpUrl} twitterHandle={event.b.twitterHandle} size={48} />
            </div>
            <div>
              <h1 className="text-3xl font-rajdhani font-bold text-white tracking-wide">{event.label}</h1>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {new Date(event.date).toLocaleDateString()} · {event.rounds} round{event.rounds > 1 ? 's' : ''} · {event.totalVolumeSol} SOL traded
                {event.eventSubtype !== 'standard' && ` · ${event.eventSubtype}`}
                {event.winner === 'pending' && ' · not yet judged'}
                {event.youtubeReplayLink && <> · <a href={event.youtubeReplayLink} target="_blank" rel="noreferrer" className="text-[#7ec1fb] hover:underline">Replay ↗</a></>}
              </p>
            </div>
          </div>
          {thesis?.headline && <p className="text-lg font-rajdhani font-bold text-[#95fe7c] mt-3">{thesis.headline}</p>}
          {thesis?.thesis && <p className="text-white/80 mt-1 italic max-w-2xl">{thesis.thesis}</p>}
        </div>
      </div>

      {/* The flywheel, one stage at a time */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide">The Battle Flywheel</h2>
          <p className="text-xs text-muted-foreground">
            Announce, interview, Face-Off, battle, aftermath, then the next battle is announced. Finish a stage and it tucks away.
          </p>
        </div>
        <ModuleGroup subject={subject} modules={EVENT_MODULES} states={states} nodes={nodes} autoProgress={autoProgress} />
      </section>
    </div>
  )
}

function TaleOfTheTrack({
  event,
  a,
  b,
}: {
  event: Awaited<ReturnType<typeof getHubEvent>>
  a: BookerCard | null
  b: BookerCard | null
}) {
  if (!event) return null
  const rows: { label: string; a: string; b: string }[] = [
    { label: 'This event', a: `${event.a.roundWins} rounds`, b: `${event.b.roundWins} rounds` },
    { label: 'Career record', a: a ? `${a.wins}–${a.losses}` : '—', b: b ? `${b.wins}–${b.losses}` : '—' },
    { label: 'Win rate', a: a?.winRate != null ? `${a.winRate}%` : '—', b: b?.winRate != null ? `${b.winRate}%` : '—' },
    { label: 'Rank', a: a?.rank ? `#${a.rank}` : '—', b: b?.rank ? `#${b.rank}` : '—' },
    { label: 'Current streak', a: a?.streak ? `${a.streak.count}${a.streak.kind}` : '—', b: b?.streak ? `${b.streak.count}${b.streak.kind}` : '—' },
    { label: 'Career volume', a: a ? `${a.volumeSol} SOL` : '—', b: b ? `${b.volumeSol} SOL` : '—' },
    { label: 'Archetype', a: a?.bible.archetype_primary ?? '—', b: b?.bible.archetype_primary ?? '—' },
    { label: 'Signature weapon', a: a?.bible.signature_weapon ?? '—', b: b?.bible.signature_weapon ?? '—' },
  ]

  return (
    <div className="rounded-xl border border-border bg-[#111827] overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4 py-3 border-b border-border items-center">
        <span className="flex items-center justify-end gap-2 font-rajdhani font-bold text-white text-right">
          {event.a.name}
          <HubAvatar name={event.a.name} pfpUrl={event.a.pfpUrl} twitterHandle={event.a.twitterHandle} size={28} />
        </span>
        <span className="text-[10px] text-muted-foreground">VS</span>
        <span className="flex items-center gap-2 font-rajdhani font-bold text-white">
          <HubAvatar name={event.b.name} pfpUrl={event.b.pfpUrl} twitterHandle={event.b.twitterHandle} size={28} />
          {event.b.name}
        </span>
      </div>
      {rows.map(r => (
        <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4 py-2 border-b border-border/50 last:border-0 items-center text-sm">
          <span className="text-white text-right font-mono">{r.a}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest whitespace-nowrap">{r.label}</span>
          <span className="text-white font-mono">{r.b}</span>
        </div>
      ))}
    </div>
  )
}
