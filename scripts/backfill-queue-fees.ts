/**
 * WaveWarz Queue Fees Backfill — populate treasury_fee_events with real
 * Skip Queue and Add to Queue revenue.
 *
 * Both fees are plain SOL transfers straight to the treasury wallet,
 * outside the WaveWarz Anchor program entirely — no buyShares/sellShares/
 * claimShares instruction, no memo, nothing for the trade-parsing webhook
 * to see. That's why the admin dashboard has carried "⚠ Skip queue fees
 * not included" since launch, and why Add to Queue revenue was only ever
 * an estimate (LAUNCH_FEES.quickQueue × quickCount) rather than real data.
 *
 * This scans the treasury wallet's own transaction history directly and
 * classifies transfers by amount against the known fee ladder (see
 * fetchTreasuryFeeEventsFromChain in src/lib/solana/hydrate.ts):
 *   - 0.005 SOL                    → Add to Queue
 *   - 0.02 SOL + n × 0.01 SOL      → Skip Queue (base + escalations)
 *
 * Found and validated 2026-07-29 by cross-referencing founder payout
 * screenshots against on-chain data, then confirmed exact-match against
 * the live Fee Rate Reference card in the admin dashboard.
 *
 * Usage:
 *   npx tsx scripts/backfill-queue-fees.ts              # backfill, skip existing signatures
 *   npx tsx scripts/backfill-queue-fees.ts --dry-run     # fetch + classify, no writes
 *
 * Safe to re-run any time — upserts on the unique `signature` column, so
 * this can go straight into the nightly integrity check alongside the
 * claims resync, same idempotent pattern.
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_HELIUS_API_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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

import { fetchTreasuryFeeEventsFromChain } from '../src/lib/solana/hydrate'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Dominant treasury wallet — 1,236 of 1,393 battles as of 2026-07-29
// (15 on a legacy address, 142 unset). Confirmed via:
//   select wavewarz_wallet, count(*) from battles group by wavewarz_wallet;
const TREASURY_WALLET = 'FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  if (!SUPABASE_URL || !SERVICE_KEY || !process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
    console.error('Missing env vars (SUPABASE_URL / SERVICE_ROLE_KEY / HELIUS_API_KEY)')
    process.exit(1)
  }

  console.log('─'.repeat(70))
  console.log('WaveWarz Queue Fees Backfill — Skip Queue + Add to Queue from chain')
  if (dryRun) console.log('DRY RUN — no writes')
  console.log('─'.repeat(70))
  console.log(`Treasury wallet: ${TREASURY_WALLET}\n`)

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const events = await fetchTreasuryFeeEventsFromChain(TREASURY_WALLET)
  if (!events) {
    console.error('Fetch failed — no events returned (see logged error above).')
    process.exit(1)
  }

  const skip = events.filter(e => e.fee_type === 'skip_queue')
  const addQ = events.filter(e => e.fee_type === 'add_to_queue')
  console.log(`Found ${events.length} fee events:`)
  console.log(`  Skip Queue:    ${skip.length} txs, ${skip.reduce((s, e) => s + e.amount_sol, 0).toFixed(4)} SOL`)
  console.log(`  Add to Queue:  ${addQ.length} txs, ${addQ.reduce((s, e) => s + e.amount_sol, 0).toFixed(4)} SOL`)

  if (!events.length) { console.log('\nNothing to write.'); return }

  if (!dryRun) {
    let written = 0
    for (let i = 0; i < events.length; i += 500) {
      const batch = events.slice(i, i + 500).map(e => ({
        signature: e.signature,
        fee_type: e.fee_type,
        amount_sol: e.amount_sol,
        from_wallet: e.from_wallet,
        timestamp: e.timestamp,
      }))
      const { error } = await supabase
        .from('treasury_fee_events')
        .upsert(batch, { onConflict: 'signature', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
      written += batch.length
    }
    console.log(`\n${written} events upserted (existing signatures skipped, safe to re-run).`)
  } else {
    console.log('\n[dry run] Would upsert the above — re-run without --dry-run to write.')
  }

  console.log('─'.repeat(70))
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
