import { PublicKey } from '@solana/web3.js'

export const PROGRAM_ID = new PublicKey('9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo')

function toU64LE(num: number | bigint): Uint8Array {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setBigUint64(0, BigInt(num), true)
  return new Uint8Array(buffer)
}

export function getBattleAddress(battleId: number | bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('battle'), toU64LE(battleId)],
    PROGRAM_ID
  )
  return pda
}

export function getBattleVaultAddress(battleId: number | bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('battle_vault'), toU64LE(battleId)],
    PROGRAM_ID
  )
  return pda
}

export function getArtistAMintAddress(battleId: number | bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('artist_a_mint'), toU64LE(battleId)],
    PROGRAM_ID
  )
  return pda
}

export function getArtistBMintAddress(battleId: number | bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('artist_b_mint'), toU64LE(battleId)],
    PROGRAM_ID
  )
  return pda
}
