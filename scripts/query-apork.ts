import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data, error } = await sb
    .from('battles')
    .select('battle_id,created_at,artist1_name,artist2_name,artist1_pool,artist2_pool,status,winner_decided,winner_artist_a,is_main_battle,is_quick_battle,is_community_battle,is_test_battle')
    .or('artist1_name.ilike.%apork%,artist2_name.ilike.%apork%,artist1_name.ilike.%wiz%,artist2_name.ilike.%wiz%')
    .order('created_at', { ascending: false })

  if (error) { console.error(error.message); process.exit(1) }

  console.log('Aporkalypse / Wiz battles:')
  console.log('='.repeat(72))
  for (const b of (data ?? [])) {
    const date = new Date(b.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'America/New_York' })
    const type = b.is_main_battle ? 'MAIN' : b.is_quick_battle ? 'QUICK' : b.is_community_battle ? 'COMMUNITY' : '?'
    const judged = b.winner_decided ? `JUDGED (winner_artist_a=${b.winner_artist_a})` : 'NOT JUDGED'
    console.log(`#${b.battle_id}  ${date}  ${b.artist1_name} vs ${b.artist2_name}  [${type}]  ${judged}  status:${b.status}`)
  }
  console.log(`\nTotal: ${data?.length ?? 0}`)
}

main().catch(e => { console.error(e); process.exit(1) })
