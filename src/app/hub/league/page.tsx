export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getRecordBook } from '@/lib/record-book'
import { LeagueBibleEditor, type LeagueBible } from './league-bible-editor'
import { RecordMarkEditor } from './record-mark-editor'
import { AssetManager, type Asset } from '@/app/hub/asset-manager'

const LEAGUE_CATEGORIES = ['History', 'Records', 'Rules', 'Logos', 'Brand', 'Sponsors', 'Press', 'Charity', 'Templates']

export default async function HubLeaguePage() {
  const supabase = createAdminClient()
  const [bibleRes, { computed, manual }, artistsRes, assetsRes] = await Promise.all([
    supabase.from('league_bible').select('*').eq('id', 1).maybeSingle(),
    getRecordBook(),
    supabase.from('artist_profiles').select('artist_id,display_name').order('display_name'),
    supabase.from('content_assets').select('id,category,franchise,title,url,asset_type,notes').eq('scope', 'league'),
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
    glossary: (row.glossary as LeagueBible['glossary']) ?? [],
  }
  const artists = (artistsRes.data ?? []).map(a => ({ id: a.artist_id, name: a.display_name as string }))
  const assets = (assetsRes.data ?? []) as Asset[]

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide mb-3">League Bible</h2>
        <LeagueBibleEditor bible={bible} />
      </section>

      <section>
        <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide mb-1">Record Book</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Computed live from every decided Main Event — the same source as the Artist Leaderboard.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {computed.map(m => (
            <div key={m.key} className="rounded-xl border border-border bg-[#111827] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{m.label}</p>
              <p className="text-lg font-rajdhani font-bold text-[#95fe7c] leading-tight mt-0.5">{m.value}</p>
              {m.holder && <p className="text-sm text-white">{m.holder}</p>}
              {m.detail && <p className="text-[11px] text-muted-foreground">{m.detail}</p>}
            </div>
          ))}
        </div>

        <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide mt-6 mb-2">Judgement-call marks</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Marks that need a human eye — biggest upset, biggest comeback, most charitable. Set the holder yourself.
        </p>
        <RecordMarkEditor marks={manual} artists={artists} />
      </section>

      <section>
        <AssetManager
          scope="league"
          categories={LEAGUE_CATEGORIES}
          assets={assets}
          revalidate="/hub/league"
        />
      </section>
    </div>
  )
}
