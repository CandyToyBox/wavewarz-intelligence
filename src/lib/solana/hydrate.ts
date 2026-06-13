import { Connection } from '@solana/web3.js'
import { getBattleAddress, getBattleVaultAddress } from './pda'
import { parseBattleAccount } from './parser'
// bs58 v4 ships as a CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }

const LAMPORTS_PER_SOL = 1_000_000_000
const WAVEWARZ_PROGRAM  = '9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'

// Anchor instruction discriminators (from IDL)
const BUY_DISCRIMINATOR  = [40, 239, 138, 154, 8, 37, 106, 108]
const SELL_DISCRIMINATOR = [184, 164, 169, 16, 231, 158, 199, 196]

function matchesDiscriminator(data: Buffer, disc: number[]): boolean {
  return disc.every((b, i) => data[i] === b)
}

function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL
}

export interface OnchainBattleData {
  artist1_pool: number                   // SOL — final pool value for artist A
  artist2_pool: number                   // SOL — final pool value for artist B
  artist1_supply: number                 // token supply minted for artist A
  artist2_supply: number                 // token supply minted for artist B
  artist1_sol_balance: number            // SOL — running balance artist A
  artist2_sol_balance: number            // SOL — running balance artist B
  total_distribution_amount: number      // SOL — total settled
  battle_duration: number                // seconds (end_time - start_time)
  start_time_sec: number                 // Unix timestamp seconds
  end_time_sec: number                   // Unix timestamp seconds
  winner_decided: boolean
  winner_artist_a: boolean | null        // null if not decided yet
  is_active: boolean
}

// ─── Helius Enhanced Transaction types (minimal) ─────────────────────────────

interface HeliusNativeTransfer {
  fromUserAccount: string
  toUserAccount: string
  amount: number  // lamports
}

interface HeliusInstruction {
  programId: string
  data: string  // base58-encoded instruction data
  innerInstructions?: HeliusInstruction[]
}

interface HeliusTx {
  signature: string
  timestamp: number
  feePayer: string
  nativeTransfers: HeliusNativeTransfer[]
  instructions: HeliusInstruction[]
}

/** One parsed buy/sell from the vault history, shaped for the trades table. */
export interface OnchainTrade {
  battle_id: number
  trader_wallet: string
  trade_type: 'buy_a' | 'buy_b' | 'sell_a' | 'sell_b'
  amount_sol: number
  timestamp: string  // ISO
}

/**
 * Fetch the true trading volume for a battle by reading all buyShares and
 * sellShares transactions for the battle vault PDA from the Helius Enhanced
 * Transaction API.
 *
 * - buyShares volume  = instruction `amount` arg (gross SOL the buyer spent, lamports)
 * - sellShares volume = NativeTransfer FROM vault to trader (net SOL returned)
 *
 * Only transactions whose timestamps fall within [startTimeSec, endTimeSec]
 * are counted. endBattle / claimShares happen after end_time and are skipped
 * both by the timestamp filter and by the discriminator filter.
 *
 * Returns per-artist volumes in SOL, or null on error.
 */
export async function fetchBattleVolumeFromChain(
  battleId: number | bigint,
  startTimeSec: number,
  endTimeSec: number,
): Promise<{ volumeA: number; volumeB: number } | null> {
  const trades = await fetchBattleTradesFromChain(battleId, startTimeSec, endTimeSec)
  if (!trades) return null
  let volumeA = 0, volumeB = 0
  for (const t of trades) {
    if (t.trade_type.endsWith('_a')) volumeA += t.amount_sol
    else                             volumeB += t.amount_sol
  }
  return { volumeA, volumeB }
}

/**
 * Fetch every individual buyShares/sellShares trade for a battle from the
 * vault PDA transaction history. The trader's wallet is the transaction fee
 * payer (the signer). Withdrawals (claimShares) and settlement (endBattle)
 * use different discriminators and are excluded — they are payouts, not
 * trading volume.
 *
 * Returns rows shaped for the trades table, oldest first, or null on error.
 */
export async function fetchBattleTradesFromChain(
  battleId: number | bigint,
  startTimeSec: number,
  endTimeSec: number,
): Promise<OnchainTrade[] | null> {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  if (!apiKey) return null
  if (!startTimeSec || !endTimeSec || endTimeSec <= startTimeSec) return null

  const vaultPDA  = getBattleVaultAddress(battleId)
  const vaultAddr = vaultPDA.toBase58()

  const trades: OnchainTrade[] = []
  let cursor: string | undefined

  try {
    for (let page = 0; page < 20; page++) {  // max 2000 transactions
      const url =
        `https://api-mainnet.helius-rpc.com/v0/addresses/${vaultAddr}/transactions` +
        `?api-key=${apiKey}&limit=100` +
        (cursor ? `&before=${cursor}` : '')

      // Retry on rate limits — a swallowed 429 here silently truncates history
      let res: Response | null = null
      for (let attempt = 0; attempt < 6; attempt++) {
        res = await fetch(url, { next: { revalidate: 0 } })
        if (res.status !== 429) break
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      }
      if (!res || !res.ok) {
        console.warn(`[trades] Helius responded ${res?.status} for battle ${battleId} after retries`)
        return null  // partial history must not be mistaken for complete history
      }

      const txs: HeliusTx[] = await res.json()
      if (!txs.length) break

      let hitFloor = false

      for (const tx of txs) {
        if (tx.timestamp > endTimeSec) continue     // after battle — skip
        if (tx.timestamp < startTimeSec) {          // before battle — we're done paginating
          hitFloor = true
          break
        }

        // Find the WaveWarz outer instruction
        const ix = tx.instructions.find(i => i.programId === WAVEWARZ_PROGRAM)
        if (!ix?.data) continue

        let data: Buffer
        try {
          data = Buffer.from(bs58.decode(ix.data))
        } catch {
          continue
        }
        if (data.length < 17) continue

        const isArtistA = data[16] !== 0
        const base = {
          battle_id: Number(battleId),
          trader_wallet: tx.feePayer,
          timestamp: new Date(tx.timestamp * 1000).toISOString(),
        }

        if (matchesDiscriminator(data, BUY_DISCRIMINATOR)) {
          // Gross SOL the buyer committed (lamports, u64 LE at offset 8)
          const amount = Number(data.readBigUInt64LE(8))
          trades.push({ ...base, trade_type: isArtistA ? 'buy_a' : 'buy_b', amount_sol: amount / LAMPORTS_PER_SOL })

        } else if (matchesDiscriminator(data, SELL_DISCRIMINATOR)) {
          // SOL returned from vault to the seller (net of fees)
          const returned = tx.nativeTransfers
            .filter(t => t.fromUserAccount === vaultAddr)
            .reduce((sum, t) => sum + t.amount, 0)
          if (returned > 0) {
            trades.push({ ...base, trade_type: isArtistA ? 'sell_a' : 'sell_b', amount_sol: returned / LAMPORTS_PER_SOL })
          }
        }
        // All other discriminators (endBattle, claimShares, initializeBattle, etc.) are ignored
      }

      if (hitFloor || txs.length < 100) break
      cursor = txs[txs.length - 1].signature
    }
  } catch (err) {
    console.error(`[trades] Error fetching trades for battle ${battleId}:`, err)
    return null
  }

  return trades.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

/**
 * Fetch and parse the onchain WaveWarz battle state account via Helius RPC.
 * Returns null if the account doesn't exist or fails to parse.
 * Non-throwing — all errors are logged and null returned.
 */
export async function hydrateOnchainData(battleId: number | bigint): Promise<OnchainBattleData | null> {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  if (!apiKey) {
    console.error('[hydrate] NEXT_PUBLIC_HELIUS_API_KEY not set')
    return null
  }

  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
    const connection = new Connection(rpcUrl, 'confirmed')
    const battlePDA = getBattleAddress(battleId)

    const accountInfo = await connection.getAccountInfo(battlePDA)
    if (!accountInfo) {
      console.warn(`[hydrate] No account found for battle ${battleId} at PDA ${battlePDA.toBase58()}`)
      return null
    }

    const parsed = parseBattleAccount(accountInfo.data)
    if (!parsed) {
      console.error(`[hydrate] Failed to parse account data for battle ${battleId}`)
      return null
    }

    const startSec       = Number(parsed.startTime)
    const endSec         = Number(parsed.endTime)
    const durationSeconds = endSec - startSec

    return {
      artist1_pool:               lamportsToSol(parsed.artistAPool),
      artist2_pool:               lamportsToSol(parsed.artistBPool),
      artist1_supply:             Number(parsed.artistASupply),
      artist2_supply:             Number(parsed.artistBSupply),
      artist1_sol_balance:        lamportsToSol(parsed.artistASolBalance),
      artist2_sol_balance:        lamportsToSol(parsed.artistBSolBalance),
      total_distribution_amount:  lamportsToSol(parsed.totalDistributionAmount),
      battle_duration:            durationSeconds > 0 ? durationSeconds : 0,
      start_time_sec:             startSec,
      end_time_sec:               endSec,
      winner_decided:             parsed.winnerDecided,
      winner_artist_a:            parsed.winnerDecided ? parsed.winnerArtistA : null,
      is_active:                  parsed.isActive,
    }
  } catch (err) {
    console.error(`[hydrate] Error fetching onchain data for battle ${battleId}:`, err)
    return null
  }
}
