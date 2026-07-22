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
    .select('battle_id,created_at,artist1_name,artist2_name,artist1_pool,artist2_pool,status,winner_decided')
    .eq('is_main_battle', true)
    .eq('is_test_battle', false)
    .eq('winner_decided', false)
    .order('created_at', { ascending: false })

  if (error) { console.error(error.message); process.exit(1) }

  console.log('MAIN BATTLES MISSING JUDGE + POLL DATA')
  console.log('='.repeat(72))
  for (const b of (data ?? [])) {
    const date = new Date(b.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'America/New_York' })
    const time = new Date(b.created_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/New_York' })
    const a1p = (b.artist1_pool ?? 0).toFixed(4)
    const a2p = (b.artist2_pool ?? 0).toFixed(4)
    const solWinner = (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0) ? b.artist1_name : b.artist2_name
    console.log(`#${b.battle_id}  ${date} ${time}  ${b.artist1_name} vs ${b.artist2_name}`)
    console.log(`       ${b.artist1_name}: ${a1p} SOL  |  ${b.artist2_name}: ${a2p} SOL  →  SOL winner: ${solWinner}`)
    console.log('')
  }
  console.log(`Total: ${data?.length ?? 0} battles need Poll + Judge data`)
}

main().catch(e => { console.error(e); process.exit(1) })
