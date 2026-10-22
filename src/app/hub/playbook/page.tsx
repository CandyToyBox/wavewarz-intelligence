export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { loadArtistReview } from '@/lib/playbook/review'
import { moduleStatus } from '@/lib/playbook/logic'
import { MODULES, MODULE_BY_KEY, PARTS } from '@/lib/playbook/spec'
import { ResolveButton } from '@/app/hub/artists/[id]/playbook/review-client'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default async function PlaybookInboxPage() {
  const supabase = createAdminClient()

  const [helpRes, invitesRes, answersRes, subsRes, foundingRes] = await Promise.all([
    supabase.from('playbook_help').select('id,artist_id,module_key,field_key,note,resolved,created_at,updated_at').order('created_at', { ascending: false }),
    supabase.from('playbook_invites').select('artist_id,created_at,last_used_at,revoked_at').order('created_at', { ascending: false }),
    supabase.from('playbook_answers').select('artist_id,updated_at'),
    supabase.from('playbook_submissions').select('artist_id,module_key,submitted_at'),
    supabase.from('artist_bibles').select('artist_id').eq('founding', true),
  ])

  // Everyone who has been given a link, has answered something, or is flagged founding.
  const ids = new Set<string>()
  for (const r of invitesRes.data ?? []) ids.add(r.artist_id)
  for (const r of answersRes.data ?? []) ids.add(r.artist_id)
  for (const r of foundingRes.data ?? []) ids.add(r.artist_id)

  const { data: profiles } = ids.size
    ? await supabase.from('artist_profiles').select('artist_id,display_name').in('artist_id', [...ids])
    : { data: [] as { artist_id: string; display_name: string | null }[] }
  const nameOf = new Map((profiles ?? []).map(p => [p.artist_id, p.display_name ?? 'Unnamed artist']))

  const latestInvite = new Map<string, { created_at: string; last_used_at: string | null; revoked_at: string | null }>()
  for (const r of invitesRes.data ?? []) if (!latestInvite.has(r.artist_id)) latestInvite.set(r.artist_id, r)
  const lastAnswer = new Map<string, string>()
  for (const r of answersRes.data ?? []) {
    const cur = lastAnswer.get(r.artist_id)
    if (!cur || r.updated_at > cur) lastAnswer.set(r.artist_id, r.updated_at)
  }
  const subsBy = new Map<string, number>()
  for (const r of subsRes.data ?? []) subsBy.set(r.artist_id, (subsBy.get(r.artist_id) ?? 0) + 1)

  // Per-artist counts, without generating file URLs.
  const rows = await Promise.all(
    [...ids].map(async id => {
      const review = await loadArtistReview(id, { signUrls: false })
      const submitted = MODULES.filter(m => {
        const sub = review.snapshot.submissions[m.key]
        return !!sub
      }).length
      const edited = MODULES.filter(m => moduleStatus(m, review.snapshot.answers, review.snapshot.help, review.snapshot.submissions[m.key]?.hash) === 'edited').length
      const toReview = review.fields.filter(f => f.status === 'new' || f.status === 'changed').length
      return { id, name: nameOf.get(id) ?? 'Unnamed artist', submitted: subsBy.get(id) ?? submitted, edited, toReview }
    }),
  )
  rows.sort((a, b) => b.toReview - a.toReview || a.name.localeCompare(b.name))

  const help = helpRes.data ?? []
  const open = help.filter(h => !h.resolved)
  const resolved = help.filter(h => h.resolved)
  const helpName = (id: string) => nameOf.get(id) ?? 'Artist'
  const helpLabel = (h: { module_key: string; field_key: string | null }) => {
    const m = MODULE_BY_KEY[h.module_key]
    const ref = h.field_key ? PARTS[h.field_key] : null
    return ref ? `Module ${m?.order}: ${m?.title}, Q${ref.qIndex + 1}. ${ref.question.label}` : `Module ${m?.order}: ${m?.title}`
  }

  // Names for artists that only show up in help requests.
  const missing = [...new Set(help.map(h => h.artist_id))].filter(id => !nameOf.has(id))
  if (missing.length) {
    const { data } = await supabase.from('artist_profiles').select('artist_id,display_name').in('artist_id', missing)
    for (const p of data ?? []) nameOf.set(p.artist_id, p.display_name ?? 'Artist')
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-rajdhani font-bold text-white tracking-wide">Playbook</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Founding artists fill in the Playbook from their private link. Their answers wait here as drafts until you accept them
            into the Artist Archive and the Assets folders. Create an artist&apos;s link from their review page.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-[#111827] p-4">
            No one has a link yet. Open an artist from <Link href="/hub/artists" className="text-[#7ec1fb] hover:underline">Artists</Link>,
            then Playbook, then Create link.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-[#111827] text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Artist</th>
                  <th className="text-left px-3 py-2">Link</th>
                  <th className="text-left px-3 py-2">Modules sent</th>
                  <th className="text-left px-3 py-2">To review</th>
                  <th className="text-left px-3 py-2">Last answer</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const inv = latestInvite.get(r.id)
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 text-white font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {!inv ? 'none' : inv.revoked_at ? 'turned off' : inv.last_used_at ? `opened ${fmt(inv.last_used_at)}` : 'not opened yet'}
                      </td>
                      <td className="px-3 py-2 text-white">
                        {r.submitted}/{MODULES.length}
                        {r.edited > 0 && <span className="ml-2 text-[10px] text-amber-400">{r.edited} edited since</span>}
                      </td>
                      <td className={`px-3 py-2 font-bold ${r.toReview ? 'text-[#7ec1fb]' : 'text-muted-foreground'}`}>{r.toReview}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(lastAnswer.get(r.id))}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/hub/artists/${r.id}/playbook`} className="text-xs text-[#7ec1fb] hover:underline">Review →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-rajdhani font-bold text-white tracking-wide">
          Help requests <span className="text-sm text-muted-foreground font-sans">({open.length} open)</span>
        </h2>
        {open.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting for help.</p>}
        <ul className="space-y-2">
          {open.map(h => (
            <HelpItem key={h.id} h={h} name={helpName(h.artist_id)} label={helpLabel(h)} />
          ))}
        </ul>
        {resolved.length > 0 && (
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground">Resolved ({resolved.length})</summary>
            <ul className="space-y-2 p-3">
              {resolved.map(h => (
                <HelpItem key={h.id} h={h} name={helpName(h.artist_id)} label={helpLabel(h)} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  )
}

function HelpItem({ h, name, label }: {
  h: { id: string; artist_id: string; field_key: string | null; note: string | null; resolved: boolean; created_at: string }
  name: string
  label: string
}) {
  return (
    <li className="rounded-lg border border-border bg-[#111827] p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm text-white">
          <Link href={`/hub/artists/${h.artist_id}/playbook${h.field_key ? `#f-${h.field_key}` : ''}`} className="font-medium hover:text-[#7ec1fb]">{name}</Link>
          <span className="text-muted-foreground text-xs"> · {fmt(h.created_at)}</span>
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {h.note && <p className="text-sm text-[#7ec1fb] whitespace-pre-wrap break-words">{h.note}</p>}
      </div>
      <div className="text-[#7ec1fb]"><ResolveButton id={h.id} resolved={h.resolved} /></div>
    </li>
  )
}
