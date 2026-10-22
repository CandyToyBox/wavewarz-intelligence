'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/playbook/admin-guard'
import { newInviteToken, sha256Hex } from '@/lib/playbook/session'
import { HUB_MAP } from '@/lib/playbook/hub-map'
import { loadArtistReview, planAccept } from '@/lib/playbook/review'
import { cleanValue, type AnswerValue } from '@/lib/playbook/logic'
import { MODULE_BY_KEY, PARTS } from '@/lib/playbook/spec'

type Result = { ok: boolean; error?: string }
const ADMIN = 'admin'

function refresh(artistId?: string) {
  if (artistId) {
    revalidatePath(`/hub/artists/${artistId}`)
    revalidatePath(`/hub/artists/${artistId}/playbook`)
  }
  revalidatePath('/hub/artists')
  revalidatePath('/hub/playbook')
  revalidatePath('/hub')
}

// ─── Private links for artists ────────────────────────────────────────────────

/** Creates a new private link and retires any earlier one. The raw token is returned once and never stored. */
export async function createPlaybookInvite(artistId: string): Promise<Result & { token?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data: artist } = await supabase.from('artist_profiles').select('artist_id').eq('artist_id', artistId).maybeSingle()
  if (!artist) return { ok: false, error: 'Artist not found.' }

  await supabase.from('playbook_invites').update({ revoked_at: new Date().toISOString() }).eq('artist_id', artistId).is('revoked_at', null)
  const token = newInviteToken()
  const { error } = await supabase.from('playbook_invites').insert({
    artist_id: artistId,
    token_hash: await sha256Hex(token),
    created_by: ADMIN,
  })
  if (error) return { ok: false, error: error.message }
  refresh(artistId)
  return { ok: true, token }
}

export async function revokePlaybookInvite(artistId: string): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('playbook_invites').update({ revoked_at: new Date().toISOString() }).eq('artist_id', artistId).is('revoked_at', null)
  if (error) return { ok: false, error: error.message }
  refresh(artistId)
  return { ok: true }
}

// ─── Help requests ────────────────────────────────────────────────────────────

export async function resolvePlaybookHelp(id: string, resolved: boolean): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('playbook_help').update({
    resolved,
    resolved_by: resolved ? ADMIN : null,
    resolved_at: resolved ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

// ─── Accepting answers into the Hub ───────────────────────────────────────────

type AcceptOptions = {
  /** "Edit then accept": the admin's version of the text. */
  edited?: string
  /** Confirms replacing a different value the Hub already holds. */
  replace?: boolean
}

async function applyAccept(artistId: string, fieldKey: string, opts: AcceptOptions): Promise<Result & { conflict?: boolean }> {
  const ref = PARTS[fieldKey]
  if (!ref || !HUB_MAP[fieldKey]) return { ok: false, error: 'Unknown field.' }
  const supabase = createAdminClient()

  const [answerRes, review] = await Promise.all([
    supabase.from('playbook_answers').select('value').eq('artist_id', artistId).eq('field_key', fieldKey).maybeSingle(),
    loadArtistReview(artistId),
  ])
  const value = cleanValue(ref.part, answerRes.data?.value) as AnswerValue
  if (value === null || value === undefined) return { ok: false, error: 'There is no answer to accept.' }

  const { data: assetUrls } = await supabase.from('content_assets').select('url').eq('artist_id', artistId)
  const plan = planAccept({
    fieldKey,
    value,
    bible: review.bible,
    extras: review.extras,
    existingAssetUrls: new Set((assetUrls ?? []).map(a => a.url as string).filter(Boolean)),
    edited: opts.edited,
    question: ref.question.label,
    moduleOrder: ref.module.order,
    qNum: ref.qIndex + 1,
  })
  if (!plan) return { ok: false, error: 'Nothing to accept.' }

  // Never overwrite a different existing Hub value unless the admin has seen both and said so.
  if (plan.conflict && !opts.replace) {
    return { ok: false, conflict: true, error: 'The Hub already has a different value here. Compare both and choose Replace.' }
  }

  const now = new Date().toISOString()
  const bibleWrite: Record<string, unknown> = { artist_id: artistId, ...plan.bibleSet, updated_at: now }
  if (plan.extrasSet) bibleWrite.playbook_extras = { ...review.extras, ...plan.extrasSet }
  if (Object.keys(plan.bibleSet).length || plan.extrasSet) {
    const { error } = await supabase.from('artist_bibles').upsert(bibleWrite, { onConflict: 'artist_id' })
    if (error) return { ok: false, error: error.message }
  }

  if (plan.assetRows.length) {
    const { error } = await supabase.from('content_assets').insert(
      plan.assetRows.map(r => ({
        scope: 'artist',
        artist_id: artistId,
        category: r.category,
        title: r.title,
        url: r.url,
        asset_type: r.assetType,
        notes: r.notes,
        why_added: r.whyAdded,
        module_key: r.moduleKey,
        family_tags: [],
      })),
    )
    if (error) return { ok: false, error: error.message }
  }

  const { error: revErr } = await supabase.from('playbook_reviews').upsert(
    {
      artist_id: artistId,
      field_key: fieldKey,
      status: 'accepted',
      answer_snapshot: value,
      accepted_value: { proposed: plan.proposed, edited: opts.edited ?? null, replaced: !!plan.conflict },
      reviewed_by: ADMIN,
      reviewed_at: now,
    },
    { onConflict: 'artist_id,field_key' },
  )
  if (revErr) return { ok: false, error: revErr.message }
  return { ok: true }
}

export async function acceptPlaybookField(artistId: string, fieldKey: string, opts: AcceptOptions = {}): Promise<Result & { conflict?: boolean }> {
  await requireAdmin()
  const res = await applyAccept(artistId, fieldKey, opts)
  if (res.ok) refresh(artistId)
  return res
}

/** Accepts every not-yet-reviewed answer in a module whose Hub destination is empty or already the same. Conflicts are left for a person. */
export async function acceptPlaybookModuleSafe(artistId: string, moduleKey: string): Promise<Result & { accepted?: number; left?: number }> {
  await requireAdmin()
  if (!MODULE_BY_KEY[moduleKey]) return { ok: false, error: 'Unknown module.' }
  const review = await loadArtistReview(artistId)
  let accepted = 0
  let left = 0
  for (const f of review.fields) {
    if (f.moduleKey !== moduleKey || f.status === 'accepted' || f.status === 'skipped') continue
    if (f.conflict) { left++; continue }
    const res = await applyAccept(artistId, f.fieldKey, {})
    if (res.ok) accepted++
    else left++
  }
  refresh(artistId)
  return { ok: true, accepted, left }
}

export async function skipPlaybookField(artistId: string, fieldKey: string): Promise<Result> {
  await requireAdmin()
  const ref = PARTS[fieldKey]
  if (!ref) return { ok: false, error: 'Unknown field.' }
  const supabase = createAdminClient()
  const { data } = await supabase.from('playbook_answers').select('value').eq('artist_id', artistId).eq('field_key', fieldKey).maybeSingle()
  const { error } = await supabase.from('playbook_reviews').upsert(
    {
      artist_id: artistId,
      field_key: fieldKey,
      status: 'skipped',
      answer_snapshot: cleanValue(ref.part, data?.value),
      accepted_value: null,
      reviewed_by: ADMIN,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: 'artist_id,field_key' },
  )
  if (error) return { ok: false, error: error.message }
  refresh(artistId)
  return { ok: true }
}

/** Puts an answer back to "needs review". Does not undo what was already written to the Hub. */
export async function resetPlaybookReview(artistId: string, fieldKey: string): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('playbook_reviews').delete().eq('artist_id', artistId).eq('field_key', fieldKey)
  if (error) return { ok: false, error: error.message }
  refresh(artistId)
  return { ok: true }
}
