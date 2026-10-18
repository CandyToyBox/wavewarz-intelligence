export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { loadArtistReview } from '@/lib/playbook/review'
import { moduleStatus, STATUS_TEXT } from '@/lib/playbook/logic'
import { MODULES } from '@/lib/playbook/spec'
import { EXTRA_LABELS } from '@/lib/playbook/hub-map'
import { PlaybookReview, type HelpRow, type InviteInfo, type ModuleRow } from './review-client'

export default async function ArtistPlaybookReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [profileRes, review, inviteRes, helpRes] = await Promise.all([
    supabase.from('artist_profiles').select('artist_id,display_name').eq('artist_id', id).maybeSingle(),
    loadArtistReview(id),
    supabase.from('playbook_invites').select('created_at,last_used_at,revoked_at').eq('artist_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('playbook_help').select('id,module_key,field_key,note,resolved').eq('artist_id', id),
  ])
  if (!profileRes.data) notFound()

  const { snapshot } = review
  const invite: InviteInfo = inviteRes.data
    ? { exists: true, active: !inviteRes.data.revoked_at, createdAt: inviteRes.data.created_at, lastUsedAt: inviteRes.data.last_used_at }
    : { exists: false, active: false, createdAt: null, lastUsedAt: null }

  const modules: ModuleRow[] = MODULES.map(m => {
    const sub = snapshot.submissions[m.key]
    const st = moduleStatus(m, snapshot.answers, snapshot.help, sub?.hash)
    const fields = review.fields.filter(f => f.moduleKey === m.key)
    return {
      key: m.key,
      order: m.order,
      title: m.title,
      color: m.color,
      statusText: STATUS_TEXT[st],
      status: st,
      submittedAt: sub?.at ?? null,
      toReview: fields.filter(f => f.status === 'new' || f.status === 'changed').length,
    }
  })

  const help: HelpRow[] = (helpRes.data ?? []).map(h => ({
    id: h.id,
    moduleKey: h.module_key,
    fieldKey: h.field_key,
    note: h.note,
    resolved: h.resolved,
  }))

  const displayName = profileRes.data.display_name ?? 'Artist'
  const extras = Object.entries(review.extras).filter(([, v]) => v && String(v).trim())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/hub/artists/${id}`} className="text-xs text-muted-foreground hover:text-white">← {displayName}</Link>
          <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide mt-1">Playbook review</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            What {displayName} submitted, next to what the Artist Archive holds today. Nothing is written until you accept it, and a
            different value that is already in the Hub is only replaced when you choose Replace.
          </p>
        </div>
        <Link href="/hub/playbook" className="text-xs text-[#7ec1fb] hover:underline">All playbooks and help requests →</Link>
      </div>

      <PlaybookReview
        artistId={id}
        artistName={displayName}
        artistNameTyped={snapshot.name}
        invite={invite}
        modules={modules}
        fields={review.fields}
        help={help}
      />

      {extras.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-rajdhani font-bold text-white tracking-wide">Playbook extras</h3>
          <p className="text-xs text-muted-foreground">Accepted answers that have no Artist Archive field of their own.</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {extras.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-[#111827] p-3">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{EXTRA_LABELS[k] ?? k}</dt>
                <dd className="text-sm text-white whitespace-pre-wrap break-words mt-0.5">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}
