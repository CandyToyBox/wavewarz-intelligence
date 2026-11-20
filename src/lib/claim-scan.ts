// Server-only: imported by src/app/api/claim/route.ts.
import { Connection, PublicKey } from '@solana/web3.js'
import { parseBattleAccount } from '@/lib/solana/parser'
import { PROGRAM_ID } from '@/lib/solana/pda'
import { createClient } from '@/lib/supabase/server'

// Server side of /claim: which WaveWarZ battle shares does a wallet still hold, and what can it do
// with each one. Same method as the old claim.wavewarz.info tool (read every battle account, match
// its two share mints against the wallet's token accounts), but run here so the Helius key never
// reaches the browser, with the battle list cached for a few minutes and names/art from Supabase.

const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? ''}`
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
// The parser reads the first 257 bytes of a battle account; smaller accounts are other types.
const BATTLE_BYTES = 257
const TTL_MS = 3 * 60 * 1000

type ChainBattle = { id: string; side: 'A' | 'B'; isActive: boolean; winnerDecided: boolean; winnerArtistA: boolean; endTime: number }

let cache: { at: number; byMint: Map<string, ChainBattle> } | null = null
let inflight: Promise<Map<string, ChainBattle>> | null = null

async function battleMints(conn: Connection): Promise<Map<string, ChainBattle>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.byMint
  inflight ??= (async () => {
    const accounts = await conn.getProgramAccounts(PROGRAM_ID, { dataSlice: { offset: 0, length: BATTLE_BYTES } })
    const byMint = new Map<string, ChainBattle>()
    for (const { account } of accounts) {
      if (account.data.length < BATTLE_BYTES) continue
      const b = parseBattleAccount(account.data)
      if (!b || !b.isInitialized) continue
      const base = { id: b.battleId.toString(), isActive: b.isActive, winnerDecided: b.winnerDecided, winnerArtistA: b.winnerArtistA, endTime: Number(b.endTime) }
      byMint.set(b.artistAMint.toBase58(), { ...base, side: 'A' })
      byMint.set(b.artistBMint.toBase58(), { ...base, side: 'B' })
    }
    cache = { at: Date.now(), byMint }
    return byMint
  })().finally(() => { inflight = null })
  return inflight
}

export type ClaimState = 'live' | 'won' | 'lost' | 'waiting'

export type ClaimHolding = {
  battleId: string
  state: ClaimState
  shares: number
  side: 'A' | 'B'
  /** the side this wallet holds, as named on the battle */
  heldName: string
  otherName: string
  image: string | null
  date: string | null
  quick: boolean
}

export function isWalletAddress(s: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false
  try { new PublicKey(s); return true } catch { return false }
}

export async function scanWallet(address: string): Promise<ClaimHolding[]> {
  const owner = new PublicKey(address)
  const conn = new Connection(RPC_URL, 'confirmed')
  const [byMint, tokens] = await Promise.all([
    battleMints(conn),
    conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM }),
  ])

  const found: { b: ChainBattle; shares: number }[] = []
  for (const t of tokens.value) {
    const info = t.account.data.parsed?.info
    const shares = Number(info?.tokenAmount?.uiAmount ?? 0)
    const b = info ? byMint.get(info.mint) : undefined
    if (b && shares > 0) found.push({ b, shares })
  }
  if (found.length === 0) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('battles')
    .select('battle_id,created_at,artist1_name,artist2_name,image_url,is_quick_battle')
    .in('battle_id', [...new Set(found.map(f => f.b.id))])
  const rows = new Map((data ?? []).map(r => [String(r.battle_id), r]))

  const order: Record<ClaimState, number> = { won: 0, lost: 1, waiting: 2, live: 3 }
  return found
    .map(({ b, shares }) => {
      const r = rows.get(b.id)
      const a = r?.artist1_name?.trim() || 'Side A'
      const z = r?.artist2_name?.trim() || 'Side B'
      const state: ClaimState = b.isActive && b.endTime * 1000 > Date.now() ? 'live'
        : !b.winnerDecided ? 'waiting'
        : (b.side === 'A') === b.winnerArtistA ? 'won' : 'lost'
      return {
        battleId: b.id,
        state,
        shares,
        side: b.side,
        heldName: b.side === 'A' ? a : z,
        otherName: b.side === 'A' ? z : a,
        image: r?.image_url ?? null,
        date: r?.created_at ?? (b.endTime ? new Date(b.endTime * 1000).toISOString() : null),
        quick: !!r?.is_quick_battle,
      } satisfies ClaimHolding
    })
    .sort((x, y) => order[x.state] - order[y.state] || (y.date ?? '').localeCompare(x.date ?? ''))
}
