/**
 * WaveWarz Claims Backfill — populate the trades table with real claimShares payouts.
 *
 * The trades table only ever captured buyShares/sellShares — claimShares (the
 * actual settlement withdrawal) was explicitly skipped, which is why trader
 * P&L on the leaderboard was wrong: a trader who bought and held to
 * settlement showed as a full loss even if they claimed a real profit.
 *
 * For every settled battle, scans the battle vault PDA via Helius for
 * claimShares transactions and stores the real SOL amount paid to each
 * trader (trade_type: 'claim'). No estimation — this is the exact on-chain
 * payout.
 *
 * Usage:
 *   npx tsx scripts/backfill-claims-from-chain.ts                 # all settled battles missing claims
 *   npx tsx scripts/backfill-claims-from-chain.ts --since=2026-05-01
 *   npx tsx scripts/backfill-claims-from-chain.ts --ids=1781142090,1781140240
 *   npx tsx scripts/backfill-claims-from-chain.ts --limit=50      # newest 50 only
 *   npx tsx scripts/backfill-claims-from-chain.ts --dry-run
 *   npx tsx scripts/backfill-claims-from-chain.ts --resync --since=2026-06-01
 *     # re-checks battles even if they already have claims, replacing stored
 *     # rows with the current on-chain set — use this for the recurring/nightly
 *     # job so claims trickling in later (traders can withdraw any time) get
 *     # picked up, not just the first claim seen.
 *
 * Without --resync: battles that already have claim rows in trades are skipped
 * (fast path for a one-off historical backfill).
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

import { fetchBattleClaimsFromChain, hydrateOnchainData } from '../src/lib/solana/hydrate'
import { fetchAll } from '../src/lib/supabase/fetch-all'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const resync = process.argv.includes('--resync')
  const idsArg = process.argv.find(a => a.startsWith('--ids='))
  const sinceArg = process.argv.find(a => a.startsWith('--since='))
  const limitArg = process.argv.find(a => a.startsWith('--limit='))

  if (!SUPABASE_URL || !SERVICE_KEY || !process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
    console.error('Missing env vars (SUPABASE_URL / SERVICE_ROLE_KEY / HELIUS_API_KEY)')
    process.exit(1)
  }

  console.log('─'.repeat(70))
  console.log('WaveWarz Claims Backfill — real settlement payouts from vault PDAs')
  if (dryRun) console.log('DRY RUN — no writes')
  console.log('─'.repeat(70))

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Which battles already have claim rows? In --resync mode we re-check these too
  // (traders can claim any time after settlement — a battle with 2 claims today
  // might have a 3rd next week), re-fetching fresh from chain and replacing what's
  // stored. Without --resync, battles with any existing claims are skipped (fast
  // path for a one-off historical backfill).
  //
  // Paginated with fetchAll -- a bare .limit(500000) silently truncates to
  // PostgREST's 1000-row cap. With claim rows approaching that threshold
  // (957 as of 2026-07-18), a truncated haveClaims set would make the delete
  // step below get skipped for battles whose claims fell past row 1000,
  // inserting a second copy of every claim for that battle on the next run --
  // the exact same duplicate-row bug already found and fixed in trades
  // (709 rows, see git history) and in backfill-trades-from-chain.ts.
  const existingClaims = await fetchAll<{ battle_id: number }>((from, to) =>
    supabase.from('trades').select('battle_id').eq('trade_type', 'claim').range(from, to)
  )
  const haveClaims = new Set(existingClaims.map(r => r.battle_id))

  let q = supabase
    .from('battles')
    .select('battle_id, artist1_name, artist2_name, created_at')
    .eq('is_test_battle', false)
    .eq('winner_decided', true)
    .order('created_at', { ascending: false })
  if (idsArg) q = q.in('battle_id', idsArg.replace('--ids=', '').split(',').map(Number).filter(Boolean))
  if (sinceArg) q = q.gte('created_at', sinceArg.replace('--since=', ''))
  const { data: battles, error } = await q
  if (error) { console.error(error.message); process.exit(1) }

  let targets = resync ? (battles ?? []) : (battles ?? []).filter(b => !haveClaims.has(b.battle_id))
  if (limitArg) targets = targets.slice(0, Number(limitArg.replace('--limit=', '')) || targets.length)

  console.log(`\nSettled battles to check for claims: ${targets.length}` +
    (resync ? ' (resync mode — rechecking all, including already-populated)' : ` (skipping ${haveClaims.size} already populated)`) + '\n')
  if (!targets.length) { console.log('Nothing to do.'); return }

  let done = 0, noClaims = 0, failed = 0, totalClaims = 0, totalSol = 0

  for (const b of targets) {
    process.stdout.write(`  #${b.battle_id} ${String(b.artist1_name).slice(0, 18)} vs ${String(b.artist2_name).slice(0, 18)}... `)
    try {
      const onchain = await hydrateOnchainData(b.battle_id)
      if (!onchain || onchain.end_time_sec <= 0) {
        console.log('no usable end_time — skipped')
        noClaims++
        continue
      }
      const claims = await fetchBattleClaimsFromChain(b.battle_id, onchain.end_time_sec)
      if (!claims) {
        console.log('fetch failed — skipped (will retry next run)')
        failed++
        continue
      }
      if (claims.length === 0) {
        console.log('0 claims on chain (unclaimed or none yet)')
        noClaims++
        continue
      }
      const sol = claims.reduce((s, c) => s + c.amount_sol, 0)
      if (!dryRun) {
        // Delete-then-insert makes this idempotent and safe to resync — a battle
        // re-checked after a trader claims later just gets its claim rows replaced
        // with the current, complete set from chain (never double-inserted).
        if (haveClaims.has(b.battle_id)) {
          const { error: delErr } = await supabase.from('trades').delete().eq('battle_id', b.battle_id).eq('trade_type', 'claim')
          if (delErr) throw new Error(delErr.message)
        }
        for (let i = 0; i < claims.length; i += 500) {
          const { error: insErr } = await supabase.from('trades').insert(claims.slice(i, i + 500))
          if (insErr) throw new Error(insErr.message)
        }
      }
      console.log(`${claims.length} claims, ${sol.toFixed(4)} SOL${dryRun ? ' [dry run]' : ' ✓'}`)
      done++
      totalClaims += claims.length
      totalSol += sol
      await new Promise(r => setTimeout(r, 1000)) // Helius rate-limit courtesy
    } catch (err) {
      console.log(`error: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log('\n' + '─'.repeat(70))
  console.log(`Backfilled: ${done} battles (${totalClaims} claims, ${totalSol.toFixed(4)} SOL)`)
  console.log(`No claims found: ${noClaims}`)
  console.log(`Errors:     ${failed}`)
  console.log('─'.repeat(70))
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
