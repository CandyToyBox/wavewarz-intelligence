'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Judging ──────────────────────────────────────────────────────────────────

type JudgingPayload = {
  battleId: number
  humanJudge: 'a' | 'b'
  xPoll: 'a' | 'b'
  solVote: 'a' | 'b'
  winner: 'a' | 'b'
}

export async function submitJudging(payload: JudgingPayload): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('battles')
    .update({ winner_artist_a: payload.winner === 'a' ? 1 : 0, winner_decided: true })
    .eq('battle_id', payload.battleId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin')
  return { ok: true }
}

// ─── Battle Media ─────────────────────────────────────────────────────────────

export async function updateBattleMedia(payload: {
  battleId: number
  youtubeReplayLink: string | null
  streamLink: string | null
  imageUrl: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('battles')
    .update({
      youtube_replay_link: payload.youtubeReplayLink || null,
      stream_link: payload.streamLink || null,
      image_url: payload.imageUrl || null,
    })
    .eq('battle_id', payload.battleId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin')
  return { ok: true }
}

// ─── Artist Profiles ──────────────────────────────────────────────────────────

export async function upsertArtistProfile(payload: {
  artistId: string | null
  displayName: string
  primaryWallet: string
  audiusHandle: string | null
  twitterHandle: string | null
  pfpUrl: string | null
  bio: string | null
  youtubeUrl: string | null
  instagramHandle: string | null
  tiktokHandle: string | null
}): Promise<{ ok: boolean; artistId?: string; error?: string }> {
  const supabase = await createAdminClient()

  const socialLinks = {
    ...(payload.youtubeUrl ? { youtube: payload.youtubeUrl } : {}),
    ...(payload.instagramHandle ? { instagram: payload.instagramHandle } : {}),
    ...(payload.tiktokHandle ? { tiktok: payload.tiktokHandle } : {}),
  }

  if (payload.artistId) {
    const { error } = await supabase
      .from('artist_profiles')
      .update({
        display_name: payload.displayName,
        primary_wallet: payload.primaryWallet,
        audius_handle: payload.audiusHandle || null,
        twitter_handle: payload.twitterHandle || null,
        profile_picture_url: payload.pfpUrl || null,
        bio: payload.bio || null,
        social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      })
      .eq('artist_id', payload.artistId)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin')
    revalidatePath(`/artist/${payload.primaryWallet}`)
    return { ok: true, artistId: payload.artistId }
  } else {
    const { data, error } = await supabase
      .from('artist_profiles')
      .insert({
        display_name: payload.displayName,
        primary_wallet: payload.primaryWallet,
        audius_handle: payload.audiusHandle || null,
        twitter_handle: payload.twitterHandle || null,
        profile_picture_url: payload.pfpUrl || null,
        bio: payload.bio || null,
        social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      })
      .select('artist_id')
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin')
    return { ok: true, artistId: data.artist_id }
  }
}

export async function linkWalletToArtist(payload: {
  artistId: string
  walletAddress: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('artist_wallets')
    .upsert({ wallet_address: payload.walletAddress, artist_id: payload.artistId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin')
  return { ok: true }
}

export async function unlinkWallet(walletAddress: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('artist_wallets')
    .delete()
    .eq('wallet_address', walletAddress)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteArtistProfile(artistId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('artist_profiles')
    .delete()
    .eq('artist_id', artistId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin')
  return { ok: true }
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

type CalendarEventRow = {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  event_type: string
  location_or_link: string | null
  flyer_url: string | null
  is_featured: boolean
  is_active: boolean
}

function formDataToCalendarEvent(fd: FormData) {
  return {
    title: String(fd.get('title') ?? '').trim(),
    description: String(fd.get('description') ?? '').trim() || null,
    event_date: String(fd.get('event_date') ?? ''),
    event_time: String(fd.get('event_time') ?? '').trim() || null,
    event_type: String(fd.get('event_type') ?? 'BATTLE'),
    location_or_link: String(fd.get('location_or_link') ?? '').trim() || null,
    flyer_url: String(fd.get('flyer_url') ?? '').trim() || null,
    is_featured: fd.get('is_featured') === 'on',
    is_active: fd.get('is_active') === 'on',
  }
}

export async function addCalendarEvent(fd: FormData): Promise<{ event?: CalendarEventRow; error?: string }> {
  const supabase = await createAdminClient()
  const payload = formDataToCalendarEvent(fd)
  if (!payload.title || !payload.event_date) return { error: 'Title and date are required.' }
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(payload)
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin')
  return { event: data as CalendarEventRow }
}

export async function updateCalendarEvent(id: string, fd: FormData): Promise<{ event?: CalendarEventRow; error?: string }> {
  const supabase = await createAdminClient()
  const payload = formDataToCalendarEvent(fd)
  if (!payload.title || !payload.event_date) return { error: 'Title and date are required.' }
  const { data, error } = await supabase
    .from('calendar_events')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin')
  return { event: data as CalendarEventRow }
}

export async function deleteCalendarEvent(id: string): Promise<{ error?: string }> {
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin')
  return {}
}

// ─── Platform Stats ───────────────────────────────────────────────────────────

type PlatformStatsRow = {
  spotify_monthly_streams: number
  spotify_total_streams: number
  spotify_profile_url: string | null
}

export async function updatePlatformStats(fd: FormData): Promise<{ stats?: PlatformStatsRow; error?: string }> {
  const supabase = await createAdminClient()
  const payload = {
    spotify_monthly_streams: parseInt(String(fd.get('spotify_monthly_streams') ?? '0')) || 0,
    spotify_total_streams: parseInt(String(fd.get('spotify_total_streams') ?? '0')) || 0,
    spotify_profile_url: String(fd.get('spotify_profile_url') ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('platform_stats')
    .update(payload)
    .eq('id', 1)
    .select('spotify_monthly_streams, spotify_total_streams, spotify_profile_url')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin')
  return { stats: data as PlatformStatsRow }
}
