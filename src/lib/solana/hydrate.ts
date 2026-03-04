import { Connection } from '@solana/web3.js'
import { getBattleAddress } from './pda'
import { parseBattleAccount } from './parser'

const LAMPORTS_PER_SOL = 1_000_000_000

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
  winner_decided: boolean
  winner_artist_a: boolean | null        // null if not decided yet
  is_active: boolean
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

    const durationSeconds = Number(parsed.endTime - parsed.startTime)

    return {
      artist1_pool:               lamportsToSol(parsed.artistAPool),
      artist2_pool:               lamportsToSol(parsed.artistBPool),
      artist1_supply:             Number(parsed.artistASupply),
      artist2_supply:             Number(parsed.artistBSupply),
      artist1_sol_balance:        lamportsToSol(parsed.artistASolBalance),
      artist2_sol_balance:        lamportsToSol(parsed.artistBSolBalance),
      total_distribution_amount:  lamportsToSol(parsed.totalDistributionAmount),
      battle_duration:            durationSeconds > 0 ? durationSeconds : 0,
      winner_decided:             parsed.winnerDecided,
      winner_artist_a:            parsed.winnerDecided ? parsed.winnerArtistA : null,
      is_active:                  parsed.isActive,
    }
  } catch (err) {
    console.error(`[hydrate] Error fetching onchain data for battle ${battleId}:`, err)
    return null
  }
}
