import { buildAnatomyCallouts, calloutLabelBox, visibleCallouts } from './core/callouts.mjs'
import { findWavIdArtist, getWavIdRoster, wavIdDefinition } from './roster'

// The Wave ID an artist page shows, plus the three callouts Quan's card reveals
// when the whole ID is in view (studio/src/card/callouts.mjs, WavID #12): the
// loudest song on a band, battle activity on a node, win ratio on a cavity.
// Labels, wording and anchor points come from that module unchanged, so the
// artist page says exactly what /wavid/card/<handle> says.

export type ArtistCallout = {
  id: string
  kind: 'band' | 'node' | 'cavity'
  kicker: string
  title: string
  detail: string
  aria: string
  /** anatomy point on the 1080 square the renderer draws */
  ax: number
  ay: number
  /** Quan's label slot for the full view: which side, and its height on the square */
  side: 'left' | 'right'
  ly: number
}

export type ArtistWavId = {
  handle: string
  checkedAt: string
  callouts: ArtistCallout[]
}

export async function getArtistWavId(who: {
  audiusHandle: string | null
  wallets: string[]
  name: string
}): Promise<ArtistWavId | null> {
  const roster = await getWavIdRoster()
  if (!roster) return null
  let artist = findWavIdArtist(roster, { audiusHandle: who.audiusHandle, name: null })
  for (const w of who.wallets) artist ??= findWavIdArtist(roster, { wallet: w })
  artist ??= findWavIdArtist(roster, { name: who.name })
  if (!artist) return null
  try {
    const definition = wavIdDefinition(artist, roster)
    const all = buildAnatomyCallouts(definition)
    const callouts = visibleCallouts(all, 'form').map((c: {
      id: string; kind: ArtistCallout['kind']; kicker: string; title: string; detail: string; aria: string; anchor: { x: number; y: number }
    }) => {
      const box = calloutLabelBox(c, 'form')
      return {
        id: c.id, kind: c.kind, kicker: c.kicker, title: c.title, detail: c.detail, aria: c.aria,
        ax: c.anchor.x, ay: c.anchor.y, side: box.align === 'left' ? 'left' : 'right', ly: box.y,
      } satisfies ArtistCallout
    })
    return { handle: artist.identity.audiusHandle, checkedAt: roster.checkpoint.checkedAt, callouts }
  } catch (err) {
    console.error('[wavid] artist definition failed:', err)
    return null
  }
}
