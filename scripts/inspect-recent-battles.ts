/**
 * Inspect recent Quick Battles — show all columns with values
 * to spot any new columns coming in via webhook
 *
 * Run: npx tsx scripts/inspect-recent-battles.ts
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Fetch last 20 quick battles from Friday March 13
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('is_quick_battle', true)
    .gte('created_at', '2026-03-13T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) { console.error('Error:', error.message); process.exit(1) }
  if (!data?.length) { console.log('No quick battles found from Friday'); return }

  console.log(`Found ${data.length} quick battles from Friday\n`)

  // Show all column names with non-null values across all rows
  const allCols = Object.keys(data[0])
  console.log('ALL COLUMNS IN TABLE:')
  console.log(allCols.join('\n'))

  console.log('\n─'.repeat(60))
  console.log('SAMPLE ROW (most recent):')
  const sample = data[0]
  for (const [k, v] of Object.entries(sample)) {
    if (v !== null && v !== undefined && v !== '') {
      console.log(`  ${k.padEnd(30)} = ${JSON.stringify(v)}`)
    }
  }

  // Show any columns that have values we might not expect
  console.log('\n─'.repeat(60))
  console.log('COLUMNS WITH NON-NULL VALUES (any row):')
  const populatedCols = new Set<string>()
  for (const row of data) {
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== undefined && v !== '') populatedCols.add(k)
    }
  }
  console.log([...populatedCols].join(', '))
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
