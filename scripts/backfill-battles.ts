/**
 * WaveWarz Battle Backfill — CSV Import (New Battles Only)
 *
 * SAFE MODE: Never modifies existing rows. Only inserts battles that are
 * not already in the Intelligence database.
 *
 * What it does:
 *   1. Reads the CSV export
 *   2. Filters to battles created on or after CUTOFF_DATE
 *   3. Loads all existing battle_ids from Supabase
 *   4. Inserts ONLY rows whose battle_id is not already in the DB
 *   5. Existing rows are never touched (ignoreDuplicates: true as hard guard)
 *
 * Run:
 *   cd "Statz App V2 WaveWarz"
 *   npx tsx scripts/backfill-battles.ts --csv ~/Downloads/battles_rows\ \(6\).csv
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ── Config ────────────────────────────────────────────────────────────────────

// Only import battles on or after this date
const CUTOFF_DATE = new Date('2026-02-27T00:00:00.000Z')

// Batch size for Supabase inserts
const BATCH_SIZE = 50

// Load .env.local
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

// ── CSV columns to keep (maps CSV header → DB column) ────────────────────────
// Skips: is_main_battle (generated), last_scanned_at, recent_trades_cache,
//        quick_battle_* extra columns

const COLUMN_MAP: Record<string, string> = {
  id:                    'id',
  battle_id:             'battle_id',
  created_at:            'created_at',
  status:                'status',
  artist1_name:          'artist1_name',
  artist1_wallet:        'artist1_wallet',
  artist1_music_link:    'artist1_music_link',
  artist1_twitter:       'artist1_twitter',
  artist1_pool:          'artist1_pool',
  artist2_name:          'artist2_name',
  artist2_wallet:        'artist2_wallet',
  artist2_music_link:    'artist2_music_link',
  artist2_twitter:       'artist2_twitter',
  artist2_pool:          'artist2_pool',
  image_url:             'image_url',
  stream_link:           'stream_link',
  battle_duration:       'battle_duration',
  winner_decided:        'winner_decided',
  winner_artist_a:       'winner_artist_a',
  is_community_battle:   'is_community_battle',
  community_round_id:    'community_round_id',
  creator_wallet:        'creator_wallet',
  total_volume_a:        'total_volume_a',
  total_volume_b:        'total_volume_b',
  trade_count:           'trade_count',
  unique_traders:        'unique_traders',
  wavewarz_wallet:       'wavewarz_wallet',
  split_wallet_address:  'split_wallet_address',
  artist1_supply:        'artist1_supply',
  artist2_supply:        'artist2_supply',
  is_quick_battle:       'is_quick_battle',
  quick_battle_queue_id: 'quick_battle_queue_id',
  is_test_battle:        'is_test_battle',
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
// Handles quoted fields (including embedded JSON with commas)

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'; i++ // escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

async function parseCSV(filePath: string): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = []
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) })

  let headers: string[] = []
  let first = true

  for await (const line of rl) {
    if (!line.trim()) continue
    if (first) {
      headers = parseCSVLine(line)
      first = false
      continue
    }
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    rows.push(row)
  }

  return rows
}

// ── Value coercion ────────────────────────────────────────────────────────────

function coerce(col: string, raw: string): unknown {
  if (raw === '' || raw === null || raw === undefined) return null

  // Boolean columns → true/false
  if (['winner_decided', 'is_community_battle', 'is_quick_battle', 'is_test_battle'].includes(col)) {
    return raw.toLowerCase() === 'true'
  }

  // winner_artist_a: CSV has 'true'/'false' but DB stores as numeric 1.0/0.0
  if (col === 'winner_artist_a') {
    if (raw.toLowerCase() === 'true')  return 1
    if (raw.toLowerCase() === 'false') return 0
    return null
  }

  // Numeric columns
  if ([
    'artist1_pool', 'artist2_pool', 'total_volume_a', 'total_volume_b',
    'battle_duration', 'trade_count', 'unique_traders',
    'artist1_supply', 'artist2_supply', 'community_round_id',
  ].includes(col)) {
    const n = parseFloat(raw)
    return isNaN(n) ? null : n
  }

  // Status: normalize to uppercase
  if (col === 'status') return raw.toUpperCase()

  return raw
}

function transformRow(csvRow: Record<string, string>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [csvCol, dbCol] of Object.entries(COLUMN_MAP)) {
    row[dbCol] = coerce(dbCol, csvRow[csvCol] ?? '')
  }
  return row
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Parse --csv argument
  const csvArg = process.argv.findIndex(a => a === '--csv')
  const csvPath = csvArg >= 0
    ? process.argv[csvArg + 1].replace(/^~/, process.env.HOME!)
    : null

  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage: npx tsx scripts/backfill-battles.ts --csv <path/to/battles.csv>')
    process.exit(1)
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  console.log('─'.repeat(60))
  console.log('WaveWarz Backfill — New Battles Only (SAFE MODE)')
  console.log(`Cutoff: ${CUTOFF_DATE.toISOString().slice(0, 10)} — only importing battles on/after this date`)
  console.log('Existing rows: NEVER modified')
  console.log('─'.repeat(60))

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // ── Step 1: Parse CSV ───────────────────────────────────────────────────────
  console.log('\n[1/4] Parsing CSV...')
  const allRows = await parseCSV(csvPath)
  console.log(`    Total rows in CSV: ${allRows.length}`)

  // ── Step 2: Filter to cutoff date ──────────────────────────────────────────
  console.log(`\n[2/4] Filtering to created_at >= ${CUTOFF_DATE.toISOString().slice(0, 10)}...`)

  const newRows = allRows.filter(r => {
    if (!r.created_at) return false
    const d = new Date(r.created_at)
    return !isNaN(d.getTime()) && d >= CUTOFF_DATE
  })

  console.log(`    Rows on/after cutoff: ${newRows.length}`)
  console.log(`    Rows before cutoff (untouched): ${allRows.length - newRows.length}`)

  if (newRows.length === 0) {
    console.log('\n✓ Nothing to import.')
    return
  }

  // ── Step 3: Load existing battle_ids from DB ───────────────────────────────
  console.log('\n[3/4] Loading existing battle_ids from Supabase...')

  const { data: existing, error: existingErr } = await supabase
    .from('battles')
    .select('battle_id')

  if (existingErr) {
    console.error('    Supabase error:', existingErr.message)
    process.exit(1)
  }

  const existingIds = new Set((existing ?? []).map(r => String(r.battle_id)))
  console.log(`    Existing rows in DB: ${existingIds.size}`)

  // Determine which CSV rows are genuinely new
  const toInsert = newRows.filter(r => !existingIds.has(String(r.battle_id)))
  const alreadyPresent = newRows.length - toInsert.length

  console.log(`    Already in DB (skip): ${alreadyPresent}`)
  console.log(`    New rows to insert:   ${toInsert.length}`)

  if (toInsert.length === 0) {
    console.log('\n✓ All battles in range already exist in the DB. Nothing to insert.')
    return
  }

  // ── Step 4: Insert in batches ───────────────────────────────────────────────
  console.log(`\n[4/4] Inserting ${toInsert.length} new battles in batches of ${BATCH_SIZE}...`)

  let inserted = 0
  let errors = 0

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE).map(transformRow)

    const { error } = await supabase
      .from('battles')
      .upsert(batch, {
        onConflict: 'battle_id',
        ignoreDuplicates: true,  // Hard guard: NEVER overwrite existing rows
      })

    if (error) {
      console.error(`    ✗ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      errors += batch.length
    } else {
      inserted += batch.length
      const batchIds = batch.map(r => r.battle_id).join(', ')
      console.log(`    ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows): battle_ids ${batchIds}`)
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log(`Inserted:          ${inserted}`)
  console.log(`Already existed:   ${alreadyPresent}`)
  console.log(`Errors:            ${errors}`)
  console.log(`Existing DB rows:  UNTOUCHED`)
  console.log('─'.repeat(60))

  if (errors > 0) {
    console.log('\nSome batches failed. Re-run the script — it is safe to run multiple times.')
  }
}

main().catch(err => {
  console.error('\nFatal:', err)
  process.exit(1)
})
