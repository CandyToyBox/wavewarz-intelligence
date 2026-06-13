/**
 * WaveWarz Trade Count Backfill — recompute battles.trade_count and
 * battles.unique_traders from the (now populated) trades table.
 *
 * The trader profile + leaderboard read the trades table directly, but the
 * admin Command Center and battle cards use the denormalized trade_count /
 * unique_traders columns on battles. After a trades backfill those columns
 * are stale (0 / null). This re-derives them.
 *
 * Usage:
 *   npx tsx scripts/backfill-trade-counts.ts            # all battles that have trades
 *   npx tsx scripts/backfill-trade-counts.ts --dry-run
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
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

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  console.log('─'.repeat(70))
  console.log('Trade Count Backfill — recompute trade_count / unique_traders')
  if (dryRun) console.log('DRY RUN — no writes')
  console.log('─'.repeat(70))

  // Page through every trade and aggregate per battle
  const counts = new Map<number, { trades: number; wallets: Set<string> }>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('trades')
      .select('battle_id, trader_wallet')
      .range(from, from + 999)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const t of data) {
      if (t.battle_id == null) continue
      let c = counts.get(t.battle_id)
      if (!c) { c = { trades: 0, wallets: new Set() }; counts.set(t.battle_id, c) }
      c.trades++
      if (t.trader_wallet) c.wallets.add(t.trader_wallet)
    }
    if (data.length < 1000) break
    from += 1000
  }

  console.log(`\nBattles with trades: ${counts.size}\n`)

  let updated = 0, failed = 0
  for (const [battleId, c] of counts) {
    if (dryRun) { updated++; continue }
    const { error } = await supabase
      .from('battles')
      .update({ trade_count: c.trades, unique_traders: c.wallets.size })
      .eq('battle_id', battleId)
    if (error) { console.warn(`  #${battleId}: ${error.message}`); failed++ }
    else updated++
  }

  console.log('─'.repeat(70))
  console.log(`Updated: ${updated}${dryRun ? ' [dry run]' : ''}`)
  console.log(`Errors:  ${failed}`)
  console.log('─'.repeat(70))
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
