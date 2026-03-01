'use server'

// ==========================================
// IDENTITY RESOLVER
// Maps wallet addresses and song names → artist_profiles UUID
//
// Problem this solves:
//   - Quick Battles store SONG TITLES in artist1_name/artist2_name
//   - Artists use multiple wallets across different battles
//   - We need one canonical artist UUID for profile pages + leaderboard links
//
// Resolution chain:
//   wallet_address → artist_wallets → artist_profiles.artist_id
//   audius_handle  → artist_profiles.audius_handle → artist_profiles.artist_id
// ==========================================

import { createClient } from '@/lib/supabase/server'

/** Resolve a wallet address to an artist_profiles UUID.
 *  Returns null if no profile is linked yet.
 */
export async function resolveWalletToProfile(
  walletAddress: string
): Promise<string | null> {
  if (!walletAddress) return null
  const supabase = await createClient()

  const { data } = await supabase
    .from('artist_wallets')
    .select('artist_id')
    .eq('wallet_address', walletAddress)
    .single()

  return data?.artist_id ?? null
}

/** Resolve an Audius handle to an artist_profiles UUID.
 *  Returns null if no profile is linked yet.
 */
export async function resolveHandleToProfile(
  audiusHandle: string
): Promise<string | null> {
  if (!audiusHandle) return null
  const supabase = await createClient()

  const { data } = await supabase
    .from('artist_profiles')
    .select('artist_id')
    .eq('audius_handle', audiusHandle.toLowerCase())
    .single()

  return data?.artist_id ?? null
}

/** Full resolution: try wallet first, then Audius handle.
 *  Returns the artist UUID or null if unlinked.
 */
export async function resolveArtistIdentity(
  wallet: string,
  audiusHandle?: string
): Promise<string | null> {
  const byWallet = await resolveWalletToProfile(wallet)
  if (byWallet) return byWallet

  if (audiusHandle) {
    const byHandle = await resolveHandleToProfile(audiusHandle)
    if (byHandle) return byHandle
  }

  return null
}

/** Fetch a full artist profile by UUID */
export async function getArtistProfile(artistId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('artist_profiles')
    .select('*')
    .eq('artist_id', artistId)
    .single()

  if (error) return null
  return data
}

/** Fetch all battles (Main Events) for an artist UUID — both sides */
export async function getArtistBattles(artistId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .or(`artist_a_profile_id.eq.${artistId},artist_b_profile_id.eq.${artistId}`)
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}
