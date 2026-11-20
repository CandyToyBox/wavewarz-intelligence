// The WaveWarZ front end is one site in two apps: wavewarz.com (battles, trading, the homepage) and wavewarz.info (stats,
// leaderboards, calendar, blog). Each keeps its own repo, data and backend. They share the nav, footer and look, and link
// to each other with these bases. Set NEXT_PUBLIC_MAIN_SITE to point the main-site links somewhere else (a preview, or
// a rewrite such as https://www.wavewarz.com once both apps sit under one domain).
export const MAIN_SITE = (process.env.NEXT_PUBLIC_MAIN_SITE || 'https://www.wavewarz.com').replace(/\/$/, '')

export const main = (path = '/') => MAIN_SITE + (path.startsWith('/') ? path : '/' + path)

export const WATCH = [
  { href: 'https://x.com/wavewarz', label: 'Watch on X' },
  { href: 'https://kick.com/wavewarz', label: 'Watch on Kick' },
  { href: 'https://www.twitch.tv/wavewarzofficial', label: 'Watch on Twitch' },
]

// The main nav: identical on both apps. Stats is this app.
export const MAIN_NAV = [
  { href: main('/#tonight'), label: 'Schedule' },
  { href: main('/#how-it-works'), label: 'How it works' },
  { href: main('/#for-artists'), label: 'For Artists' },
  { href: main('/quick-battles'), label: 'Queue' },
  { href: '/', label: 'Statz', stats: true },
  { href: 'https://merch.wavewarz.info', label: 'Merch', external: true },
]

// The Stats section's own pages
export const STATS_NAV = [
  { href: '/', label: 'Overview' },
  { href: '/battles', label: 'Battles' },
  { href: '/leaderboards', label: 'Leaderboards' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/voter-guide', label: 'Voter guide' },
  { href: '/wavid', label: 'WavID' },
  { href: '/benefits', label: 'Benefits' },
  { href: '/blog', label: 'Blog' },
  { href: '/api-docs', label: 'API' },
  { href: 'https://claim.wavewarz.info', label: 'Claim', external: true },
]
