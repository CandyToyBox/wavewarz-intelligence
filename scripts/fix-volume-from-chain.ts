/**
 * WaveWarz Volume Fix — Recompute from Vault Transaction History
 *
 * Correct volume = ALL buyShares gross SOL + ALL sellShares SOL returned
 * during the battle's trading window (start_time → end_time).
 *
 * This fixes battles where total_volume_a == artist1_pool (i.e. only the
 * final pool value was stored, not actual trading volume including sells).
 *
 * Usage:
 *   # Fix all battles where vol ≈ pool (within 0.1% tolerance):
 *   npx tsx scripts/fix-volume-from-chain.ts
 *
 *   # Fix specific battle IDs:
 *   npx tsx scripts/fix-volume-from-chain.ts --ids 1774827361,1774829375,1774831893
 *
 *   # Dry run (no writes):
 *   npx tsx scripts/fix-volume-from-chain.ts --dry-run
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   NEXT_PUBLIC_HELIUS_API_KEY=...
 */

import { createClient } from '@supabase/supabase-js'
import { PublicKey } from '@solana/web3.js'
import * as fs from 'fs'
import * as path from 'path'

// ── Env ────────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) { console.error('Missing .env.local'); process.exit(1) }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HELIUS_KEY    = process.env.NEXT_PUBLIC_HELIUS_API_KEY!
const PROGRAM_ID    = '9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'
const LAMPORTS      = 1_000_000_000

// Anchor discriminators from IDL
const BUY_DISCRIMINATOR  = [40, 239, 138, 154, 8, 37, 106, 108]
const SELL_DISCRIMINATOR = [184, 164, 169, 16, 231, 158, 199, 196]

// bs58 v4 ships as a CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }

// ── PDAs ──────────────────────────────────────────────────────────────────────

function toBigIntLE(num: number): Uint8Array {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setBigUint64(0, BigInt(num), true)
  return new Uint8Array(buf)
}

function programId(): PublicKey { return new PublicKey(PROGRAM_ID) }

function getVaultPDA(battleId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('battle_vault'), toBigIntLE(battleId)],
    programId()
  )
  return pda
}

// Need battle account to read start/end times
function getBattlePDA(battleId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('battle'), toBigIntLE(battleId)],
    programId()
  )
  return pda
}

// ── Battle account parser (minimal) ──────────────────────────────────────────

function parseBattleTimes(data: Uint8Array): { startTime: number; endTime: number } | null {
  try {
    // Layout (matches parser.ts):
    // 8  discriminator
    // 8  battle_id
    // 4  bumps (4 × u8)
    // 8  start_time  ← offset 20
    // 8  end_time    ← offset 28
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const startTime = Number(view.getBigInt64(20, true))
    const endTime   = Number(view.getBigInt64(28, true))
    if (startTime <= 0 || endTime <= 0 || endTime <= startTime) return null
    return { startTime, endTime }
  } catch {
    return null
  }
}

// ── Helius volume fetch ───────────────────────────────────────────────────────

interface HeliusTx {
  signature: string
  timestamp: number
  nativeTransfers: { fromUserAccount: string; toUserAccount: string; amount: number }[]
  instructions:    { programId: string; data: string }[]
}

function matchesDisc(buf: Buffer, disc: number[]): boolean {
  return disc.every((b, i) => buf[i] === b)
}

async function fetchVolumeFromChain(
  battleId: number,
  startTimeSec: number,
  endTimeSec: number,
): Promise<{ volumeA: number; volumeB: number } | null> {
  const vaultAddr = getVaultPDA(battleId).toBase58()
  let lamportsA = 0, lamportsB = 0
  let cursor: string | undefined

  for (let page = 0; page < 20; page++) {
    const url =
      `https://api-mainnet.helius-rpc.com/v0/addresses/${vaultAddr}/transactions` +
      `?api-key=${HELIUS_KEY}&limit=100` +
      (cursor ? `&before=${cursor}` : '')

    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  Helius ${res.status} on page ${page}`)
      break
    }

    const txs: HeliusTx[] = await res.json()
    if (!txs.length) break

    let hitFloor = false

    for (const tx of txs) {
      if (tx.timestamp > endTimeSec) continue
      if (tx.timestamp < startTimeSec) { hitFloor = true; break }

      const ix = tx.instructions.find(i => i.programId === PROGRAM_ID)
      if (!ix?.data) continue

      let data: Buffer
      try { data = Buffer.from(bs58.decode(ix.data)) }
      catch { continue }
      if (data.length < 17) continue

      const isA = data[16] !== 0

      if (matchesDisc(data, BUY_DISCRIMINATOR)) {
        const amount = Number(data.readBigUInt64LE(8))
        if (isA) lamportsA += amount
        else      lamportsB += amount

      } else if (matchesDisc(data, SELL_DISCRIMINATOR)) {
        const returned = tx.nativeTransfers
          .filter(t => t.fromUserAccount === vaultAddr)
          .reduce((sum, t) => sum + t.amount, 0)
        if (isA) lamportsA += returned
        else      lamportsB += returned
      }
    }

    if (hitFloor || txs.length < 100) break
    cursor = txs[txs.length - 1].signature

    // Gentle rate-limit pause between pages
    await new Promise(r => setTimeout(r, 250))
  }

  return { volumeA: lamportsA / LAMPORTS, volumeB: lamportsB / LAMPORTS }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const idsArg = process.argv.find(a => a.startsWith('--ids='))

  if (!SUPABASE_URL || !SERVICE_KEY || !HELIUS_KEY) {
    console.error('Missing env vars')
    process.exit(1)
  }

  console.log('─'.repeat(70))
  console.log('WaveWarz Volume Fix — from Vault Transaction History')
  if (dryRun) console.log('DRY RUN — no writes')
  console.log('─'.repeat(70))

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  let targets: { battle_id: number; artist1_pool: number; artist2_pool: number; total_volume_a: number; total_volume_b: number }[]

  if (idsArg) {
    // Specific IDs passed on CLI
    const ids = idsArg.replace('--ids=', '').split(',').map(Number).filter(Boolean)
    const { data, error } = await supabase
      .from('battles')
      .select('battle_id,artist1_pool,artist2_pool,total_volume_a,total_volume_b')
      .in('battle_id', ids)
    if (error) { console.error(error.message); process.exit(1) }
    targets = (data ?? []) as typeof targets
  } else {
    // Auto-detect: battles where total_volume ≈ artist_pool (within 0.1% of each other)
    // These are the ones where artist_sol_balance was used instead of true volume.
    const { data, error } = await supabase
      .from('battles')
      .select('battle_id,artist1_pool,artist2_pool,total_volume_a,total_volume_b')
      .eq('is_test_battle', false)
      .not('total_volume_a', 'is', null)
      .not('total_volume_b', 'is', null)
      .order('battle_id', { ascending: false })
    if (error) { console.error(error.message); process.exit(1) }

    // Keep only battles where vol ≈ pool (indicating vol was copied from pool, not computed)
    targets = ((data ?? []) as typeof targets).filter(b => {
      const totalVol  = (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0)
      const totalPool = (b.artist1_pool ?? 0) + (b.artist2_pool ?? 0)
      if (totalPool <= 0) return false
      const diff = Math.abs(totalVol - totalPool) / totalPool
      return diff < 0.001  // vol is within 0.1% of pool — almost certainly wrong
    })
  }

  console.log(`\nBattles to fix: ${targets.length}\n`)
  if (!targets.length) { console.log('Nothing to fix.'); return }

  // Also need battle timestamps from Solana
  const { Connection } = await import('@solana/web3.js')
  const connection = new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
    'confirmed'
  )

  let fixed = 0, skipped = 0, failed = 0

  for (const battle of targets) {
    const id = battle.battle_id
    const oldVol = (battle.total_volume_a ?? 0) + (battle.total_volume_b ?? 0)
    process.stdout.write(`  Battle #${id} (old vol=${oldVol.toFixed(4)})... `)

    try {
      // Get battle timestamps from chain
      const battlePDA = getBattlePDA(id)
      const account = await connection.getAccountInfo(battlePDA)
      if (!account) {
        process.stdout.write('no onchain account — skipped\n')
        skipped++
        continue
      }

      const times = parseBattleTimes(account.data)
      if (!times) {
        process.stdout.write('could not parse timestamps — skipped\n')
        skipped++
        continue
      }

      // Fetch true volume from Helius
      const vol = await fetchVolumeFromChain(id, times.startTime, times.endTime)
      if (!vol) {
        process.stdout.write('Helius fetch failed — skipped\n')
        skipped++
        continue
      }

      const newTotalVol = vol.volumeA + vol.volumeB
      if (newTotalVol === 0) {
        process.stdout.write('chain returned 0 volume — skipped\n')
        skipped++
        continue
      }

      process.stdout.write(`new vol A=${vol.volumeA.toFixed(4)} B=${vol.volumeB.toFixed(4)} (total=${newTotalVol.toFixed(4)})`)

      if (!dryRun) {
        const { error: updateErr } = await supabase
          .from('battles')
          .update({ total_volume_a: vol.volumeA, total_volume_b: vol.volumeB })
          .eq('battle_id', id)

        if (updateErr) {
          process.stdout.write(` ✗ ${updateErr.message}\n`)
          failed++
          continue
        }
      }

      process.stdout.write(dryRun ? ' [dry run]\n' : ' ✓\n')
      fixed++

      // Pause between battles to avoid Helius rate limits
      await new Promise(r => setTimeout(r, 500))

    } catch (err) {
      process.stdout.write(`error: ${err instanceof Error ? err.message : String(err)}\n`)
      failed++
    }
  }

  console.log('\n' + '─'.repeat(70))
  console.log(`Fixed:   ${fixed}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors:  ${failed}`)
  if (dryRun) console.log('\nRe-run without --dry-run to apply.')
  console.log('─'.repeat(70))
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
