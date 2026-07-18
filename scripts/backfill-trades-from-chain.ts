/**
 * WaveWarz Trades Backfill — populate the trades table from chain history.
 *
 * For every battle with volume but no rows in the trades table, scans the
 * battle vault PDA via Helius and stores each individual buyShares/sellShares
 * trade (wallet, side, amount, timestamp). Withdrawals (claimShares) are
 * excluded — payouts are not trading volume.
 *
 * This is what makes trader profiles and the trader leaderboard reliable:
 * both read straight from the trades table.
 *
 * Usage:
 *   npx tsx scripts/backfill-trades-from-chain.ts                 # all battles missing trades
 *   npx tsx scripts/backfill-trades-from-chain.ts --since=2026-05-01
 *   npx tsx scripts/backfill-trades-from-chain.ts --ids=1781142090,1781140240
 *   npx tsx scripts/backfill-trades-from-chain.ts --limit=50      # newest 50 only
 *   npx tsx scripts/backfill-trades-from-chain.ts --dry-run
 *
 * Safe to re-run: battles that already have trades rows are skipped.
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_HELIUS_API_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Env (must load before importing hydrate, which reads process.env) ────────
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

import { fetchBattleTradesFromChain, hydrateOnchainData } from '../src/lib/solana/hydrate'
import { fetchAll } from '../src/lib/supabase/fetch-all'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const idsArg = process.argv.find(a => a.startsWith('--ids='))
  const sinceArg = process.argv.find(a => a.startsWith('--since='))
  const limitArg = process.argv.find(a => a.startsWith('--limit='))

  if (!SUPABASE_URL || !SERVICE_KEY || !process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
    console.error('Missing env vars (SUPABASE_URL / SERVICE_ROLE_KEY / HELIUS_API_KEY)')
    process.exit(1)
  }

  console.log('─'.repeat(70))
  console.log('WaveWarz Trades Backfill — per-trade history from vault PDAs')
  if (dryRun) console.log('DRY RUN — no writes')
  console.log('─'.repeat(70))

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Which battles already have BUY/SELL trades rows? (paginated past PostgREST's
  // 1000-row default cap -- a plain .limit(500000) silently truncates at 1000,
  // which was misclassifying battles as "already backfilled" and risked
  // re-inserting duplicates. Also excludes trade_type='claim': a battle with
  // only withdrawal rows and zero buy/sell rows still needs backfilling --
  // the old unfiltered query counted claim-only battles as "done" and they
  // were silently skipped forever, 74 battles / 33.94 SOL worth.)
  const existing = await fetchAll<{ battle_id: number }>((from, to) =>
    supabase.from('trades').select('battle_id').neq('trade_type', 'claim').range(from, to)
  )
  const haveTrades = new Set(existing.map(r => r.battle_id))

  // Target battles
  let q = supabase
    .from('battles')
    .select('battle_id, artist1_name, artist2_name, total_volume_a, total_volume_b, created_at')
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })
  if (idsArg) q = q.in('battle_id', idsArg.replace('--ids=', '').split(',').map(Number).filter(Boolean))
  if (sinceArg) q = q.gte('created_at', sinceArg.replace('--since=', ''))
  const { data: battles, error } = await q
  if (error) { console.error(error.message); process.exit(1) }

  let targets = (battles ?? []).filter(b =>
    !haveTrades.has(b.battle_id) &&
    ((b.total_volume_a ?? 0) + (b.total_volume_b ?? 0)) > 0
  )
  if (limitArg) targets = targets.slice(0, Number(limitArg.replace('--limit=', '')) || targets.length)

  console.log(`\nBattles to backfill: ${targets.length} (skipping ${haveTrades.size ? [...haveTrades].length : 0} already populated)\n`)
  if (!targets.length) { console.log('Nothing to do.'); return }

  let done = 0, skipped = 0, failed = 0, totalTrades = 0

  for (const b of targets) {
    process.stdout.write(`  #${b.battle_id} ${String(b.artist1_name).slice(0, 18)} vs ${String(b.artist2_name).slice(0, 18)}... `)
    try {
      const onchain = await hydrateOnchainData(b.battle_id)
      if (!onchain || onchain.start_time_sec <= 0 || onchain.end_time_sec <= onchain.start_time_sec) {
        console.log('no usable onchain timestamps — skipped')
        skipped++
        continue
      }
      const trades = await fetchBattleTradesFromChain(b.battle_id, onchain.start_time_sec, onchain.end_time_sec)
      if (!trades || trades.length === 0) {
        console.log('0 trades on chain — skipped')
        skipped++
        continue
      }
      const vol = trades.reduce((s, t) => s + t.amount_sol, 0)
      if (!dryRun) {
        // chunked insert (PostgREST payload limits)
        for (let i = 0; i < trades.length; i += 500) {
          const { error: insErr } = await supabase.from('trades').insert(trades.slice(i, i + 500))
          if (insErr) throw new Error(insErr.message)
        }
      }
      console.log(`${trades.length} trades, ${vol.toFixed(2)} SOL${dryRun ? ' [dry run]' : ' ✓'}`)
      done++
      totalTrades += trades.length
      await new Promise(r => setTimeout(r, 1000)) // Helius rate-limit courtesy
    } catch (err) {
      console.log(`error: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log('\n' + '─'.repeat(70))
  console.log(`Backfilled: ${done} battles (${totalTrades} trades)`)
  console.log(`Skipped:    ${skipped}`)
  console.log(`Errors:     ${failed}`)
  console.log('─'.repeat(70))
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
