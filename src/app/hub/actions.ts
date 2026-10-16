'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getAudiusUser, getUserPfp } from '@/lib/audius'
import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

// Server Actions are callable directly once their action ID is known — the
// layout's redirect check does not protect them. Every action re-checks here.
async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (!(await verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE)?.value))) {
    throw new Error('Unauthorized')
  }
}

type Result = { ok: boolean; error?: string }

// ─── League Archive ───────────────────────────────────────────────────────────────

export async function upsertLeagueBible(payload: Record<string, unknown>): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('league_bible')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/hub/league')
  revalidatePath('/hub')
  return { ok: true }
}

// ─── Artist Archive ───────────────────────────────────────────────────────────────

export async function upsertArtistBible(
  artistId: string,
  payload: Record<string, unknown>,
): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('artist_bibles')
    .upsert({ artist_id: artistId, ...payload, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/hub/artists/${artistId}`)
  revalidatePath('/hub/artists')
  revalidatePath('/hub')
  return { ok: true }
}

// Founding-artist flag and rollout batch (who gets the Playbook first).
export async function setArtistRollout(artistId: string, founding: boolean, batch: number | null): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('artist_bibles')
    .upsert({ artist_id: artistId, founding, batch, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/hub/artists/${artistId}`)
  revalidatePath('/hub/artists')
  revalidatePath('/hub')
  return { ok: true }
}

// ─── Battle Thesis ────────────────────────────────────────────────────────────

export async function upsertBattleThesis(
  eventSlug: string,
  payload: Record<string, unknown>,
): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('battle_theses')
    .upsert({ event_slug: eventSlug, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'event_slug' })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/hub/events/${eventSlug}`)
  revalidatePath('/hub/events')
  revalidatePath('/hub')
  return { ok: true }
}

export async function setRunwayItem(eventSlug: string, runway: Record<string, boolean>): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('battle_theses')
    .upsert({ event_slug: eventSlug, runway, updated_at: new Date().toISOString() }, { onConflict: 'event_slug' })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/hub/events/${eventSlug}`)
  return { ok: true }
}

// Toggle ONE runway item. Merges server-side so several checklists on one page
// (one per flywheel stage) cannot overwrite each other with stale state.
export async function setRunwayKey(eventSlug: string, key: string, value: boolean): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase.from('battle_theses').select('runway').eq('event_slug', eventSlug).maybeSingle()
  const next = { ...((data?.runway as Record<string, boolean>) ?? {}), [key]: value }
  const { error } = await supabase
    .from('battle_theses')
    .upsert({ event_slug: eventSlug, runway: next, updated_at: new Date().toISOString() }, { onConflict: 'event_slug' })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/hub/events/${eventSlug}`)
  return { ok: true }
}

// ─── Modules ──────────────────────────────────────────────────────────────────
// Progress per module per subject ('league' | 'artist:<id>' | 'event:<slug>').
// Done modules are hidden in the Hub by default; their saved links stay put.

const MODULE_STATUSES = ['not_started', 'in_progress', 'done']

function revalidateSubject(subject: string) {
  revalidatePath('/hub')
  if (subject === 'league') revalidatePath('/hub/league')
  else if (subject.startsWith('artist:')) { revalidatePath(`/hub/artists/${subject.slice(7)}`); revalidatePath('/hub/artists') }
  else if (subject.startsWith('event:')) { revalidatePath(`/hub/events/${subject.slice(6)}`); revalidatePath('/hub/events') }
}

export async function setModuleStatus(subject: string, moduleKey: string, status: string): Promise<Result> {
  await requireAdmin()
  if (!MODULE_STATUSES.includes(status)) return { ok: false, error: 'Unknown status' }
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await supabase.from('hub_modules').upsert({
    subject,
    module_key: moduleKey,
    status,
    completed_at: status === 'done' ? now : null,
    updated_at: now,
  }, { onConflict: 'subject,module_key' })
  if (error) return { ok: false, error: error.message }
  revalidateSubject(subject)
  return { ok: true }
}

export async function setModuleChecklistItem(subject: string, moduleKey: string, itemKey: string, value: boolean): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data } = await supabase.from('hub_modules').select('checklist,status').eq('subject', subject).eq('module_key', moduleKey).maybeSingle()
  const checklist = { ...((data?.checklist as Record<string, boolean>) ?? {}), [itemKey]: value }
  const status = data?.status && data.status !== 'not_started' ? data.status : 'in_progress'
  const { error } = await supabase.from('hub_modules').upsert({
    subject, module_key: moduleKey, checklist, status, updated_at: new Date().toISOString(),
  }, { onConflict: 'subject,module_key' })
  if (error) return { ok: false, error: error.message }
  revalidateSubject(subject)
  return { ok: true }
}

// ─── Storylines ───────────────────────────────────────────────────────────────

export async function upsertStoryline(payload: Record<string, unknown> & { id?: string | null }): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { id, ...rest } = payload
  const row = { ...rest, updated_at: new Date().toISOString() }
  const { error } = id
    ? await supabase.from('storylines').update(row).eq('id', id)
    : await supabase.from('storylines').insert(row)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/hub/storylines')
  revalidatePath('/hub')
  return { ok: true }
}

export async function deleteStoryline(id: string): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('storylines').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/hub/storylines')
  return { ok: true }
}

// ─── Sponsor Inventory ────────────────────────────────────────────────────────

export async function upsertSponsorProperty(payload: Record<string, unknown> & { id?: string | null }): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { id, ...rest } = payload
  const row = { ...rest, updated_at: new Date().toISOString() }
  const { error } = id
    ? await supabase.from('sponsor_inventory').update(row).eq('id', id)
    : await supabase.from('sponsor_inventory').insert(row)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/hub/sponsors')
  revalidatePath('/hub')
  return { ok: true }
}

export async function deleteSponsorProperty(id: string): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('sponsor_inventory').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/hub/sponsors')
  return { ok: true }
}

// ─── Content Assets ───────────────────────────────────────────────────────────

export async function addContentAsset(payload: {
  scope: string
  artistId?: string | null
  eventSlug?: string | null
  category: string
  franchise?: string | null
  title: string
  url?: string | null
  assetType?: string
  notes?: string | null
  whyAdded: string
  moduleKey?: string | null
  familyTags?: string[]
}): Promise<Result> {
  await requireAdmin()
  // Every piece of content must say why it is here and what it adds to the
  // WaveWarZ lore, archive or history.
  if (!payload.whyAdded?.trim()) {
    return { ok: false, error: 'Say why this is being added and what it brings to the WaveWarZ lore, archive or history.' }
  }
  const supabase = createAdminClient()
  const { error } = await supabase.from('content_assets').insert({
    scope: payload.scope,
    artist_id: payload.artistId ?? null,
    event_slug: payload.eventSlug ?? null,
    category: payload.category,
    franchise: payload.franchise ?? null,
    title: payload.title,
    url: payload.url ?? null,
    asset_type: payload.assetType ?? 'link',
    notes: payload.notes ?? null,
    why_added: payload.whyAdded.trim(),
    module_key: payload.moduleKey ?? null,
    family_tags: payload.familyTags ?? [],
  })
  if (error) return { ok: false, error: error.message }
  if (payload.artistId) revalidatePath(`/hub/artists/${payload.artistId}`)
  if (payload.eventSlug) revalidatePath(`/hub/events/${payload.eventSlug}`)
  revalidatePath('/hub/league')
  return { ok: true }
}

export async function deleteContentAsset(id: string, revalidate?: string): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('content_assets').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  if (revalidate) revalidatePath(revalidate)
  return { ok: true }
}

// ─── Roster + avatar sync ─────────────────────────────────────────────────────
// Keeps the Hub roster in lock-step with the live Artist Leaderboard: creates an
// artist_profiles row (the DB trigger adds the empty Artist Archive) for any
// leaderboard artist that doesn't have one yet, then resolves + persists avatars.
// Records, events, rankings and stats are already live-synced (every /hub page is
// force-dynamic and reuses the same shared libs as wavewarz.info / the API), so
// roster membership is the only thing this button has to reconcile.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function syncRoster(): Promise<Result & { added?: number }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const [{ rows }, profilesRes, walletsRes] = await Promise.all([
    getArtistLeaderboard(),
    supabase.from('artist_profiles').select('primary_wallet,display_name'),
    supabase.from('artist_wallets').select('wallet_address'),
  ])
  const known = new Set<string>()
  for (const p of profilesRes.data ?? []) if (p.primary_wallet) known.add(p.primary_wallet)
  for (const w of walletsRes.data ?? []) known.add(w.wallet_address)

  const toAdd = rows
    .filter(r => r.wallet && !UUID_RE.test(r.wallet) && !known.has(r.wallet))
    .map(r => {
      const handle = (r.twitterHandle ?? '').split(/\s+/)[0].replace(/^@/, '') || null
      return {
        display_name: r.name,
        primary_wallet: r.wallet,
        twitter_handle: handle,
        profile_picture_url: r.pfpUrl ?? (handle ? `https://unavatar.io/twitter/${handle}` : null),
      }
    })

  let added = 0
  if (toAdd.length) {
    const { data, error } = await supabase.from('artist_profiles').insert(toAdd).select('artist_id')
    if (error) return { ok: false, error: error.message }
    added = data?.length ?? 0
  }
  revalidatePath('/hub')
  revalidatePath('/hub/artists')
  revalidatePath('/hub/events')
  return { ok: true, added }
}

// Resolve every roster artist's avatar the same way the Artist Leaderboard does
// (stored pfp → Twitter via unavatar → Audius photo) and PERSIST it to
// artist_profiles.profile_picture_url, so the Hub and the public leaderboard
// show identical, stored faces instead of computed-on-the-fly fallbacks.
export async function syncArtistAvatars(): Promise<Result & { updated?: number }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('artist_profiles')
    .select('artist_id,display_name,twitter_handle,audius_handle,profile_picture_url,custom_pfp_url,primary_wallet')
  if (!profiles) return { ok: false, error: 'Could not load profiles' }

  let updated = 0
  for (const p of profiles) {
    if (p.profile_picture_url) continue // already stored — leave it
    let url: string | null = p.custom_pfp_url as string | null
    if (!url && p.twitter_handle) {
      url = `https://unavatar.io/twitter/${(p.twitter_handle as string).replace(/^@/, '')}`
    }
    if (!url && p.audius_handle) {
      try {
        const audiusUser = await getAudiusUser(p.audius_handle as string)
        const audiusPfp = getUserPfp(audiusUser)
        if (audiusUser && audiusPfp && !audiusPfp.startsWith('/placeholder')) url = audiusPfp
      } catch { /* ignore */ }
    }
    if (!url) continue
    const { error } = await supabase.from('artist_profiles').update({ profile_picture_url: url }).eq('artist_id', p.artist_id)
    if (!error) {
      updated++
      if (p.primary_wallet) revalidatePath(`/artist/${p.primary_wallet}`)
    }
  }
  revalidatePath('/hub')
  revalidatePath('/hub/artists')
  revalidatePath('/hub/events')
  revalidatePath('/leaderboards/artists')
  return { ok: true, updated }
}

// ─── Record Book Marks ────────────────────────────────────────────────────────

export async function setRecordMark(payload: {
  markKey: string
  label: string
  artistId?: string | null
  valueText?: string | null
  battleId?: number | null
  note?: string | null
}): Promise<Result> {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('record_book_marks').upsert({
    mark_key: payload.markKey,
    label: payload.label,
    artist_id: payload.artistId ?? null,
    value_text: payload.valueText ?? null,
    battle_id: payload.battleId ?? null,
    note: payload.note ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'mark_key' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/hub/league')
  return { ok: true }
}
