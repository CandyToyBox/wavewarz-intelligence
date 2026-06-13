// ==========================================
// AUDIUS API WRAPPER
// Docs: https://docs.audius.org/developers/
// All fetches cache for 60 seconds (Next.js revalidation).
//
// Audius has no single fixed host — discovery nodes rotate and individual
// ones go down (the old hardcoded `discoveryprovider.audius.co` now 404s,
// which is why album art stopped loading). The correct pattern: ask
// `https://api.audius.co` for the current list of healthy nodes, cache it,
// and fall back to the next node on failure. Every request must carry an
// `app_name` or Audius rate-limits it.
// ==========================================

const APP_NAME = 'WaveWarz'
const DISCOVERY_DIRECTORY = 'https://api.audius.co'
// Always-valid fallback: api.audius.co itself proxies to a healthy node.
const FALLBACK_HOSTS = ['https://api.audius.co']

let cachedHosts: string[] | null = null
let hostsFetchedAt = 0
const HOSTS_TTL_MS = 30 * 60 * 1000 // refresh the node list every 30 min

async function getHosts(): Promise<string[]> {
  if (cachedHosts && Date.now() - hostsFetchedAt < HOSTS_TTL_MS) return cachedHosts
  try {
    const res = await fetch(DISCOVERY_DIRECTORY, { next: { revalidate: 1800 } })
    if (res.ok) {
      const json = await res.json()
      const hosts = Array.isArray(json?.data) ? json.data.filter((h: unknown): h is string => typeof h === 'string') : []
      if (hosts.length) {
        cachedHosts = hosts
        hostsFetchedAt = Date.now()
        return hosts
      }
    }
  } catch { /* fall through to fallback */ }
  return FALLBACK_HOSTS
}

/** GET an Audius API path across healthy nodes, appending app_name, with failover. */
async function audiusGet(path: string): Promise<unknown | null> {
  const hosts = await getHosts()
  const sep = path.includes('?') ? '&' : '?'
  for (const host of hosts.slice(0, 4)) {
    try {
      const res = await fetch(`${host}/v1${path}${sep}app_name=${APP_NAME}`, { next: { revalidate: 60 } })
      if (!res.ok) continue
      return await res.json()
    } catch { /* try next node */ }
  }
  return null
}

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
  const json = await audiusGet(`/resolve?url=${encodeURIComponent(url)}`)
  return (json as { data?: AudiusTrack } | null)?.data ?? null
}

/** Fetch a user profile by Audius handle */
export async function getAudiusUser(handle: string): Promise<AudiusUser | null> {
  if (!handle) return null
  const json = await audiusGet(`/users/handle/${encodeURIComponent(handle)}`)
  return (json as { data?: AudiusUser } | null)?.data ?? null
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
