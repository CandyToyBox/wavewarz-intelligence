/**
 * Fixes battles that are winner_decided=true but still status='ACTIVE'.
 * Sets status to 'COMPLETED' so they stop showing as LIVE.
 *
 * npx tsx scripts/fix-stuck-active.ts          (dry run)
 * npx tsx scripts/fix-stuck-active.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'; import * as path from 'path'

const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb    = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const apply = process.argv.includes('--apply')

async function main() {
  const { data, error } = await sb
    .from('battles')
    .select('battle_id,artist1_name,artist2_name,created_at')
    .eq('status', 'ACTIVE')
    .eq('winner_decided', true)
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })

  if (error) { console.error('Query failed:', error.message); process.exit(1) }

  console.log(`Found ${data?.length ?? 0} battle(s) stuck as ACTIVE with winner_decided=true:\n`)
  for (const b of data ?? []) {
    console.log(`  #${b.battle_id}  ${b.artist1_name} vs ${b.artist2_name}  (${new Date(b.created_at).toLocaleDateString()})`)
  }

  if (!data?.length) { console.log('Nothing to fix.'); return }
  if (!apply) { console.log('\nRe-run with --apply to set status → COMPLETED'); return }

  const ids = data.map(b => b.battle_id)
  const { error: updateErr } = await sb
    .from('battles')
    .update({ status: 'COMPLETED' })
    .in('battle_id', ids)

  if (updateErr) { console.error('Update failed:', updateErr.message); process.exit(1) }
  console.log(`\n✓ Marked ${ids.length} battle(s) as COMPLETED — LIVE badge will no longer show.`)
}

main().catch(err => { console.error(err); process.exit(1) })
