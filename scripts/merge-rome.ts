import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'; import * as path from 'path'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const apply = process.argv.includes('--apply')

async function battleCount(wallet: string) {
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    sb.from('battles').select('battle_id', { count: 'exact', head: true }).eq('artist1_wallet', wallet).eq('is_test_battle', false),
    sb.from('battles').select('battle_id', { count: 'exact', head: true }).eq('artist2_wallet', wallet).eq('is_test_battle', false),
  ])
  return (c1 ?? 0) + (c2 ?? 0)
}

async function main() {
  // Find full addresses by prefix
  const { data: r1 } = await sb.from('battles').select('artist1_wallet').ilike('artist1_name', '%rome%').eq('is_test_battle', false).limit(50)
  const { data: r2 } = await sb.from('battles').select('artist2_wallet').ilike('artist2_name', '%rome%').eq('is_test_battle', false).limit(50)
  const wallets = new Set<string>()
  for (const r of r1 ?? []) if (r.artist1_wallet) wallets.add(r.artist1_wallet)
  for (const r of r2 ?? []) if (r.artist2_wallet) wallets.add(r.artist2_wallet)

  console.log('Wallets found for "rome":')
  const counts: { wallet: string; count: number }[] = []
  for (const w of wallets) {
    const c = await battleCount(w)
    counts.push({ wallet: w, count: c })
    console.log(`  ${w.slice(0,8)}…${w.slice(-4)}  ${c} battles`)
  }

  if (!apply) { console.log('\nRe-run with --apply to merge.'); return }

  // Primary = wallet with more battles
  counts.sort((a, b) => b.count - a.count)
  const primary = counts[0].wallet
  const secondaries = counts.slice(1).map(c => c.wallet)

  const { data, error } = await sb.from('artist_profiles')
    .insert({ display_name: 'Rome', primary_wallet: primary })
    .select('artist_id').single()
  if (error) { console.log('Create failed:', error.message); return }
  const profileId = data.artist_id
  console.log(`\n✓ Created profile ${profileId} → "Rome" (primary: ${primary.slice(0,8)}…${primary.slice(-4)})`)

  for (const w of secondaries) {
    const { error: e } = await sb.from('artist_wallets')
      .upsert({ wallet_address: w, artist_id: profileId }, { onConflict: 'wallet_address' })
    console.log(e ? `✗ Link ${w.slice(0,8)}… failed: ${e.message}` : `✓ Linked ${w.slice(0,8)}…${w.slice(-4)}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
