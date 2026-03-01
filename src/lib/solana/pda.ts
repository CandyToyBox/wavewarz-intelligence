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
