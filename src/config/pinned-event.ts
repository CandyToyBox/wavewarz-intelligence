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
  sectionLabel: 'Community Music Battle',
  title: 'MB WIF Hitmakerz vs Wave Warriorz',
  subtitle:
    'Two crews, one stage. MB WIF Hitmakerz take on Wave Warriorz in a Community Music Battle. Sunday, October 18 · 7PM EST, live on Twitch, X and Kick.',
  badge: 'SUN OCT 18 · 7PM EST',
  eyebrow: 'Community Music Battle',
  icon: '',
  bullets: [
    'Sunday, October 18 at 7PM EST',
    'Live on Twitch, X and Kick',
    'MB WIF Hitmakerz vs Wave Warriorz',
    'Every battle settles ONCHAIN on Solana',
  ],
  mediaType: 'image',
  src: '/events/community-battle-oct18/mbwif-vs-wave-warriorz-flyer.jpg',
  href: 'https://x.com/WaveWarZ/status/2109067564106100771',
  cta: 'See the announcement on X',
}
