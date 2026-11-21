import { PublicKey } from '@solana/web3.js'

export interface BattleAccount {
  battleId: bigint
  startTime: bigint
  endTime: bigint
  artistAWallet: PublicKey
  artistBWallet: PublicKey
  wavewarzWallet: PublicKey
  artistAMint: PublicKey
  artistBMint: PublicKey
  artistASupply: bigint
  artistBSupply: bigint
  artistASolBalance: bigint
  artistBSolBalance: bigint
  artistAPool: bigint
  artistBPool: bigint
  winnerArtistA: boolean
  winnerDecided: boolean
  isInitialized: boolean
  isActive: boolean
  totalDistributionAmount: bigint
  /** Wallet that signed InitializeBattle: Pubkey at byte 257 (chain/BATTLE-ACCOUNT.md). Null on a short account. */
  launcher: PublicKey | null
}

export function parseBattleAccount(data: Uint8Array | Buffer): BattleAccount | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 8 // skip 8-byte Anchor discriminator

    const battleId = view.getBigUint64(offset, true); offset += 8
    offset += 4 // 4 bumps (u8 each)
    const startTime = view.getBigInt64(offset, true); offset += 8
    const endTime = view.getBigInt64(offset, true); offset += 8

    const artistAWallet = new PublicKey(data.subarray(offset, offset + 32)); offset += 32
    const artistBWallet = new PublicKey(data.subarray(offset, offset + 32)); offset += 32
    const wavewarzWallet = new PublicKey(data.subarray(offset, offset + 32)); offset += 32
    const artistAMint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32
    const artistBMint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32

    const artistASupply = view.getBigUint64(offset, true); offset += 8
    const artistBSupply = view.getBigUint64(offset, true); offset += 8
    const artistASolBalance = view.getBigUint64(offset, true); offset += 8
    const artistBSolBalance = view.getBigUint64(offset, true); offset += 8
    const artistAPool = view.getBigUint64(offset, true); offset += 8
    const artistBPool = view.getBigUint64(offset, true); offset += 8

    const winnerArtistA = view.getUint8(offset) !== 0; offset += 1
    const winnerDecided = view.getUint8(offset) !== 0; offset += 1
    offset += 1 // transaction_state enum
    const isInitialized = view.getUint8(offset) !== 0; offset += 1
    const isActive = view.getUint8(offset) !== 0; offset += 1
    const totalDistributionAmount = view.getBigUint64(offset, true)
    const launcher = data.length >= 289 ? new PublicKey(data.subarray(257, 289)) : null

    return {
      battleId, startTime, endTime,
      artistAWallet, artistBWallet, wavewarzWallet,
      artistAMint, artistBMint,
      artistASupply, artistBSupply,
      artistASolBalance, artistBSolBalance,
      artistAPool, artistBPool,
      winnerArtistA, winnerDecided,
      isInitialized, isActive,
      totalDistributionAmount,
      launcher,
    }
  } catch {
    return null
  }
}
