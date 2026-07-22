import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq > 0) process.env[t.slice(0,eq).trim()] = t.slice(eq+1).trim()
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data, error } = await sb.from('battles')
    .select('battle_id,created_at,artist1_name,artist2_name,dj_wavy_winner,poll_winner,quick_battles_overall_winner,quick_battles_winner_decided,winner_decided,winner_artist_a')
    .eq('is_quick_battle', true)
    .gt('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) { console.error(error.message); process.exit(1) }
  if (!data?.length) { console.log('No QB battles in last 24h'); return }

  for (const b of data) {
    const t = new Date(b.created_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/New_York' })
    console.log(`#${b.battle_id} ${t}  ${b.artist1_name} vs ${b.artist2_name}`)
    console.log(`  dj_wavy_winner:               ${b.dj_wavy_winner ?? 'NULL'}`)
    console.log(`  poll_winner:                  ${b.poll_winner ?? 'NULL'}`)
    console.log(`  quick_battles_overall_winner: ${b.quick_battles_overall_winner ?? 'NULL'}`)
    console.log(`  quick_battles_winner_decided: ${b.quick_battles_winner_decided ?? 'NULL'}`)
    console.log(`  winner_decided: ${b.winner_decided}  |  winner_artist_a: ${b.winner_artist_a}`)
    console.log('')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
