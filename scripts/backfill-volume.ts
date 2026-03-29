/**
 * WaveWarz Volume Backfill
 *
 * Fixes battles where total_volume_a + total_volume_b = 0 but
 * artist1_pool + artist2_pool > 0. This happens when the webhook
 * payload didn't include volume and the hydration step wasn't yet
 * writing artist_sol_balance to the DB.
 *
 * For each affected battle, fetches the Solana account's
 * artist_a_sol_balance and artist_b_sol_balance (cumulative trading SOL)
 * and writes them as total_volume_a / total_volume_b.
 *
 * Run:
 *   cd "Statz App V2 WaveWarz"
 *   npx tsx scripts/backfill-volume.ts
 *
 * Dry run (no writes):
 *   npx tsx scripts/backfill-volume.ts --dry-run
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   NEXT_PUBLIC_HELIUS_API_KEY=...
 */

import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey } from '@solana/web3.js'
import * as fs from 'fs'
import * as path from 'path'

// ── Env ───────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local')
    process.exit(1)
  }
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
const PROGRAM_ID    = new PublicKey('9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo')
const LAMPORTS      = 1_000_000_000

// ── PDA ───────────────────────────────────────────────────────────────────────

function toBattlePDA(battleId: number): PublicKey {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setBigUint64(0, BigInt(battleId), true)
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('battle'), new Uint8Array(buf)],
    PROGRAM_ID
  )
  return pda
}

// ── Account parser (minimal — only what we need) ──────────────────────────────

function parseSolBalances(data: Uint8Array): { solBalanceA: number; solBalanceB: number } | null {
  try {
    // Layout (from full parser.ts):
    // 8  discriminator
    // 8  battle_id
    // 4  bumps (4 x u8)
    // 8  start_time
    // 8  end_time
    // 32 artistAWallet
    // 32 artistBWallet
    // 32 wavewarzWallet
    // 32 artistAMint
    // 32 artistBMint
    // 8  artistASupply
    // 8  artistBSupply
    // 8  artistASolBalance  ← offset 204
    // 8  artistBSolBalance  ← offset 212
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const offset = 8 + 8 + 4 + 8 + 8 + 32 + 32 + 32 + 32 + 32 + 8 + 8  // = 212
    const solBalanceA = Number(view.getBigUint64(offset,     true)) / LAMPORTS
    const solBalanceB = Number(view.getBigUint64(offset + 8, true)) / LAMPORTS
    return { solBalanceA, solBalanceB }
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  if (!SUPABASE_URL || !SERVICE_KEY || !HELIUS_KEY) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_HELIUS_API_KEY')
    process.exit(1)
  }

  console.log('─'.repeat(60))
  console.log('WaveWarz Volume Backfill')
  if (dryRun) console.log('DRY RUN — no writes will happen')
  console.log('─'.repeat(60))

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, 'confirmed')

  // Find battles with 0 volume but non-zero pools (excluding test battles)
  const { data: battles, error } = await supabase
    .from('battles')
    .select('battle_id, artist1_pool, artist2_pool, total_volume_a, total_volume_b, status')
    .eq('is_test_battle', false)
    .or('total_volume_a.is.null,total_volume_a.eq.0')
    .or('total_volume_b.is.null,total_volume_b.eq.0')
    .order('battle_id', { ascending: false })

  if (error) {
    console.error('Supabase query failed:', error.message)
    process.exit(1)
  }

  // Filter to those that have real pool data (confirms battle actually ran)
  const targets = (battles ?? []).filter(b =>
    (b.artist1_pool ?? 0) + (b.artist2_pool ?? 0) > 0
  )

  console.log(`\nBattles with 0 volume + non-zero pools: ${targets.length}`)

  if (targets.length === 0) {
    console.log('Nothing to fix.')
    return
  }

  let fixed = 0, skipped = 0, failed = 0

  for (const battle of targets) {
    const id = battle.battle_id
    process.stdout.write(`  Battle #${id}... `)

    try {
      const pda = toBattlePDA(id)
      const accountInfo = await connection.getAccountInfo(pda)

      if (!accountInfo) {
        process.stdout.write('no onchain account — skipped\n')
        skipped++
        continue
      }

      const balances = parseSolBalances(accountInfo.data)

      if (!balances) {
        process.stdout.write('parse failed — skipped\n')
        skipped++
        continue
      }

      const { solBalanceA, solBalanceB } = balances

      if (solBalanceA === 0 && solBalanceB === 0) {
        process.stdout.write(`chain also 0 — skipped\n`)
        skipped++
        continue
      }

      process.stdout.write(`volA=${solBalanceA.toFixed(4)} volB=${solBalanceB.toFixed(4)}`)

      if (!dryRun) {
        const { error: updateErr } = await supabase
          .from('battles')
          .update({ total_volume_a: solBalanceA, total_volume_b: solBalanceB })
          .eq('battle_id', id)

        if (updateErr) {
          process.stdout.write(` ✗ ${updateErr.message}\n`)
          failed++
          continue
        }
      }

      process.stdout.write(dryRun ? ' [dry run]\n' : ' ✓\n')
      fixed++

      // Small delay to avoid RPC rate limits
      await new Promise(r => setTimeout(r, 150))

    } catch (err) {
      process.stdout.write(`error: ${err instanceof Error ? err.message : String(err)}\n`)
      failed++
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`Fixed:   ${fixed}`)
  console.log(`Skipped: ${skipped} (no onchain data or chain also 0)`)
  console.log(`Errors:  ${failed}`)
  if (dryRun) console.log('\nRe-run without --dry-run to apply.')
  console.log('─'.repeat(60))
}

main().catch(err => {
  console.error('\nFatal:', err)
  process.exit(1)
})
