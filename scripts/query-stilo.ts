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
  const { data } = await sb
    .from('battles')
    .select('battle_id,created_at,artist1_name,artist1_wallet,artist2_name,artist2_wallet,is_main_battle,is_quick_battle,event_subtype,winner_decided,status')
    .or('artist1_name.ilike.%stilo%,artist2_name.ilike.%stilo%')
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })

  console.log('All STILO* battles:')
  console.log('='.repeat(80))
  const wallets = new Map<string, string>()
  for (const b of data ?? []) {
    const date = new Date(b.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'America/New_York' })
    const type = b.is_main_battle ? `MAIN(${b.event_subtype ?? 'standard'})` : b.is_quick_battle ? 'QUICK' : '?'
    const judged = b.winner_decided ? 'JUDGED' : 'PENDING'
    // track which names map to which wallets
    if (b.artist1_name?.toLowerCase().includes('stilo')) wallets.set(b.artist1_name, b.artist1_wallet)
    if (b.artist2_name?.toLowerCase().includes('stilo')) wallets.set(b.artist2_name, b.artist2_wallet)
    console.log(`#${b.battle_id}  ${date}  [${type}][${judged}]  ${b.artist1_name} vs ${b.artist2_name}`)
  }
  console.log('\nName → Wallet mapping:')
  for (const [name, wallet] of wallets) {
    console.log(`  "${name}" → ${wallet}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
