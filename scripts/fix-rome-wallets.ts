import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'; import * as path from 'path'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const PROFILE_ID       = '507c9989-8e62-4e8a-94c2-1a2b42229362'
const CORRECT_PRIMARY  = '7a6BrTcHq21CNgY6okuYyCJczTctJnqv1zUSRAjNqNAJ'  // rank 13, 3 battles
const CORRECT_SECONDARY = 'EyGR6ptNoBjbLCT53uu6eN1UAYzTDaQtpBFWmMxQ4TMU' // rank 39, 3 battles

async function main() {
  // 1. Set correct primary wallet
  const { error: e1 } = await sb.from('artist_profiles')
    .update({ primary_wallet: CORRECT_PRIMARY })
    .eq('artist_id', PROFILE_ID)
  console.log(e1 ? `✗ Primary update: ${e1.message}` : `✓ Primary → ${CORRECT_PRIMARY.slice(0,8)}…${CORRECT_PRIMARY.slice(-4)}`)

  // 2. Link correct secondary wallet
  const { error: e2 } = await sb.from('artist_wallets')
    .upsert({ wallet_address: CORRECT_SECONDARY, artist_id: PROFILE_ID }, { onConflict: 'wallet_address' })
  console.log(e2 ? `✗ Link secondary: ${e2.message}` : `✓ Linked ${CORRECT_SECONDARY.slice(0,8)}…${CORRECT_SECONDARY.slice(-4)}`)

  // 3. Remove wrong entries from artist_wallets (the bad addresses from the first merge attempt)
  const wrongWallets = [
    'EyGR6ptNFJVyb7NpnkLhKz3vGPMJCqCiWFsXcnHH4TMU',  // wrong secondary (0 battles)
  ]
  for (const w of wrongWallets) {
    const { error: e3 } = await sb.from('artist_wallets').delete().eq('wallet_address', w)
    console.log(e3 ? `✗ Remove ${w.slice(0,8)}: ${e3.message}` : `✓ Removed wrong entry ${w.slice(0,8)}…${w.slice(-4)}`)
  }

  console.log('\nRome merge corrected.')
}
main().catch(err => { console.error(err); process.exit(1) })
