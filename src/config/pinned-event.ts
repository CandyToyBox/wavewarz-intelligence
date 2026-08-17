// The event currently pinned on the WaveWarZ X account (@wavewarz).
// Samantha makes every flyer/animation locally — when a new post is pinned,
// drop the asset into public/events/ and update this file (or let the
// future ops/sync-pinned-event script rewrite it).

export type MatchupSide = {
  name: string
  role: string
  img: string
}

export type PinnedEvent = {
  /** Small eyebrow label above the section, e.g. "Main Event" or "Live Tournament" */
  sectionLabel: string
  /** Section headline, e.g. tournament or event name */
  title: string
  /** One-line description shown under the title */
  subtitle: string
  /** Short badge label, e.g. "Tonight 7PM EST" or "In Progress" */
  badge: string
  /** Small label above the title in the right-hand panel */
  eyebrow: string
  /** Emoji shown next to the title in the right-hand panel */
  icon: string
  /** Fact bullets shown under the subtitle */
  bullets: string[]
  /** "video" renders an autoplaying muted loop; "image" renders a flyer; "matchup" renders a two-photo VS card */
  mediaType: 'video' | 'image' | 'matchup'
  /** Path under /public, e.g. /events/ai-tournament-bracket.mp4 (video/image only) */
  src?: string
  /** Poster image for video media (path under /public) */
  poster?: string
  /** Two-photo VS layout (matchup only) */
  matchup?: { side1: MatchupSide; side2: MatchupSide; vsLabel: string }
  /** Where clicking the media/CTA goes */
  href: string
  /** CTA label */
  cta: string
}

export const pinnedEvent: PinnedEvent = {
  sectionLabel: 'Main Event',
  title: 'The Founder Challenge',
  subtitle:
    'GODCLOUD holds the #1 song on WaveWarZ — then he called out the founder. Hurric4n3Ike built this arena; now he steps into it for the first time. Sunday, August 23 · 7PM EST, live on X and YouTube.',
  badge: 'SUN AUG 23 · 7PM EST',
  eyebrow: 'Main Event — Founder vs. #1 Song',
  icon: '⚔️',
  bullets: [
    'GODCLOUD’s #1 song "Fuck Yo Feelingz" is 21–06 across 27 Quick Battlez — the winningest track on the platform',
    'Hurric4n3Ike has never fought a Main Event before — this is his first time in the arena he built',
    '1,400 battles settled onchain, 13.88 SOL paid to artists — automatically, every time',
    'Winner decided 2-of-3: Human Judge + X Poll + SOL Vote',
  ],
  mediaType: 'video',
  src: '/events/founder-challenge/founder-challenge.mp4',
  poster: '/events/founder-challenge/founder-challenge-flyer.jpg',
  href: 'https://x.com/wavewarz',
  cta: 'Follow the Founder Challenge on X',
}
