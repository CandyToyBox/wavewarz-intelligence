/**
 * READ-ONLY independent verification of fix-volume-from-chain.ts's output.
 * Pulls the vault's real transaction history from Helius and re-sums buy/sell
 * volume by hand, checking specifically for duplicate signatures across
 * pagination pages (the classic "before cursor is inclusive" bug).
 *
 * Usage: npx tsx scripts/verify-volume-onchain.ts <battleId>
 */
import * as fs from 'fs'
import * as path from 'path'
import { getBattleVaultAddress } from '../src/lib/solana/pda'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

const HELIUS_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY!
const PROGRAM_ID = '9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'
const LAMPORTS = 1_000_000_000
const BUY_DISC = [40, 239, 138, 154, 8, 37, 106, 108]
const SELL_DISC = [184, 164, 169, 16, 231, 158, 199, 196]
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }

function matchesDisc(buf: Buffer, disc: number[]): boolean {
  return disc.every((b, i) => buf[i] === b)
}

async function main() {
  const battleId = Number(process.argv[2])
  if (!battleId) { console.error('Usage: npx tsx scripts/verify-volume-onchain.ts <battleId>'); process.exit(1) }

  const vaultAddr = getBattleVaultAddress(battleId).toBase58()
  console.log(`Battle #${battleId}`)
  console.log(`Vault PDA: ${vaultAddr}`)
  console.log(`Verify independently: https://solscan.io/account/${vaultAddr}`)
  console.log('─'.repeat(70))

  const seenSignatures = new Set<string>()
  let dupeCount = 0
  let lamportsA = 0, lamportsB = 0
  let buyCount = 0, sellCount = 0
  let cursor: string | undefined
  const allRows: { sig: string; type: string; side: string; sol: number; ts: number }[] = []

  for (let page = 0; page < 30; page++) {
    const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${vaultAddr}/transactions?api-key=${HELIUS_KEY}&limit=100` + (cursor ? `&before=${cursor}` : '')
    const res = await fetch(url)
    if (!res.ok) { console.warn(`Helius ${res.status} on page ${page}`); break }
    const txs: any[] = await res.json()
    if (!txs.length) break

    for (const tx of txs) {
      if (seenSignatures.has(tx.signature)) {
        dupeCount++
        console.log(`  !! DUPLICATE signature across pages: ${tx.signature}`)
        continue // don't double-count it ourselves, but flag it
      }
      seenSignatures.add(tx.signature)

      const ix = tx.instructions?.find((i: any) => i.programId === PROGRAM_ID)
      if (!ix?.data) continue
      let data: Buffer
      try { data = Buffer.from(bs58.decode(ix.data)) } catch { continue }
      if (data.length < 17) continue
      const isA = data[16] !== 0
      const side = isA ? 'A' : 'B'

      if (matchesDisc(data, BUY_DISC)) {
        const amount = Number(data.readBigUInt64LE(8)) / LAMPORTS
        buyCount++
        if (isA) lamportsA += amount; else lamportsB += amount
        allRows.push({ sig: tx.signature, type: 'BUY', side, sol: amount, ts: tx.timestamp })
      } else if (matchesDisc(data, SELL_DISC)) {
        const returned = (tx.nativeTransfers ?? [])
          .filter((t: any) => t.fromUserAccount === vaultAddr)
          .reduce((sum: number, t: any) => sum + t.amount, 0) / LAMPORTS
        sellCount++
        if (isA) lamportsA += returned; else lamportsB += returned
        allRows.push({ sig: tx.signature, type: 'SELL', side, sol: returned, ts: tx.timestamp })
      }
    }

    if (txs.length < 100) break
    cursor = txs[txs.length - 1].signature
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nTotal unique signatures seen: ${seenSignatures.size}`)
  console.log(`Cross-page duplicate signatures detected: ${dupeCount}`)
  console.log(`Buy instructions: ${buyCount}  Sell instructions: ${sellCount}`)
  console.log('─'.repeat(70))
  console.log(`Independently computed volume A: ${lamportsA.toFixed(4)} SOL`)
  console.log(`Independently computed volume B: ${lamportsB.toFixed(4)} SOL`)
  console.log(`Total: ${(lamportsA + lamportsB).toFixed(4)} SOL`)
  console.log('─'.repeat(70))
  console.log('\nAll parsed rows (chronological):')
  allRows.sort((a, b) => a.ts - b.ts)
  for (const r of allRows) {
    console.log(`  ${new Date(r.ts * 1000).toISOString()}  ${r.type.padEnd(4)} side ${r.side}  ${r.sol.toFixed(4)} SOL  ${r.sig.slice(0, 20)}...`)
  }
}
main()
