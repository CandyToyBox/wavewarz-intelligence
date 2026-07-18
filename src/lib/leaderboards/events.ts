import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { isBattleLive } from '@/lib/battle-metrics'

/**
 * Main Event grouping — a Main Event is typically 3 rounds (battle_id each)
 * between the same two artists within a short window. Each round's winner is
 * decided 2-of-3 (Human Judge + X Poll + SOL/Chart vote, entered via the
 * admin judging panel — see winner_decided/winner_artist_a). The EVENT
 * winner is best-of-3 rounds: whoever wins the majority of rounds.
 *
 * Same grouping logic as src/lib/leaderboards/artists.ts (wallet-pair + 6hr
 * window), kept in its own file because this returns full round detail per
 * event rather than per-artist aggregate totals.
 */

const GROUP_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours — same as artists.ts / battles feed

type RawBattle = {
  battle_id: number
  created_at: string
  artist1_name: string
  artist1_wallet: string
  artist1_twitter: string | null
  artist2_name: string
  artist2_wallet: string
  artist2_twitter: string | null
  artist1_pool: number
  artist2_pool: number
  total_volume_a: number
  total_volume_b: number
  winner_artist_a: number | null
  event_subtype: string
  battle_duration: number | null
  image_url: string | null
}

export type EventRound = {
  battleId: number
  roundNumber: number
  winnerSide: 'artist1' | 'artist2'
  artist1PoolSol: number
  artist2PoolSol: number
  artist1VolumeSol: number
  artist2VolumeSol: number
  createdAt: string
  endsAt: string
  live: boolean
  url: string
}

export type MainEvent = {
  eventId: string
  eventSubtype: string
  live: boolean
  artist1: { name: string; wallet: string; profilePictureUrl: string | null; twitterHandle: string | null }
  artist2: { name: string; wallet: string; profilePictureUrl: string | null; twitterHandle: string | null }
  roundsWon: { artist1: number; artist2: number }
  winnerSide: 'artist1' | 'artist2' | null
  totalVolumeSol: number
  imageUrl: string | null
  startedAt: string
  endsAt: string
  rounds: EventRound[]
}

export async function getMainEvents(): Promise<{ events: MainEvent[] }> {
  const supabase = await createClient()
  const [battlesRes, profilesRes, walletsRes, overridesRes] = await Promise.all([
    fetchAll<RawBattle>((from, to) => supabase
      .from('battles')
      .select('battle_id,created_at,artist1_name,artist1_wallet,artist1_twitter,artist2_name,artist2_wallet,artist2_twitter,artist1_pool,artist2_pool,total_volume_a,total_volume_b,winner_artist_a,event_subtype,battle_duration,image_url')
      .eq('is_main_battle', true)
      .eq('is_community_battle', false)
      .eq('is_quick_battle', false)
      .eq('is_test_battle', false)
      .eq('winner_decided', true)
      .range(from, to)),
    supabase.from('artist_profiles').select('artist_id,primary_wallet,display_name,profile_picture_url,twitter_handle'),
    supabase.from('artist_wallets').select('artist_id,wallet_address'),
    supabase.from('battle_artist_overrides').select('battle_id,wallet,artist_id'),
  ])

  const battles = battlesRes

  const profileById = new Map(
    (profilesRes.data ?? []).map(p => [p.artist_id, {
      primaryWallet: p.primary_wallet as string | null,
      displayName: p.display_name as string | null,
      pfpUrl: p.profile_picture_url as string | null,
      twitter: p.twitter_handle as string | null,
    }])
  )
  const walletToProfileId = new Map<string, string>()
  for (const p of profilesRes.data ?? []) if (p.primary_wallet) walletToProfileId.set(p.primary_wallet, p.artist_id)
  for (const w of walletsRes.data ?? []) walletToProfileId.set(w.wallet_address, w.artist_id)
  const overrideMap = new Map<string, string>()
  for (const o of overridesRes.data ?? []) overrideMap.set(`${o.battle_id}|${o.wallet}`, o.artist_id)

  function resolveWallet(battleId: number, wallet: string, fallbackName: string, twitter: string | null) {
    const overrideId = overrideMap.get(`${battleId}|${wallet}`)
    const profileId = overrideId ?? walletToProfileId.get(wallet)
    if (profileId) {
      const p = profileById.get(profileId)
      if (p) return {
        key: profileId,
        wallet: p.primaryWallet ?? profileId,
        name: p.displayName ?? fallbackName,
        pfpUrl: p.pfpUrl,
        twitterHandle: (p.twitter ?? twitter)?.replace(/^@/, '') || null,
      }
    }
    return { key: wallet, wallet, name: fallbackName, pfpUrl: null, twitterHandle: twitter?.replace(/^@/, '') || null }
  }

  function resolvedPairKey(b: RawBattle): string {
    const r1 = resolveWallet(b.battle_id, b.artist1_wallet, b.artist1_name, b.artist1_twitter)
    const r2 = resolveWallet(b.battle_id, b.artist2_wallet, b.artist2_name, b.artist2_twitter)
    return [r1.key, r2.key].sort().join('|')
  }

  const sorted = [...battles].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const groups: { key: string; battles: RawBattle[] }[] = []
  for (const b of sorted) {
    const key = resolvedPairKey(b)
    const bTime = new Date(b.created_at).getTime()
    let matched: (typeof groups)[0] | null = null
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i]
      if (g.key !== key) continue
      const lastTime = new Date(g.battles[g.battles.length - 1].created_at).getTime()
      if (bTime - lastTime <= GROUP_WINDOW_MS) { matched = g; break }
    }
    if (matched) matched.battles.push(b)
    else groups.push({ key, battles: [b] })
  }

  const now = Date.now()
  const round = (n: number) => Math.round(n * 10000) / 10000

  const events: MainEvent[] = groups.map(group => {
    const firstBattle = group.battles[0]
    const r1 = resolveWallet(firstBattle.battle_id, firstBattle.artist1_wallet, firstBattle.artist1_name, firstBattle.artist1_twitter)
    const r2 = resolveWallet(firstBattle.battle_id, firstBattle.artist2_wallet, firstBattle.artist2_name, firstBattle.artist2_twitter)

    let r1RoundWins = 0, r2RoundWins = 0
    let totalVolume = 0
    const rounds: EventRound[] = []

    group.battles.forEach((b, i) => {
      const bR1 = resolveWallet(b.battle_id, b.artist1_wallet, b.artist1_name, b.artist1_twitter)
      const r1IsArtist1 = bR1.key === r1.key
      const aWon = Number(b.winner_artist_a ?? 0) >= 1
      const r1Won = r1IsArtist1 ? aWon : !aWon
      if (r1Won) r1RoundWins++; else r2RoundWins++

      const vol = (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0)
      totalVolume += vol
      const live = isBattleLive({ created_at: b.created_at, battle_duration: b.battle_duration }, now)

      rounds.push({
        battleId: b.battle_id,
        roundNumber: i + 1,
        winnerSide: r1Won ? 'artist1' : 'artist2',
        artist1PoolSol: round(r1IsArtist1 ? (b.artist1_pool ?? 0) : (b.artist2_pool ?? 0)),
        artist2PoolSol: round(r1IsArtist1 ? (b.artist2_pool ?? 0) : (b.artist1_pool ?? 0)),
        artist1VolumeSol: round(r1IsArtist1 ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)),
        artist2VolumeSol: round(r1IsArtist1 ? (b.total_volume_b ?? 0) : (b.total_volume_a ?? 0)),
        createdAt: b.created_at,
        endsAt: new Date(new Date(b.created_at).getTime() + (b.battle_duration ?? 0) * 1000).toISOString(),
        live,
        url: `https://wavewarz.info/battles/${b.battle_id}`,
      })
    })

    const lastBattle = group.battles[group.battles.length - 1]

    return {
      eventId: `event-${firstBattle.battle_id}`,
      eventSubtype: firstBattle.event_subtype ?? 'standard',
      live: rounds.some(r => r.live),
      artist1: { name: r1.name, wallet: r1.wallet, profilePictureUrl: r1.pfpUrl, twitterHandle: r1.twitterHandle },
      artist2: { name: r2.name, wallet: r2.wallet, profilePictureUrl: r2.pfpUrl, twitterHandle: r2.twitterHandle },
      roundsWon: { artist1: r1RoundWins, artist2: r2RoundWins },
      winnerSide: (r1RoundWins === r2RoundWins ? null : (r1RoundWins > r2RoundWins ? 'artist1' : 'artist2')) as 'artist1' | 'artist2' | null,
      totalVolumeSol: round(totalVolume),
      imageUrl: firstBattle.image_url,
      startedAt: firstBattle.created_at,
      endsAt: new Date(new Date(lastBattle.created_at).getTime() + (lastBattle.battle_duration ?? 0) * 1000).toISOString(),
      rounds,
    }
  }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return { events }
}
