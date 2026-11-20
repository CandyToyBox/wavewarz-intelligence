// Share cards for Statz pages. Every number is read from the database here, on the server, from the same
// math the pages use, so a shared card can never say something the page doesn't. The card URL only picks
// which page (kind + id), which headline and which background; it never carries numbers.
//
// Wording rules (homepage copy, Nov 11 2026): artists get paid win or lose; no profit, ROI or "winnings"
// language; trader results are not shared as cards at all.
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { platformMetrics, type MetricsBattle } from '@/lib/battle-metrics'
import { calculateArtistEarnings, getWinnerLoserPools, formatSol } from '@/lib/wavewarz-math'
import { getArtistStats } from '@/lib/artist-stats'

import { isShareKind, type ShareKind } from '@/lib/share-options'
export { isShareKind }

export type ShareHero = { key: string; label: string; value: string; unit?: string; sub: string }
export type ShareCard = {
  kind: ShareKind
  id: string
  path: string // the Statz page this card shares
  badge: string
  title: string // e.g. "LUI vs R3PLIC4NT"
  heroes: ShareHero[]
  stats: { k: string; v: string }[]
  shareText: string
  sides?: [string, string]
}

const sol = (n: number) => formatSol(n)
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

async function platformCard(): Promise<ShareCard | null> {
  const supabase = await createClient()
  const battles = await fetchAll<MetricsBattle>((from, to) => supabase
    .from('battles')
    .select('total_volume_a, total_volume_b, artist1_pool, artist2_pool, artist1_wallet, artist2_wallet, winner_artist_a, winner_decided, is_quick_battle, is_community_battle, is_main_battle, is_test_battle, event_subtype, created_at')
    .eq('is_test_battle', false)
    .range(from, to))
  if (!battles.length) return null
  const m = platformMetrics(battles)
  const n = battles.length
  return {
    kind: 'platform', id: 'all', path: '/',
    badge: 'Public ONCHAIN stats',
    title: 'Live music battles on Solana',
    heroes: [
      { key: 'artists', label: 'Paid to artists', value: sol(m.artistPayouts), unit: 'SOL', sub: `across ${plural(n, 'battle')}, win or lose` },
      { key: 'battles', label: 'Battles so far', value: n.toLocaleString('en-US'), sub: `${plural(m.mainEvents, 'Main Event')} and ${plural(m.quickCount, 'Quick Battle')}` },
      { key: 'volume', label: 'Traded on the music', value: sol(m.totalVolume), unit: 'SOL', sub: 'every trade pays the artist 1%' },
    ],
    stats: [
      { k: 'Battles', v: n.toLocaleString('en-US') },
      { k: 'Main Events', v: m.mainEvents.toLocaleString('en-US') },
      { k: 'Quick Battles', v: m.quickCount.toLocaleString('en-US') },
      { k: 'Paid to artists', v: `${sol(m.artistPayouts)} SOL` },
    ],
    shareText: `WaveWarZ has paid artists ${sol(m.artistPayouts)} SOL across ${plural(n, 'battle')}, win or lose. Public stats:`,
  }
}

async function battleCard(id: string): Promise<ShareCard | null> {
  const bid = Number(id)
  if (!Number.isInteger(bid)) return null
  const supabase = await createClient()
  const { data: b } = await supabase.from('battles').select('*').eq('battle_id', bid).single()
  if (!b || b.is_test_battle) return null

  const p1 = b.artist1_pool ?? 0, p2 = b.artist2_pool ?? 0
  const vol1 = b.total_volume_a ?? 0, vol2 = b.total_volume_b ?? 0
  const totalVol = vol1 + vol2
  const decided = b.winner_decided === true
  const a1Won = decided ? Number(b.winner_artist_a) === 1 : p1 >= p2
  const { loserPool } = getWinnerLoserPools(p1, p2, a1Won)
  const earnA = calculateArtistEarnings(vol1, decided ? loserPool : 0, a1Won).totalSol
  const earnB = calculateArtistEarnings(vol2, decided ? loserPool : 0, !a1Won).totalSol
  const nameA = (b.artist1_name ?? 'Side A').trim(), nameB = (b.artist2_name ?? 'Side B').trim()
  const type = b.is_quick_battle ? 'Quick Battle' : b.is_community_battle ? 'Community Battle' : 'Main Event'
  const winner = a1Won ? nameA : nameB
  const ended = decided || ['ended', 'completed', 'settled'].includes(String(b.status ?? '').toLowerCase())

  const heroes: ShareHero[] = []
  const paid = earnA + earnB > 0
  if (decided) heroes.push({ key: 'result', label: `${type} result`, value: winner, sub: paid ? `took battle #${bid}. Both artists got paid.` : `took battle #${bid}.` })
  if (paid) heroes.push({ key: 'artists', label: 'Paid to both artists', value: sol(earnA + earnB), unit: 'SOL', sub: `${nameA} ${sol(earnA)} · ${nameB} ${sol(earnB)}` })
  if (totalVol > 0) heroes.push({ key: 'volume', label: 'Traded on the music', value: sol(totalVol), unit: 'SOL', sub: `${nameA} ${sol(vol1)} · ${nameB} ${sol(vol2)}` })

  if (!heroes.length) heroes.push({ key: 'battle', label: type, value: `#${bid}`, sub: decided || ended ? 'Full stats on WaveWarZ Statz.' : 'Live now on WaveWarZ.' })

  return {
    kind: 'battle', id: String(bid), path: `/battles/${bid}`,
    badge: decided ? `${type} · settled` : ended ? `${type} · ended` : `${type} · live`,
    title: `${nameA} vs ${nameB}`,
    sides: [nameA, nameB],
    heroes,
    stats: [
      { k: 'Battle', v: `#${bid}` },
      { k: 'Winner', v: decided ? winner : ended ? 'No majority' : 'Live now' },
      { k: 'Traded', v: `${sol(totalVol)} SOL` },
      { k: 'To artists', v: `${sol(earnA + earnB)} SOL` },
    ],
    shareText: decided
      ? `${winner} took the ${type} on WaveWarZ: ${nameA} vs ${nameB}.${paid ? ' Both artists got paid.' : ''} Full stats:`
      : `${nameA} vs ${nameB} on WaveWarZ. Every trade pays the artists. Full stats:`,
  }
}

async function artistCard(id: string): Promise<ShareCard | null> {
  const s = await getArtistStats(id)
  if (!s) return null
  const played = s.wins + s.losses
  return {
    kind: 'artist', id, path: `/artist/${encodeURIComponent(id)}`,
    badge: 'Artist record',
    title: s.displayName,
    heroes: [
      { key: 'earned', label: 'Earned on WaveWarZ', value: sol(s.totalEarningsSol), unit: 'SOL', sub: `${sol(s.tradingFeesSol)} from trades · ${sol(s.settlementBonusSol)} from settlements` },
      { key: 'record', label: 'Battle record', value: `${s.wins}-${s.losses}`, sub: played ? `${plural(s.mainWins + s.mainLosses, 'Main Event')} · ${plural(s.quickWins + s.quickLosses, 'Quick Battle')}` : 'first battle coming up' },
      { key: 'volume', label: 'Traded on their music', value: sol(s.totalVolumeSol), unit: 'SOL', sub: 'every trade pays the artist 1%' },
    ],
    stats: [
      { k: 'Record', v: `${s.wins}-${s.losses}` },
      { k: 'Main Events', v: `${s.mainWins}-${s.mainLosses}` },
      { k: 'Quick Battles', v: `${s.quickWins}-${s.quickLosses}` },
      { k: 'Earned', v: `${sol(s.totalEarningsSol)} SOL` },
    ],
    shareText: `${s.displayName} has earned ${sol(s.totalEarningsSol)} SOL battling on WaveWarZ (${s.wins}-${s.losses}). Artist card:`,
  }
}

export async function getShareCard(kind: ShareKind, id: string): Promise<ShareCard | null> {
  if (kind === 'platform') return platformCard()
  if (kind === 'battle') return battleCard(id)
  return artistCard(id)
}
