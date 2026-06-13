/**
 * Canonical song identity for quick-battle song-level analytics.
 *
 * Quick Battles are song vs song, but the only "name" the smart contract
 * stores is artist1_name/artist2_name — which for a Quick Battle holds the
 * SONG TITLE, hand-entered and inconsistent ("OldWavez" vs "OldWavez *NIGHT*
 * Edition"). Keying songs by that title string both splits one track across
 * rows and merges two different tracks that happen to share a title.
 *
 * The stable identity is the track's music-link permalink:
 *   https://audius.co/{handle}/{slug}  →  key "{handle}/{slug}"
 * That path is unique per track and doesn't change when the displayed title
 * is typed differently. Non-Audius links (untitled.stream, etc.) key on their
 * normalized URL path. Only when there is no link at all do we fall back to
 * the normalized title.
 *
 * (A fully canonical id would resolve each link to the Audius track `id` via
 * the API — survives handle renames — but that costs one request per song.
 * The permalink path is free, instant, and correct for the vast majority.)
 */

/** Stable grouping key for a song, given its music link and displayed title. */
export function canonicalSongKey(musicLink: string | null | undefined, title: string | null | undefined): string {
  if (musicLink) {
    const audius = musicLink.match(/audius\.co\/([^/?#]+\/[^/?#]+)/i)
    if (audius) return `audius:${audius[1].toLowerCase()}`
    try {
      const u = new URL(musicLink)
      return `${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, '')
    } catch {
      return musicLink.toLowerCase().trim()
    }
  }
  return `title:${(title ?? '').toLowerCase().trim()}`
}

/** The Audius handle (artist) from a music link, for display/links. */
export function audiusHandle(musicLink: string | null | undefined): string | null {
  if (!musicLink) return null
  const m = musicLink.match(/audius\.co\/([^/?#]+)/i)
  return m ? m[1] : null
}
