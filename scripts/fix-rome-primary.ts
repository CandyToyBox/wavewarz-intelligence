import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'; import * as path from 'path'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  // Swap primary to rank-13 wallet and link rank-39 as secondary
  const primaryWallet   = '7a6BrTcHiGHmpE1iSiL7PygXbPxhQRhCEqMqfH7bqNAJ'  // rank 13
  const secondaryWallet = 'EyGR6ptNFJVyb7NpnkLhKz3vGPMJCqCiWFsXcnHH4TMU'  // rank 39

  const { error: e1 } = await sb.from('artist_profiles')
    .update({ primary_wallet: primaryWallet })
    .eq('artist_id', '507c9989-8e62-4e8a-94c2-1a2b42229362')
  if (e1) { console.log('Update failed:', e1.message); return }

  // Move old primary to artist_wallets
  const { error: e2 } = await sb.from('artist_wallets')
    .upsert({ wallet_address: secondaryWallet, artist_id: '507c9989-8e62-4e8a-94c2-1a2b42229362' }, { onConflict: 'wallet_address' })
  if (e2) { console.log('Link failed:', e2.message); return }

  // Remove new primary from artist_wallets if it was there
  await sb.from('artist_wallets').delete().eq('wallet_address', primaryWallet)

  console.log(`✓ Primary → ${primaryWallet.slice(0,8)}…${primaryWallet.slice(-4)} (rank 13)`)
  console.log(`✓ Secondary → ${secondaryWallet.slice(0,8)}…${secondaryWallet.slice(-4)} (rank 39)`)
}
main().catch(err => { console.error(err); process.exit(1) })
