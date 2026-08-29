'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getAudiusUser, getUserPfp } from '@/lib/audius'
import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

// Server Actions are callable directly once their action ID is known — the
// layout's redirect check does not protect them. Every action re-checks here.
async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_authed')?.value !== '1') {
    throw new Error('Unauthorized')
  }
}

type Result = { ok: boolean; error?: string }

// ─── League Bible ─────────────────────────────────────────────────────────────

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

// ─── Artist Bible ─────────────────────────────────────────────────────────────

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
}): Promise<Result> {
  await requireAdmin()
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
// artist_profiles row (the DB trigger adds the empty Identity Bible) for any
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
