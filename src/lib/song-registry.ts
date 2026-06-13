/**
 * Song registry resolution — shared by the settlement webhook (new songs
 * register the moment their battle settles) and the backfill script.
 *
 * Audius is an open protocol; the API is free. We resolve a song's music-link
 * permalink to its canonical Audius track once and cache the enrichment in the
 * song_registry table so pages never resolve at render time.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { canonicalSongKey } from './song-identity'

let HOSTS: string[] | null = null
async function audiusHost(): Promise<string> {
  if (HOSTS?.length) return HOSTS[0]
  try {
    const r = await fetch('https://api.audius.co', { next: { revalidate: 1800 } })
    const j = await r.json()
    if (Array.isArray(j?.data) && j.data.length) { HOSTS = j.data; return HOSTS![0] }
  } catch { /* fall through */ }
  return 'https://api.audius.co'
}

export type ResolvedSong = {
  audius_track_id: string
  title: string | null
  artist_name: string | null
  artist_handle: string | null
  genre: string | null
  artwork_url: string | null
  play_count: number | null
}

/** Resolve one Audius music link to its canonical track, or null. */
export async function resolveSong(musicLink: string): Promise<ResolvedSong | null> {
  if (!/audius\.co/i.test(musicLink)) return null   // only Audius links are resolvable
  const host = await audiusHost()
  try {
    const res = await fetch(`${host}/v1/resolve?url=${encodeURIComponent(musicLink)}&app_name=WaveWarZ`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const t = (await res.json())?.data
    if (!t?.id) return null
    return {
      audius_track_id: t.id,
      title: t.title ?? null,
      artist_name: t.user?.name ?? null,
      artist_handle: t.user?.handle ?? null,
      genre: t.genre ?? null,
      artwork_url: t.artwork?.['480x480'] ?? t.artwork?.['1000x1000'] ?? null,
      play_count: typeof t.play_count === 'number' ? t.play_count : null,
    }
  } catch { return null }
}

/**
 * Register (or refresh) the songs of a quick battle in song_registry.
 * Non-fatal: any failure is logged and swallowed so it never breaks the
 * caller (the settlement webhook). Skips non-Audius links.
 */
export async function registerBattleSongs(
  supabase: SupabaseClient,
  sides: { musicLink: string | null | undefined; title: string | null | undefined }[],
): Promise<void> {
  for (const { musicLink, title } of sides) {
    if (!musicLink || !/audius\.co/i.test(musicLink)) continue
    try {
      const resolved = await resolveSong(musicLink)
      if (!resolved) continue
      const { error } = await supabase.from('song_registry').upsert({
        permalink_key: canonicalSongKey(musicLink, title),
        music_link: musicLink,
        resolved_at: new Date().toISOString(),
        ...resolved,
      }, { onConflict: 'permalink_key' })
      if (error) console.warn('[song-registry] upsert failed:', error.message)
    } catch (e) {
      console.warn('[song-registry] resolve threw:', e instanceof Error ? e.message : String(e))
    }
  }
}
