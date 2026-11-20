// Client-safe share-card options (no database imports). The numbers live in lib/share-cards.ts.
export const SHARE_KINDS = ['platform', 'battle', 'artist'] as const
export type ShareKind = (typeof SHARE_KINDS)[number]

export const SHARE_BACKGROUNDS = [
  { key: 'arena', label: 'Arena' },
  { key: 'wave', label: 'Waveform' },
  { key: 'split', label: 'VS split' },
  { key: 'minimal', label: 'Minimal' },
] as const
export type ShareBackground = (typeof SHARE_BACKGROUNDS)[number]['key']

export function isShareKind(k: string | null | undefined): k is ShareKind {
  return !!k && (SHARE_KINDS as readonly string[]).includes(k)
}

/** Image URL for a card. `look` is "<background>.<headline>", e.g. "arena.artists"; both parts are optional. */
export function shareImagePath(kind: ShareKind, id: string, look?: string | null) {
  const q = new URLSearchParams({ kind, id })
  if (look) q.set('look', look)
  return `/api/share-card?${q}`
}

/** A page's Open Graph image: the card the sharer picked (?card=bg.headline), or the default. */
export function shareOgImages(kind: ShareKind, id: string, card?: string | string[]) {
  const look = typeof card === 'string' && /^[a-z]+(\.[a-z]+)?$/.test(card) ? card : null
  return [{ url: shareImagePath(kind, id, look), width: 1200, height: 630 }]
}
