import { createAdminClient } from '@/lib/supabase/server'
import { getArtistLeaderboard } from '@/lib/leaderboards/artists'
import { listHubEvents, type HubEvent } from '@/lib/hub-events'
import { formatSol } from '@/lib/wavewarz-math'

// The Phase 3 WaveWarZ Record Book. Computed marks are derived live from
// battles (via the same leaderboard + event grouping the site already trusts).
// Judgement-call marks (biggest upset, most charitable) live in the editable
// record_book_marks table.

export type RecordMark = {
  key: string
  label: string
  holder: string | null
  value: string
  detail?: string
  battleId?: number | null
}

export type ManualMark = {
  id: string
  mark_key: string
  label: string
  artist_id: string | null
  artist_name: string | null
  value_text: string | null
  battle_id: number | null
  note: string | null
  sort_order: number
}

function longestWinStreakByArtist(events: HubEvent[]): { name: string; count: number } | null {
  // events come newest-first; walk oldest-first per artist
  const chrono = [...events].reverse()
  const streaks = new Map<string, { current: number; best: number }>()
  const bump = (name: string, won: boolean) => {
    const s = streaks.get(name) ?? { current: 0, best: 0 }
    s.current = won ? s.current + 1 : 0
    s.best = Math.max(s.best, s.current)
    streaks.set(name, s)
  }
  for (const e of chrono) {
    if (e.winner !== 'a' && e.winner !== 'b') continue // skip draws + undecided
    bump(e.a.name, e.winner === 'a')
    bump(e.b.name, e.winner === 'b')
  }
  const top = [...streaks.entries()].sort((a, b) => b[1].best - a[1].best)[0]
  return top && top[1].best > 1 ? { name: top[0], count: top[1].best } : null
}

export async function getRecordBook(): Promise<{ computed: RecordMark[]; manual: ManualMark[] }> {
  const supabase = createAdminClient()
  const [{ rows }, events, manualRes] = await Promise.all([
    getArtistLeaderboard(),
    listHubEvents(),
    supabase.from('record_book_marks').select('*').order('sort_order'),
  ])

  const computed: RecordMark[] = []

  const byWins = [...rows].filter(r => r.wins > 0).sort((a, b) => b.wins - a.wins)[0]
  if (byWins) computed.push({ key: 'most_wins', label: 'Most Event Wins', holder: byWins.name, value: `${byWins.wins}` })

  const byLosses = [...rows].filter(r => r.losses > 0).sort((a, b) => b.losses - a.losses)[0]
  if (byLosses) computed.push({ key: 'most_losses', label: 'Most Event Losses', holder: byLosses.name, value: `${byLosses.losses}` })

  const byRate = [...rows].filter(r => r.wins + r.losses >= 3).sort((a, b) => b.winRate - a.winRate)[0]
  if (byRate) computed.push({ key: 'best_win_rate', label: 'Best Win Rate (3+ events)', holder: byRate.name, value: `${byRate.winRate}%`, detail: `${byRate.wins}W–${byRate.losses}L` })

  const byAppearances = [...rows].sort((a, b) => b.battles - a.battles)[0]
  if (byAppearances) computed.push({ key: 'most_appearances', label: 'Most Main-Event Appearances', holder: byAppearances.name, value: `${byAppearances.battles}` })

  const byVolume = [...rows].sort((a, b) => parseFloat(b.totalVolumeSol) - parseFloat(a.totalVolumeSol))[0]
  if (byVolume) computed.push({ key: 'highest_career_volume', label: 'Highest Career Trading Volume', holder: byVolume.name, value: `${byVolume.totalVolumeSol} SOL` })

  const byEarnings = [...rows].sort((a, b) => parseFloat(b.totalEarningsSol) - parseFloat(a.totalEarningsSol))[0]
  if (byEarnings) computed.push({ key: 'highest_career_earnings', label: 'Highest Career Earnings', holder: byEarnings.name, value: `${byEarnings.totalEarningsSol} SOL` })

  const streak = longestWinStreakByArtist(events)
  if (streak) computed.push({ key: 'longest_streak', label: 'Longest Winning Streak', holder: streak.name, value: `${streak.count} in a row` })

  // Rivalry marks
  const pairCounts = new Map<string, { label: string; count: number; volume: number }>()
  for (const e of events) {
    const key = [e.a.name, e.b.name].sort().join(' ⚔ ')
    const p = pairCounts.get(key) ?? { label: key, count: 0, volume: e.a.volumeSol + e.b.volumeSol }
    p.count++
    p.volume += e.a.volumeSol + e.b.volumeSol
    pairCounts.set(key, p)
  }
  const topRivalry = [...pairCounts.values()].sort((a, b) => b.count - a.count)[0]
  if (topRivalry && topRivalry.count > 1) {
    computed.push({ key: 'longest_rivalry', label: 'Longest Rivalry', holder: topRivalry.label, value: `${topRivalry.count} meetings` })
  }
  const rematches = [...pairCounts.values()].filter(p => p.count > 1).length
  computed.push({ key: 'rematches', label: 'Total Rematched Pairings', holder: null, value: `${rematches}` })

  // Event-level volume marks
  const byEventVolume = [...events].sort((a, b) => parseFloat(b.totalVolumeSol) - parseFloat(a.totalVolumeSol))[0]
  if (byEventVolume) computed.push({ key: 'biggest_event', label: 'Highest-Volume Event', holder: byEventVolume.label, value: `${byEventVolume.totalVolumeSol} SOL`, detail: new Date(byEventVolume.date).toLocaleDateString() })

  const decidedEvents = events.filter(e => (e.winner === 'a' || e.winner === 'b') && (e.a.volumeSol + e.b.volumeSol) > 0)
  const closest = [...decidedEvents].sort((a, b) => {
    const ma = Math.abs(a.a.volumeSol - a.b.volumeSol) / (a.a.volumeSol + a.b.volumeSol)
    const mb = Math.abs(b.a.volumeSol - b.b.volumeSol) / (b.a.volumeSol + b.b.volumeSol)
    return ma - mb
  })[0]
  if (closest) {
    const margin = Math.abs(closest.a.volumeSol - closest.b.volumeSol)
    computed.push({ key: 'closest_battle', label: 'Closest Battle (by volume)', holder: closest.label, value: `${formatSol(margin)} SOL apart`, detail: new Date(closest.date).toLocaleDateString() })
  }

  computed.push({ key: 'total_events', label: 'Main Events All-Time', holder: null, value: `${events.length}` })

  // Manual marks — resolve artist names
  const manualRows = manualRes.data ?? []
  const artistIds = manualRows.map(m => m.artist_id).filter(Boolean) as string[]
  const nameById = new Map<string, string>()
  if (artistIds.length) {
    const { data } = await supabase.from('artist_profiles').select('artist_id,display_name').in('artist_id', artistIds)
    for (const p of data ?? []) nameById.set(p.artist_id, p.display_name as string)
  }
  const manual: ManualMark[] = manualRows.map(m => ({
    id: m.id,
    mark_key: m.mark_key,
    label: m.label,
    artist_id: m.artist_id,
    artist_name: m.artist_id ? (nameById.get(m.artist_id) ?? null) : null,
    value_text: m.value_text,
    battle_id: m.battle_id,
    note: m.note,
    sort_order: m.sort_order,
  }))

  return { computed, manual }
}
