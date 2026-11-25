// The one game feed for WaveWarz battles. The battle page's Battle Stage, the
// public games API (/api/public/games/...) and the games MCP server all read
// battles and trades through these two functions, so every game sees the same
// numbers.
//
// Rules this file keeps (see PRODUCT.md):
// - Trades come from the vault's onchain history (live) or the trades table
//   (replay). Pools in the feed are a running net of buys minus sells, for
//   animation only. They are not the settled pool and not the winner.
// - The result is the STORED result. Nothing here computes or guesses a winner.
//   Before winner_decided is true the outcome is null.
import { createClient } from '@/lib/supabase/server'
import { isBattleLive } from '@/lib/battle-metrics'
import { fetchRecentBattleTradesFromChain } from '@/lib/solana/hydrate'
import {
  type ArenaTheme,
  type Side,
  classifyTradeActionForTheme,
  computeDancerArenaDynamics,
  computeDjArenaDynamics,
  computeOceanWaveParams,
  computeRacerArenaDynamics,
  getSurferTier,
  getTierDisplayTitle,
} from '@/lib/games/battle-logic'

export const GAME_THEMES = ['fighter', 'dj', 'surf', 'racer', 'dancer'] as const
export type GameTheme = (typeof GAME_THEMES)[number]

export function isGameTheme(v: string | null | undefined): v is GameTheme {
  return !!v && (GAME_THEMES as readonly string[]).includes(v)
}

// The fighter is AttaBotty's arena; the 3D themes share the battle-logic trick
// tables. The fighter reads trades directly, so its cues reuse the DJ table.
function logicTheme(theme: GameTheme): ArenaTheme {
  return theme === 'fighter' ? 'dj' : theme
}

// The fighter's own move names and level titles (its animations follow the
// same trick sizes as the 3D themes).
const FIGHTER_MOVES: Record<string, string> = {
  idle: 'Guard', carve: 'Jab', indyGrab: 'Cross', spin360: 'Spin kick', megaTsunami: 'Jump punch', wipeoutWobble: 'Stagger', grandFinale: 'Finisher',
}
const FIGHTER_TIERS: Record<number, string> = { 1: 'Rookie', 2: 'Contender', 3: 'Brawler', 4: 'Champion', 5: 'Legend' }

export function themeAction(theme: GameTheme, sol: number, kind: 'buy' | 'sell') {
  const p = classifyTradeActionForTheme(sol, kind, logicTheme(theme))
  return theme === 'fighter' ? { ...p, label: FIGHTER_MOVES[p.trick] ?? p.label } : p
}

export function themeTierTitle(theme: GameTheme, tier: ReturnType<typeof getSurferTier>) {
  return theme === 'fighter' ? FIGHTER_TIERS[tier.level] ?? tier.title : getTierDisplayTitle(tier, logicTheme(theme))
}

export type GameBattleState = {
  battleId: number
  type: 'quick_battle' | 'main_event' | 'community_battle'
  status: 'live' | 'ended'
  startsAt: string | null
  endsAt: string | null
  msRemaining: number
  sides: Record<Side, { name: string; wallet: string | null; musicLink: string | null; settledPoolSol: number }>
  // Stored result only. null until WaveWarz has decided the battle.
  outcome: null | {
    winner: Side
    factors: { poll: Side | 'tie' | null; djWavy: Side | 'tie' | null } | null
  }
  links: { page: string; trade: string; events: string }
}

type BattleRow = {
  battle_id: number
  is_quick_battle: boolean | null
  is_community_battle: boolean | null
  created_at: string
  battle_duration: number | null
  winner_decided: boolean | null
  winner_artist_a: number | string | null
  artist1_pool: number | null
  artist2_pool: number | null
  artist1_name: string | null
  artist2_name: string | null
  artist1_wallet: string | null
  artist2_wallet: string | null
  artist1_music_link: string | null
  artist2_music_link: string | null
  poll_winner: string | null
  dj_wavy_winner: string | null
}

function factorSide(raw: string | null, nameA: string | null, nameB: string | null): Side | 'tie' | null {
  if (!raw) return null
  const v = raw.trim()
  const up = v.toUpperCase()
  if (up === 'TIE') return 'tie'
  if (up === 'A' || up === 'ARTIST_A' || up === 'ARTIST1') return 'A'
  if (up === 'B' || up === 'ARTIST_B' || up === 'ARTIST2') return 'B'
  if (nameA && v.toLowerCase() === nameA.trim().toLowerCase()) return 'A'
  if (nameB && v.toLowerCase() === nameB.trim().toLowerCase()) return 'B'
  return null
}

export async function getGameBattleState(battleId: number, origin = 'https://wavewarz.info'): Promise<GameBattleState | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('battles')
    .select('battle_id,is_quick_battle,is_community_battle,created_at,battle_duration,winner_decided,winner_artist_a,artist1_pool,artist2_pool,artist1_name,artist2_name,artist1_wallet,artist2_wallet,artist1_music_link,artist2_music_link,poll_winner,dj_wavy_winner')
    .eq('battle_id', battleId)
    .maybeSingle()
  if (error || !data) return null
  const b = data as BattleRow

  const live = isBattleLive({ created_at: b.created_at, battle_duration: b.battle_duration })
  const startMs = new Date(b.created_at).getTime()
  const endMs = b.battle_duration ? startMs + b.battle_duration * 1000 : null
  const nameA = (b.artist1_name ?? 'Side A').trim()
  const nameB = (b.artist2_name ?? 'Side B').trim()
  const quick = b.is_quick_battle === true

  return {
    battleId: b.battle_id,
    type: quick ? 'quick_battle' : b.is_community_battle ? 'community_battle' : 'main_event',
    status: live ? 'live' : 'ended',
    startsAt: b.created_at,
    endsAt: endMs ? new Date(endMs).toISOString() : null,
    msRemaining: live && endMs ? Math.max(0, endMs - Date.now()) : 0,
    sides: {
      A: { name: nameA, wallet: b.artist1_wallet, musicLink: b.artist1_music_link, settledPoolSol: Number(b.artist1_pool ?? 0) },
      B: { name: nameB, wallet: b.artist2_wallet, musicLink: b.artist2_music_link, settledPoolSol: Number(b.artist2_pool ?? 0) },
    },
    outcome: b.winner_decided === true
      ? {
          winner: Number(b.winner_artist_a) === 1 ? 'A' : 'B',
          factors: quick ? { poll: factorSide(b.poll_winner, nameA, nameB), djWavy: factorSide(b.dj_wavy_winner, nameA, nameB) } : null,
        }
      : null,
    links: {
      page: `${origin}/battles/${b.battle_id}`,
      trade: `https://www.wavewarz.com/v2/battles/${b.battle_id}`,
      events: `${origin}/api/public/games/battles/${b.battle_id}/events`,
    },
  }
}

export type GameTradeEvent = {
  side: Side
  kind: 'buy' | 'sell'
  sol: number
  at: string
  // Running net SOL per side after this trade (buys minus sells), for animation.
  netA: number
  netB: number
  cue: {
    theme: GameTheme
    action: string
    trick: string
    power: number
    waveSurge: number
    durationMs: number
    tier: { level: number; title: string }
    levelUp: boolean
  }
}

type RawTrade = { trade_type: string; amount_sol: number | string; timestamp: string }

export function enrichTrades(raw: RawTrade[], theme: GameTheme, startNet = { A: 0, B: 0 }): GameTradeEvent[] {
  let a = startNet.A
  let b = startNet.B
  const out: GameTradeEvent[] = []
  for (const t of raw) {
    const type = t.trade_type
    if (!/^(buy|sell)_[ab]$/.test(type)) continue
    const side: Side = type.endsWith('_a') ? 'A' : 'B'
    const kind = type.startsWith('buy') ? 'buy' : 'sell'
    const sol = Math.max(0, Number(t.amount_sol) || 0)
    const before = side === 'A' ? a : b
    const after = Math.max(0, kind === 'buy' ? before + sol : before - sol)
    if (side === 'A') a = after
    else b = after
    const plan = themeAction(theme, sol, kind)
    const prevTier = getSurferTier(before)
    const tier = getSurferTier(after)
    out.push({
      side, kind, sol, at: t.timestamp, netA: round(a), netB: round(b),
      cue: {
        theme,
        action: plan.label,
        trick: plan.trick,
        power: round(plan.power01),
        waveSurge: round(plan.waveSurge),
        durationMs: plan.durationMs,
        tier: { level: tier.level, title: themeTierTitle(theme, tier) },
        levelUp: tier.level > prevTier.level,
      },
    })
  }
  return out
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6
}

// Full trade history from the trades table, oldest first: used for replays and
// for any game that wants to rebuild a battle from the start.
export async function getBattleTradeHistory(battleId: number): Promise<RawTrade[]> {
  const supabase = await createClient()
  const rows: RawTrade[] = []
  // PostgREST caps a page at 1000 rows; page until done.
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from('trades')
      .select('trade_type, amount_sol, timestamp')
      .eq('battle_id', battleId)
      .order('timestamp', { ascending: true })
      .range(from, from + 999)
    if (error || !data) break
    rows.push(...(data as RawTrade[]))
    if (data.length < 1000) break
  }
  return rows
}

// New trades since a transaction signature, read off the vault's onchain
// history. With no signature it returns an empty list plus the current
// cursor, so a client never replays the whole battle by accident.
export async function getLiveTrades(battleId: number, since: string | null) {
  const res = await fetchRecentBattleTradesFromChain(battleId, { sinceSignature: since })
  if (!res) return null
  return { trades: res.trades.map((t) => ({ trade_type: t.trade_type, amount_sol: t.amount_sol, timestamp: t.timestamp })), cursor: res.latestSignature }
}

export function gameDynamics(theme: GameTheme, a: number, b: number) {
  switch (theme) {
    case 'surf': return computeOceanWaveParams(a, b)
    case 'racer': return computeRacerArenaDynamics(a, b)
    case 'dancer': return computeDancerArenaDynamics(a, b)
    default: return computeDjArenaDynamics(a, b)
  }
}

export const THEME_INFO: Record<GameTheme, { name: string; by: string; description: string }> = {
  fighter: { name: 'Fighter', by: 'AttaBotty', description: 'Two fighters trade blows. Every buy is a strike for that side, every sell a stumble.' },
  dj: { name: 'DJ Clash', by: 'WaveWarz Stream Battle', description: 'Two DJ rigs on one stage. Trades drop scratches, sweeps and bass drops; bigger pools grow the rig.' },
  surf: { name: 'Wave Surf', by: 'WaveWarz Stream Battle', description: 'Two surfers ride a wave shaped by the pools. Trades become carves, grabs and aerials.' },
  racer: { name: 'Racers', by: 'WaveWarz Stream Battle', description: 'Two pods race a sky track. Buys are boosts, sells are air brakes; the lead follows the pools.' },
  dancer: { name: 'Dancers', by: 'WaveWarz Stream Battle', description: 'A street dance-off. Trades become power moves; the crowd follows the pools.' },
}
