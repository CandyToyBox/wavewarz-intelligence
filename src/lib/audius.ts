// ==========================================
// AUDIUS API WRAPPER
// Docs: https://audiusproject.github.io/api-docs
// All fetches cache for 60 seconds (Next.js revalidation).
// ==========================================

const AUDIUS_API = 'https://discoveryprovider.audius.co/v1'

export type AudiusTrack = {
  id: string
  title: string
  genre?: string
  artwork: {
    '150x150': string
    '480x480': string
    '1000x1000': string
  } | null
  user: {
    id: string
    handle: string
    name: string
    profile_picture: {
      '150x150': string
      '480x480': string
      '1000x1000': string
    } | null
  }
  play_count: number
  permalink: string
}

export type AudiusUser = {
  id: string
  handle: string
  name: string
  follower_count: number
  profile_picture: {
    '150x150': string
    '480x480': string
    '1000x1000': string
  } | null
  cover_photo: {
    '640x': string
    '2000x': string
  } | null
  bio: string | null
  track_count: number
}

/** Resolve an Audius URL to a track object.
 *  Accepts full URLs like https://audius.co/handle/track-slug
 *  Returns null if the URL is not an Audius link or the fetch fails.
 */
export async function resolveAudiusTrack(url: string): Promise<AudiusTrack | null> {
  if (!url?.includes('audius.co')) return null
  try {
    const res = await fetch(
      `${AUDIUS_API}/resolve?url=${encodeURIComponent(url)}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.data as AudiusTrack
  } catch {
    return null
  }
}

/** Fetch a user profile by Audius handle */
export async function getAudiusUser(handle: string): Promise<AudiusUser | null> {
  if (!handle) return null
  try {
    const res = await fetch(
      `${AUDIUS_API}/users/handle/${handle}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.data as AudiusUser
  } catch {
    return null
  }
}

/** Get the best available artwork URL from an Audius track (prefers 480x480) */
export function getTrackArtwork(track: AudiusTrack | null, size: '150x150' | '480x480' | '1000x1000' = '480x480'): string {
  return track?.artwork?.[size] ?? '/placeholder-track.png'
}

/** Get the best available profile picture from an Audius user (prefers 480x480) */
export function getUserPfp(user: AudiusUser | null, size: '150x150' | '480x480' | '1000x1000' = '480x480'): string {
  return user?.profile_picture?.[size] ?? '/placeholder-artist.png'
}

/** Build a direct Audius track link from handle + slug */
export function buildAudiusUrl(handle: string, slug: string): string {
  return `https://audius.co/${handle}/${slug}`
}
