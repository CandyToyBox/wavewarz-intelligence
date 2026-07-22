/**
 * Marks battles for community-only artists as is_community_battle = true
 * so they stop appearing on the Artist Leaderboard (main events only).
 *
 * Run:
 *   npx tsx scripts/fix-community-battles.ts          (dry run)
 *   npx tsx scripts/fix-community-battles.ts --apply   (writes to DB)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) {
  const eq = l.indexOf('=')
  if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim()
}

const sb    = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const apply = process.argv.includes('--apply')

// Wallet prefixes from screenshots → resolved to full addresses via dry-run lookup below
// Nova: F9edcG…e4Gj | LilBonez: FVJNJm…9cbP | V.D.O.: DLC6qH…1pJ9 | Emoji: EDYGtb…qEBx
const ARTIST_NAMES = ['Nova', 'LilBonez', 'V.D.O.', 'Emoji', 'VDO', 'V.D.O']

async function main() {
  console.log('─'.repeat(70))
  console.log('Fix Community Battles')
  if (!apply) console.log('DRY RUN — run with --apply to write changes')
  console.log('─'.repeat(70))

  // Find all non-test, non-quick battles for these artists by name
  const battleIds = new Set<number>()
  const found: { battle_id: number; a1: string; a2: string; type: string }[] = []

  for (const name of ARTIST_NAMES) {
    // artist1 side
    const { data: a1 } = await sb
      .from('battles')
      .select('battle_id,artist1_name,artist2_name,is_community_battle,is_quick_battle,is_main_battle,is_test_battle')
      .ilike('artist1_name', `%${name}%`)
      .eq('is_test_battle', false)
      .eq('is_quick_battle', false)

    for (const b of a1 ?? []) {
      if (!battleIds.has(b.battle_id)) {
        battleIds.add(b.battle_id)
        found.push({
          battle_id: b.battle_id,
          a1: b.artist1_name,
          a2: b.artist2_name,
          type: b.is_community_battle ? 'community' : b.is_quick_battle ? 'quick' : 'main',
        })
      }
    }

    // artist2 side
    const { data: a2 } = await sb
      .from('battles')
      .select('battle_id,artist1_name,artist2_name,is_community_battle,is_quick_battle,is_main_battle,is_test_battle')
      .ilike('artist2_name', `%${name}%`)
      .eq('is_test_battle', false)
      .eq('is_quick_battle', false)

    for (const b of a2 ?? []) {
      if (!battleIds.has(b.battle_id)) {
        battleIds.add(b.battle_id)
        found.push({
          battle_id: b.battle_id,
          a1: b.artist1_name,
          a2: b.artist2_name,
          type: b.is_community_battle ? 'community' : b.is_quick_battle ? 'quick' : 'main',
        })
      }
    }
  }

  if (found.length === 0) {
    console.log('\nNo battles found.')
    return
  }

  // Group by current type
  const needsFix = found.filter(b => b.type !== 'community')
  const alreadyOk = found.filter(b => b.type === 'community')

  console.log(`\nFound ${found.length} battle(s) total`)
  if (alreadyOk.length) console.log(`  ${alreadyOk.length} already marked community — skipping`)
  console.log(`  ${needsFix.length} need to be marked community:\n`)

  for (const b of needsFix) {
    console.log(`  #${b.battle_id}  ${b.a1} vs ${b.a2}  [currently: ${b.type}]`)
  }

  if (!apply || needsFix.length === 0) return

  // Update in one batch
  const ids = needsFix.map(b => b.battle_id)
  const { error } = await sb
    .from('battles')
    .update({ is_community_battle: true })
    .in('battle_id', ids)

  if (error) {
    console.log(`\n✗ Update failed: ${error.message}`)
  } else {
    console.log(`\n✓ Marked ${ids.length} battle(s) as is_community_battle = true`)
    console.log('  These artists will no longer appear on the Artist Leaderboard.')
  }
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
