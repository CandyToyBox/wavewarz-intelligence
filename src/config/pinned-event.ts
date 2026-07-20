// The event currently pinned on the WaveWarZ X account (@wavewarz).
// Samantha makes every flyer/animation locally — when a new post is pinned,
// drop the asset into public/events/ and update this file (or let the
// future ops/sync-pinned-event script rewrite it).

export type PinnedEvent = {
  /** Section headline, e.g. tournament or event name */
  title: string
  /** One-line description shown under the title */
  subtitle: string
  /** Short badge label, e.g. "Tonight 7PM EST" or "In Progress" */
  badge: string
  /** "video" renders an autoplaying muted loop; "image" renders a flyer */
  mediaType: 'video' | 'image'
  /** Path under /public, e.g. /events/ai-tournament-bracket.mp4 */
  src: string
  /** Poster image for video media (path under /public) */
  poster?: string
  /** Where clicking the media/CTA goes */
  href: string
  /** CTA label */
  cta: string
}

export const pinnedEvent: PinnedEvent = {
  title: 'AI Artist Tournament',
  subtitle:
    'Semifinal result: GEEK MYTH def. LUI 2 rounds to 1 — a 342 SOL event, 8.7x the biggest in WaveWarZ history. The equivalent of 8.9M Spotify streams traded in one night.',
  badge: 'RECORD NIGHT · 342 SOL',
  mediaType: 'video',
  src: '/events/ai-tournament-bracket.mp4',
  poster: '/events/ai-tournament-bracket-poster.jpg',
  href: 'https://x.com/wavewarz',
  cta: 'Grand Final next — follow on X',
}
