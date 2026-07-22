import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'; import * as path from 'path'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await sb
    .from('battles')
    .select('battle_id,artist1_name,artist2_name,artist1_wallet,artist2_wallet,is_main_battle,is_community_battle,is_quick_battle,is_test_battle,event_subtype,winner_decided,winner_artist_a,status,created_at')
    .or('artist1_name.ilike.%dcoop%,artist2_name.ilike.%dcoop%')
    .order('created_at', { ascending: false })

  console.log(`Found ${data?.length ?? 0} battles for DCOOP:\n`)
  for (const b of data ?? []) {
    console.log(`#${b.battle_id}  ${b.artist1_name} vs ${b.artist2_name}`)
    console.log(`  main:${b.is_main_battle}  community:${b.is_community_battle}  quick:${b.is_quick_battle}  test:${b.is_test_battle}`)
    console.log(`  subtype:${b.event_subtype}  winner_decided:${b.winner_decided}  winner_a:${b.winner_artist_a}  status:${b.status}`)
    console.log(`  a1_wallet:${b.artist1_wallet}  a2_wallet:${b.artist2_wallet}`)
    console.log()
  }
}
main().catch(console.error)
