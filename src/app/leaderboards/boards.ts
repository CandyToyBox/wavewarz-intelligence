// The five leaderboards, one source for the hub cards, the board tabs and each board's header.
// Accent colours are the redesign's: green and blue for the two battle sides, the rest from the
// Wave ID palette (aqua, oxide-amber, sodium) in wavewarz-homepage-candy-work/index.html.
export type BoardKey = 'artists' | 'songs' | 'community' | 'traders' | 'clippers'

export type Board = {
  key: BoardKey
  href: string
  tab: string
  label: string
  title: [string, string]
  accent: string
  desc: string
  stats: string[]
}

export const BOARDS: Board[] = [
  {
    key: 'artists',
    href: '/leaderboards/artists',
    tab: 'Artists',
    label: 'Main Events',
    title: ['Artist', 'Rankings'],
    accent: '#95fe7c',
    desc: 'Main event competitors ranked by wins, volume, and onchain earnings.',
    stats: ['Win / Loss record by Main Event', 'Total SOL traded by fans', 'Artist earnings: 1% fees + settlement bonus', 'Win rate %'],
  },
  {
    key: 'songs',
    href: '/leaderboards/songs',
    tab: 'Songs',
    label: 'Quick Battles',
    title: ['Song', 'Charts'],
    accent: '#7ec1fb',
    desc: 'Tracks ranked by quick battle performance. Album art from Audius. Winner: 2-of-3 (Poll + Charts + DJ Wavy AI Judge).',
    stats: ['Trending score: velocity × recency × engagement', 'Win / Loss record', 'Total SOL volume', 'Battle count & unique traders'],
  },
  {
    key: 'community',
    href: '/leaderboards/community',
    tab: 'Community',
    label: 'Community',
    title: ['Community', 'Rankings'],
    accent: '#76f3df',
    desc: 'Community battle competitors ranked by wins and trading volume. Battle artwork shown per entry.',
    stats: ['Win / Loss record', 'Total SOL traded', 'Win rate %', 'Battle count'],
  },
  {
    key: 'traders',
    href: '/leaderboards/traders',
    tab: 'Traders',
    label: 'All Battles',
    title: ['Trader', 'Rankings'],
    accent: '#f2a74b',
    desc: 'Fans and traders ranked by total SOL traded. Click any wallet to see its public onchain record.',
    stats: ['Total SOL traded across all battles', 'How often they backed the winning side', 'Net SOL (received back minus spent)', 'Live onchain scan per wallet'],
  },
  {
    key: 'clippers',
    href: '/leaderboards/clippers',
    tab: 'Clippers',
    label: 'Community Clips',
    title: ['Clipper', 'Rankings'],
    accent: '#e5c25a',
    desc: 'Community contributors ranked by clip submissions, approvals, and points. Many are also active battle artists.',
    stats: ['Clips submitted → approved → posted', 'Points earned', 'Battle record (if they compete)', 'SOL wallet for future rewards'],
  },
]

export const board = (key: BoardKey) => BOARDS.find(b => b.key === key)!
