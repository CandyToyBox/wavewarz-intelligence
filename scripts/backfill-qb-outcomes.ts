/**
 * QB Outcome Backfill — CSV Import
 *
 * Takes a CSV export from IKE (wavewarz.com Supabase) and patches our
 * Intelligence DB with DJ Wavy, poll, chart, and overall winner data.
 *
 * Ask IKE to run this query in his Supabase SQL editor and export as CSV:
 *
 *   SELECT
 *     battle_id,
 *     poll_votes_a,
 *     poll_votes_b,
 *     poll_winner,
 *     poll_finalized_at,
 *     quick_battles_dj_wavy_winner,
 *     quick_battles_dj_wavy_judged_at,
 *     quick_battles_chart_winner,
 *     quick_battles_final_artist1_pool,
 *     quick_battles_final_artist2_pool,
 *     quick_battles_charts_finalized_at,
 *     quick_battles_overall_winner,
 *     quick_battles_winner_decided,
 *     quick_battles_winner_artist_a
 *   FROM battles
 *   WHERE is_quick_battle = true
 *     AND quick_battles_dj_wavy_winner IS NOT NULL
 *   ORDER BY battle_id ASC;
 *
 * Run:
 *   cd "Statz App V2 WaveWarz"
 *   npx tsx scripts/backfill-qb-outcomes.ts --csv ~/Downloads/qb_outcomes.csv
 *
 * Safe to re-run — updates only, no deletes.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, createReadStream, existsSync } from 'fs'
import { resolve } from 'path'
import * as readline from 'readline'

// ── Load .env.local ───────────────────────────────────────────────────────────
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
}

const statz = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── CSV parser (handles quoted fields) ───────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

async function parseCSV(filePath: string): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = []
  const rl = readline.createInterface({ input: createReadStream(filePath) })
  let headers: string[] = []
  let first = true
  for await (const line of rl) {
    if (!line.trim()) continue
    if (first) { headers = parseCSVLine(line); first = false; continue }
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = values[i]?.trim() ?? '' })
    rows.push(row)
  }
  return rows
}

// ── Coerce CSV strings to correct types ──────────────────────────────────────
function coerceBool(v: string): boolean | null {
  if (!v) return null
  return v.toLowerCase() === 'true'
}

function coerceNum(v: string): number | null {
  if (!v) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function coerceStr(v: string): string | null {
  return v || null
}

// ── Patch our battles table ───────────────────────────────────────────────────
async function patchStatz(rows: Record<string, string>[]) {
  let updated = 0
  let skipped = 0
  let errors  = 0

  for (const row of rows) {
    const battleId = Number(row.battle_id)
    if (isNaN(battleId)) { skipped++; continue }

    const qbWinnerDecided  = coerceBool(row.quick_battles_winner_decided)
    const qbWinnerArtistA  = coerceBool(row.quick_battles_winner_artist_a)

    const patch: Record<string, unknown> = {
      // Poll
      poll_votes_a:                      coerceNum(row.poll_votes_a),
      poll_votes_b:                      coerceNum(row.poll_votes_b),
      poll_winner:                       coerceStr(row.poll_winner),
      poll_finalized_at:                 coerceStr(row.poll_finalized_at),
      // DJ Wavy: map wavewarz.com column name → our dj_wavy_winner field
      dj_wavy_winner:                    coerceStr(row.quick_battles_dj_wavy_winner),
      // QB-specific outcome columns
      quick_battles_dj_wavy_judged_at:   coerceStr(row.quick_battles_dj_wavy_judged_at),
      quick_battles_chart_winner:        coerceStr(row.quick_battles_chart_winner),
      quick_battles_final_artist1_pool:  coerceNum(row.quick_battles_final_artist1_pool),
      quick_battles_final_artist2_pool:  coerceNum(row.quick_battles_final_artist2_pool),
      quick_battles_charts_finalized_at: coerceStr(row.quick_battles_charts_finalized_at),
      quick_battles_overall_winner:      coerceStr(row.quick_battles_overall_winner),
      quick_battles_winner_decided:      qbWinnerDecided ?? false,
      quick_battles_winner_artist_a:     qbWinnerArtistA,
    }

    // If wavewarz.com has decided the QB winner, fix the main winner fields too
    if (qbWinnerDecided && qbWinnerArtistA != null) {
      patch.winner_decided  = true
      patch.winner_artist_a = qbWinnerArtistA ? 1 : 0
    }

    const { error } = await statz
      .from('battles')
      .update(patch)
      .eq('battle_id', battleId)

    if (error) {
      console.error(`  ✗ battle ${battleId}: ${error.message}`)
      errors++
    } else {
      const djW     = row.quick_battles_dj_wavy_winner  || '—'
      const poll    = row.poll_winner                    || '—'
      const overall = row.quick_battles_overall_winner   || '—'
      console.log(`  ✓ #${battleId}  DJ Wavy: ${djW}  |  Poll: ${poll}  |  Overall: ${overall}`)
      updated++
    }
  }

  return { updated, skipped, errors }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvArg  = process.argv.findIndex(a => a === '--csv')
  const csvPath = csvArg >= 0
    ? process.argv[csvArg + 1]?.replace(/^~/, process.env.HOME!)
    : null

  if (!csvPath || !existsSync(csvPath)) {
    console.error('Usage: npx tsx scripts/backfill-qb-outcomes.ts --csv <path/to/qb_outcomes.csv>')
    process.exit(1)
  }

  console.log('─'.repeat(64))
  console.log('QB Outcome Backfill — CSV → Intelligence DB')
  console.log('─'.repeat(64))

  console.log('\n[1/2] Parsing CSV...')
  const rows = await parseCSV(csvPath)
  console.log(`      Rows in CSV: ${rows.length}`)

  if (rows.length === 0) {
    console.log('Nothing to import.')
    return
  }

  console.log(`\n[2/2] Patching ${rows.length} battles...`)
  const { updated, skipped, errors } = await patchStatz(rows)

  console.log('\n' + '─'.repeat(64))
  console.log(`Updated:  ${updated}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Errors:   ${errors}`)
  console.log('─'.repeat(64))

  if (errors > 0) {
    console.log('\nSome updates failed — safe to re-run.')
    process.exit(1)
  }
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
