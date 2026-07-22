import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'; import * as path from 'path'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  // ── Rome: find actual wallets by name ────────────────────────────────────────
  console.log('\n▶  ROME — wallet lookup by name:')
  const { data: r1 } = await sb.from('battles').select('artist1_wallet,artist1_name').ilike('artist1_name', 'rome').eq('is_test_battle', false)
  const { data: r2 } = await sb.from('battles').select('artist2_wallet,artist2_name').ilike('artist2_name', 'rome').eq('is_test_battle', false)
  const romeWallets = new Map<string, string>()
  for (const r of r1 ?? []) if (r.artist1_wallet) romeWallets.set(r.artist1_wallet, r.artist1_name)
  for (const r of r2 ?? []) if (r.artist2_wallet) romeWallets.set(r.artist2_wallet, r.artist2_name)
  for (const [w, name] of romeWallets) {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      sb.from('battles').select('*', { count: 'exact', head: true }).eq('artist1_wallet', w).eq('is_test_battle', false),
      sb.from('battles').select('*', { count: 'exact', head: true }).eq('artist2_wallet', w).eq('is_test_battle', false),
    ])
    const { data: aw } = await sb.from('artist_wallets').select('artist_id').eq('wallet_address', w).maybeSingle()
    const { data: ap } = await sb.from('artist_profiles').select('artist_id,display_name').eq('primary_wallet', w).maybeSingle()
    const ref = ap ? `PRIMARY profile: ${ap.display_name}` : aw ? `linked→${aw.artist_id.slice(0,8)}` : 'UNLINKED'
    console.log(`  ${w}  (${(c1??0)+(c2??0)} battles)  [${ref}]  name: "${name}"`)
  }

  // ── Cannon Jones: what are those 9 main battles? ─────────────────────────────
  console.log('\n▶  CANNON JONES secondary wallets — main battle details:')
  for (const w of ['CnzrNEu9JFS95fsbMGvkbNLzEKbDazQ6RiTXkrwbbBZw', 'EsZTCLNnTzvma5rJArHvQsuoUtxoRiZTuTgng3nNxW6s']) {
    const { data: a1 } = await sb.from('battles')
      .select('battle_id,artist1_name,artist2_name,is_main_battle,event_subtype,winner_decided,created_at')
      .eq('artist1_wallet', w).eq('is_test_battle', false).order('created_at', { ascending: false })
    const { data: a2 } = await sb.from('battles')
      .select('battle_id,artist1_name,artist2_name,is_main_battle,event_subtype,winner_decided,created_at')
      .eq('artist2_wallet', w).eq('is_test_battle', false).order('created_at', { ascending: false })
    console.log(`\n  Wallet ${w.slice(0,8)}…${w.slice(-4)}:`)
    for (const b of [...(a1??[]), ...(a2??[])]) {
      const d = new Date(b.created_at).toLocaleDateString()
      console.log(`    #${b.battle_id} ${b.artist1_name} vs ${b.artist2_name}  main:${b.is_main_battle} subtype:${b.event_subtype} judged:${b.winner_decided} (${d})`)
    }
  }
}
main().catch(console.error)
