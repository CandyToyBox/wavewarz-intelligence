import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'; import * as path from 'path'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CANNON_WALLETS = [
  'D3FVLnnzTZnff7xdsfdpNmeALhNnDa3hhmJaaXHjWePD',
  'CnzrNEu9JFS95fsbMGvkbNLzEKbDazQ6RiTXkrwbbBZw',
  'EsZTCLNnTzvma5rJArHvQsuoUtxoRiZTuTgng3nNxW6s',
]

async function main() {
  // Get all main battles across all 3 wallets
  const seen = new Set<number>()
  const battles: any[] = []
  for (const w of CANNON_WALLETS) {
    for (const side of ['artist1_wallet', 'artist2_wallet'] as const) {
      const { data } = await sb.from('battles').select('battle_id,artist1_name,artist1_wallet,artist2_name,artist2_wallet,winner_artist_a,winner_decided,created_at').eq(side, w).eq('is_main_battle', true).eq('is_test_battle', false)
      for (const b of data ?? []) {
        if (!seen.has(b.battle_id)) { seen.add(b.battle_id); battles.push(b) }
      }
    }
  }
  battles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  console.log(`Main battles for Cannon Jones (${battles.length} total):\n`)
  for (const b of battles) {
    const a1IsCannon = CANNON_WALLETS.includes(b.artist1_wallet)
    const a2IsCannon = CANNON_WALLETS.includes(b.artist2_wallet)
    const flag = a1IsCannon && a2IsCannon ? '  ⚠ BOTH SIDES ARE CANNON' : ''
    const date = new Date(b.created_at).toLocaleDateString()
    console.log(`#${b.battle_id} ${b.artist1_name} [${b.artist1_wallet?.slice(0,8)}] vs ${b.artist2_name} [${b.artist2_wallet?.slice(0,8)}] (${date}) judged:${b.winner_decided}${flag}`)
  }
}
main().catch(console.error)
