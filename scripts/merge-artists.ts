/**
 * WaveWarz Artist Profile Merge Tool
 *
 * Merges duplicate artist entries into single profiles.
 * Uses exact wallet addresses identified from the leaderboard.
 *
 * Run:
 *   npx tsx scripts/merge-artists.ts          (dry run — shows what would change)
 *   npx tsx scripts/merge-artists.ts --apply   (writes to DB)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) { console.error('Missing .env.local'); process.exit(1) }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env vars'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const apply    = process.argv.includes('--apply')

// ── Merge Definitions ─────────────────────────────────────────────────────────
// primaryWallet: the canonical wallet for this artist (will be set on artist_profiles)
// secondaryWallets: additional wallets to link via artist_wallets table
type MergeGroup = {
  displayName: string
  primaryWallet: string
  secondaryWallets: string[]
}

const MERGES: MergeGroup[] = [
  {
    // Three separate entries on leaderboard — all Cannon Jones 973
    displayName: 'Cannon Jones 973',
    primaryWallet:    'D3FVLnnzTZnff7xdsfdpNmeALhNnDa3hhmJaaXHjWePD',   // "Cannon Jones973" — 95 battles (most established)
    secondaryWallets: [
      'CnzrNEu9JFS95fsbMGvkbNLzEKbDazQ6RiTXkrwbbBZw',                   // "CANNON JONES"
      'EsZTCLNnTzvma5rJArHvQsuoUtxoRiZTuTgng3nNxW6s',                   // "CANNON JONES"
    ],
  },
  {
    // The Tech → name change → Chill Sample Hub
    displayName: 'Chill Sample Hub',
    primaryWallet:    'Bx1o7mkirgPigHwAxVQaypoRHtL6JNdLHmcrzpfyk12f',   // current brand name
    secondaryWallets: [
      '8qXrvREdA1whuqmLiuW7h9ZhiRCrkWpZqKUs97ss68M1',                   // old name "The Tech"
    ],
  },
  {
    // Hurric4n3Ike — three leaderboard entries (founder)
    displayName: 'Hurric4n3Ike',
    primaryWallet:    '62g5hYiSTqj185F26c3pT6EPx4Gs1P6gL72kGNzvkbjM',   // "Hurric4n3Ike" — 95 battles (main wallet)
    secondaryWallets: [
      '4g2wDCUN1WcsMRd2czDSVhxgk5eCLH4CpVLk3thfv5rG',                   // "RaWavez x Hurric4n3Ike"
      '9RbUvEftkY9Q7teDaCYjGs1w5n7318GUaJ1KdLDCQM1B',                   // "StretchWavez x Hurric4n3Ike"
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBattleCount(wallet: string): Promise<number> {
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    supabase.from('battles').select('battle_id', { count: 'exact', head: true }).eq('artist1_wallet', wallet).eq('is_test_battle', false),
    supabase.from('battles').select('battle_id', { count: 'exact', head: true }).eq('artist2_wallet', wallet).eq('is_test_battle', false),
  ])
  return (c1 ?? 0) + (c2 ?? 0)
}

async function getExistingProfile(wallet: string): Promise<{ id: string; displayName: string } | null> {
  const { data: p } = await supabase
    .from('artist_profiles')
    .select('artist_id,display_name')
    .eq('primary_wallet', wallet)
    .maybeSingle()
  if (p) return { id: p.artist_id, displayName: p.display_name }

  const { data: aw } = await supabase
    .from('artist_wallets')
    .select('artist_id')
    .eq('wallet_address', wallet)
    .maybeSingle()
  if (aw?.artist_id) {
    const { data: prof } = await supabase
      .from('artist_profiles')
      .select('artist_id,display_name')
      .eq('artist_id', aw.artist_id)
      .single()
    if (prof) return { id: prof.artist_id, displayName: prof.display_name }
  }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('─'.repeat(70))
  console.log('WaveWarz Artist Merge Tool')
  if (!apply) console.log('DRY RUN — run with --apply to write changes')
  console.log('─'.repeat(70))

  for (const group of MERGES) {
    const allWallets = [group.primaryWallet, ...group.secondaryWallets]
    console.log(`\n▶  ${group.displayName}`)

    // Show battle counts + any existing profiles
    for (const w of allWallets) {
      const count = await getBattleCount(w)
      const existing = await getExistingProfile(w)
      const tag = existing ? ` [profile: ${existing.displayName}]` : ''
      const isPrimary = w === group.primaryWallet ? ' (PRIMARY)' : ''
      console.log(`   ${w.slice(0, 8)}…${w.slice(-4)}  ${count} battles${isPrimary}${tag}`)
    }

    if (!apply) continue

    // ── APPLY ──

    // Check if any wallet already has a profile — reuse that profile ID
    let profileId: string | null = null
    for (const w of allWallets) {
      const existing = await getExistingProfile(w)
      if (existing) { profileId = existing.id; break }
    }

    if (profileId) {
      const { error } = await supabase
        .from('artist_profiles')
        .update({ display_name: group.displayName, primary_wallet: group.primaryWallet })
        .eq('artist_id', profileId)
      if (error) { console.log(`   ✗ Update failed: ${error.message}`); continue }
      console.log(`   ✓ Updated profile ${profileId} → "${group.displayName}"`)
    } else {
      const { data, error } = await supabase
        .from('artist_profiles')
        .insert({ display_name: group.displayName, primary_wallet: group.primaryWallet })
        .select('artist_id')
        .single()
      if (error) { console.log(`   ✗ Create failed: ${error.message}`); continue }
      profileId = data.artist_id
      console.log(`   ✓ Created profile ${profileId} → "${group.displayName}"`)
    }

    // Link all secondary wallets
    for (const w of group.secondaryWallets) {
      const { error } = await supabase
        .from('artist_wallets')
        .upsert({ wallet_address: w, artist_id: profileId }, { onConflict: 'wallet_address' })
      if (error) {
        console.log(`   ✗ Link ${w.slice(0, 8)}…${w.slice(-4)} failed: ${error.message}`)
      } else {
        console.log(`   ✓ Linked ${w.slice(0, 8)}…${w.slice(-4)}`)
      }
    }
  }

  console.log('\n' + '─'.repeat(70))
  if (!apply) {
    console.log('Re-run with --apply to execute.\n')
  } else {
    console.log('Done. Leaderboard will reflect merged profiles on next page load.\n')
  }
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
