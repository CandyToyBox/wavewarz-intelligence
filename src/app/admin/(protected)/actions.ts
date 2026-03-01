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
    .update({ winner_artist_a: payload.winner === 'a', winner_decided: true })
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
