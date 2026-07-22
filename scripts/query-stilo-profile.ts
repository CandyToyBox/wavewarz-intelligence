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

const STILO_WALLETS = [
  'BVtreDeDWXNkkRWNLEEUKBCG4hauDmQnxcoVCBRJ1C4e', // STILOWORLD
  '9LLTjsWhYJBxFgca43MQtrLLsPcxWMR86NoxAHGsBUCk', // STILO
]

async function main() {
  // Check artist_profiles
  const { data: profiles } = await sb
    .from('artist_profiles')
    .select('*')
    .or(STILO_WALLETS.map(w => `primary_wallet.eq.${w}`).join(','))
  console.log('artist_profiles:', JSON.stringify(profiles, null, 2))

  // Check artist_wallets
  const { data: wallets } = await sb
    .from('artist_wallets')
    .select('*')
    .in('wallet_address', STILO_WALLETS)
  console.log('\nartist_wallets:', JSON.stringify(wallets, null, 2))

  // Check all columns on artist_profiles table (to see what fields exist)
  const { data: sample } = await sb.from('artist_profiles').select('*').limit(1)
  if (sample?.[0]) console.log('\nartist_profiles columns:', Object.keys(sample[0]))
}

main().catch(e => { console.error(e); process.exit(1) })
