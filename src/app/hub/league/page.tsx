export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getRecordBook } from '@/lib/record-book'
import { LeagueArchiveEditor } from './league-archive-editor'
import type { LeagueBible } from './league-archive-editor'
import { RecordMarkEditor } from './record-mark-editor'
import { AssetManager, type Asset } from '@/app/hub/asset-manager'
import { ModuleGroup } from '@/app/hub/module-group'
import { ASSET_COLUMNS, LEAGUE_MODULES, subjectKey, toStateMap } from '@/lib/hub-modules'

export default async function HubLeaguePage() {
  const supabase = createAdminClient()
  const subject = subjectKey('league')
  const [bibleRes, { computed, manual }, artistsRes, assetsRes, modulesRes] = await Promise.all([
    supabase.from('league_bible').select('*').eq('id', 1).maybeSingle(),
    getRecordBook(),
    supabase.from('artist_profiles').select('artist_id,display_name').order('display_name'),
    supabase.from('content_assets').select(ASSET_COLUMNS).eq('scope', 'league'),
    supabase.from('hub_modules').select('module_key,status,checklist').eq('subject', subject),
  ])

  const row = (bibleRes.data ?? {}) as Partial<LeagueBible>
  const bible: LeagueBible = {
    mission: row.mission ?? null,
    one_liner: row.one_liner ?? null,
    ten_sec: row.ten_sec ?? null,
    thirty_sec: row.thirty_sec ?? null,
    long_form: row.long_form ?? null,
    tagline: row.tagline ?? null,
    positioning: row.positioning ?? null,
    rules_md: row.rules_md ?? null,
    scoring_md: row.scoring_md ?? null,
    guardrails_md: row.guardrails_md ?? null,
    ethos_md: row.ethos_md ?? null,
    glossary: (row.glossary as LeagueBible['glossary']) ?? [],
  }
  const artists = (artistsRes.data ?? []).map(a => ({ id: a.artist_id, name: a.display_name as string }))
  const assets = (assetsRes.data ?? []) as Asset[]
  const states = toStateMap(modulesRes.data)

  const nodes = Object.fromEntries(LEAGUE_MODULES.map(m => [
    m.key,
    <div key={m.key} className="space-y-4">
      {m.sections && m.sections.filter(s => s !== 'Record Book').length > 0 && (
        <LeagueArchiveEditor bible={bible} only={m.sections} />
      )}

      {m.key === 'sponsors' && (
        <p className="text-xs text-muted-foreground">
          The ownable properties live in <Link href="/hub/sponsors" className="text-[#7ec1fb] hover:underline">Sponsor Inventory</Link>.
          Nothing is a deal until it is marked sold.
        </p>
      )}

      {m.key === 'records' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Computed live from every decided Main Event, the same source as the Artist Leaderboard.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {computed.map(c => (
              <div key={c.key} className="rounded-xl border border-border bg-[#111827] p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{c.label}</p>
                <p className="text-lg font-rajdhani font-bold text-[#95fe7c] leading-tight mt-0.5">{c.value}</p>
                {c.holder && <p className="text-sm text-white">{c.holder}</p>}
                {c.detail && <p className="text-[11px] text-muted-foreground">{c.detail}</p>}
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-sm font-rajdhani font-bold text-white tracking-wide mb-1">Judgement-call marks</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Marks that need a human eye: biggest upset, biggest comeback, most charitable. Set the holder yourself.
            </p>
            <RecordMarkEditor marks={manual} artists={artists} />
          </div>
        </div>
      )}

      {m.categories.length > 0 && (
        <AssetManager
          scope="league"
          categories={m.categories}
          assets={assets.filter(a => m.categories.includes(a.category))}
          revalidate="/hub/league"
          moduleKey={m.key}
          heading="Files and links"
        />
      )}
    </div>,
  ]))

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide">WaveWarZ Archives</h2>
        <p className="text-xs text-muted-foreground mb-3">
          The league-wide record of who we are, what we stand for and what has happened. Every file added here says why it is here.
        </p>
        <ModuleGroup subject={subject} modules={LEAGUE_MODULES} states={states} nodes={nodes} />
      </section>
    </div>
  )
}
