/**
 * Apply byte-249 (total_distribution_amount) from Zaal's chain re-read to
 * battles.total_distribution_amount. Chain truth: ~450 SOL across ~1,506
 * battles; the column previously summed ~44 SOL because a hydration step
 * failed on most battles.
 *
 * Only writes total_distribution_amount. Does NOT touch winner_decided /
 * winner_artist_a — those are the sanctioned-outcome fields and stay untouched
 * per the house rule.
 *
 *   npx tsx scripts/apply-settlement-from-chain.ts --csv ~/wavewarz-protocol/recon/settlement-from-chain.csv [--dry-run]
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const p = path.resolve(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const csvArg = process.argv.find(a => a.startsWith('--csv='))
    ?? (() => { const i = process.argv.indexOf('--csv'); return i >= 0 ? `--csv=${process.argv[i + 1]}` : undefined })()
  if (!csvArg) { console.error('need --csv <path>'); process.exit(1) }
  const csvPath = csvArg.replace('--csv=', '').replace(/^~/, process.env.HOME!)

  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n').slice(1)
  const rows = lines.map(l => {
    const [battle_id, dist] = l.split(',')
    return { battle_id: Number(battle_id), dist: Number(dist) }
  }).filter(r => Number.isFinite(r.battle_id))

  console.log(`${rows.length} rows in CSV; ${rows.filter(r => r.dist > 0).length} with non-zero distribution`)
  const total = rows.reduce((s, r) => s + r.dist, 0)
  console.log(`total distribution on chain: ${total.toFixed(2)} SOL`)
  if (dryRun) { console.log('DRY RUN — no writes'); return }

  let done = 0, changed = 0
  for (const r of rows) {
    const { error } = await supabase.from('battles')
      .update({ total_distribution_amount: r.dist })
      .eq('battle_id', r.battle_id)
    if (error) { console.warn(`  ${r.battle_id}: ${error.message}`); continue }
    done++
    if (done % 200 === 0) process.stdout.write(`  ${done}/${rows.length}\r`)
  }
  console.log(`\nupdated ${done} battles`)
}
main().catch(e => { console.error(e); process.exit(1) })
