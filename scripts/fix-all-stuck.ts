import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  // All judged battles still in any "live" state (ACTIVE, Active, or any non-terminal status)
  const { data } = await sb
    .from('battles')
    .select('battle_id,status,artist1_name,artist2_name')
    .eq('winner_decided', true)
    .eq('is_test_battle', false)
    .not('status', 'in', '("COMPLETED","SETTLED","ENDED")')

  console.log(`Judged battles with non-completed status: ${data?.length ?? 0}`)
  for (const b of data ?? []) {
    console.log(`  #${b.battle_id}  [${b.status}]  ${b.artist1_name} vs ${b.artist2_name}`)
  }

  if (!data?.length) return

  const ids = data.map(b => b.battle_id)
  const { error } = await sb.from('battles').update({ status: 'COMPLETED' }).in('battle_id', ids)
  console.log(error ? `✗ ${error.message}` : `✓ Marked ${ids.length} battle(s) as COMPLETED`)
}
main().catch(console.error)
